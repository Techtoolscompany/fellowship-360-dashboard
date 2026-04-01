import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { graceMessages } from "@/db/schema";
import { getOrCreateGraceSession, runGraceMessage } from "@/lib/grace/runtime";
import { graceFlags } from "@/lib/grace/flags";
import { rateLimitKeyed, verifyWebhookSignature } from "@/lib/grace/channels/webhooks";
import { processServiceAssignmentSmsReply } from "@/app/actions/operations";
import { resolveProviderWebhookSecret } from "@/lib/grace/providers/resolver";
import { getClientIp } from "@/lib/security/request";

export async function POST(req: NextRequest) {
  if (!graceFlags.enabled || !graceFlags.publicChannelsEnabled) {
    return NextResponse.json({ error: "GRACE public channels are disabled" }, { status: 503 });
  }

  const rawBody = await req.text();
  let payload: {
    organizationId?: string;
    sessionId?: string;
    messageId?: string;
    from?: string;
    message?: string;
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
    channel: "sms",
    provider: "textbee",
    fallbackEnvSecret: process.env.TEXTBEE_WEBHOOK_SECRET,
  });
  const validSignature = verifyWebhookSignature(rawBody, signature, webhookSecret ?? undefined);
  if (!validSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const key = `${getClientIp(req)}:sms`;
  if (!(await rateLimitKeyed(key, 240, 60_000))) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  if (!payload.message) {
    return NextResponse.json(
      { error: "message is required" },
      { status: 400 }
    );
  }

  const session = await getOrCreateGraceSession({
    organizationId: payload.organizationId,
    channel: "sms_public",
    actorType: "public",
    sessionId: payload.sessionId,
  });

  if (payload.messageId) {
    const [existingMessage] = await db
      .select()
      .from(graceMessages)
      .where(
        and(
          eq(graceMessages.organizationId, payload.organizationId),
          eq(graceMessages.providerMessageId, payload.messageId)
        )
      )
      .limit(1);

    if (existingMessage) {
      return NextResponse.json({ ok: true, deduplicated: true });
    }
  }

  await db.insert(graceMessages).values({
    organizationId: payload.organizationId,
    sessionId: session.id,
    direction: "inbound",
    channel: "sms_public",
    messageText: payload.message,
    providerMessageId: payload.messageId ?? null,
  });

  if (payload.from) {
    const assignmentReply = await processServiceAssignmentSmsReply({
      organizationId: payload.organizationId,
      fromPhone: payload.from,
      message: payload.message,
    });

    if (assignmentReply.handled) {
      return NextResponse.json({
        ok: true,
        assignmentReply: true,
        sessionId: session.id,
        assignmentId: assignmentReply.assignmentId,
        assignmentStatus: assignmentReply.assignmentStatus,
      });
    }
  }

  const result = await runGraceMessage({
    organizationId: payload.organizationId,
    channel: "sms_public",
    actorType: "public",
    message: payload.message,
    sessionId: session.id,
  });

  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    response: result.response,
    proposedActions: result.proposedActions,
    actionOutcomes: result.actionOutcomes,
  });
}
