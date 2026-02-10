"use server";

import { db } from "@/db";
import {
  conversations,
  messages,
  broadcasts,
  messageTemplates,
  churchContacts,
} from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

// ── Conversations ──
export async function getConversations(
  orgId: string,
  filters?: { status?: string }
) {
  if (filters?.status) {
    return await db
      .select({ conversation: conversations, contact: churchContacts })
      .from(conversations)
      .leftJoin(
        churchContacts,
        eq(conversations.contactId, churchContacts.id)
      )
      .where(
        and(
          eq(conversations.organizationId, orgId),
          eq(conversations.status, filters.status as any)
        )
      )
      .orderBy(desc(conversations.lastMessageAt));
  }
  return await db
    .select({ conversation: conversations, contact: churchContacts })
    .from(conversations)
    .leftJoin(churchContacts, eq(conversations.contactId, churchContacts.id))
    .where(eq(conversations.organizationId, orgId))
    .orderBy(desc(conversations.lastMessageAt));
}

export async function getConversationMessages(conversationId: string) {
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
    .where(eq(conversations.id, data.conversationId));

  return message;
}

export async function updateConversationStatus(
  id: string,
  status: string
) {
  const [conversation] = await db
    .update(conversations)
    .set({ status: status as any, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .returning();
  return conversation;
}

// ── Broadcasts ──
export async function getBroadcasts(orgId: string) {
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

export async function updateBroadcastStatus(
  id: string,
  status: string,
  stats?: { totalRecipients?: number; totalDelivered?: number }
) {
  const [broadcast] = await db
    .update(broadcasts)
    .set({
      status: status as any,
      sentAt: status === "sent" ? new Date() : undefined,
      ...stats,
    } as any)
    .where(eq(broadcasts.id, id))
    .returning();
  return broadcast;
}

// ── Templates ──
export async function getTemplates(orgId: string) {
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
  const [template] = await db
    .update(messageTemplates)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(eq(messageTemplates.id, id))
    .returning();
  return template;
}

export async function deleteTemplate(id: string) {
  await db.delete(messageTemplates).where(eq(messageTemplates.id, id));
}

// ── Stats ──
export async function getConversationStats(orgId: string) {
  const [stats] = await db
    .select({
      total: sql<number>`count(*)`,
      open: sql<number>`count(*) filter (where ${conversations.status} = 'open')`,
      waiting: sql<number>`count(*) filter (where ${conversations.status} = 'waiting')`,
      resolved: sql<number>`count(*) filter (where ${conversations.status} = 'resolved')`,
    })
    .from(conversations)
    .where(eq(conversations.organizationId, orgId));
  return stats;
}

export async function getPhoneCalls(orgId: string) {
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
