import { db } from "@/db";
import { smsDevices, smsMessages } from "@/db/schema/sms-gateway";
import { and, eq, inArray } from "drizzle-orm";
import { sendFcmPush } from "./fcm";

export class SmsGatewayError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SmsGatewayError";
    this.status = status;
  }
}

function uniqueRecipients(recipients: string[]) {
  return Array.from(
    new Set(
      recipients
        .map((recipient) => recipient.trim())
        .filter((recipient) => recipient.length > 0)
    )
  );
}

export async function queueOutboundSmsMessages(params: {
  organizationId: string;
  recipients: string[];
  message: string;
  idempotencyKey?: string;
  metadataJson?: Record<string, unknown>;
}) {
  const recipients = uniqueRecipients(params.recipients);
  const message = params.message.trim();

  if (!params.organizationId || recipients.length === 0 || !message) {
    throw new SmsGatewayError(
      400,
      "organizationId, recipients, and message are required"
    );
  }

  const [device] = await db
    .select()
    .from(smsDevices)
    .where(
      and(
        eq(smsDevices.organizationId, params.organizationId),
        eq(smsDevices.isActive, true)
      )
    )
    .limit(1);

  if (!device) {
    throw new SmsGatewayError(
      422,
      "No active SMS device assigned to this organization"
    );
  }

  let messages;
  const metadataJson =
    params.idempotencyKey || params.metadataJson
      ? {
          ...(params.metadataJson ?? {}),
          ...(params.idempotencyKey
            ? { idempotencyKey: params.idempotencyKey }
            : {}),
        }
      : undefined;

  if (params.idempotencyKey) {
    await db
      .insert(smsMessages)
      .values(
        recipients.map((recipient) => ({
          organizationId: params.organizationId,
          deviceId: device.id,
          direction: "outbound" as const,
          fromNumber: device.phoneNumber,
          toNumber: recipient,
          body: message,
          status: "queued" as const,
          idempotencyKey: params.idempotencyKey,
          ...(metadataJson ? { metadataJson } : {}),
        }))
      )
      .onConflictDoNothing({
        target: [
          smsMessages.organizationId,
          smsMessages.direction,
          smsMessages.idempotencyKey,
          smsMessages.toNumber,
        ],
      });

    messages = await db
      .select()
      .from(smsMessages)
      .where(
        and(
          eq(smsMessages.organizationId, params.organizationId),
          eq(smsMessages.direction, "outbound"),
          eq(smsMessages.idempotencyKey, params.idempotencyKey),
          inArray(smsMessages.toNumber, recipients)
        )
      );
  } else {
    messages = await db
      .insert(smsMessages)
      .values(
        recipients.map((recipient) => ({
          organizationId: params.organizationId,
          deviceId: device.id,
          direction: "outbound" as const,
          fromNumber: device.phoneNumber,
          toNumber: recipient,
          body: message,
          status: "queued" as const,
          ...(metadataJson ? { metadataJson } : {}),
        }))
      )
      .returning();
  }

  if (device.fcmToken) {
    const queuedMessages = messages.filter(
      (queuedMessage) => queuedMessage.status === "queued"
    );

    try {
      if (queuedMessages.length > 0) {
        await sendFcmPush(device.fcmToken, {
          type: "SEND_SMS",
          messages: queuedMessages.map((queuedMessage) => ({
            id: queuedMessage.id,
            to: queuedMessage.toNumber,
            body: queuedMessage.body,
          })),
        });
      }
    } catch (error) {
      console.error("[SMS Gateway] FCM push failed:", error);
    }
  }

  return {
    device,
    messages,
  };
}
