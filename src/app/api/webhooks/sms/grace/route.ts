import { NextRequest, NextResponse } from "next/server";
import { graceFlags } from "@/lib/grace/flags";
import { rateLimitKeyed, verifyWebhookSignature } from "@/lib/grace/channels/webhooks";
import { handleInboundGraceSms } from "@/lib/grace/channels/sms/inbound";
import { resolveProviderWebhookSecret } from "@/lib/grace/providers/resolver";
import { getClientIp } from "@/lib/security/request";
import {
  getSmsGatewayWebhookSecretEnv,
  PRIMARY_SMS_GATEWAY_PROVIDER,
} from "@/lib/sms-gateway/provider";

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
    provider: PRIMARY_SMS_GATEWAY_PROVIDER,
    fallbackEnvSecret: getSmsGatewayWebhookSecretEnv() ?? undefined,
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

  const result = await handleInboundGraceSms({
    organizationId: payload.organizationId,
    message: payload.message,
    sessionId: payload.sessionId,
    providerMessageId: payload.messageId ?? null,
    fromNumber: payload.from ?? null,
    source: "fellowship_gateway_webhook",
  });

  return NextResponse.json(result);
}
