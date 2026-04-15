import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { conversations, graceMessages, graceSessions, messages } from "@/db/schema";
import { processServiceAssignmentSmsReply } from "@/app/actions/operations";
import { findOrganizationContactByPhone } from "@/lib/communications/system-conversations";
import {
  normalizeSmsThreadPhone,
  selectReusableSmsGraceSessionId,
} from "@/lib/grace/channels/sms/threading";
import { getOrCreateGraceSession, runGraceMessage } from "@/lib/grace/runtime";
import {
  sendOrganizationSms,
  type SendOrganizationSmsResult,
} from "@/lib/sms-gateway/send";

export type HandleInboundGraceSmsParams = {
  organizationId: string;
  message: string;
  fromNumber?: string | null;
  toNumber?: string | null;
  sessionId?: string;
  providerMessageId?: string | null;
  smsGatewayMessageId?: string | null;
  source:
    | "fellowship_gateway_webhook"
    | "sms_gateway_device"
    | "sms_gateway_device_legacy";
};

type ReplyDeliverySummary = Pick<
  SendOrganizationSmsResult,
  "success" | "providerMessageId" | "deviceId" | "messageIds" | "queuedCount" | "error"
>;

export type HandleInboundGraceSmsResult = {
  ok: boolean;
  sessionId: string;
  deduplicated?: boolean;
  assignmentReply?: boolean;
  assignmentId?: string;
  assignmentStatus?: string;
  response?: string;
  proposedActions?: Awaited<ReturnType<typeof runGraceMessage>>["proposedActions"];
  actionOutcomes?: Awaited<ReturnType<typeof runGraceMessage>>["actionOutcomes"];
  replyDelivery?: ReplyDeliverySummary | null;
  conversationId?: string | null;
  workflowGoalId?: string | null;
  workflowStatus?: string | null;
  workflowKey?: string | null;
  error?: string;
};

function buildInboundReplyIdempotencyKey(params: {
  sessionId: string;
  providerMessageId?: string | null;
  smsGatewayMessageId?: string | null;
  message: string;
}) {
  if (params.providerMessageId) {
    return `${params.sessionId}:reply:${params.providerMessageId}`;
  }

  if (params.smsGatewayMessageId) {
    return `${params.sessionId}:reply:${params.smsGatewayMessageId}`;
  }

  const fingerprint = Buffer.from(params.message.trim().slice(0, 120)).toString("base64url");
  return `${params.sessionId}:reply:${fingerprint}`;
}

async function resolveReusableSmsGraceSessionId(params: {
  organizationId: string;
  sessionId?: string;
  fromNumber?: string | null;
  contactId?: string | null;
}) {
  if (params.sessionId) {
    return params.sessionId;
  }

  const threadPhone = normalizeSmsThreadPhone(params.fromNumber);
  if (threadPhone) {
    const recentMessages = await db
      .select({
        sessionId: graceMessages.sessionId,
        metadataJson: graceMessages.metadataJson,
      })
      .from(graceMessages)
      .where(
        and(
          eq(graceMessages.organizationId, params.organizationId),
          eq(graceMessages.channel, "sms_public")
        )
      )
      .orderBy(desc(graceMessages.createdAt))
      .limit(120);

    const candidateSessionIds = [...new Set(recentMessages.map((row) => row.sessionId))];
    if (candidateSessionIds.length > 0) {
      const sessions = await db
        .select({
          id: graceSessions.id,
          status: graceSessions.status,
        })
        .from(graceSessions)
        .where(
          and(
            eq(graceSessions.organizationId, params.organizationId),
            eq(graceSessions.channel, "sms_public"),
            inArray(graceSessions.id, candidateSessionIds)
          )
        );

      const matchedSessionId = selectReusableSmsGraceSessionId({
        fromNumber: threadPhone,
        recentMessages,
        sessions,
      });

      if (matchedSessionId) {
        return matchedSessionId;
      }
    }
  }

  if (!params.contactId) {
    return undefined;
  }

  const [existingContactSession] = await db
    .select({ id: graceSessions.id })
    .from(graceSessions)
    .where(
      and(
        eq(graceSessions.organizationId, params.organizationId),
        eq(graceSessions.channel, "sms_public"),
        eq(graceSessions.status, "open"),
        or(
          eq(graceSessions.contactId, params.contactId),
          eq(graceSessions.matchedContactId, params.contactId)
        )
      )
    )
    .orderBy(desc(graceSessions.updatedAt), desc(graceSessions.createdAt))
    .limit(1);

  return existingContactSession?.id;
}

async function getOrCreateSmsConversation(params: {
  organizationId: string;
  contactId: string | null;
  fromNumber: string | null;
  toNumber: string | null;
}) {
  if (params.contactId) {
    const [existingByContact] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, params.organizationId),
          eq(conversations.channel, "sms"),
          eq(conversations.contactId, params.contactId)
        )
      )
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
      .limit(1);

    if (existingByContact) {
      return existingByContact.id;
    }
  }

  if (params.fromNumber) {
    const [existingBySubject] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, params.organizationId),
          eq(conversations.channel, "sms"),
          ilike(conversations.subject, `%${params.fromNumber}%`)
        )
      )
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
      .limit(1);

    if (existingBySubject) {
      return existingBySubject.id;
    }
  }

  const [created] = await db
    .insert(conversations)
    .values({
      organizationId: params.organizationId,
      contactId: params.contactId,
      channel: "sms",
      status: "open",
      subject: `SMS ${params.fromNumber ?? "Unknown sender"} → ${params.toNumber ?? "Church line"}`,
      lastMessageAt: new Date(),
    })
    .returning({ id: conversations.id });

  return created.id;
}

async function appendConversationMessageIfNew(params: {
  organizationId: string;
  conversationId: string;
  contactId: string | null;
  content: string;
  direction: "inbound" | "outbound";
  senderType: "human" | "ai" | "system";
}) {
  const normalized = params.content.trim();
  if (!normalized) {
    return;
  }

  const [latestSimilar] = await db
    .select({
      id: messages.id,
      content: messages.content,
      direction: messages.direction,
    })
    .from(messages)
    .where(eq(messages.conversationId, params.conversationId))
    .orderBy(desc(messages.sentAt))
    .limit(1);

  if (
    latestSimilar &&
    latestSimilar.direction === params.direction &&
    latestSimilar.content.trim() === normalized
  ) {
    await db
      .update(conversations)
      .set({
        lastMessageAt: new Date(),
        updatedAt: new Date(),
        ...(params.contactId ? { contactId: params.contactId } : {}),
      })
      .where(eq(conversations.id, params.conversationId));
    return;
  }

  const sentAt = new Date();
  await db.insert(messages).values({
    conversationId: params.conversationId,
    content: normalized,
    direction: params.direction,
    senderType: params.senderType,
    sentAt,
  });

  await db
    .update(conversations)
    .set({
      lastMessageAt: sentAt,
      updatedAt: new Date(),
      ...(params.contactId ? { contactId: params.contactId } : {}),
    })
    .where(eq(conversations.id, params.conversationId));
}

export async function handleInboundGraceSms(
  params: HandleInboundGraceSmsParams
): Promise<HandleInboundGraceSmsResult> {
  const normalizedMessage = params.message.trim();
  if (!normalizedMessage) {
    throw new Error("message is required");
  }

  if (params.providerMessageId) {
    const [existingMessage] = await db
      .select({
        sessionId: graceMessages.sessionId,
      })
      .from(graceMessages)
      .where(
        and(
          eq(graceMessages.organizationId, params.organizationId),
          eq(graceMessages.providerMessageId, params.providerMessageId)
        )
      )
      .limit(1);

    if (existingMessage) {
      return {
        ok: true,
        deduplicated: true,
        sessionId: existingMessage.sessionId,
      };
    }
  }

  const matchedContact = params.fromNumber
    ? await findOrganizationContactByPhone({
        organizationId: params.organizationId,
        phone: params.fromNumber,
      })
    : null;

  const reusableSessionId = await resolveReusableSmsGraceSessionId({
    organizationId: params.organizationId,
    sessionId: params.sessionId,
    fromNumber: params.fromNumber,
    contactId: matchedContact?.id ?? null,
  });

  const session = await getOrCreateGraceSession({
    organizationId: params.organizationId,
    channel: "sms_public",
    actorType: "public",
    sessionId: reusableSessionId,
    contactId: matchedContact?.id ?? null,
  });

  const nextState = {
    ...((session.stateJson as Record<string, unknown> | null) ?? {}),
    ...(params.fromNumber ? { phone: params.fromNumber, fromNumber: params.fromNumber } : {}),
    ...(params.toNumber ? { toNumber: params.toNumber } : {}),
  };

  await db
    .update(graceSessions)
    .set({
      stateJson: nextState,
      updatedAt: new Date(),
      ...(session.contactId ? {} : matchedContact?.id ? { contactId: matchedContact.id } : {}),
    })
    .where(eq(graceSessions.id, session.id));

  await db.insert(graceMessages).values({
    organizationId: params.organizationId,
    sessionId: session.id,
    contactId: matchedContact?.id ?? session.contactId ?? null,
    direction: "inbound",
    channel: "sms_public",
    messageText: normalizedMessage,
    providerMessageId: params.providerMessageId ?? null,
    metadataJson: {
      source: params.source,
      fromNumber: params.fromNumber ?? null,
      toNumber: params.toNumber ?? null,
      normalizedFromNumber: normalizeSmsThreadPhone(params.fromNumber),
      smsGatewayMessageId: params.smsGatewayMessageId ?? null,
    },
  });

  const conversationId: string | null = await getOrCreateSmsConversation({
    organizationId: params.organizationId,
    contactId: matchedContact?.id ?? session.contactId ?? null,
    fromNumber: params.fromNumber ?? null,
    toNumber: params.toNumber ?? null,
  });

  await appendConversationMessageIfNew({
    organizationId: params.organizationId,
    conversationId,
    contactId: matchedContact?.id ?? session.contactId ?? null,
    content: normalizedMessage,
    direction: "inbound",
    senderType: "human",
  });

  if (params.fromNumber) {
    const assignmentReply = await processServiceAssignmentSmsReply({
      organizationId: params.organizationId,
      fromPhone: params.fromNumber,
      message: normalizedMessage,
    });

    if (assignmentReply.handled) {
      if (assignmentReply.replySendResult?.success && assignmentReply.replyMessage) {
        await db.insert(graceMessages).values({
          organizationId: params.organizationId,
          sessionId: session.id,
          contactId: matchedContact?.id ?? session.contactId ?? null,
          direction: "outbound",
          channel: "sms_public",
          messageText: assignmentReply.replyMessage,
          providerMessageId: assignmentReply.replyProviderMessageId ?? null,
          metadataJson: {
            source: "service_assignment_reply",
            workflowKey: assignmentReply.workflowKey ?? "volunteer_staffing",
            workflowGoalId: assignmentReply.workflowGoalId ?? null,
            workflowStatus: assignmentReply.workflowStatus ?? null,
            assignmentId: assignmentReply.assignmentId ?? null,
            assignmentStatus: assignmentReply.assignmentStatus ?? null,
          },
        });

        await appendConversationMessageIfNew({
          organizationId: params.organizationId,
          conversationId,
          contactId: matchedContact?.id ?? session.contactId ?? null,
          content: assignmentReply.replyMessage,
          direction: "outbound",
          senderType: "system",
        });
      }

      return {
        ok: true,
        assignmentReply: true,
        sessionId: session.id,
        assignmentId: assignmentReply.assignmentId,
        assignmentStatus: assignmentReply.assignmentStatus,
        replyDelivery: assignmentReply.replySendResult ?? null,
        conversationId,
        workflowGoalId: assignmentReply.workflowGoalId ?? null,
        workflowStatus: assignmentReply.workflowStatus ?? null,
        workflowKey: assignmentReply.workflowKey ?? null,
      };
    }
  }

  try {
    const result = await runGraceMessage({
      organizationId: params.organizationId,
      channel: "sms_public",
      actorType: "public",
      message: normalizedMessage,
      sessionId: session.id,
    });

    const [refreshedSession] = await db
      .select({
        contactId: graceSessions.contactId,
        matchedContactId: graceSessions.matchedContactId,
      })
      .from(graceSessions)
      .where(eq(graceSessions.id, session.id))
      .limit(1);

    const resolvedContactId =
      refreshedSession?.contactId ??
      refreshedSession?.matchedContactId ??
      result.contactMatch?.contactId ??
      matchedContact?.id ??
      session.contactId ??
      null;

    if (resolvedContactId) {
      await db
        .update(conversations)
        .set({
          contactId: resolvedContactId,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversationId));
    }

    let replyDelivery: ReplyDeliverySummary | null = null;
    const responseText = result.response.trim();

    if (responseText && params.fromNumber) {
      const sent = await sendOrganizationSms({
        organizationId: params.organizationId,
        to: params.fromNumber,
        message: responseText,
        idempotencyKey: buildInboundReplyIdempotencyKey({
          sessionId: session.id,
          providerMessageId: params.providerMessageId,
          smsGatewayMessageId: params.smsGatewayMessageId,
          message: normalizedMessage,
        }),
        metadataJson: {
          source: "grace_inbound_sms_reply",
          sessionId: session.id,
          inboundProviderMessageId: params.providerMessageId ?? null,
          inboundSmsGatewayMessageId: params.smsGatewayMessageId ?? null,
          contactId: resolvedContactId,
        },
      });

      replyDelivery = {
        success: sent.success,
        providerMessageId: sent.providerMessageId,
        deviceId: sent.deviceId,
        messageIds: sent.messageIds,
        queuedCount: sent.queuedCount,
        error: sent.error,
      };

      if (sent.success) {
        await db.insert(graceMessages).values({
          organizationId: params.organizationId,
          sessionId: session.id,
          contactId: resolvedContactId,
          direction: "outbound",
          channel: "sms_public",
          messageText: responseText,
          providerMessageId: sent.providerMessageId,
          metadataJson: {
            source: "grace_inbound_sms_reply",
            inReplyTo: params.providerMessageId ?? params.smsGatewayMessageId ?? null,
          },
        });

        await appendConversationMessageIfNew({
          organizationId: params.organizationId,
          conversationId,
          contactId: resolvedContactId,
          content: responseText,
          direction: "outbound",
          senderType: "ai",
        });
      }
    }

    return {
      ok: true,
      sessionId: session.id,
      response: result.response,
      proposedActions: result.proposedActions,
      actionOutcomes: result.actionOutcomes,
      replyDelivery,
      conversationId,
    };
  } catch (error) {
    return {
      ok: false,
      sessionId: session.id,
      conversationId,
      error: error instanceof Error ? error.message : "Failed to process inbound GRACE SMS",
    };
  }
}

export const processInboundGraceSms = handleInboundGraceSms;
