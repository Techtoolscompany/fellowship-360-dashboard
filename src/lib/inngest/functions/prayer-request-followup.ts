import { NonRetriableError } from "inngest";
import { and, desc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  aiConfig,
  churchContacts,
  conversations,
  graceFollowupProposals,
  graceHandoffs,
  graceMessages,
  messages,
  prayerRequests,
  tasks,
} from "@/db/schema";
import sendMail from "@/lib/email/sendMail";
import { sendTextBeeSMS } from "@/lib/grace/channels/sms/textbee";
import { resolveSmsProvider } from "@/lib/grace/providers/resolver";
import { getOrCreateGraceSession } from "@/lib/grace/runtime";
import {
  buildPrayerEscalationTaskMarker,
  buildPrayerEscalationTaskTitle,
  isPrayerRequestActive,
  type PrayerUrgency,
} from "@/lib/prayer/routing";
import { inngest } from "../client";
import { INNGEST_EVENTS } from "../events";
import { INNGEST_RETRY_PROFILES } from "../policy";

const TASK_OPEN_STATUSES: Array<"todo" | "in_progress"> = ["todo", "in_progress"];

function trimOrNull(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function buildPrayerAcknowledgmentMessage(params: {
  firstName: string;
  churchName: string;
  assignedTeam: string;
  urgency: PrayerUrgency;
}) {
  const intro = `Hi ${params.firstName}, this is Grace from ${params.churchName}.`;
  const acknowledgment = `Thank you for sharing your prayer request. ${params.assignedTeam} has received it and is praying with you.`;
  const urgencyLine =
    params.urgency === "critical"
      ? "A pastor is being alerted for immediate follow-up. If anyone is in immediate danger, please call 911 now."
      : params.urgency === "urgent"
        ? "A care team member will follow up soon."
        : "We are standing with you in prayer.";
  return `${intro} ${acknowledgment} ${urgencyLine}`;
}

type PreparedContext = {
  organizationId: string;
  requestId: string;
  sessionId: string;
  conversationId: string | null;
  contactId: string | null;
  contactName: string;
  firstName: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  channel: "sms" | "email" | null;
  churchName: string;
  assignedTeam: string;
  content: string;
  status: "new" | "praying" | "answered" | "archived";
  urgency: PrayerUrgency;
};

export const prayerRequestFollowupSequence = inngest.createFunction(
  {
    id: "sequence-prayer-request-followup",
    retries: INNGEST_RETRY_PROFILES.CORE_AUTOMATION,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.GRACE_PRAYER_REQUEST_FOLLOWUP_REQUESTED },
  async ({ event, step, logger }) => {
    const { organizationId, requestId, trigger } = event.data as {
      organizationId: string;
      requestId: string;
      trigger: "created" | "updated";
      idempotencyKey: string;
    };

    const prepared = await step.run("prepare-context", async () => {
      const [requestRow] = await db
        .select({
          requestId: prayerRequests.id,
          organizationId: prayerRequests.organizationId,
          contactId: prayerRequests.contactId,
          contactName: prayerRequests.contactName,
          content: prayerRequests.content,
          status: prayerRequests.status,
          urgency: prayerRequests.urgency,
          assignedTeam: prayerRequests.assignedTeam,
          contactFirstName: churchContacts.firstName,
          contactLastName: churchContacts.lastName,
          contactPhone: churchContacts.phone,
          contactEmail: churchContacts.email,
        })
        .from(prayerRequests)
        .leftJoin(churchContacts, eq(prayerRequests.contactId, churchContacts.id))
        .where(
          and(
            eq(prayerRequests.organizationId, organizationId),
            eq(prayerRequests.id, requestId)
          )
        )
        .limit(1);

      if (!requestRow) {
        throw new NonRetriableError(`Prayer request not found: ${requestId}`);
      }

      if (!isPrayerRequestActive(requestRow.status)) {
        return {
          skip: true,
          reason: `Prayer request status is ${requestRow.status}`,
        } as const;
      }

      const [orgConfig] = await db
        .select({ churchName: aiConfig.churchName })
        .from(aiConfig)
        .where(eq(aiConfig.organizationId, organizationId))
        .limit(1);

      const churchName = trimOrNull(orgConfig?.churchName) ?? "your church";
      const contactFullName = `${requestRow.contactFirstName ?? ""} ${requestRow.contactLastName ?? ""}`.trim();
      const resolvedName =
        trimOrNull(requestRow.contactName) ??
        trimOrNull(contactFullName) ??
        "Friend";
      const firstName = resolvedName.split(" ")[0] || "Friend";
      const recipientPhone = normalizePhone(requestRow.contactPhone);
      const recipientEmail = trimOrNull(requestRow.contactEmail);
      const channel: "sms" | "email" | null = recipientPhone
        ? "sms"
        : recipientEmail
          ? "email"
          : null;

      const session = await getOrCreateGraceSession({
        organizationId,
        channel: channel === "sms" ? "sms" : "web",
        actorType: "system",
        contactId: requestRow.contactId ?? null,
      });

      const conversationId =
        channel && requestRow.contactId
          ? (
              await db
                .select({ id: conversations.id })
                .from(conversations)
                .where(
                  and(
                    eq(conversations.organizationId, organizationId),
                    eq(conversations.contactId, requestRow.contactId),
                    eq(conversations.channel, channel)
                  )
                )
                .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
                .limit(1)
            )[0]?.id ??
            (
              await db
                .insert(conversations)
                .values({
                  organizationId,
                  contactId: requestRow.contactId,
                  channel,
                  status: "open",
                  subject: "Prayer request care",
                })
                .returning({ id: conversations.id })
            )[0]?.id ??
            null
          : null;

      return {
        skip: false,
        context: {
          organizationId,
          requestId: requestRow.requestId,
          sessionId: session.id,
          conversationId,
          contactId: requestRow.contactId ?? null,
          contactName: resolvedName,
          firstName,
          recipientPhone,
          recipientEmail,
          channel,
          churchName,
          assignedTeam: trimOrNull(requestRow.assignedTeam) ?? "Prayer Team",
          content: requestRow.content,
          status: requestRow.status,
          urgency: requestRow.urgency,
        } satisfies PreparedContext,
      } as const;
    });

    if (prepared.skip) {
      logger.info("Prayer follow-up skipped", {
        organizationId,
        requestId,
        reason: prepared.reason,
      });
      return { status: "skipped", reason: prepared.reason };
    }

    const run = prepared.context;
    const ackMessageKey = `prayer-ack:${run.requestId}`;
    const ackMessageText = buildPrayerAcknowledgmentMessage({
      firstName: run.firstName,
      churchName: run.churchName,
      assignedTeam: run.assignedTeam,
      urgency: run.urgency,
    });

    const ackResult = await step.run("send-acknowledgment", async () => {
      const [alreadySent] = await db
        .select({ id: graceMessages.id })
        .from(graceMessages)
        .where(
          and(
            eq(graceMessages.organizationId, run.organizationId),
            eq(graceMessages.providerMessageId, ackMessageKey)
          )
        )
        .limit(1);

      if (alreadySent) {
        return { sent: false, reason: "already_acknowledged" as const };
      }

      let deliveryStatus: "sent" | "pending" = "pending";
      let deliveryError: string | null = null;

      if (run.channel === "sms" && run.recipientPhone) {
        const smsProvider = await resolveSmsProvider(run.organizationId);
        if (!smsProvider) {
          deliveryError = "SMS provider not configured";
        } else {
          const result = await sendTextBeeSMS({
            to: run.recipientPhone,
            message: ackMessageText,
            idempotencyKey: ackMessageKey,
            config: smsProvider,
          });
          if (result.success) {
            deliveryStatus = "sent";
          } else {
            deliveryError = result.error;
          }
        }
      } else if (run.channel === "email" && run.recipientEmail) {
        try {
          await sendMail(
            run.recipientEmail,
            `We received your prayer request — ${run.churchName}`,
            ackMessageText
          );
          deliveryStatus = "sent";
        } catch (error) {
          deliveryError = error instanceof Error ? error.message : "Email delivery failed";
        }
      } else {
        return { sent: false, reason: "no_recipient_channel" as const };
      }

      if (run.conversationId) {
        await db.insert(messages).values({
          conversationId: run.conversationId,
          content: ackMessageText,
          direction: "outbound",
          senderType: "ai",
        });

        await db
          .update(conversations)
          .set({ lastMessageAt: new Date(), updatedAt: new Date() })
          .where(eq(conversations.id, run.conversationId));
      }

      await db.insert(graceFollowupProposals).values({
        organizationId: run.organizationId,
        sessionId: run.sessionId,
        contactId: run.contactId,
        actorType: "system",
        channel: run.channel ?? "web",
        proposedChannel: run.channel ?? "web",
        recipient: run.recipientPhone ?? run.recipientEmail,
        subject: "Prayer request acknowledgment",
        messageText: ackMessageText,
        reason: "prayer_request_acknowledgment",
        status: deliveryStatus,
        metadataJson: {
          sequence: "prayer_request_followup",
          trigger,
          requestId: run.requestId,
          urgency: run.urgency,
          deliveryError,
        },
      });

      if (deliveryStatus === "sent") {
        try {
          await db.insert(graceMessages).values({
            organizationId: run.organizationId,
            sessionId: run.sessionId,
            contactId: run.contactId,
            direction: "outbound",
            channel: run.channel ?? "web",
            messageText: ackMessageText,
            providerMessageId: ackMessageKey,
            metadataJson: {
              sequence: "prayer_request_followup",
              requestId: run.requestId,
              trigger,
            },
          });
        } catch (error) {
          if (!isUniqueViolation(error)) {
            throw error;
          }
        }
      }

      return {
        sent: deliveryStatus === "sent",
        reason:
          deliveryStatus === "sent" ? ("acknowledgment_sent" as const) : ("delivery_pending" as const),
      };
    });

    const escalationResult = await step.run("route-escalation", async () => {
      if (run.urgency === "normal") {
        return { escalated: false, reason: "normal_urgency" as const };
      }

      const escalationKey = `prayer-escalation:${run.requestId}:${run.urgency}`;
      const [alreadyEscalated] = await db
        .select({ id: graceMessages.id })
        .from(graceMessages)
        .where(
          and(
            eq(graceMessages.organizationId, run.organizationId),
            eq(graceMessages.providerMessageId, escalationKey)
          )
        )
        .limit(1);

      if (alreadyEscalated) {
        return { escalated: false, reason: "already_escalated" as const };
      }

      const escalationReasons = ["prayer_request_urgent", "prayer_request_critical"] as const;
      const [existingOpenHandoff] = await db
        .select({ id: graceHandoffs.id })
        .from(graceHandoffs)
        .where(
          and(
            eq(graceHandoffs.organizationId, run.organizationId),
            eq(graceHandoffs.sessionId, run.sessionId),
            eq(graceHandoffs.status, "open"),
            inArray(graceHandoffs.reason, [...escalationReasons])
          )
        )
        .limit(1);

      const handoffId =
        existingOpenHandoff?.id ??
        (
          await db
            .insert(graceHandoffs)
            .values({
              organizationId: run.organizationId,
              sessionId: run.sessionId,
              contactId: run.contactId,
              actorType: "system",
              reason:
                run.urgency === "critical"
                  ? "prayer_request_critical"
                  : "prayer_request_urgent",
              summaryText: `Prayer request escalated to ${run.assignedTeam}.`,
              assignedTeam: run.assignedTeam,
              status: "open",
              metadataJson: {
                sequence: "prayer_request_followup",
                requestId: run.requestId,
                trigger,
                urgency: run.urgency,
              },
            })
            .returning({ id: graceHandoffs.id })
        )[0]?.id ??
        null;

      const taskMarker = buildPrayerEscalationTaskMarker(run.requestId);
      const [existingOpenTask] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, run.organizationId),
            inArray(tasks.status, TASK_OPEN_STATUSES),
            ilike(tasks.description, `%${taskMarker}%`)
          )
        )
        .limit(1);

      const escalationTaskId =
        existingOpenTask?.id ??
        (
          await db
            .insert(tasks)
            .values({
              organizationId: run.organizationId,
              title: buildPrayerEscalationTaskTitle({
                requesterName: run.contactName,
                urgency: run.urgency,
              }),
              description: [
                taskMarker,
                `Assigned Team: ${run.assignedTeam}`,
                `Prayer request: ${run.content}`,
              ].join("\n"),
              priority: run.urgency === "critical" ? "urgent" : "high",
              status: "todo",
              dueDate:
                run.urgency === "critical"
                  ? new Date(Date.now() + 60 * 60 * 1000)
                  : new Date(Date.now() + 6 * 60 * 60 * 1000),
            })
            .returning({ id: tasks.id })
        )[0]?.id ??
        null;

      const escalationMessageText =
        run.urgency === "critical"
          ? `Grace escalated a critical prayer request to ${run.assignedTeam}.`
          : `Grace escalated an urgent prayer request to ${run.assignedTeam}.`;

      await db.insert(graceFollowupProposals).values({
        organizationId: run.organizationId,
        sessionId: run.sessionId,
        contactId: run.contactId,
        actorType: "system",
        channel: "in_app",
        proposedChannel: "in_app",
        recipient: null,
        subject: "Prayer request escalation",
        messageText: escalationMessageText,
        reason: "prayer_request_escalation",
        status: "pending",
        metadataJson: {
          sequence: "prayer_request_followup",
          trigger,
          requestId: run.requestId,
          urgency: run.urgency,
          handoffId,
          taskId: escalationTaskId,
        },
      });

      await db.insert(graceMessages).values({
        organizationId: run.organizationId,
        sessionId: run.sessionId,
        contactId: run.contactId,
        direction: "outbound",
        channel: "in_app",
        messageText: escalationMessageText,
        providerMessageId: escalationKey,
        metadataJson: {
          sequence: "prayer_request_followup",
          trigger,
          requestId: run.requestId,
          urgency: run.urgency,
          handoffId,
          taskId: escalationTaskId,
        },
      });

      return {
        escalated: true,
        handoffId,
        taskId: escalationTaskId,
      };
    });

    logger.info("Prayer request follow-up processed", {
      organizationId,
      requestId,
      trigger,
      acknowledgment: ackResult,
      escalation: escalationResult,
    });

    return {
      status: "completed",
      trigger,
      acknowledgment: ackResult,
      escalation: escalationResult,
    };
  }
);
