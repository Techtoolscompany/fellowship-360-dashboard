import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { graceMessages } from "@/db/schema";
import { getOrCreateGraceSession, runGraceMessage } from "@/lib/grace/runtime";
import { graceFlags } from "@/lib/grace/flags";
import { rateLimitKeyed, verifyWebhookSignature } from "@/lib/grace/channels/webhooks";

export async function POST(req: NextRequest) {
  if (!graceFlags.enabled || !graceFlags.publicChannelsEnabled) {
    return NextResponse.json({ error: "GRACE public channels are disabled" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-grace-signature");
  const validSignature = verifyWebhookSignature(rawBody, signature, process.env.TEXTBEE_WEBHOOK_SECRET);
  if (!validSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const key = `${req.headers.get("x-forwarded-for") || "unknown"}:sms`;
  if (!rateLimitKeyed(key, 240, 60_000)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const payload = JSON.parse(rawBody) as {
    organizationId?: string;
    sessionId?: string;
    messageId?: string;
    from?: string;
    message?: string;
  };

  if (!payload.organizationId || !payload.message) {
    return NextResponse.json(
      { error: "organizationId and message are required" },
      { status: 400 }
    );
  }

  const session = await getOrCreateGraceSession({
    organizationId: payload.organizationId,
    channel: "sms",
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
    channel: "sms",
    messageText: payload.message,
    providerMessageId: payload.messageId ?? null,
  });

  const result = await runGraceMessage({
    organizationId: payload.organizationId,
    channel: "sms",
    message: payload.message,
    sessionId: session.id,
  });

  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    response: result.response,
    proposedActions: result.proposedActions,
  });
}
