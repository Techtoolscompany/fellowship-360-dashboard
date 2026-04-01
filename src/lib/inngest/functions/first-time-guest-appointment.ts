import { NonRetriableError } from "inngest";
import { and, desc, eq, gte, ilike, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  aiConfig,
  appointments,
  churchContacts,
  conversations,
  graceFollowupProposals,
  graceMessages,
  messages,
  pipelineItems,
  pipelineStages,
  tasks,
} from "@/db/schema";
import sendMail from "@/lib/email/sendMail";
import { getOrCreateGraceSession } from "@/lib/grace/runtime";
import {
  buildFirstTimeGuestTaskMarker,
  buildFirstTimeGuestTaskTitle,
  isFirstTimeGuestStageName,
} from "@/lib/pipeline/first-time-guest";
import { sendOrganizationSms } from "@/lib/sms-gateway/send";
import { inngest } from "../client";
import { INNGEST_EVENTS } from "../events";
import { INNGEST_RETRY_PROFILES } from "../policy";

const TASK_OPEN_STATUSES: Array<"todo" | "in_progress"> = ["todo", "in_progress"];
const ACTIVE_APPOINTMENT_STATUSES: Array<"scheduled" | "confirmed" | "completed"> = [
  "scheduled",
  "confirmed",
  "completed",
];

type EnrollmentTrigger = "created" | "stage_changed" | "ai_categorized";

type PreparedContext = {
  organizationId: string;
  pipelineItemId: string;
  stageId: string;
  stageName: string;
  contactId: string;
  contactName: string;
  firstName: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  channel: "sms" | "email";
  churchName: string;
  sessionId: string;
  conversationId: string;
  sequenceStartedAtIso: string;
};

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

function toValidDate(value: string | null | undefined) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function buildGuestAppointmentInviteMessage(params: {
  firstName: string;
  churchName: string;
}) {
  return `Hi ${params.firstName}, this is Grace from ${params.churchName}. We're glad you visited. Would you like to book a quick first-time guest appointment this week so we can answer questions and help you get connected?`;
}

function buildGuestAppointmentReminderMessage(params: {
  firstName: string;
  churchName: string;
}) {
  return `Following up from ${params.churchName}: we can reserve a short first-time guest appointment at a time that works for you. Reply with your preferred day/time and we’ll schedule it.`;
}

export const firstTimeGuestAppointmentSequence = inngest.createFunction(
  {
    id: "sequence-first-time-guest-appointment",
    retries: INNGEST_RETRY_PROFILES.CORE_AUTOMATION,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.GRACE_FIRST_TIME_GUEST_APPOINTMENT_REQUESTED },
  async ({ event, step, logger }) => {
    const {
      organizationId,
      pipelineItemId,
      trigger,
      occurredAt,
    } = event.data as {
      organizationId: string;
      pipelineItemId: string;
      trigger: EnrollmentTrigger;
      occurredAt: string;
      idempotencyKey: string;
    };

    const prepared = await step.run("prepare-context", async () => {
      const [pipelineRow] = await db
        .select({
          pipelineItemId: pipelineItems.id,
          organizationId: pipelineItems.organizationId,
          contactId: pipelineItems.contactId,
          stageId: pipelineStages.id,
          stageName: pipelineStages.name,
          contactFirstName: churchContacts.firstName,
          contactLastName: churchContacts.lastName,
          contactPhone: churchContacts.phone,
          contactEmail: churchContacts.email,
          churchName: aiConfig.churchName,
        })
        .from(pipelineItems)
        .innerJoin(pipelineStages, eq(pipelineItems.stageId, pipelineStages.id))
        .leftJoin(churchContacts, eq(pipelineItems.contactId, churchContacts.id))
        .leftJoin(aiConfig, eq(pipelineItems.organizationId, aiConfig.organizationId))
        .where(
          and(
            eq(pipelineItems.organizationId, organizationId),
            eq(pipelineItems.id, pipelineItemId)
          )
        )
        .limit(1);

      if (!pipelineRow) {
        throw new NonRetriableError(`Pipeline item not found: ${pipelineItemId}`);
      }

      if (!isFirstTimeGuestStageName(pipelineRow.stageName)) {
        return {
          skip: true,
          reason: `Stage "${pipelineRow.stageName}" is not first-time guest eligible`,
        } as const;
      }

      if (!pipelineRow.contactId) {
        return {
          skip: true,
          reason: "Pipeline item has no contact",
        } as const;
      }

      const contactName = `${pipelineRow.contactFirstName ?? ""} ${pipelineRow.contactLastName ?? ""}`
        .trim()
        .replace(/\s+/g, " ");
      const firstName = (contactName.split(" ")[0] || "").trim() || "there";

      const recipientPhone = normalizePhone(pipelineRow.contactPhone);
      const recipientEmail = trimOrNull(pipelineRow.contactEmail);
      const channel: "sms" | "email" | null = recipientPhone
        ? "sms"
        : recipientEmail
          ? "email"
          : null;

      if (!channel) {
        return {
          skip: true,
          reason: "Contact has no phone or email",
        } as const;
      }

      const session = await getOrCreateGraceSession({
        organizationId,
        channel: channel === "sms" ? "sms" : "web",
        actorType: "system",
        contactId: pipelineRow.contactId,
      });

      const [existingConversation] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.organizationId, organizationId),
            eq(conversations.contactId, pipelineRow.contactId),
            eq(conversations.channel, channel)
          )
        )
        .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
        .limit(1);

      const conversationId =
        existingConversation?.id ??
        (
          await db
            .insert(conversations)
            .values({
              organizationId,
              contactId: pipelineRow.contactId,
              channel,
              status: "open",
              subject: "First-Time Guest Appointment",
            })
            .returning({ id: conversations.id })
        )[0].id;

      return {
        skip: false,
        context: {
          organizationId,
          pipelineItemId: pipelineRow.pipelineItemId,
          stageId: pipelineRow.stageId,
          stageName: pipelineRow.stageName,
          contactId: pipelineRow.contactId,
          contactName: contactName || "Guest",
          firstName,
          recipientPhone,
          recipientEmail,
          channel,
          churchName: trimOrNull(pipelineRow.churchName) ?? "your church",
          sessionId: session.id,
          conversationId,
          sequenceStartedAtIso: toValidDate(occurredAt).toISOString(),
        } satisfies PreparedContext,
      } as const;
    });

    if (prepared.skip) {
      logger.info("First-time guest appointment sequence skipped", {
        organizationId,
        pipelineItemId,
        reason: prepared.reason,
      });
      return { status: "skipped", reason: prepared.reason };
    }

    const run = prepared.context;

    const sendSequenceMessage = async (params: {
      stepName: string;
      reason: string;
      messageKey: string;
      subject: string;
      messageText: string;
    }) =>
      step.run(params.stepName, async () => {
        const [alreadySent] = await db
          .select({ id: graceMessages.id })
          .from(graceMessages)
          .where(
            and(
              eq(graceMessages.organizationId, run.organizationId),
              eq(graceMessages.providerMessageId, params.messageKey)
            )
          )
          .limit(1);

        if (alreadySent) {
          return { sent: false, reason: "already_sent" as const };
        }

        let deliveryStatus: "sent" | "pending" = "pending";
        let deliveryError: string | null = null;

        if (run.channel === "sms" && run.recipientPhone) {
          const result = await sendOrganizationSms({
            organizationId: run.organizationId,
            to: run.recipientPhone,
            message: params.messageText,
            idempotencyKey: params.messageKey,
          });
          if (result.success) {
            deliveryStatus = "sent";
          } else {
            deliveryError = result.error;
          }
        } else if (run.channel === "email" && run.recipientEmail) {
          try {
            await sendMail(run.recipientEmail, params.subject, params.messageText);
            deliveryStatus = "sent";
          } catch (error) {
            deliveryError = error instanceof Error ? error.message : "Email delivery failed";
          }
        }

        await db.insert(messages).values({
          conversationId: run.conversationId,
          content: params.messageText,
          direction: "outbound",
          senderType: "ai",
        });

        await db
          .update(conversations)
          .set({ lastMessageAt: new Date(), updatedAt: new Date() })
          .where(eq(conversations.id, run.conversationId));

        await db.insert(graceFollowupProposals).values({
          organizationId: run.organizationId,
          sessionId: run.sessionId,
          contactId: run.contactId,
          actorType: "system",
          channel: run.channel,
          proposedChannel: run.channel,
          recipient: run.recipientPhone ?? run.recipientEmail,
          subject: params.subject,
          messageText: params.messageText,
          reason: params.reason,
          status: deliveryStatus,
          metadataJson: {
            sequence: "first_time_guest_appointment",
            trigger,
            pipelineItemId: run.pipelineItemId,
            stageId: run.stageId,
            step: params.reason,
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
              channel: run.channel,
              messageText: params.messageText,
              providerMessageId: params.messageKey,
              metadataJson: {
                sequence: "first_time_guest_appointment",
                trigger,
                pipelineItemId: run.pipelineItemId,
                stageId: run.stageId,
                step: params.reason,
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
            deliveryStatus === "sent"
              ? ("message_sent" as const)
              : ("delivery_pending" as const),
        };
      });

    const hasStopSignal = async (stepName: string) =>
      step.run(stepName, async () => {
        const sequenceStartedAt = toValidDate(run.sequenceStartedAtIso);

        const [inboundReply] = await db
          .select({ id: messages.id })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, run.conversationId),
              eq(messages.direction, "inbound"),
              gte(messages.sentAt, sequenceStartedAt)
            )
          )
          .limit(1);

        const [bookedAppointment] = await db
          .select({ id: appointments.id })
          .from(appointments)
          .where(
            and(
              eq(appointments.organizationId, run.organizationId),
              eq(appointments.contactId, run.contactId),
              gte(appointments.createdAt, sequenceStartedAt),
              inArray(appointments.status, ACTIVE_APPOINTMENT_STATUSES)
            )
          )
          .limit(1);

        return Boolean(inboundReply || bookedAppointment);
      });

    await sendSequenceMessage({
      stepName: "send-initial-appointment-invite",
      reason: "step_1_initial_invite",
      messageKey: `first-time-guest-appointment:${run.pipelineItemId}:step1`,
      subject: `Welcome from ${run.churchName}`,
      messageText: buildGuestAppointmentInviteMessage({
        firstName: run.firstName,
        churchName: run.churchName,
      }),
    });

    await step.sleep("wait-24h", "24h");
    if (await hasStopSignal("check-stop-signal-after-24h")) {
      return { status: "stopped", reason: "guest_engaged_after_initial_invite" };
    }

    await sendSequenceMessage({
      stepName: "send-appointment-invite-reminder",
      reason: "step_2_reminder_invite",
      messageKey: `first-time-guest-appointment:${run.pipelineItemId}:step2`,
      subject: `Appointment invitation from ${run.churchName}`,
      messageText: buildGuestAppointmentReminderMessage({
        firstName: run.firstName,
        churchName: run.churchName,
      }),
    });

    await step.sleep("wait-48h", "48h");
    if (await hasStopSignal("check-stop-signal-after-72h")) {
      return { status: "stopped", reason: "guest_engaged_after_reminder_invite" };
    }

    const escalationResult = await step.run("create-manual-outreach-task", async () => {
      const escalationKey = `first-time-guest-appointment:${run.pipelineItemId}:manual-escalation`;
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
        return { escalated: false, reason: "already_escalated" as const, taskId: null };
      }

      const taskMarker = buildFirstTimeGuestTaskMarker(run.pipelineItemId);
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

      const [createdTask] = existingOpenTask
        ? []
        : await db
            .insert(tasks)
            .values({
              organizationId: run.organizationId,
              title: buildFirstTimeGuestTaskTitle(run.contactName),
              description: [
                taskMarker,
                `Pipeline stage: ${run.stageName}`,
                "No reply or booked appointment after the first-time guest appointment sequence.",
                "Please call or text personally and offer next available appointment times.",
              ].join("\n"),
              priority: "high",
              status: "todo",
              dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
            })
            .returning({ id: tasks.id });

      const taskId = existingOpenTask?.id ?? createdTask?.id ?? null;
      const escalationMessage = `Grace created manual first-time guest appointment outreach for ${run.contactName}.`;

      await db.insert(graceFollowupProposals).values({
        organizationId: run.organizationId,
        sessionId: run.sessionId,
        contactId: run.contactId,
        actorType: "system",
        channel: "in_app",
        proposedChannel: "in_app",
        recipient: null,
        subject: "First-time guest manual outreach",
        messageText: escalationMessage,
        reason: "step_3_manual_outreach",
        status: "pending",
        metadataJson: {
          sequence: "first_time_guest_appointment",
          trigger,
          pipelineItemId: run.pipelineItemId,
          stageId: run.stageId,
          taskId,
        },
      });

      try {
        await db.insert(graceMessages).values({
          organizationId: run.organizationId,
          sessionId: run.sessionId,
          contactId: run.contactId,
          direction: "outbound",
          channel: "in_app",
          messageText: escalationMessage,
          providerMessageId: escalationKey,
          metadataJson: {
            sequence: "first_time_guest_appointment",
            trigger,
            pipelineItemId: run.pipelineItemId,
            stageId: run.stageId,
            taskId,
          },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }

      return { escalated: true, reason: "manual_outreach_created" as const, taskId };
    });

    logger.info("First-time guest appointment sequence processed", {
      organizationId,
      pipelineItemId,
      trigger,
      escalation: escalationResult,
    });

    return {
      status: "completed",
      trigger,
      escalation: escalationResult,
    };
  }
);
