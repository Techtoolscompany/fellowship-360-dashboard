"use server";

import { db } from "@/db";
import {
  conversations,
  messages,
  broadcasts,
  messageTemplates,
  churchContacts,
} from "@/db/schema";
import { eq, desc, and, sql, ne } from "drizzle-orm";
import { requireOrgMembership } from "./utils";

const CONVERSATION_STATUSES = ["open", "waiting", "resolved", "archived"] as const;
type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];
const CONVERSATION_STATUS_SET = new Set<string>(CONVERSATION_STATUSES);
const CONVERSATION_STATUS_TRANSITIONS: Record<ConversationStatus, Set<ConversationStatus>> = {
  open: new Set(["waiting", "resolved", "archived"]),
  waiting: new Set(["open", "resolved", "archived"]),
  resolved: new Set(["open", "archived"]),
  archived: new Set(["open"]),
};

function parseConversationStatus(status: string): ConversationStatus {
  if (!CONVERSATION_STATUS_SET.has(status)) {
    throw new Error(`Invalid conversation status: ${status}`);
  }
  return status as ConversationStatus;
}

async function requireConversationAccess(conversationId: string) {
  const [conversation] = await db
    .select({
      id: conversations.id,
      organizationId: conversations.organizationId,
      status: conversations.status,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conversation) throw new Error("Conversation not found");
  await requireOrgMembership(conversation.organizationId);
  return conversation;
}

async function requireBroadcastAccess(broadcastId: string) {
  const [broadcast] = await db
    .select()
    .from(broadcasts)
    .where(eq(broadcasts.id, broadcastId))
    .limit(1);
  if (!broadcast) throw new Error("Broadcast not found");
  await requireOrgMembership(broadcast.organizationId);
  return broadcast;
}

async function requireTemplateAccess(templateId: string) {
  const [template] = await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.id, templateId))
    .limit(1);
  if (!template) throw new Error("Template not found");
  await requireOrgMembership(template.organizationId);
  return template;
}

// ── Conversations ──
export async function getConversations(
  orgId: string,
  filters?: { status?: string; includeArchived?: boolean }
) {
  await requireOrgMembership(orgId);

  if (filters?.status) {
    const status = parseConversationStatus(filters.status);
    return db
      .select({ conversation: conversations, contact: churchContacts })
      .from(conversations)
      .leftJoin(churchContacts, eq(conversations.contactId, churchContacts.id))
      .where(and(eq(conversations.organizationId, orgId), eq(conversations.status, status)))
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.updatedAt));
  }

  const query = db
    .select({ conversation: conversations, contact: churchContacts })
    .from(conversations)
    .leftJoin(churchContacts, eq(conversations.contactId, churchContacts.id));

  if (filters?.includeArchived) {
    return query
      .where(eq(conversations.organizationId, orgId))
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.updatedAt));
  }

  return query
    .where(and(eq(conversations.organizationId, orgId), ne(conversations.status, "archived")))
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.updatedAt));
}

export async function getConversationMessages(conversationId: string) {
  await requireConversationAccess(conversationId);
  return await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.sentAt);
}

export async function createConversation(data: {
  contactId?: string;
  channel: string;
  subject?: string;
  assigneeId?: string;
  organizationId: string;
}) {
  await requireOrgMembership(data.organizationId);
  const [conversation] = await db
    .insert(conversations)
    .values({
      contactId: data.contactId ?? null,
      channel: data.channel as any,
      subject: data.subject ?? null,
      assigneeId: data.assigneeId ?? null,
      organizationId: data.organizationId,
    })
    .returning();
  return conversation;
}

export async function addMessage(data: {
  conversationId: string;
  content: string;
  direction: string;
  senderType?: string;
  senderId?: string;
}) {
  const conversation = await requireConversationAccess(data.conversationId);
  const [message] = await db
    .insert(messages)
    .values({
      conversationId: data.conversationId,
      content: data.content,
      direction: data.direction as any,
      senderType: (data.senderType as any) ?? "human",
      senderId: data.senderId ?? null,
    })
    .returning();

  // Update conversation's last message timestamp
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, data.conversationId),
        eq(conversations.organizationId, conversation.organizationId)
      )
    );

  return message;
}

export async function updateConversationStatus(
  id: string,
  status: string
) {
  const nextStatus = parseConversationStatus(status);
  const existing = await requireConversationAccess(id);
  const currentStatus = parseConversationStatus(existing.status);
  if (currentStatus !== nextStatus) {
    const allowedNextStatuses = CONVERSATION_STATUS_TRANSITIONS[currentStatus];
    if (!allowedNextStatuses.has(nextStatus)) {
      throw new Error(
        `Cannot transition conversation from ${currentStatus} to ${nextStatus}`
      );
    }
  }

  const [conversation] = await db
    .update(conversations)
    .set({ status: nextStatus, updatedAt: new Date() } as any)
    .where(and(eq(conversations.id, id), eq(conversations.organizationId, existing.organizationId)))
    .returning();
  if (!conversation) {
    throw new Error("Conversation not found");
  }
  return conversation;
}

export async function markConversationWaiting(id: string) {
  return updateConversationStatus(id, "waiting");
}

export async function resolveConversation(id: string) {
  return updateConversationStatus(id, "resolved");
}

export async function archiveConversation(id: string) {
  return updateConversationStatus(id, "archived");
}

export async function reopenConversation(id: string) {
  return updateConversationStatus(id, "open");
}

// ── Broadcasts ──
export async function getBroadcasts(orgId: string) {
  await requireOrgMembership(orgId);
  return await db
    .select()
    .from(broadcasts)
    .where(eq(broadcasts.organizationId, orgId))
    .orderBy(desc(broadcasts.createdAt));
}

export async function createBroadcast(data: {
  title: string;
  content: string;
  channel: string;
  audienceFilter?: any;
  scheduledAt?: Date;
  organizationId: string;
}) {
  await requireOrgMembership(data.organizationId);
  const [broadcast] = await db
    .insert(broadcasts)
    .values({
      title: data.title,
      content: data.content,
      channel: data.channel as any,
      audienceFilter: data.audienceFilter ?? null,
      scheduledAt: data.scheduledAt ?? null,
      organizationId: data.organizationId,
    })
    .returning();
  return broadcast;
}

export async function updateBroadcast(
  id: string,
  data: Partial<{
    title: string;
    content: string;
    channel: string;
  }>
) {
  const existing = await requireBroadcastAccess(id);
  const [broadcast] = await db
    .update(broadcasts)
    .set({ ...data } as any)
    .where(and(eq(broadcasts.id, id), eq(broadcasts.organizationId, existing.organizationId)))
    .returning();

  if (!broadcast) {
    throw new Error("Broadcast not found");
  }

  return broadcast;
}

export async function updateBroadcastStatus(
  id: string,
  status: string,
  stats?: { totalRecipients?: number; totalDelivered?: number }
) {
  const existing = await requireBroadcastAccess(id);
  const [broadcast] = await db
    .update(broadcasts)
    .set({
      status: status as any,
      sentAt: status === "sent" ? new Date() : undefined,
      ...stats,
    } as any)
    .where(and(eq(broadcasts.id, id), eq(broadcasts.organizationId, existing.organizationId)))
    .returning();

  if (!broadcast) {
    throw new Error("Broadcast not found");
  }

  return broadcast;
}

export async function triggerBroadcast(id: string) {
  const broadcast = await requireBroadcastAccess(id);
  if (broadcast.channel !== "sms") {
    throw new Error("Only SMS broadcasts are supported in this demo.");
  }
  if (broadcast.status !== "draft" && broadcast.status !== "scheduled") {
    throw new Error("Only draft or scheduled broadcasts can be sent.");
  }

  const { inngest } = await import("@/lib/inngest/client");
  const {
    INNGEST_EVENTS,
    buildBroadcastSendIdempotencyKey,
  } = await import("@/lib/inngest/events");
  const idempotencyKey = buildBroadcastSendIdempotencyKey({
    organizationId: broadcast.organizationId,
    broadcastId: id,
  });

  await inngest.send({
    id: idempotencyKey,
    name: INNGEST_EVENTS.COMMUNICATIONS_BROADCAST_SEND_REQUESTED,
    data: {
      organizationId: broadcast.organizationId,
      broadcastId: id,
      idempotencyKey,
    },
  });

  return broadcast;
}

export async function deleteBroadcast(id: string) {
  const existing = await requireBroadcastAccess(id);
  const [broadcast] = await db
    .delete(broadcasts)
    .where(and(eq(broadcasts.id, id), eq(broadcasts.organizationId, existing.organizationId)))
    .returning();

  if (!broadcast) {
    throw new Error("Broadcast not found");
  }

  return broadcast;
}

// ── Templates ──
export async function getTemplates(orgId: string) {
  await requireOrgMembership(orgId);
  return await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.organizationId, orgId))
    .orderBy(messageTemplates.name);
}

export async function createTemplate(data: {
  name: string;
  content: string;
  category?: string;
  channel?: string;
  variables?: string[];
  organizationId: string;
}) {
  await requireOrgMembership(data.organizationId);
  const [template] = await db
    .insert(messageTemplates)
    .values({
      name: data.name,
      content: data.content,
      category: data.category ?? null,
      channel: (data.channel as any) ?? null,
      variables: data.variables ?? null,
      organizationId: data.organizationId,
    })
    .returning();
  return template;
}

export async function updateTemplate(
  id: string,
  data: Partial<{
    name: string;
    content: string;
    category: string | null;
    channel: string | null;
    variables: string[] | null;
  }>
) {
  const existing = await requireTemplateAccess(id);
  const [template] = await db
    .update(messageTemplates)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(and(eq(messageTemplates.id, id), eq(messageTemplates.organizationId, existing.organizationId)))
    .returning();

  if (!template) {
    throw new Error("Template not found");
  }

  return template;
}

export async function deleteTemplate(id: string) {
  const existing = await requireTemplateAccess(id);
  await db
    .delete(messageTemplates)
    .where(and(eq(messageTemplates.id, id), eq(messageTemplates.organizationId, existing.organizationId)));
}

// ── Stats ──
export async function getConversationStats(orgId: string) {
  await requireOrgMembership(orgId);
  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      open: sql<number>`count(*) filter (where ${conversations.status} = 'open')`,
      waiting: sql<number>`count(*) filter (where ${conversations.status} = 'waiting')`,
      resolved: sql<number>`count(*) filter (where ${conversations.status} = 'resolved')`,
      archived: sql<number>`count(*) filter (where ${conversations.status} = 'archived')`,
    })
    .from(conversations)
    .where(eq(conversations.organizationId, orgId));
  return stats;
}

export async function getPhoneCalls(orgId: string) {
  await requireOrgMembership(orgId);
  return await db
    .select({
      conversation: conversations,
      contact: churchContacts,
      latestDirection: sql<"inbound" | "outbound" | null>`(
        select m.direction
        from message m
        where m.conversation_id = ${conversations.id}
        order by m.sent_at desc
        limit 1
      )`,
      latestContent: sql<string | null>`(
        select m.content
        from message m
        where m.conversation_id = ${conversations.id}
        order by m.sent_at desc
        limit 1
      )`,
      latestSentAt: sql<Date | null>`(
        select m.sent_at
        from message m
        where m.conversation_id = ${conversations.id}
        order by m.sent_at desc
        limit 1
      )`,
    })
    .from(conversations)
    .leftJoin(churchContacts, eq(conversations.contactId, churchContacts.id))
    .where(
      and(
        eq(conversations.organizationId, orgId),
        eq(conversations.channel, "phone")
      )
    )
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt));
}
