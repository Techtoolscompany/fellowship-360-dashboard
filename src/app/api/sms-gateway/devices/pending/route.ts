import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  resolveSmsGatewayDeviceRequestAuth,
  SmsGatewayAuthError,
} from "@/lib/sms-gateway/auth";
import {
  serializeSmsGatewayPendingMessages,
} from "@/lib/sms-gateway/client-contract";
import { loadQueuedSmsMessagesForDevice } from "@/lib/sms-gateway/devices";

const querySchema = z.object({
  deviceId: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = querySchema.parse({
      deviceId: searchParams.get("deviceId") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const { device } = await resolveSmsGatewayDeviceRequestAuth({
      req,
      deviceId: query.deviceId,
    });

    const messages = await loadQueuedSmsMessagesForDevice({
      deviceId: device.id,
      limit: query.limit,
    });

    return NextResponse.json(serializeSmsGatewayPendingMessages(messages));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid pending-message query" }, { status: 400 });
    }

    const status = error instanceof SmsGatewayAuthError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load pending messages" },
      { status }
    );
  }
}
