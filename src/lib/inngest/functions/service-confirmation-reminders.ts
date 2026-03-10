import { inngest } from "../client";
import { db } from "@/db";
import {
  churchContacts,
  graceMessages,
  organizations,
  serviceAssignments,
  serviceRuns,
  serviceTemplateRoleSlots,
  tasks,
  volunteers,
} from "@/db/schema";
import { and, eq, inArray, lte, gte, ne } from "drizzle-orm";
import { INNGEST_RETRY_PROFILES } from "../policy";
import { resolveSmsProvider } from "@/lib/grace/providers/resolver";
import { sendTextBeeSMS } from "@/lib/grace/channels/sms/textbee";
import { getOrCreateGraceSession } from "@/lib/grace/runtime";

type ReminderMilestone = {
  key: "t48" | "t24" | "t2";
  hoursBefore: number;
  label: string;
};

const REMINDER_MILESTONES: ReminderMilestone[] = [
  { key: "t48", hoursBefore: 48, label: "48-hour reminder" },
  { key: "t24", hoursBefore: 24, label: "24-hour reminder" },
  { key: "t2", hoursBefore: 2, label: "2-hour reminder" },
];

const REMINDER_ELIGIBLE_STATUSES = [
  "offered",
  "proposed",
  "declined",
  "needs_replacement",
] as const;

const SERVICE_RUN_ACTIVE_STATUSES = ["planned", "in_progress"] as const;
const TASK_OPEN_STATUSES = ["todo", "in_progress"] as const;
const REMINDER_WINDOW_HOURS = 0.75;

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizePhoneNumber(value: string | null | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

function formatShortDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getReminderMilestone(serviceAt: Date, now: Date) {
  const hoursUntil = (serviceAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntil <= 0) {
    return null;
  }

  return (
    REMINDER_MILESTONES.find(
      (milestone) =>
        Math.abs(hoursUntil - milestone.hoursBefore) <= REMINDER_WINDOW_HOURS
    ) ?? null
  );
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function buildReminderMessage(params: {
  churchName: string;
  roleName: string;
  serviceAt: Date;
  milestone: ReminderMilestone;
}) {
  const whenText = formatShortDateTime(params.serviceAt);
  if (params.milestone.key === "t2") {
    return `Grace ${params.milestone.label}: please confirm ${params.roleName} for ${whenText}. Reply YES to confirm or NO if unavailable.`;
  }
  return `Grace ${params.milestone.label} from ${params.churchName}: are you still available for ${params.roleName} on ${whenText}? Reply YES to confirm or NO to decline.`;
}

type EscalationCandidate = {
  organizationId: string;
  serviceRunId: string;
  serviceRunName: string;
  serviceAt: Date;
  roleName: string;
  status: string;
  isRequired: boolean;
};

export const serviceConfirmationReminders = inngest.createFunction(
  { id: "service-confirmation-reminders", retries: INNGEST_RETRY_PROFILES.SCHEDULED },
  { cron: "0 * * * *" }, // Hourly
  async ({ step, logger }) => {
    const now = new Date();
    const lookaheadStart = now;
    const lookaheadEnd = new Date(now.getTime() + 49 * 60 * 60 * 1000);

    const reminderRows = await step.run("load-reminder-candidates", async () => {
      return db
        .select({
          assignmentId: serviceAssignments.id,
          assignmentStatus: serviceAssignments.status,
          roleName: serviceAssignments.roleName,
          organizationId: serviceAssignments.organizationId,
          serviceRunId: serviceAssignments.serviceRunId,
          serviceRunName: serviceRuns.name,
          serviceRunAt: serviceRuns.serviceAt,
          contactId: churchContacts.id,
          contactPhone: churchContacts.phone,
          churchName: organizations.name,
        })
        .from(serviceAssignments)
        .innerJoin(serviceRuns, eq(serviceAssignments.serviceRunId, serviceRuns.id))
        .leftJoin(volunteers, eq(serviceAssignments.volunteerId, volunteers.id))
        .leftJoin(churchContacts, eq(volunteers.contactId, churchContacts.id))
        .innerJoin(organizations, eq(serviceAssignments.organizationId, organizations.id))
        .where(
          and(
            inArray(serviceAssignments.status, [...REMINDER_ELIGIBLE_STATUSES]),
            inArray(serviceRuns.status, [...SERVICE_RUN_ACTIVE_STATUSES]),
            gte(serviceRuns.serviceAt, lookaheadStart),
            lte(serviceRuns.serviceAt, lookaheadEnd)
          )
        );
    });

    const reminderCandidatesRaw = reminderRows
      .map((row) => {
        const serviceAt = toDate(row.serviceRunAt);
        if (!serviceAt) return null;
        const milestone = getReminderMilestone(serviceAt, now);
        if (!milestone) return null;
        return {
          ...row,
          serviceAt,
          milestone,
          reminderKey: `service-reminder:${row.assignmentId}:${milestone.key}`,
          normalizedPhone: normalizePhoneNumber(row.contactPhone),
        };
      });
    const reminderCandidates = reminderCandidatesRaw.filter(
      (
        row
      ): row is NonNullable<(typeof reminderCandidatesRaw)[number]> =>
        Boolean(row)
    );

    const existingReminderLogs = reminderCandidates.length
      ? await step.run("load-existing-reminder-logs", async () => {
          return db
            .select({ providerMessageId: graceMessages.providerMessageId })
            .from(graceMessages)
            .where(
              inArray(
                graceMessages.providerMessageId,
                reminderCandidates.map((row) => row.reminderKey)
              )
            );
        })
      : [];

    const existingReminderKeys = new Set(
      existingReminderLogs
        .map((row) => row.providerMessageId)
        .filter((id): id is string => Boolean(id))
    );

    const providerByOrg = new Map<
      string,
      Awaited<ReturnType<typeof resolveSmsProvider>> | null
    >();
    const sessionByOrg = new Map<string, string>();

    let sent = 0;
    let skippedAlreadySent = 0;
    let skippedNoProvider = 0;
    let skippedNoPhone = 0;
    let failed = 0;

    for (const row of reminderCandidates) {
      if (existingReminderKeys.has(row.reminderKey)) {
        skippedAlreadySent += 1;
        continue;
      }

      if (!row.normalizedPhone) {
        skippedNoPhone += 1;
        continue;
      }

      if (!providerByOrg.has(row.organizationId)) {
        providerByOrg.set(
          row.organizationId,
          await resolveSmsProvider(row.organizationId)
        );
      }
      const smsProvider = providerByOrg.get(row.organizationId) ?? null;

      if (!smsProvider) {
        skippedNoProvider += 1;
        continue;
      }

      const message = buildReminderMessage({
        churchName: row.churchName || "your church",
        roleName: row.roleName,
        serviceAt: row.serviceAt,
        milestone: row.milestone,
      });

      const sendResult = await sendTextBeeSMS({
        to: row.normalizedPhone,
        message,
        idempotencyKey: row.reminderKey,
        config: smsProvider,
      });

      if (!sendResult.success) {
        failed += 1;
        continue;
      }

      try {
        if (!sessionByOrg.has(row.organizationId)) {
          const session = await getOrCreateGraceSession({
            organizationId: row.organizationId,
            channel: "sms",
            actorType: "system",
            contactId: row.contactId ?? null,
          });
          sessionByOrg.set(row.organizationId, session.id);
        }

        await db.insert(graceMessages).values({
          organizationId: row.organizationId,
          sessionId: sessionByOrg.get(row.organizationId)!,
          contactId: row.contactId ?? null,
          direction: "outbound",
          channel: "sms",
          messageText: message,
          // Internal reminder key enables dedupe via unique index.
          providerMessageId: row.reminderKey,
          metadataJson: {
            workflow: "service_confirmation_reminders",
            milestone: row.milestone.key,
            serviceRunId: row.serviceRunId,
            assignmentId: row.assignmentId,
            textbeeMessageId: sendResult.providerMessageId,
          },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }

      sent += 1;
    }

    const t2Start = new Date(now.getTime() + (2 - REMINDER_WINDOW_HOURS) * 60 * 60 * 1000);
    const t2End = new Date(now.getTime() + (2 + REMINDER_WINDOW_HOURS) * 60 * 60 * 1000);

    const escalationRows = await step.run("load-t2-escalation-candidates", async () => {
      return db
        .select({
          organizationId: serviceAssignments.organizationId,
          serviceRunId: serviceAssignments.serviceRunId,
          serviceRunName: serviceRuns.name,
          serviceAt: serviceRuns.serviceAt,
          roleName: serviceAssignments.roleName,
          status: serviceAssignments.status,
          isRequired: serviceTemplateRoleSlots.isRequired,
        })
        .from(serviceAssignments)
        .innerJoin(serviceRuns, eq(serviceAssignments.serviceRunId, serviceRuns.id))
        .leftJoin(serviceTemplateRoleSlots, eq(serviceAssignments.roleSlotId, serviceTemplateRoleSlots.id))
        .where(
          and(
            inArray(serviceRuns.status, [...SERVICE_RUN_ACTIVE_STATUSES]),
            gte(serviceRuns.serviceAt, t2Start),
            lte(serviceRuns.serviceAt, t2End),
            ne(serviceAssignments.status, "confirmed"),
            ne(serviceAssignments.status, "checked_in"),
            ne(serviceAssignments.status, "checked_out")
          )
        );
    });

    const escalationByRun = new Map<string, EscalationCandidate[]>();
    for (const row of escalationRows) {
      const serviceAt = toDate(row.serviceAt);
      if (!serviceAt) continue;
      const isRequired = row.isRequired ?? true;
      if (!isRequired) continue;
      const key = `${row.organizationId}:${row.serviceRunId}`;
      const list = escalationByRun.get(key) ?? [];
      list.push({
        organizationId: row.organizationId,
        serviceRunId: row.serviceRunId,
        serviceRunName: row.serviceRunName,
        serviceAt,
        roleName: row.roleName,
        status: row.status,
        isRequired,
      });
      escalationByRun.set(key, list);
    }

    let escalationsCreated = 0;
    for (const rows of escalationByRun.values()) {
      const first = rows[0];
      const taskTitle = `URGENT coverage gap (${first.serviceRunId})`;
      const [existingTask] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, first.organizationId),
            eq(tasks.title, taskTitle),
            inArray(tasks.status, [...TASK_OPEN_STATUSES])
          )
        )
        .limit(1);

      if (existingTask) {
        continue;
      }

      const roleSummary = Array.from(new Set(rows.map((row) => row.roleName))).join(", ");
      const dueDate = new Date(
        Math.max(Date.now() + 15 * 60 * 1000, first.serviceAt.getTime() - 30 * 60 * 1000)
      );

      await db.insert(tasks).values({
        organizationId: first.organizationId,
        title: taskTitle,
        description: `Service run "${first.serviceRunName}" at ${formatShortDateTime(
          first.serviceAt
        )} has unconfirmed required seats within 2 hours. Open required roles: ${
          roleSummary || "See assignments board"
        }.`,
        priority: "urgent",
        status: "todo",
        dueDate,
      });
      escalationsCreated += 1;
    }

    logger.info("Service confirmation reminders processed", {
      reminderCandidates: reminderCandidates.length,
      sent,
      skippedAlreadySent,
      skippedNoProvider,
      skippedNoPhone,
      failed,
      escalationsCreated,
    });

    return {
      reminderCandidates: reminderCandidates.length,
      sent,
      skippedAlreadySent,
      skippedNoProvider,
      skippedNoPhone,
      failed,
      escalationsCreated,
    };
  }
);
