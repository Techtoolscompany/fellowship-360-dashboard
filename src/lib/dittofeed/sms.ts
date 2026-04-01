import { db } from "@/db";
import { smsMessages } from "@/db/schema/sms-gateway";
import { and, desc, eq } from "drizzle-orm";
import { trackDittofeedEvent } from "./client";
import { resolveDittofeedProviderForOrganization } from "./provider";

export const DITTOFEED_SMS_EVENTS = {
  queued: "ChurchSmsQueued",
  sent: "ChurchSmsSent",
  delivered: "ChurchSmsDelivered",
  failed: "ChurchSmsFailed",
  replied: "ChurchSmsReplied",
} as const;

export type DittofeedSmsMessageMetadata = {
  source: "dittofeed";
  workspaceId: string;
  messageId?: string | null;
  journeyId?: string | null;
  nodeId?: string | null;
  userId?: string | null;
  runId?: string | null;
  templateId?: string | null;
  channel?: string | null;
};

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhoneForComparison(value: string | null | undefined) {
  return (value ?? "").replace(/\D+/g, "");
}

export function buildDittofeedSmsMetadata(
  input: Omit<DittofeedSmsMessageMetadata, "source">
): DittofeedSmsMessageMetadata {
  return {
    source: "dittofeed",
    workspaceId: input.workspaceId,
    messageId: input.messageId ?? null,
    journeyId: input.journeyId ?? null,
    nodeId: input.nodeId ?? null,
    userId: input.userId ?? null,
    runId: input.runId ?? null,
    templateId: input.templateId ?? null,
    channel: input.channel ?? null,
  };
}

export function getDittofeedSmsMetadata(
  value: unknown
): DittofeedSmsMessageMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.source !== "dittofeed") return null;

  const workspaceId = getString(record.workspaceId);
  if (!workspaceId) return null;

  return {
    source: "dittofeed",
    workspaceId,
    messageId: getString(record.messageId),
    journeyId: getString(record.journeyId),
    nodeId: getString(record.nodeId),
    userId: getString(record.userId),
    runId: getString(record.runId),
    templateId: getString(record.templateId),
    channel: getString(record.channel),
  };
}

async function sendDittofeedSmsTrackEvent(params: {
  organizationId: string;
  metadata: DittofeedSmsMessageMetadata;
  event: string;
  messageId: string;
  properties: Record<string, unknown>;
}) {
  if (!params.metadata.userId) return false;

  const provider = await resolveDittofeedProviderForOrganization(params.organizationId);
  if (!provider?.writeKey) return false;

  await trackDittofeedEvent({
    baseUrl: provider.baseUrl,
    writeKey: provider.writeKey,
    userId: params.metadata.userId,
    event: params.event,
    messageId: params.messageId,
    properties: {
      workspaceId: params.metadata.workspaceId,
      journeyId: params.metadata.journeyId,
      nodeId: params.metadata.nodeId,
      templateId: params.metadata.templateId,
      dittofeedMessageId: params.metadata.messageId,
      ...params.properties,
    },
  });

  return true;
}

export async function trackDittofeedSmsQueued(
  message: typeof smsMessages.$inferSelect
) {
  const metadata = getDittofeedSmsMetadata(message.metadataJson);
  if (!metadata) return false;

  return sendDittofeedSmsTrackEvent({
    organizationId: message.organizationId,
    metadata,
    event: DITTOFEED_SMS_EVENTS.queued,
    messageId: `dittofeed-sms-queued-${message.id}`,
    properties: {
      gatewayMessageId: message.id,
      phone: message.toNumber,
      transport: "custom_sms_gateway",
      gatewayStatus: message.status,
    },
  });
}

export async function trackDittofeedSmsStatus(
  message: typeof smsMessages.$inferSelect
) {
  const metadata = getDittofeedSmsMetadata(message.metadataJson);
  if (!metadata) return false;

  const event =
    message.status === "sent"
      ? DITTOFEED_SMS_EVENTS.sent
      : message.status === "delivered"
        ? DITTOFEED_SMS_EVENTS.delivered
        : message.status === "failed"
          ? DITTOFEED_SMS_EVENTS.failed
          : null;

  if (!event) return false;

  return sendDittofeedSmsTrackEvent({
    organizationId: message.organizationId,
    metadata,
    event,
    messageId: `dittofeed-sms-status-${message.id}-${message.status}`,
    properties: {
      gatewayMessageId: message.id,
      phone: message.toNumber,
      gatewayStatus: message.status,
      sentAt: message.sentAt?.toISOString() ?? null,
      deliveredAt: message.deliveredAt?.toISOString() ?? null,
      transport: "custom_sms_gateway",
    },
  });
}

export async function trackDittofeedSmsReply(params: {
  organizationId: string;
  fromNumber: string;
  toNumber?: string | null;
  body: string;
  inboundMessageId: string;
}) {
  const outboundMessages = await db
    .select()
    .from(smsMessages)
    .where(
      and(
        eq(smsMessages.organizationId, params.organizationId),
        eq(smsMessages.direction, "outbound")
      )
    )
    .orderBy(desc(smsMessages.createdAt))
    .limit(50);

  const matchingMessage = outboundMessages.find((candidate) => {
    const metadata = getDittofeedSmsMetadata(candidate.metadataJson);
    if (!metadata) return false;
    return (
      normalizePhoneForComparison(candidate.toNumber) ===
      normalizePhoneForComparison(params.fromNumber)
    );
  });

  if (!matchingMessage) return false;

  const metadata = getDittofeedSmsMetadata(matchingMessage.metadataJson);
  if (!metadata) return false;

  return sendDittofeedSmsTrackEvent({
    organizationId: params.organizationId,
    metadata,
    event: DITTOFEED_SMS_EVENTS.replied,
    messageId: `dittofeed-sms-replied-${params.inboundMessageId}`,
    properties: {
      gatewayMessageId: params.inboundMessageId,
      inReplyToGatewayMessageId: matchingMessage.id,
      inReplyToDittofeedMessageId: metadata.messageId,
      phone: params.fromNumber,
      replyTo: params.toNumber ?? null,
      body: params.body,
      transport: "custom_sms_gateway",
    },
  });
}
