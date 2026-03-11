import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import {
  graceCalls,
  graceSessions,
  graceHandoffs,
  conversations,
  messages,
} from "@/db/schema";
import { inngest } from "@/lib/inngest/client";
import {
  INNGEST_EVENTS,
  buildMissedCallRecoveryIdempotencyKey,
} from "@/lib/inngest/events";
import { getOrCreateGraceSession, runGraceMessage } from "@/lib/grace/runtime";
import { graceFlags } from "@/lib/grace/flags";
import { rateLimitKeyed, verifyWebhookSignature } from "@/lib/grace/channels/webhooks";
import { resolveProviderWebhookSecret } from "@/lib/grace/providers/resolver";

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function deriveDurationSeconds(params: {
  startedAt: Date | null;
  endedAt: Date | null;
  incomingDurationSec?: number | null;
  existingDurationSec?: number | null;
}) {
  if (
    typeof params.incomingDurationSec === "number" &&
    Number.isFinite(params.incomingDurationSec)
  ) {
    return Math.max(0, Math.floor(params.incomingDurationSec));
  }
  if (params.startedAt && params.endedAt) {
    return Math.max(
      0,
      Math.floor((params.endedAt.getTime() - params.startedAt.getTime()) / 1000)
    );
  }
  return params.existingDurationSec ?? null;
}

function summarizeCall(params: {
  payloadSummary?: string;
  assistantResponse?: string;
  transcript?: string;
}) {
  const fromPayload = params.payloadSummary?.trim();
  if (fromPayload) return fromPayload.slice(0, 400);
  const fromAssistant = params.assistantResponse?.trim();
  if (fromAssistant) return fromAssistant.slice(0, 400);
  const fromTranscript = params.transcript?.trim();
  if (fromTranscript) return fromTranscript.slice(0, 400);
  return null;
}

async function getOrCreatePhoneConversation(params: {
  organizationId: string;
  contactId: string | null;
  fromNumber: string | null;
  toNumber: string | null;
}) {
  if (params.contactId) {
    const [existingByContact] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, params.organizationId),
          eq(conversations.channel, "phone"),
          eq(conversations.contactId, params.contactId)
        )
      )
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
      .limit(1);

    if (existingByContact) {
      return existingByContact.id;
    }
  }

  if (params.fromNumber) {
    const [existingBySubject] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, params.organizationId),
          eq(conversations.channel, "phone"),
          ilike(conversations.subject, `%${params.fromNumber}%`)
        )
      )
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
      .limit(1);

    if (existingBySubject) {
      return existingBySubject.id;
    }
  }

  const [created] = await db
    .insert(conversations)
    .values({
      organizationId: params.organizationId,
      contactId: params.contactId,
      channel: "phone",
      status: "open",
      subject: `Voice call ${params.fromNumber ?? "Unknown caller"} → ${params.toNumber ?? "Church line"}`,
      lastMessageAt: new Date(),
    })
    .returning({ id: conversations.id });

  return created.id;
}

async function insertConversationMessageIfNew(params: {
  conversationId: string;
  content: string;
  direction: "inbound" | "outbound";
  senderType: "human" | "ai" | "system";
}) {
  const normalized = params.content.trim();
  if (!normalized) return;

  const [latestSimilar] = await db
    .select({
      id: messages.id,
      content: messages.content,
      direction: messages.direction,
    })
    .from(messages)
    .where(eq(messages.conversationId, params.conversationId))
    .orderBy(desc(messages.sentAt))
    .limit(1);

  if (
    latestSimilar &&
    latestSimilar.direction === params.direction &&
    latestSimilar.content.trim() === normalized
  ) {
    return;
  }

  await db.insert(messages).values({
    conversationId: params.conversationId,
    content: normalized,
    direction: params.direction,
    senderType: params.senderType,
  });
}

async function ensureOpenHandoff(params: {
  organizationId: string;
  sessionId: string;
  contactId: string | null;
  reason: string;
  summaryText: string | null;
  metadataJson?: Record<string, unknown>;
}) {
  const [existing] = await db
    .select({ id: graceHandoffs.id })
    .from(graceHandoffs)
    .where(
      and(
        eq(graceHandoffs.organizationId, params.organizationId),
        eq(graceHandoffs.sessionId, params.sessionId),
        eq(graceHandoffs.status, "open")
      )
    )
    .limit(1);

  if (existing) return existing.id;

  const [created] = await db
    .insert(graceHandoffs)
    .values({
      organizationId: params.organizationId,
      sessionId: params.sessionId,
      contactId: params.contactId,
      actorType: "system",
      reason: params.reason,
      summaryText: params.summaryText,
      assignedTeam: "pastoral_care",
      status: "open",
      metadataJson: params.metadataJson ?? {},
    })
    .returning({ id: graceHandoffs.id });

  return created.id;
}

export async function POST(req: NextRequest) {
  if (!graceFlags.enabled || !graceFlags.publicChannelsEnabled) {
    return NextResponse.json({ error: "GRACE public channels are disabled" }, { status: 503 });
  }

  const rawBody = await req.text();
  let payload: {
    organizationId?: string;
    sessionId?: string;
    callId?: string;
    from?: string;
    to?: string;
    transcript?: string;
    summary?: string;
    intent?: string;
    outcome?: string;
    durationSec?: number;
    recordingUrl?: string;
    startedAt?: string;
    endedAt?: string;
  };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload.organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  const signature = req.headers.get("x-grace-signature");
  const webhookSecret = await resolveProviderWebhookSecret({
    organizationId: payload.organizationId,
    channel: "voice",
    provider: "retell",
    fallbackEnvSecret: process.env.RETELL_WEBHOOK_SECRET,
  });
  const validSignature = verifyWebhookSignature(rawBody, signature, webhookSecret ?? undefined);
  if (!validSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const key = `${req.headers.get("x-forwarded-for") || "unknown"}:voice`;
  if (!(await rateLimitKeyed(key, 120, 60_000))) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const session = await getOrCreateGraceSession({
    organizationId: payload.organizationId,
    channel: "voice_public",
    actorType: "public",
    sessionId: payload.sessionId,
  });

  const startedAt = parseDate(payload.startedAt);
  const endedAt = parseDate(payload.endedAt);

  const [existingCall] = payload.callId
    ? await db
        .select()
        .from(graceCalls)
        .where(and(eq(graceCalls.organizationId, payload.organizationId), eq(graceCalls.externalCallId, payload.callId)))
        .limit(1)
    : await db
        .select()
        .from(graceCalls)
        .where(
          and(
            eq(graceCalls.organizationId, payload.organizationId),
            eq(graceCalls.sessionId, session.id)
          )
        )
        .orderBy(desc(graceCalls.createdAt))
        .limit(1)
  ;

  const nextDurationSec = deriveDurationSeconds({
    startedAt: startedAt ?? existingCall?.startedAt ?? null,
    endedAt: endedAt ?? existingCall?.endedAt ?? null,
    incomingDurationSec: payload.durationSec,
    existingDurationSec: existingCall?.durationSec ?? null,
  });

  const [callRecord] = existingCall
    ? await db
        .update(graceCalls)
        .set({
          transcriptText: payload.transcript ?? existingCall.transcriptText,
          summaryText: payload.summary?.trim() || existingCall.summaryText,
          intent: payload.intent?.trim() || existingCall.intent,
          outcome: payload.outcome?.trim() || existingCall.outcome,
          recordingUrl: payload.recordingUrl ?? existingCall.recordingUrl,
          startedAt: startedAt ?? existingCall.startedAt,
          endedAt: endedAt ?? existingCall.endedAt,
          durationSec: nextDurationSec,
          fromNumber: payload.from ?? existingCall.fromNumber,
          toNumber: payload.to ?? existingCall.toNumber,
        })
        .where(eq(graceCalls.id, existingCall.id))
        .returning()
    : await db
        .insert(graceCalls)
        .values({
          organizationId: payload.organizationId,
          sessionId: session.id,
          contactId: session.contactId ?? session.matchedContactId ?? null,
          externalCallId: payload.callId ?? null,
          fromNumber: payload.from ?? null,
          toNumber: payload.to ?? null,
          startedAt: startedAt ?? new Date(),
          endedAt,
          durationSec: nextDurationSec,
          recordingUrl: payload.recordingUrl ?? null,
          transcriptText: payload.transcript ?? null,
          summaryText: payload.summary?.trim() || null,
          intent: payload.intent?.trim() || null,
          outcome: payload.outcome?.trim() || null,
        })
        .returning()
  ;

  if (!callRecord) {
    return NextResponse.json(
      { error: "Unable to persist call lifecycle record" },
      { status: 500 }
    );
  }

  let assistantResponse = "";
  let actionOutcomes: Awaited<ReturnType<typeof runGraceMessage>>["actionOutcomes"] = [];
  let linkedConversationId: string | null = null;
  const normalizedTranscript = payload.transcript?.trim() ?? "";
  const shouldProcessTranscript = normalizedTranscript.length > 0 && Boolean(payload.endedAt);

  if (shouldProcessTranscript) {
    const result = await runGraceMessage({
      organizationId: payload.organizationId,
      channel: "voice_public",
      actorType: "public",
      sessionId: session.id,
      message: normalizedTranscript,
    });
    assistantResponse = result.response;
    actionOutcomes = result.actionOutcomes;

    const [refreshedSession] = await db
      .select()
      .from(graceSessions)
      .where(eq(graceSessions.id, session.id))
      .limit(1);

    const resolvedContactId =
      refreshedSession?.contactId ??
      refreshedSession?.matchedContactId ??
      result.contactMatch?.contactId ??
      callRecord?.contactId ??
      null;

    linkedConversationId = await getOrCreatePhoneConversation({
      organizationId: payload.organizationId,
      contactId: resolvedContactId,
      fromNumber: payload.from ?? callRecord?.fromNumber ?? null,
      toNumber: payload.to ?? callRecord?.toNumber ?? null,
    });

    await insertConversationMessageIfNew({
      conversationId: linkedConversationId,
      content: normalizedTranscript,
      direction: "inbound",
      senderType: "human",
    });

    if (assistantResponse.trim()) {
      await insertConversationMessageIfNew({
        conversationId: linkedConversationId,
        content: assistantResponse,
        direction: "outbound",
        senderType: "ai",
      });
    }

    const escalatedByAction = actionOutcomes.some(
      (outcome) =>
        outcome.tool === "handoff.transfer" &&
        (outcome.status === "executed" || outcome.status === "queued")
    );
    const sessionEscalated = refreshedSession?.status === "escalated";
    const isEscalated = escalatedByAction || sessionEscalated;

    await db
      .update(conversations)
      .set({
        status: isEscalated ? "waiting" : "open",
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, linkedConversationId));

    const summary = summarizeCall({
      payloadSummary: payload.summary,
      assistantResponse,
      transcript: normalizedTranscript,
    });
    const intent =
      payload.intent?.trim() ||
      (typeof result.intent === "string" ? result.intent : null) ||
      callRecord.intent ||
      null;
    const outcome = payload.outcome?.trim() || (isEscalated ? "escalated" : "handled");

    await db
      .update(graceCalls)
      .set({
        contactId: resolvedContactId,
        summaryText: summary,
        intent,
        outcome,
        endedAt: endedAt ?? callRecord.endedAt,
        durationSec: deriveDurationSeconds({
          startedAt: callRecord.startedAt ?? startedAt,
          endedAt: endedAt ?? callRecord.endedAt,
          incomingDurationSec: payload.durationSec,
          existingDurationSec: callRecord.durationSec ?? null,
        }),
      })
      .where(eq(graceCalls.id, callRecord.id));

    if (isEscalated) {
      const reason = refreshedSession?.handoffReason || "voice_escalation";
      await ensureOpenHandoff({
        organizationId: payload.organizationId,
        sessionId: session.id,
        contactId: resolvedContactId,
        reason,
        summaryText: summary,
        metadataJson: {
          source: "voice_webhook",
          callRecordId: callRecord.id,
          externalCallId: payload.callId ?? null,
          conversationId: linkedConversationId,
        },
      });
    }
  } else if (payload.endedAt) {
    await db
      .update(graceCalls)
      .set({
        outcome: payload.outcome?.trim() || "missed_no_transcript",
        summaryText:
          payload.summary?.trim() ||
          "Missed call with no transcript. Recovery sequence queued.",
      })
      .where(eq(graceCalls.id, callRecord.id));

    const idempotencyKey = buildMissedCallRecoveryIdempotencyKey({
      organizationId: payload.organizationId,
      callId: payload.callId ?? null,
      sessionId: session.id,
      fromNumber: payload.from ?? null,
      endedAt: payload.endedAt,
    });

    try {
      await inngest.send({
        id: idempotencyKey,
        name: INNGEST_EVENTS.GRACE_MISSED_CALL_RECOVERY_REQUESTED,
        data: {
          organizationId: payload.organizationId,
          sessionId: session.id,
          callId: payload.callId,
          fromNumber: payload.from,
          toNumber: payload.to,
          startedAt: payload.startedAt,
          endedAt: payload.endedAt,
          callRecordId: callRecord.id,
          idempotencyKey,
        },
      });
    } catch (error) {
      console.error("[Grace voice webhook] Failed to enqueue missed-call recovery sequence", {
        organizationId: payload.organizationId,
        sessionId: session.id,
        callId: payload.callId ?? null,
        error,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    callRecordId: callRecord.id,
    linkedConversationId,
    response: assistantResponse,
    actionOutcomes,
  });
}
