import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  aiConfig,
  churchContacts,
  conversations,
  graceCalls,
  graceHandoffs,
  graceSessions,
  graceFollowupProposals,
  messages,
  tasks,
} from "@/db/schema";
import { getOrCreateGraceSession } from "@/lib/grace/runtime";
import { sendOrganizationSms } from "@/lib/sms-gateway/send";
import { inngest } from "../client";
import { INNGEST_EVENTS } from "../events";
import { INNGEST_RETRY_PROFILES } from "../policy";

type MissedCallContext = {
  organizationId: string;
  sessionId: string;
  conversationId: string;
  contactId: string | null;
  contactName: string;
  recipient: string | null;
  churchName: string;
  callId: string | null;
  callRecordId: string | null;
  fromNumber: string | null;
  sequenceStartedAt: string;
};

function normalizePhone(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

export const missedCallRecoverySequence = inngest.createFunction(
  {
    id: "sequence-missed-call-recovery",
    retries: INNGEST_RETRY_PROFILES.CORE_AUTOMATION,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.GRACE_MISSED_CALL_RECOVERY_REQUESTED },
  async ({ event, step, logger }) => {
    const { organizationId, callId, sessionId, fromNumber, toNumber, callRecordId } =
      event.data as {
      organizationId: string;
      callId?: string | null;
      sessionId?: string | null;
      fromNumber?: string | null;
      toNumber?: string | null;
      callRecordId?: string | null;
    };

    const prepared = await step.run("prepare-context", async () => {
      const [orgConfig] = await db
        .select({ churchName: aiConfig.churchName })
        .from(aiConfig)
        .where(eq(aiConfig.organizationId, organizationId))
        .limit(1);

      const churchName = orgConfig?.churchName?.trim() || "your church";
      const normalizedIncoming = normalizePhone(fromNumber);
      const callRecordIdFromEvent = callRecordId ? String(callRecordId) : null;

      const [existingCall] = callRecordIdFromEvent
        ? await db
            .select({ id: graceCalls.id })
            .from(graceCalls)
            .where(
              and(
                eq(graceCalls.organizationId, organizationId),
                eq(graceCalls.id, callRecordIdFromEvent)
              )
            )
            .limit(1)
        : callId
          ? await db
              .select({ id: graceCalls.id })
              .from(graceCalls)
              .where(
                and(
                  eq(graceCalls.organizationId, organizationId),
                  eq(graceCalls.externalCallId, callId)
                )
              )
              .orderBy(desc(graceCalls.createdAt))
              .limit(1)
          : sessionId
            ? await db
                .select({ id: graceCalls.id })
                .from(graceCalls)
                .where(
                  and(
                    eq(graceCalls.organizationId, organizationId),
                    eq(graceCalls.sessionId, sessionId)
                  )
                )
                .orderBy(desc(graceCalls.createdAt))
                .limit(1)
            : [];

      let contact: typeof churchContacts.$inferSelect | null = null;
      if (fromNumber) {
        const [exactMatch] = await db
          .select()
          .from(churchContacts)
          .where(and(eq(churchContacts.organizationId, organizationId), eq(churchContacts.phone, fromNumber)))
          .limit(1);
        contact = exactMatch ?? null;
      }

      if (!contact && normalizedIncoming) {
        const [normalizedMatch] = await db
          .select()
          .from(churchContacts)
          .where(and(eq(churchContacts.organizationId, organizationId), eq(churchContacts.phone, normalizedIncoming)))
          .limit(1);
        contact = normalizedMatch ?? null;
      }

      if (!contact && normalizedIncoming) {
        const candidates = await db
          .select()
          .from(churchContacts)
          .where(and(eq(churchContacts.organizationId, organizationId), isNotNull(churchContacts.phone)))
          .limit(500);

        const incomingSuffix = normalizedIncoming.slice(-10);
        contact =
          candidates.find((candidate) =>
            normalizePhone(candidate.phone).endsWith(incomingSuffix)
          ) ?? null;
      }

      const session = await getOrCreateGraceSession({
        organizationId,
        channel: "voice_public",
        actorType: "system",
        sessionId: sessionId ?? undefined,
        contactId: contact?.id ?? null,
      });

      const [existingConversation] = contact?.id
        ? await db
            .select({ id: conversations.id })
            .from(conversations)
            .where(
              and(
                eq(conversations.organizationId, organizationId),
                eq(conversations.channel, "phone"),
                eq(conversations.contactId, contact.id)
              )
            )
            .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
            .limit(1)
        : [];

      const conversationId =
        existingConversation?.id ??
        (
          await db
            .insert(conversations)
            .values({
              organizationId,
              contactId: contact?.id ?? null,
              channel: "phone",
              status: "open",
              subject: "Missed call recovery",
            })
            .returning({ id: conversations.id })
        )[0].id;

      await db.insert(messages).values({
        conversationId,
        direction: "inbound",
        senderType: "system",
        content: `Missed call captured from ${fromNumber ?? "Unknown caller"} to ${toNumber ?? "church line"}${callId ? ` (call ${callId})` : ""}.`,
      });

      const contactName = contact ? `${contact.firstName} ${contact.lastName}`.trim() : "Caller";
      const recipient = contact?.phone ?? fromNumber ?? null;

      if (existingCall?.id) {
        await db
          .update(graceCalls)
          .set({
            contactId: contact?.id ?? null,
            intent: "missed_call",
            outcome: "recovery_sequence_started",
            summaryText: "Missed call recovery sequence started.",
          })
          .where(
            and(
              eq(graceCalls.organizationId, organizationId),
              eq(graceCalls.id, existingCall.id)
            )
          );
      }

      return {
        organizationId,
        sessionId: session.id,
        conversationId,
        contactId: contact?.id ?? null,
        contactName,
        recipient,
        churchName,
        callId: callId ?? null,
        callRecordId: existingCall?.id ?? callRecordIdFromEvent,
        fromNumber: fromNumber ?? null,
        sequenceStartedAt: new Date().toISOString(),
      } satisfies MissedCallContext;
    });

    const updateCallLifecycle = async (values: {
      outcome?: string;
      summaryText?: string;
      intent?: string;
      contactId?: string | null;
    }) => {
      if (!prepared.callRecordId) return;
      await db
        .update(graceCalls)
        .set({
          ...(values.outcome ? { outcome: values.outcome } : {}),
          ...(values.summaryText ? { summaryText: values.summaryText } : {}),
          ...(values.intent ? { intent: values.intent } : {}),
          ...(values.contactId !== undefined ? { contactId: values.contactId } : {}),
        })
        .where(
          and(
            eq(graceCalls.organizationId, prepared.organizationId),
            eq(graceCalls.id, prepared.callRecordId)
          )
        );
    };

    const firstRecoveryMessage = `Hi ${prepared.contactName.split(" ")[0] || "there"}, this is Grace from ${prepared.churchName}. We missed your call and want to help. Reply here and we will follow up right away.`;
    const secondRecoveryMessage = `Quick follow-up from ${prepared.churchName}: we still want to connect after your missed call. Reply with the best time and our team will reach out.`;

    const recordProposal = async (params: {
      messageText: string;
      reason: string;
      status: "sent" | "pending";
      deliveryError?: string | null;
      metadata?: Record<string, unknown>;
    }) => {
      await db.insert(graceFollowupProposals).values({
        organizationId: prepared.organizationId,
        sessionId: prepared.sessionId,
        contactId: prepared.contactId,
        actorType: "system",
        channel: "sms",
        proposedChannel: "sms",
        recipient: prepared.recipient,
        subject: "Missed call follow-up",
        messageText: params.messageText,
        reason: params.reason,
        status: params.status,
        metadataJson: {
          sequence: "missed_call_recovery",
          callId: prepared.callId,
          fromNumber: prepared.fromNumber,
          deliveryError: params.deliveryError ?? null,
          ...(params.metadata ?? {}),
        },
      });
    };

    await step.run("send-initial-recovery", async () => {
      let status: "sent" | "pending" = "pending";
      let deliveryError: string | null = null;

      if (prepared.recipient) {
        try {
          const sendResult = await sendOrganizationSms({
            organizationId: prepared.organizationId,
            to: prepared.recipient,
            message: firstRecoveryMessage,
            idempotencyKey: `missed-call-recovery:${prepared.sessionId}:step1`,
          });
          if (!sendResult.success) {
            throw new Error(sendResult.error ?? "SMS delivery failed");
          }
          status = "sent";
        } catch (error) {
          status = "pending";
          deliveryError = error instanceof Error ? error.message : "SMS delivery failed";
        }
      } else {
        deliveryError = "No recipient available for missed-call recovery message";
      }

      await db.insert(messages).values({
        conversationId: prepared.conversationId,
        direction: "outbound",
        senderType: "ai",
        content: firstRecoveryMessage,
      });

      await db
        .update(conversations)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(conversations.id, prepared.conversationId));

      await recordProposal({
        messageText: firstRecoveryMessage,
        reason: "step_1_immediate_recovery",
        status,
        deliveryError,
      });

      await updateCallLifecycle({
        outcome: status === "sent" ? "recovery_first_touch_sent" : "recovery_first_touch_pending",
        summaryText:
          status === "sent"
            ? "Missed-call recovery message sent to caller."
            : "Missed-call recovery pending due to delivery issue.",
      });
    });

    await step.run("create-callback-task", async () => {
      const dueDate = new Date(Date.now() + 60 * 60 * 1000);
      await db.insert(tasks).values({
        organizationId: prepared.organizationId,
        title: `Return missed call: ${prepared.contactName}`,
        description: `Grace detected a missed call from ${prepared.fromNumber ?? "unknown number"}. Call back within SLA.`,
        priority: "high",
        status: "todo",
        dueDate,
      });
    });

    await step.sleep("wait-2h-for-reply", "2h");

    const engaged = await step.run("check-for-reply", async () => {
      const [inboundReply] = await db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, prepared.conversationId),
            eq(messages.direction, "inbound"),
            gte(messages.sentAt, new Date(prepared.sequenceStartedAt))
          )
        )
        .limit(1);

      return Boolean(inboundReply);
    });

    if (engaged) {
      await step.run("mark-call-recovered", async () => {
        await db
          .update(conversations)
          .set({ status: "resolved", updatedAt: new Date() })
          .where(eq(conversations.id, prepared.conversationId));

        await db
          .update(graceSessions)
          .set({
            status: "closed",
            finalSummary: "Missed call recovery completed after caller reply.",
            updatedAt: new Date(),
          })
          .where(eq(graceSessions.id, prepared.sessionId));

        await updateCallLifecycle({
          outcome: "recovered_after_reply",
          summaryText: "Caller replied after missed-call recovery message.",
        });
      });
      return { status: "completed", reason: "member_replied_after_initial_recovery" };
    }

    await step.run("retry-and-escalate", async () => {
      let retryStatus: "sent" | "pending" = "pending";
      let retryError: string | null = null;

      if (prepared.recipient) {
        try {
          const sendResult = await sendOrganizationSms({
            organizationId: prepared.organizationId,
            to: prepared.recipient,
            message: secondRecoveryMessage,
            idempotencyKey: `missed-call-recovery:${prepared.sessionId}:step2`,
          });
          if (!sendResult.success) {
            throw new Error(sendResult.error ?? "Retry SMS failed");
          }
          retryStatus = "sent";
        } catch (error) {
          retryStatus = "pending";
          retryError = error instanceof Error ? error.message : "Retry SMS failed";
        }
      } else {
        retryError = "No recipient available for retry";
      }

      await db.insert(messages).values({
        conversationId: prepared.conversationId,
        direction: "outbound",
        senderType: "ai",
        content: secondRecoveryMessage,
      });

      await db
        .update(conversations)
        .set({ lastMessageAt: new Date(), updatedAt: new Date() })
        .where(eq(conversations.id, prepared.conversationId));

      await recordProposal({
        messageText: secondRecoveryMessage,
        reason: "step_2_retry_message",
        status: retryStatus,
        deliveryError: retryError,
      });

      const [task] = await db
        .insert(tasks)
        .values({
          organizationId: prepared.organizationId,
          title: `Escalation: missed call unresolved (${prepared.contactName})`,
          description:
            "No response after missed-call recovery sequence. Assign staff member for direct outreach immediately.",
          priority: "urgent",
          status: "todo",
          dueDate: new Date(),
        })
        .returning({ id: tasks.id });

      await recordProposal({
        messageText: "Grace escalated this missed call to a human operator.",
        reason: "step_2_human_escalation",
        status: "pending",
        metadata: { escalationTaskId: task.id },
      });

      await db
        .update(conversations)
        .set({ status: "waiting", updatedAt: new Date() })
        .where(eq(conversations.id, prepared.conversationId));

      await db
        .update(graceSessions)
        .set({
          status: "escalated",
          handoffReason: "missed_call_unresolved",
          updatedAt: new Date(),
        })
        .where(eq(graceSessions.id, prepared.sessionId));

      const [existingOpenHandoff] = await db
        .select({ id: graceHandoffs.id })
        .from(graceHandoffs)
        .where(
          and(
            eq(graceHandoffs.organizationId, prepared.organizationId),
            eq(graceHandoffs.sessionId, prepared.sessionId),
            eq(graceHandoffs.status, "open")
          )
        )
        .limit(1);

      if (!existingOpenHandoff) {
        await db.insert(graceHandoffs).values({
          organizationId: prepared.organizationId,
          sessionId: prepared.sessionId,
          contactId: prepared.contactId,
          actorType: "system",
          reason: "missed_call_unresolved",
          summaryText: "Missed call recovery exhausted; escalated to staff.",
          assignedTeam: "pastoral_care",
          status: "open",
          metadataJson: {
            source: "missed_call_recovery",
            conversationId: prepared.conversationId,
            callId: prepared.callId,
            callRecordId: prepared.callRecordId,
            escalationTaskId: task.id,
          },
        });
      }

      await updateCallLifecycle({
        outcome: "escalated_after_no_reply",
        summaryText: "No reply after recovery sequence. Escalated to staff.",
      });
    });

    logger.info("Missed call recovery escalated", {
      organizationId: prepared.organizationId,
      callId: prepared.callId,
      contactId: prepared.contactId,
    });

    return { status: "completed", reason: "escalated_after_no_reply" };
  }
);
