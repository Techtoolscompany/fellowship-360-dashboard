import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { graceCalls, graceSessions } from "@/db/schema";
import { getOrCreateGraceSession, runGraceMessage } from "@/lib/grace/runtime";
import { graceFlags } from "@/lib/grace/flags";
import { rateLimitKeyed, verifyWebhookSignature } from "@/lib/grace/channels/webhooks";

export async function POST(req: NextRequest) {
  if (!graceFlags.enabled || !graceFlags.publicChannelsEnabled) {
    return NextResponse.json({ error: "GRACE public channels are disabled" }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-grace-signature");
  const validSignature = verifyWebhookSignature(rawBody, signature, process.env.RETELL_WEBHOOK_SECRET);
  if (!validSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const key = `${req.headers.get("x-forwarded-for") || "unknown"}:voice`;
  if (!rateLimitKeyed(key, 120, 60_000)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const payload = JSON.parse(rawBody) as {
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

  if (!payload.organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  const session = await getOrCreateGraceSession({
    organizationId: payload.organizationId,
    channel: "voice",
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
  if (payload.transcript && payload.transcript.trim().length > 0) {
    const result = await runGraceMessage({
      organizationId: payload.organizationId,
      channel: "voice",
      sessionId: session.id,
      message: payload.transcript,
    });
    assistantResponse = result.response;

    await db
      .update(graceSessions)
      .set({ finalSummary: result.response, updatedAt: new Date() })
      .where(eq(graceSessions.id, session.id));
  }

  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    response: assistantResponse,
  });
}
