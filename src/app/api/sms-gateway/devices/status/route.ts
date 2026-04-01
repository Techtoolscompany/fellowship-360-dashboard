import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { smsMessages } from "@/db/schema/sms-gateway";
import { trackDittofeedSmsStatus } from "@/lib/dittofeed/sms";
import { mergeSmsGatewayStatusJson } from "@/lib/sms-gateway/client-contract";
import {
  resolveSmsGatewayDeviceRequestAuth,
  SmsGatewayAuthError,
} from "@/lib/sms-gateway/auth";
import { updateSmsGatewayDevicePresence } from "@/lib/sms-gateway/devices";

const statusSchema = z.object({
  deviceId: z.string().trim().optional().nullable(),
  messageId: z.string().min(1),
  status: z.enum(["sent", "delivered", "failed"]),
  errorMessage: z.string().trim().optional().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const body = statusSchema.parse(await req.json());
    const { device } = await resolveSmsGatewayDeviceRequestAuth({
      req,
      deviceId: body.deviceId,
    });

    await updateSmsGatewayDevicePresence({ deviceId: device.id });

    const [existing] = await db
      .select()
      .from(smsMessages)
      .where(eq(smsMessages.id, body.messageId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (existing.deviceId && existing.deviceId !== device.id) {
      return NextResponse.json(
        { error: `Message ${body.messageId} does not belong to this device` },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = { status: body.status };
    if (body.status === "sent") updateData.sentAt = new Date();
    if (body.status === "delivered") {
      updateData.sentAt = existing.sentAt ?? new Date();
      updateData.deliveredAt = new Date();
    }
    if (body.errorMessage) {
      updateData.metadataJson = {
        ...(existing.metadataJson ?? {}),
        deliveryError: body.errorMessage,
      };
    }

    const [updated] = await db
      .update(smsMessages)
      .set(updateData as never)
      .where(eq(smsMessages.id, body.messageId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    await updateSmsGatewayDevicePresence({
      deviceId: device.id,
      statusJson: mergeSmsGatewayStatusJson(device.statusJson, {
        lastDeliveryStatus: body.status,
        lastDeliveryStatusAt: new Date().toISOString(),
        lastDeliveryError: body.status === "failed" ? body.errorMessage ?? "Delivery failed" : null,
        lastDeliveryErrorAt:
          body.status === "failed" ? new Date().toISOString() : null,
      }),
    });

    try {
      await trackDittofeedSmsStatus(updated);
    } catch (error) {
      console.error("[SMS Gateway] Failed to sync Dittofeed SMS status:", error);
    }

    return NextResponse.json({ message: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid delivery status payload" }, { status: 400 });
    }

    const status = error instanceof SmsGatewayAuthError ? error.status : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process delivery status" },
      { status }
    );
  }
}
