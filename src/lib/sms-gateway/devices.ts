import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { smsDevices, smsMessages } from "@/db/schema/sms-gateway";

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function updateSmsGatewayDevicePresence(params: {
  deviceId: string;
  deviceName?: string | null;
  phoneNumber?: string | null;
  fcmToken?: string | null;
  statusJson?: Record<string, unknown> | null;
}) {
  const now = new Date();
  const [device] = await db
    .update(smsDevices)
    .set({
      ...(params.deviceName !== undefined
        ? { deviceName: normalizeText(params.deviceName) ?? "Fellowship 360 Gateway" }
        : {}),
      ...(params.phoneNumber !== undefined
        ? { phoneNumber: normalizeText(params.phoneNumber) }
        : {}),
      ...(params.fcmToken !== undefined
        ? { fcmToken: normalizeText(params.fcmToken) }
        : {}),
      ...(params.statusJson !== undefined ? { statusJson: params.statusJson } : {}),
      authTokenLastUsedAt: now,
      lastSeenAt: now,
      updatedAt: now,
    })
    .where(eq(smsDevices.id, params.deviceId))
    .returning();

  return device ?? null;
}

export async function loadQueuedSmsMessagesForDevice(params: {
  deviceId: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 200);

  return db
    .select({
      id: smsMessages.id,
      to: smsMessages.toNumber,
      body: smsMessages.body,
      createdAt: smsMessages.createdAt,
      idempotencyKey: smsMessages.idempotencyKey,
      metadataJson: smsMessages.metadataJson,
    })
    .from(smsMessages)
    .where(
      and(eq(smsMessages.deviceId, params.deviceId), eq(smsMessages.status, "queued"))
    )
    .orderBy(asc(smsMessages.createdAt))
    .limit(limit);
}
