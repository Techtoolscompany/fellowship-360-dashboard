import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqualString } from "@/lib/security/compare";
import {
  queueOutboundSmsMessages,
  SmsGatewayError,
} from "@/lib/sms-gateway/queue-outbound";

/**
 * POST /api/sms-gateway/send — Queue outbound SMS
 * Internal route: called by GRACE/Inngest functions, not exposed to churches.
 * Resolves the org's assigned device → sends via FCM push to that Android phone.
 */
export async function POST(req: NextRequest) {
  // Internal auth: require API key for internal service calls
  const apiKey = req.headers.get("x-api-key");
  if (!timingSafeEqualString(apiKey, process.env.SMS_GATEWAY_API_KEY)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { organizationId, recipients, message, idempotencyKey, metadataJson } = body;

  if (!organizationId || !recipients?.length || !message) {
    return NextResponse.json(
      { error: "organizationId, recipients, and message are required" },
      { status: 400 }
    );
  }

  try {
    const { device, messages } = await queueOutboundSmsMessages({
      organizationId,
      recipients,
      message,
      idempotencyKey,
      metadataJson,
    });

    return NextResponse.json({
      queued: messages.length,
      deviceId: device.id,
      messageIds: messages.map((queuedMessage) => queuedMessage.id),
    });
  } catch (error) {
    if (error instanceof SmsGatewayError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("[SMS Gateway] Failed to queue outbound SMS:", error);
    return NextResponse.json(
      { error: "Failed to queue SMS messages" },
      { status: 500 }
    );
  }
}
