import { db } from "@/db";
import { churchContacts, conversations, messages } from "@/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { normalizeContactPhone } from "@/lib/operations/contacts-lifecycle";

type ConversationChannel = typeof conversations.$inferSelect.channel;
type MessageDirection = typeof messages.$inferSelect.direction;
type SenderType = typeof messages.$inferSelect.senderType;

function normalizePhoneSuffix(value: string | null | undefined) {
  const normalized = normalizeContactPhone(value);
  if (!normalized) return null;
  return normalized.length > 10 ? normalized.slice(-10) : normalized;
}

export async function findOrganizationContactByPhone(params: {
  organizationId: string;
  phone: string | null | undefined;
}) {
  const incomingSuffix = normalizePhoneSuffix(params.phone);
  if (!incomingSuffix) {
    return null;
  }

  const candidates = await db
    .select()
    .from(churchContacts)
    .where(
      and(
        eq(churchContacts.organizationId, params.organizationId),
        isNotNull(churchContacts.phone)
      )
    )
    .limit(500);

  return (
    candidates.find((candidate) => {
      const candidateSuffix = normalizePhoneSuffix(candidate.phone);
      return Boolean(candidateSuffix && candidateSuffix === incomingSuffix);
    }) ?? null
  );
}

export async function getOrCreateSystemConversation(params: {
  organizationId: string;
  contactId?: string | null;
  channel: ConversationChannel;
  subject?: string | null;
}) {
  const [existing] =
    params.contactId
      ? await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(
            and(
              eq(conversations.organizationId, params.organizationId),
              eq(conversations.channel, params.channel),
              eq(conversations.contactId, params.contactId)
            )
          )
          .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
          .limit(1)
      : [];

  if (existing?.id) {
    return existing.id;
  }

  const [created] = await db
    .insert(conversations)
    .values({
      organizationId: params.organizationId,
      contactId: params.contactId ?? null,
      channel: params.channel,
      status: "open",
      subject: params.subject ?? null,
    })
    .returning({ id: conversations.id });

  return created.id;
}

export async function appendSystemConversationMessage(params: {
  organizationId: string;
  conversationId?: string | null;
  contactId?: string | null;
  channel: ConversationChannel;
  subject?: string | null;
  content: string;
  direction: MessageDirection;
  senderType?: SenderType;
  senderId?: string | null;
  sentAt?: Date;
}) {
  const conversationId =
    params.conversationId ??
    (await getOrCreateSystemConversation({
      organizationId: params.organizationId,
      contactId: params.contactId ?? null,
      channel: params.channel,
      subject: params.subject ?? null,
    }));

  const sentAt = params.sentAt ?? new Date();
  const [message] = await db
    .insert(messages)
    .values({
      conversationId,
      content: params.content,
      direction: params.direction,
      senderType: params.senderType ?? "system",
      senderId: params.senderId ?? null,
      sentAt,
    })
    .returning({ id: messages.id, sentAt: messages.sentAt });

  await db
    .update(conversations)
    .set({
      lastMessageAt: message.sentAt ?? sentAt,
      updatedAt: new Date(),
      ...(params.contactId ? { contactId: params.contactId } : {}),
      ...(params.subject !== undefined ? { subject: params.subject ?? null } : {}),
    })
    .where(eq(conversations.id, conversationId));

  return {
    conversationId,
    messageId: message.id,
    sentAt: message.sentAt ?? sentAt,
  };
}
