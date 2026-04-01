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
import {
  assertConversationStatusTransition,
  parseConversationLifecycleStatus,
} from "@/lib/operations/conversations-lifecycle";
import * as z from "zod";

const CHANNEL_VALUES = ["phone", "sms", "email", "web", "in_person"] as const;
const MESSAGE_DIRECTION_VALUES = ["inbound", "outbound", "draft"] as const;
const MESSAGE_SENDER_TYPE_VALUES = ["human", "ai", "system"] as const;
const BROADCAST_STATUS_VALUES = ["draft", "scheduled", "sending", "sent", "failed"] as const;

const organizationIdSchema = z.string().trim().min(1);
const recordIdSchema = z.string().trim().min(1);

const conversationFiltersSchema = z
  .object({
    status: z.string().trim().min(1).optional(),
    includeArchived: z.boolean().optional(),
  })
  .optional();

const createConversationSchema = z.object({
  contactId: z.string().trim().min(1).optional(),
  channel: z.enum(CHANNEL_VALUES),
  subject: z.string().trim().optional(),
  assigneeId: z.string().trim().min(1).optional(),
  organizationId: organizationIdSchema,
});

const addMessageSchema = z.object({
  conversationId: recordIdSchema,
  content: z.string().trim().min(1),
  direction: z.enum(MESSAGE_DIRECTION_VALUES),
  senderType: z.enum(MESSAGE_SENDER_TYPE_VALUES).optional(),
  senderId: z.string().trim().min(1).optional(),
});

const createBroadcastSchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  channel: z.enum(CHANNEL_VALUES),
  audienceFilter: z.record(z.string(), z.unknown()).optional(),
  scheduledAt: z.coerce.date().optional(),
  organizationId: organizationIdSchema,
});

const updateBroadcastSchema = z.object({
  title: z.string().trim().min(1).optional(),
  content: z.string().trim().min(1).optional(),
  channel: z.enum(CHANNEL_VALUES).optional(),
});

const updateBroadcastStatusSchema = z.object({
  id: recordIdSchema,
  status: z.enum(BROADCAST_STATUS_VALUES),
  stats: z
    .object({
      totalRecipients: z.number().int().nonnegative().optional(),
      totalDelivered: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

const createTemplateSchema = z.object({
  name: z.string().trim().min(1),
  content: z.string().trim().min(1),
  category: z.string().trim().optional(),
  channel: z.enum(CHANNEL_VALUES).optional(),
  variables: z.array(z.string().trim().min(1)).optional(),
  organizationId: organizationIdSchema,
});

const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  content: z.string().trim().min(1).optional(),
  category: z.string().trim().nullable().optional(),
  channel: z.enum(CHANNEL_VALUES).nullable().optional(),
  variables: z.array(z.string().trim().min(1)).nullable().optional(),
});

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
  const parsedOrgId = organizationIdSchema.parse(orgId);
  const parsedFilters = conversationFiltersSchema.parse(filters);
  await requireOrgMembership(parsedOrgId);

  if (parsedFilters?.status) {
    const status = parseConversationLifecycleStatus(parsedFilters.status);
    return db
      .select({ conversation: conversations, contact: churchContacts })
      .from(conversations)
      .leftJoin(churchContacts, eq(conversations.contactId, churchContacts.id))
      .where(and(eq(conversations.organizationId, parsedOrgId), eq(conversations.status, status)))
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.updatedAt));
  }

  const query = db
    .select({ conversation: conversations, contact: churchContacts })
    .from(conversations)
    .leftJoin(churchContacts, eq(conversations.contactId, churchContacts.id));

  if (parsedFilters?.includeArchived) {
    return query
      .where(eq(conversations.organizationId, parsedOrgId))
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.updatedAt));
  }

  return query
    .where(and(eq(conversations.organizationId, parsedOrgId), ne(conversations.status, "archived")))
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.updatedAt));
}

export async function getConversationMessages(conversationId: string) {
  const parsedConversationId = recordIdSchema.parse(conversationId);
  await requireConversationAccess(parsedConversationId);
  return await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, parsedConversationId))
    .orderBy(messages.sentAt);
}

export async function createConversation(data: {
  contactId?: string;
  channel: string;
  subject?: string;
  assigneeId?: string;
  organizationId: string;
}) {
  const parsed = createConversationSchema.parse(data);
  await requireOrgMembership(parsed.organizationId);
  const [conversation] = await db
    .insert(conversations)
    .values({
      contactId: parsed.contactId ?? null,
      channel: parsed.channel,
      subject: parsed.subject ?? null,
      assigneeId: parsed.assigneeId ?? null,
      organizationId: parsed.organizationId,
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
  const parsed = addMessageSchema.parse(data);
  const conversation = await requireConversationAccess(parsed.conversationId);
  const [message] = await db
    .insert(messages)
    .values({
      conversationId: parsed.conversationId,
      content: parsed.content,
      direction: parsed.direction,
      senderType: parsed.senderType ?? "human",
      senderId: parsed.senderId ?? null,
    })
    .returning();

  // Update conversation's last message timestamp
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(conversations.id, parsed.conversationId),
        eq(conversations.organizationId, conversation.organizationId)
      )
    );

  return message;
}

export async function updateConversationStatus(
  id: string,
  status: string
) {
  const parsedId = recordIdSchema.parse(id);
  const parsedStatus = z.string().trim().min(1).parse(status);
  const nextStatus = parseConversationLifecycleStatus(parsedStatus);
  const existing = await requireConversationAccess(parsedId);
  const currentStatus = parseConversationLifecycleStatus(existing.status);
  if (currentStatus !== nextStatus) {
    assertConversationStatusTransition(currentStatus, nextStatus);
  }

  const [conversation] = await db
    .update(conversations)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(
      and(eq(conversations.id, parsedId), eq(conversations.organizationId, existing.organizationId))
    )
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
  const parsedOrgId = organizationIdSchema.parse(orgId);
  await requireOrgMembership(parsedOrgId);
  return await db
    .select()
    .from(broadcasts)
    .where(eq(broadcasts.organizationId, parsedOrgId))
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
  const parsed = createBroadcastSchema.parse(data);
  await requireOrgMembership(parsed.organizationId);
  const [broadcast] = await db
    .insert(broadcasts)
    .values({
      title: parsed.title,
      content: parsed.content,
      channel: parsed.channel,
      audienceFilter: parsed.audienceFilter ?? null,
      scheduledAt: parsed.scheduledAt ?? null,
      organizationId: parsed.organizationId,
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
  const broadcastId = recordIdSchema.parse(id);
  const parsed = updateBroadcastSchema.parse(data);
  const existing = await requireBroadcastAccess(broadcastId);
  if (Object.keys(parsed).length === 0) {
    return existing;
  }
  const [broadcast] = await db
    .update(broadcasts)
    .set(parsed)
    .where(
      and(eq(broadcasts.id, broadcastId), eq(broadcasts.organizationId, existing.organizationId))
    )
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
  const parsed = updateBroadcastStatusSchema.parse({ id, status, stats });
  const existing = await requireBroadcastAccess(parsed.id);
  const [broadcast] = await db
    .update(broadcasts)
    .set({
      status: parsed.status,
      sentAt: parsed.status === "sent" ? new Date() : undefined,
      ...parsed.stats,
    })
    .where(and(eq(broadcasts.id, parsed.id), eq(broadcasts.organizationId, existing.organizationId)))
    .returning();

  if (!broadcast) {
    throw new Error("Broadcast not found");
  }

  return broadcast;
}

export async function triggerBroadcast(id: string) {
  const broadcastId = recordIdSchema.parse(id);
  const broadcast = await requireBroadcastAccess(broadcastId);
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
    broadcastId,
  });

  await inngest.send({
    id: idempotencyKey,
    name: INNGEST_EVENTS.COMMUNICATIONS_BROADCAST_SEND_REQUESTED,
    data: {
      organizationId: broadcast.organizationId,
      broadcastId,
      idempotencyKey,
    },
  });

  return broadcast;
}

export async function deleteBroadcast(id: string) {
  const broadcastId = recordIdSchema.parse(id);
  const existing = await requireBroadcastAccess(broadcastId);
  const [broadcast] = await db
    .delete(broadcasts)
    .where(
      and(eq(broadcasts.id, broadcastId), eq(broadcasts.organizationId, existing.organizationId))
    )
    .returning();

  if (!broadcast) {
    throw new Error("Broadcast not found");
  }

  return broadcast;
}

// ── Templates ──
export async function getTemplates(orgId: string) {
  const parsedOrgId = organizationIdSchema.parse(orgId);
  await requireOrgMembership(parsedOrgId);
  return await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.organizationId, parsedOrgId))
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
  const parsed = createTemplateSchema.parse(data);
  await requireOrgMembership(parsed.organizationId);
  const [template] = await db
    .insert(messageTemplates)
    .values({
      name: parsed.name,
      content: parsed.content,
      category: parsed.category ?? null,
      channel: parsed.channel ?? null,
      variables: parsed.variables ?? null,
      organizationId: parsed.organizationId,
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
  const templateId = recordIdSchema.parse(id);
  const parsed = updateTemplateSchema.parse(data);
  const existing = await requireTemplateAccess(templateId);
  if (Object.keys(parsed).length === 0) {
    return existing;
  }
  const [template] = await db
    .update(messageTemplates)
    .set({ ...parsed, updatedAt: new Date() })
    .where(
      and(
        eq(messageTemplates.id, templateId),
        eq(messageTemplates.organizationId, existing.organizationId)
      )
    )
    .returning();

  if (!template) {
    throw new Error("Template not found");
  }

  return template;
}

export async function deleteTemplate(id: string) {
  const templateId = recordIdSchema.parse(id);
  const existing = await requireTemplateAccess(templateId);
  await db
    .delete(messageTemplates)
    .where(
      and(eq(messageTemplates.id, templateId), eq(messageTemplates.organizationId, existing.organizationId))
    );
}

// ── Stats ──
export async function getConversationStats(orgId: string) {
  const parsedOrgId = organizationIdSchema.parse(orgId);
  await requireOrgMembership(parsedOrgId);
  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      open: sql<number>`count(*) filter (where ${conversations.status} = 'open')`,
      waiting: sql<number>`count(*) filter (where ${conversations.status} = 'waiting')`,
      resolved: sql<number>`count(*) filter (where ${conversations.status} = 'resolved')`,
      archived: sql<number>`count(*) filter (where ${conversations.status} = 'archived')`,
    })
    .from(conversations)
    .where(eq(conversations.organizationId, parsedOrgId));
  return stats;
}

export async function getPhoneCalls(orgId: string) {
  const parsedOrgId = organizationIdSchema.parse(orgId);
  await requireOrgMembership(parsedOrgId);
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
        eq(conversations.organizationId, parsedOrgId),
        eq(conversations.channel, "phone")
      )
    )
    .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt));
}
