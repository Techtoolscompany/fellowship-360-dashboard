import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { graceCalls, graceSessions } from "@/db/schema";
import { inngest } from "@/lib/inngest/client";
import {
  INNGEST_EVENTS,
  buildMissedCallRecoveryIdempotencyKey,
} from "@/lib/inngest/events";
import { getOrCreateGraceSession, runGraceMessage } from "@/lib/grace/runtime";
import { graceFlags } from "@/lib/grace/flags";
import { rateLimitKeyed, verifyWebhookSignature } from "@/lib/grace/channels/webhooks";
import { resolveProviderWebhookSecret } from "@/lib/grace/providers/resolver";

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

  const [existingCall] = payload.callId
    ? await db
        .select()
        .from(graceCalls)
        .where(and(eq(graceCalls.organizationId, payload.organizationId), eq(graceCalls.externalCallId, payload.callId)))
        .limit(1)
    : [];

  if (existingCall) {
    await db
      .update(graceCalls)
      .set({
        transcriptText: payload.transcript ?? existingCall.transcriptText,
        recordingUrl: payload.recordingUrl ?? existingCall.recordingUrl,
        endedAt: payload.endedAt ? new Date(payload.endedAt) : existingCall.endedAt,
      })
      .where(eq(graceCalls.id, existingCall.id));
  } else {
    await db.insert(graceCalls).values({
      organizationId: payload.organizationId,
      sessionId: session.id,
      externalCallId: payload.callId ?? null,
      fromNumber: payload.from ?? null,
      toNumber: payload.to ?? null,
      startedAt: payload.startedAt ? new Date(payload.startedAt) : new Date(),
      endedAt: payload.endedAt ? new Date(payload.endedAt) : null,
      recordingUrl: payload.recordingUrl ?? null,
      transcriptText: payload.transcript ?? null,
    });
  }

  let assistantResponse = "";
  let actionOutcomes: Awaited<ReturnType<typeof runGraceMessage>>["actionOutcomes"] = [];
  const normalizedTranscript = payload.transcript?.trim() ?? "";

  if (normalizedTranscript.length > 0) {
    const result = await runGraceMessage({
      organizationId: payload.organizationId,
      channel: "voice_public",
      actorType: "public",
      sessionId: session.id,
      message: normalizedTranscript,
    });
    assistantResponse = result.response;
    actionOutcomes = result.actionOutcomes;

    await db
      .update(graceSessions)
      .set({ finalSummary: result.response, updatedAt: new Date() })
      .where(eq(graceSessions.id, session.id));
  } else if (payload.endedAt) {
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
    response: assistantResponse,
    actionOutcomes,
  });
}
