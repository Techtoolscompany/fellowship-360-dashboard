import { and, desc, eq, gte, ilike, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  aiConfig,
  appointments,
  churchContacts,
  conversations,
  graceFollowupProposals,
  graceMessages,
  messages,
  tasks,
} from "@/db/schema";
import sendMail from "@/lib/email/sendMail";
import { getOrCreateGraceSession } from "@/lib/grace/runtime";
import { sendOrganizationSms } from "@/lib/sms-gateway/send";
import { inngest } from "../client";
import { INNGEST_RETRY_PROFILES } from "../policy";

type ReminderMilestone = {
  key: "t24" | "t2";
  hoursBefore: number;
  label: string;
};

type ReminderCandidate = {
  appointmentId: string;
  organizationId: string;
  contactId: string | null;
  title: string;
  dateTime: Date;
  status: string;
  contactPhone: string | null;
  contactEmail: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  churchName: string;
  milestone: ReminderMilestone;
  channel: "sms" | "email" | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  firstName: string;
  reminderKey: string;
};

const APPOINTMENT_REMINDER_MILESTONES: ReminderMilestone[] = [
  { key: "t24", hoursBefore: 24, label: "24-hour reminder" },
  { key: "t2", hoursBefore: 2, label: "2-hour reminder" },
];

const APPOINTMENT_REMINDER_STATUSES: Array<"scheduled" | "confirmed"> = [
  "scheduled",
  "confirmed",
];
const TASK_OPEN_STATUSES: Array<"todo" | "in_progress"> = ["todo", "in_progress"];
const REMINDER_WINDOW_HOURS = 0.75;

function normalizePhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

function trimOrNull(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatShortDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getReminderMilestone(appointmentAt: Date, now: Date) {
  const hoursUntil = (appointmentAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntil <= 0) {
    return null;
  }
  return (
    APPOINTMENT_REMINDER_MILESTONES.find(
      (milestone) =>
        Math.abs(hoursUntil - milestone.hoursBefore) <= REMINDER_WINDOW_HOURS
    ) ?? null
  );
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildAppointmentReminderMessage(params: {
  firstName: string;
  churchName: string;
  title: string;
  dateTime: Date;
  milestone: ReminderMilestone;
}) {
  const when = formatShortDateTime(params.dateTime);
  if (params.milestone.key === "t2") {
    return `Hi ${params.firstName}, this is Grace from ${params.churchName}. Your appointment "${params.title}" is in about 2 hours (${when}). Reply if you need to reschedule.`;
  }
  return `Hi ${params.firstName}, this is Grace from ${params.churchName}. Friendly reminder for your appointment "${params.title}" on ${when}. Reply if you need anything before then.`;
}

function buildNoShowRecoveryMessage(params: {
  firstName: string;
  churchName: string;
  title: string;
  dateTime: Date;
}) {
  return `Hi ${params.firstName}, this is Grace from ${params.churchName}. We missed you for "${params.title}" at ${formatShortDateTime(
    params.dateTime
  )}. We care about you and can help reschedule when you’re ready.`;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export const appointmentRemindersNoShowRecovery = inngest.createFunction(
  { id: "sequence-appointment-reminders-no-show-recovery", retries: INNGEST_RETRY_PROFILES.SCHEDULED },
  { cron: "0 * * * *" },
  async ({ step, logger }) => {
    const now = new Date();
    const reminderLookaheadEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const noShowLookbackStart = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    const [reminderRows, noShowRows] = await Promise.all([
      step.run("load-appointment-reminder-candidates", async () =>
        db
          .select({
            appointmentId: appointments.id,
            organizationId: appointments.organizationId,
            contactId: appointments.contactId,
            title: appointments.title,
            dateTime: appointments.dateTime,
            status: appointments.status,
            contactPhone: churchContacts.phone,
            contactEmail: churchContacts.email,
            contactFirstName: churchContacts.firstName,
            contactLastName: churchContacts.lastName,
            churchName: aiConfig.churchName,
          })
          .from(appointments)
          .leftJoin(churchContacts, eq(appointments.contactId, churchContacts.id))
          .leftJoin(aiConfig, eq(appointments.organizationId, aiConfig.organizationId))
          .where(
            and(
              inArray(appointments.status, APPOINTMENT_REMINDER_STATUSES),
              gte(appointments.dateTime, now),
              lte(appointments.dateTime, reminderLookaheadEnd)
            )
          )
      ),
      step.run("load-no-show-candidates", async () =>
        db
          .select({
            appointmentId: appointments.id,
            organizationId: appointments.organizationId,
            contactId: appointments.contactId,
            title: appointments.title,
            dateTime: appointments.dateTime,
            status: appointments.status,
            contactPhone: churchContacts.phone,
            contactEmail: churchContacts.email,
            contactFirstName: churchContacts.firstName,
            contactLastName: churchContacts.lastName,
            churchName: aiConfig.churchName,
          })
          .from(appointments)
          .leftJoin(churchContacts, eq(appointments.contactId, churchContacts.id))
          .leftJoin(aiConfig, eq(appointments.organizationId, aiConfig.organizationId))
          .where(
            and(
              eq(appointments.status, "no_show"),
              gte(appointments.dateTime, noShowLookbackStart),
              lte(appointments.dateTime, now)
            )
          )
      ),
    ]);

    const reminderCandidates = reminderRows
      .map((row): ReminderCandidate | null => {
        const appointmentAt = toDate(row.dateTime);
        if (!appointmentAt) return null;
        const milestone = getReminderMilestone(appointmentAt, now);
        if (!milestone) return null;
        const phone = normalizePhone(row.contactPhone);
        const email = trimOrNull(row.contactEmail);
        const channel: "sms" | "email" | null = phone ? "sms" : email ? "email" : null;
        return {
          ...row,
          dateTime: appointmentAt,
          milestone,
          channel,
          recipientPhone: phone,
          recipientEmail: email,
          firstName: trimOrNull(row.contactFirstName) || "there",
          churchName: trimOrNull(row.churchName) || "your church",
          reminderKey: `appointment-reminder:${row.appointmentId}:${milestone.key}`,
        };
      })
      .filter((row): row is ReminderCandidate => row !== null);

    const reminderKeys = reminderCandidates.map((row) => row.reminderKey);
    const existingReminderLogs = reminderKeys.length
      ? await step.run("load-existing-reminder-logs", async () =>
          db
            .select({ providerMessageId: graceMessages.providerMessageId })
            .from(graceMessages)
            .where(inArray(graceMessages.providerMessageId, reminderKeys))
        )
      : [];

    const existingReminderKeySet = new Set(
      existingReminderLogs
        .map((row) => row.providerMessageId)
        .filter((value): value is string => Boolean(value))
    );

    const sessionByScope = new Map<string, string>();
    const conversationByScope = new Map<string, string | null>();

    const getSessionId = async (params: {
      organizationId: string;
      contactId: string | null;
      channel: "sms" | "email" | null;
    }) => {
      const scopeKey = `${params.organizationId}:${params.contactId ?? "anon"}:${params.channel ?? "none"}`;
      const cached = sessionByScope.get(scopeKey);
      if (cached) return cached;
      const session = await getOrCreateGraceSession({
        organizationId: params.organizationId,
        channel: params.channel === "sms" ? "sms" : "web",
        actorType: "system",
        contactId: params.contactId ?? null,
      });
      sessionByScope.set(scopeKey, session.id);
      return session.id;
    };

    const ensureConversationId = async (params: {
      organizationId: string;
      contactId: string | null;
      channel: "sms" | "email" | null;
      subject: string;
    }) => {
      if (!params.contactId || !params.channel) return null;
      const scopeKey = `${params.organizationId}:${params.contactId}:${params.channel}`;
      if (conversationByScope.has(scopeKey)) {
        return conversationByScope.get(scopeKey) ?? null;
      }

      const [existingConversation] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.organizationId, params.organizationId),
            eq(conversations.contactId, params.contactId),
            eq(conversations.channel, params.channel)
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
              organizationId: params.organizationId,
              contactId: params.contactId,
              channel: params.channel,
              status: "open",
              subject: params.subject,
            })
            .returning({ id: conversations.id })
        )[0]?.id ??
        null;

      conversationByScope.set(scopeKey, conversationId);
      return conversationId;
    };

    let remindersSent = 0;
    let remindersPending = 0;
    let remindersSkippedAlreadyLogged = 0;
    let remindersSkippedNoRecipient = 0;

    for (const row of reminderCandidates) {
      if (existingReminderKeySet.has(row.reminderKey)) {
        remindersSkippedAlreadyLogged += 1;
        continue;
      }

      if (!row.channel) {
        remindersSkippedNoRecipient += 1;
        continue;
      }

      const messageText = buildAppointmentReminderMessage({
        firstName: row.firstName,
        churchName: row.churchName,
        title: row.title,
        dateTime: row.dateTime,
        milestone: row.milestone,
      });

      let deliveryStatus: "sent" | "pending" = "pending";
      let deliveryError: string | null = null;

      if (row.channel === "sms" && row.recipientPhone) {
        const sendResult = await sendOrganizationSms({
          organizationId: row.organizationId,
          to: row.recipientPhone,
          message: messageText,
          idempotencyKey: row.reminderKey,
        });
        if (sendResult.success) {
          deliveryStatus = "sent";
        } else {
          deliveryError = sendResult.error;
        }
      } else if (row.channel === "email" && row.recipientEmail) {
        try {
          await sendMail(
            row.recipientEmail,
            `Appointment reminder — ${row.churchName}`,
            messageText
          );
          deliveryStatus = "sent";
        } catch (error) {
          deliveryError = error instanceof Error ? error.message : "Email delivery failed";
        }
      }

      if (deliveryStatus === "sent") {
        remindersSent += 1;
      } else {
        remindersPending += 1;
      }

      const sessionId = await getSessionId({
        organizationId: row.organizationId,
        contactId: row.contactId,
        channel: row.channel,
      });
      const conversationId = await ensureConversationId({
        organizationId: row.organizationId,
        contactId: row.contactId,
        channel: row.channel,
        subject: "Appointment reminders",
      });

      if (conversationId) {
        await db.insert(messages).values({
          conversationId,
          direction: "outbound",
          senderType: "ai",
          content: messageText,
        });

        await db
          .update(conversations)
          .set({ lastMessageAt: new Date(), updatedAt: new Date() })
          .where(eq(conversations.id, conversationId));
      }

      await db.insert(graceFollowupProposals).values({
        organizationId: row.organizationId,
        sessionId,
        contactId: row.contactId,
        actorType: "system",
        channel: row.channel,
        proposedChannel: row.channel,
        recipient: row.recipientPhone ?? row.recipientEmail,
        subject: "Appointment reminder",
        messageText,
        reason: `appointment_reminder_${row.milestone.key}`,
        status: deliveryStatus,
        metadataJson: {
          sequence: "appointment_reminders_no_show_recovery",
          appointmentId: row.appointmentId,
          milestone: row.milestone.key,
          deliveryError,
        },
      });

      if (deliveryStatus === "sent") {
        try {
          await db.insert(graceMessages).values({
            organizationId: row.organizationId,
            sessionId,
            contactId: row.contactId,
            direction: "outbound",
            channel: row.channel,
            messageText,
            providerMessageId: row.reminderKey,
            metadataJson: {
              sequence: "appointment_reminders_no_show_recovery",
              appointmentId: row.appointmentId,
              milestone: row.milestone.key,
            },
          });
        } catch (error) {
          if (!isUniqueViolation(error)) {
            throw error;
          }
        }
      }
    }

    const noShowKeys = noShowRows.map((row) => `appointment-noshow:${row.appointmentId}:recovery1`);
    const existingNoShowLogs = noShowKeys.length
      ? await step.run("load-existing-no-show-logs", async () =>
          db
            .select({ providerMessageId: graceMessages.providerMessageId })
            .from(graceMessages)
            .where(inArray(graceMessages.providerMessageId, noShowKeys))
        )
      : [];
    const existingNoShowKeySet = new Set(
      existingNoShowLogs
        .map((row) => row.providerMessageId)
        .filter((value): value is string => Boolean(value))
    );

    let noShowProcessed = 0;
    let noShowTasksCreated = 0;

    for (const row of noShowRows) {
      const noShowKey = `appointment-noshow:${row.appointmentId}:recovery1`;
      if (existingNoShowKeySet.has(noShowKey)) {
        continue;
      }
      const appointmentAt = toDate(row.dateTime);
      if (!appointmentAt) {
        continue;
      }

      const phone = normalizePhone(row.contactPhone);
      const email = trimOrNull(row.contactEmail);
      const channel: "sms" | "email" | null = phone ? "sms" : email ? "email" : null;
      const firstName = trimOrNull(row.contactFirstName) || "there";
      const churchName = trimOrNull(row.churchName) || "your church";
      const messageText = buildNoShowRecoveryMessage({
        firstName,
        churchName,
        title: row.title,
        dateTime: appointmentAt,
      });

      let deliveryStatus: "sent" | "pending" = "pending";
      let deliveryError: string | null = null;

      if (channel === "sms" && phone) {
        const sendResult = await sendOrganizationSms({
          organizationId: row.organizationId,
          to: phone,
          message: messageText,
          idempotencyKey: noShowKey,
        });
        if (sendResult.success) {
          deliveryStatus = "sent";
        } else {
          deliveryError = sendResult.error;
        }
      } else if (channel === "email" && email) {
        try {
          await sendMail(email, `We missed you — ${churchName}`, messageText);
          deliveryStatus = "sent";
        } catch (error) {
          deliveryError = error instanceof Error ? error.message : "Email delivery failed";
        }
      } else {
        deliveryError = "No recipient channel available";
      }

      const sessionId = await getSessionId({
        organizationId: row.organizationId,
        contactId: row.contactId,
        channel,
      });
      const conversationId = await ensureConversationId({
        organizationId: row.organizationId,
        contactId: row.contactId,
        channel,
        subject: "Appointment no-show recovery",
      });

      if (conversationId) {
        await db.insert(messages).values({
          conversationId,
          direction: "outbound",
          senderType: "ai",
          content: messageText,
        });
        await db
          .update(conversations)
          .set({ lastMessageAt: new Date(), updatedAt: new Date() })
          .where(eq(conversations.id, conversationId));
      }

      const taskMarker = `[AppointmentNoShow:${row.appointmentId}]`;
      const [existingTask] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, row.organizationId),
            inArray(tasks.status, TASK_OPEN_STATUSES),
            ilike(tasks.description, `%${taskMarker}%`)
          )
        )
        .limit(1);

      let noShowTaskId = existingTask?.id ?? null;
      if (!noShowTaskId) {
        const [task] = await db
          .insert(tasks)
          .values({
            organizationId: row.organizationId,
            title: `No-show follow-up: ${firstName}`,
            description: `${taskMarker}\nAppointment "${row.title}" missed at ${formatShortDateTime(
              appointmentAt
            )}. Reach out and offer to reschedule.`,
            priority: "high",
            status: "todo",
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          })
          .returning({ id: tasks.id });
        noShowTaskId = task?.id ?? null;
        if (noShowTaskId) noShowTasksCreated += 1;
      }

      await db.insert(graceFollowupProposals).values({
        organizationId: row.organizationId,
        sessionId,
        contactId: row.contactId,
        actorType: "system",
        channel: channel ?? "web",
        proposedChannel: channel ?? "web",
        recipient: phone ?? email,
        subject: "No-show recovery outreach",
        messageText,
        reason: "appointment_no_show_recovery",
        status: deliveryStatus,
        metadataJson: {
          sequence: "appointment_reminders_no_show_recovery",
          appointmentId: row.appointmentId,
          deliveryError,
          taskId: noShowTaskId,
        },
      });

      try {
        await db.insert(graceMessages).values({
          organizationId: row.organizationId,
          sessionId,
          contactId: row.contactId,
          direction: "outbound",
          channel: channel ?? "web",
          messageText,
          providerMessageId: noShowKey,
          metadataJson: {
            sequence: "appointment_reminders_no_show_recovery",
            appointmentId: row.appointmentId,
            taskId: noShowTaskId,
            deliveryStatus,
          },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }

      noShowProcessed += 1;
    }

    logger.info("Appointment reminder/no-show sequence processed", {
      reminderCandidates: reminderCandidates.length,
      remindersSent,
      remindersPending,
      remindersSkippedAlreadyLogged,
      remindersSkippedNoRecipient,
      noShowCandidates: noShowRows.length,
      noShowProcessed,
      noShowTasksCreated,
    });

    return {
      reminders: {
        candidates: reminderCandidates.length,
        sent: remindersSent,
        pending: remindersPending,
        skippedAlreadyLogged: remindersSkippedAlreadyLogged,
        skippedNoRecipient: remindersSkippedNoRecipient,
      },
      noShowRecovery: {
        candidates: noShowRows.length,
        processed: noShowProcessed,
        tasksCreated: noShowTasksCreated,
      },
    };
  }
);
