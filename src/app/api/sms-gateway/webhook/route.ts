import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { smsMessages } from "@/db/schema/sms-gateway";
import { trackDittofeedSmsStatus } from "@/lib/dittofeed/sms";
import {
  resolveSmsGatewayDeviceRequestAuth,
  SmsGatewayAuthError,
} from "@/lib/sms-gateway/auth";
import { updateSmsGatewayDevicePresence } from "@/lib/sms-gateway/devices";

const statusItemSchema = z.object({
  messageId: z.string().min(1),
  status: z.enum(["sent", "delivered", "failed"]),
  error: z.string().trim().optional().nullable(),
  metadataJson: z.record(z.string(), z.unknown()).optional(),
});

const webhookSchema = z
  .object({
    deviceId: z.string().trim().optional().nullable(),
    messageId: z.string().trim().optional().nullable(),
    status: z.enum(["sent", "delivered", "failed"]).optional(),
    error: z.string().trim().optional().nullable(),
    metadataJson: z.record(z.string(), z.unknown()).optional(),
    events: z.array(statusItemSchema).min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.events && (!value.messageId || !value.status)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "messageId and status are required when events is not provided",
      });
    }
  });

/**
 * POST /api/sms-gateway/webhook — Delivery status updates from Android app
 * Auth: device token or legacy gateway API key
 * Updates message status to sent/delivered/failed.
 */
export async function POST(req: NextRequest) {
  try {
    const body = webhookSchema.parse(await req.json());
    const { device } = await resolveSmsGatewayDeviceRequestAuth({
      req,
      deviceId: body.deviceId,
    });

    const events = body.events ?? [
      {
        messageId: body.messageId!,
        status: body.status!,
        error: body.error,
        metadataJson: body.metadataJson,
      },
    ];

    await updateSmsGatewayDevicePresence({ deviceId: device.id });

    const updatedMessages = [];

    for (const event of events) {
      const [existing] = await db
        .select()
        .from(smsMessages)
        .where(eq(smsMessages.id, event.messageId))
        .limit(1);

      if (!existing) {
        continue;
      }

      if (existing.deviceId && existing.deviceId !== device.id) {
        return NextResponse.json(
          { error: `Message ${event.messageId} does not belong to this device` },
          { status: 403 }
        );
      }

      const updateData: Record<string, unknown> = { status: event.status };
      if (event.status === "sent") updateData.sentAt = new Date();
      if (event.status === "delivered") {
        updateData.sentAt = existing.sentAt ?? new Date();
        updateData.deliveredAt = new Date();
      }
      if (event.error || event.metadataJson) {
        updateData.metadataJson = {
          ...(existing.metadataJson ?? {}),
          ...(event.metadataJson ?? {}),
          ...(event.error ? { deliveryError: event.error } : {}),
        };
      }

      const [updated] = await db
        .update(smsMessages)
        .set(updateData as never)
        .where(eq(smsMessages.id, event.messageId))
        .returning();

      if (!updated) {
        continue;
      }

      updatedMessages.push(updated);

      try {
        await trackDittofeedSmsStatus(updated);
      } catch (error) {
        console.error("[SMS Gateway] Failed to sync Dittofeed SMS status:", error);
      }
    }

    if (updatedMessages.length === 0) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: updatedMessages[0],
      messages: updatedMessages,
    });
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
