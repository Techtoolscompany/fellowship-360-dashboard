import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema/organization";
import { smsDevices } from "@/db/schema/sms-gateway";

type SmsGatewayDeviceRecord = typeof smsDevices.$inferSelect;

type SmsGatewayPendingMessage = {
  id: string;
  to: string | null;
  body: string;
};

function getStatusRecord(
  statusJson: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  return statusJson && typeof statusJson === "object" ? statusJson : {};
}

function getBooleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function getNumberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function getOrganizationName(organizationId: string | null | undefined) {
  if (!organizationId) return null;

  const [organization] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return organization?.name ?? null;
}

export async function serializeSmsGatewayClientDevice(
  device: SmsGatewayDeviceRecord,
  authToken?: string | null
) {
  const status = getStatusRecord(device.statusJson);

  return {
    deviceId: device.id,
    deviceAuthToken: authToken ?? null,
    organizationId: device.organizationId,
    organizationName: await getOrganizationName(device.organizationId),
    gatewayEnabled: getBooleanValue(status.gatewayEnabled) ?? device.isActive,
    receiveSmsEnabled: getBooleanValue(status.receiveSmsEnabled) ?? false,
    preferredSim: getNumberValue(status.preferredSim),
  };
}

export function mergeSmsGatewayStatusJson(
  currentStatusJson: Record<string, unknown> | null | undefined,
  patch: Record<string, unknown>
) {
  const current = getStatusRecord(currentStatusJson);
  const next: Record<string, unknown> = { ...current };

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    next[key] = value;
  }

  return next;
}

export function serializeSmsGatewayPendingMessages(
  messages: SmsGatewayPendingMessage[]
) {
  return {
    messages: messages.map((message) => ({
      id: message.id,
      to: message.to ?? "",
      body: message.body,
    })),
  };
}
