import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { smsMessages } from "@/db/schema/sms-gateway";
import { trackDittofeedSmsReply } from "@/lib/dittofeed/sms";
import { handleInboundGraceSms } from "@/lib/grace/channels/sms/inbound";
import {
  resolveSmsGatewayDeviceRequestAuth,
  SmsGatewayAuthError,
} from "@/lib/sms-gateway/auth";
import { updateSmsGatewayDevicePresence } from "@/lib/sms-gateway/devices";

const inboundSchema = z.object({
  deviceId: z.string().trim().optional().nullable(),
  fromNumber: z.string().trim().min(1),
  toNumber: z.string().trim().optional().nullable(),
  body: z.string().min(1),
  receivedAt: z.string().datetime().optional(),
  metadataJson: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/sms-gateway/inbound — Receive inbound SMS from Android app
 * Auth: device token or legacy gateway API key
 * Creates message record and runs the live GRACE SMS reply loop.
 */
export async function POST(req: NextRequest) {
  try {
    const body = inboundSchema.parse(await req.json());
    const { device } = await resolveSmsGatewayDeviceRequestAuth({
      req,
      deviceId: body.deviceId,
    });

    if (!device.organizationId) {
      return NextResponse.json(
        { error: "Device not found or not assigned to an organization" },
        { status: 422 }
      );
    }

    await updateSmsGatewayDevicePresence({ deviceId: device.id });

    const deliveredAt = body.receivedAt ? new Date(body.receivedAt) : new Date();
    const [message] = await db
      .insert(smsMessages)
      .values({
        organizationId: device.organizationId,
        deviceId: device.id,
        direction: "inbound",
        fromNumber: body.fromNumber,
        toNumber: body.toNumber || device.phoneNumber,
        body: body.body,
        status: "delivered",
        deliveredAt,
        metadataJson: {
          source: "sms_gateway_device",
          ...(body.metadataJson ?? {}),
        },
      })
      .returning({ id: smsMessages.id });

    const result = await handleInboundGraceSms({
      organizationId: device.organizationId,
      fromNumber: body.fromNumber,
      toNumber: body.toNumber || device.phoneNumber,
      message: body.body,
      smsGatewayMessageId: message.id,
      source: "sms_gateway_device",
    });

    try {
      await trackDittofeedSmsReply({
        organizationId: device.organizationId,
        fromNumber: body.fromNumber,
        toNumber: body.toNumber || device.phoneNumber,
        body: body.body,
        inboundMessageId: message.id,
      });
    } catch (error) {
      console.error("[SMS Gateway] Failed to sync Dittofeed SMS reply:", error);
    }

    return NextResponse.json({
      organizationId: device.organizationId,
      message,
      grace: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid inbound payload" }, { status: 400 });
    }

    const status = error instanceof SmsGatewayAuthError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process inbound SMS" },
      { status }
    );
  }
}
