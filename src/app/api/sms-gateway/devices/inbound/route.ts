import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { smsMessages } from "@/db/schema/sms-gateway";
import { trackDittofeedSmsReply } from "@/lib/dittofeed/sms";
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
  receivedAtInMillis: z.number().int().nonnegative().optional(),
});

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

    const deliveredAt = body.receivedAtInMillis
      ? new Date(body.receivedAtInMillis)
      : new Date();

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
          receivedAtInMillis: body.receivedAtInMillis ?? deliveredAt.getTime(),
        },
      })
      .returning();

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

    try {
      const { inngest } = await import("@/lib/inngest/client");
      const {
        INNGEST_EVENTS,
        buildLeadReceivedIdempotencyKey,
      } = await import("@/lib/inngest/events");

      await inngest.send({
        id: buildLeadReceivedIdempotencyKey({
          organizationId: device.organizationId,
          contactEmail: body.fromNumber,
          message: body.body,
        }),
        name: INNGEST_EVENTS.GRACE_LEAD_RECEIVED,
        data: {
          organizationId: device.organizationId,
          contactName: body.fromNumber,
          contactEmail: body.fromNumber,
          message: body.body,
          idempotencyKey: `sms-inbound-${message.id}`,
        },
      });
    } catch (error) {
      console.error("[SMS Gateway] Failed to fire GRACE event for inbound SMS:", error);
    }

    return NextResponse.json({ message, organizationId: device.organizationId });
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
