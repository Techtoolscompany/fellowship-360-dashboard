import { NonRetriableError } from "inngest";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  churchContacts,
  graceFollowupProposals,
  graceGoalSteps,
  graceGoals,
  graceMessages,
  serviceAssignments,
  serviceRuns,
  serviceTemplateRoleSlots,
  tasks,
  volunteers,
} from "@/db/schema";
import { getOrCreateGraceSession } from "@/lib/grace/runtime";
import { inngest } from "../client";
import {
  buildGraceServiceAutostaffIdempotencyKey,
  INNGEST_EVENTS,
} from "../events";
import { INNGEST_RETRY_PROFILES } from "../policy";

const TASK_OPEN_STATUSES: Array<"todo" | "in_progress"> = ["todo", "in_progress"];
const SERVICE_RUN_ACTIVE_STATUSES: Array<"planned" | "in_progress"> = [
  "planned",
  "in_progress",
];

const AUTOSTAFF_STEP_TEMPLATES: Array<{
  stepKey: string;
  title: string;
  runOrder: number;
}> = [
  {
    stepKey: "ensure_assignments",
    title: "Ensure run has assignment seats",
    runOrder: 10,
  },
  {
    stepKey: "seed_assignments",
    title: "Auto-fill seats from recommendations",
    runOrder: 20,
  },
  {
    stepKey: "send_offers",
    title: "Send SMS offers to proposed assignees",
    runOrder: 30,
  },
  {
    stepKey: "wait_responses",
    title: "Wait for volunteer/staff responses",
    runOrder: 40,
  },
  {
    stepKey: "escalate_gaps",
    title: "Escalate unresolved required seats",
    runOrder: 50,
  },
];

function formatShortDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function toValidDate(value: Date | string | null | undefined) {
  if (!value) return new Date();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

async function seedAutostaffGoalSteps(goalId: string, organizationId: string) {
  const rows = AUTOSTAFF_STEP_TEMPLATES.map((step) => ({
    goalId,
    organizationId,
    stepKey: step.stepKey,
    title: step.title,
    runOrder: step.runOrder,
    status: "pending" as const,
  }));
  await db.insert(graceGoalSteps).values(rows);
}

export const serviceAssignmentReplacementSequence = inngest.createFunction(
  {
    id: "service-assignment-replacement-sequence",
    retries: INNGEST_RETRY_PROFILES.CORE_AUTOMATION,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.GRACE_SERVICE_ASSIGNMENT_REPLACEMENT_REQUESTED },
  async ({ event, step, logger }) => {
    const {
      organizationId,
      serviceRunId,
      assignmentId,
      reasonStatus,
      occurredAt,
    } = event.data as {
      organizationId: string;
      serviceRunId: string;
      assignmentId: string;
      reasonStatus: "needs_replacement" | "no_show";
      occurredAt: string;
      idempotencyKey: string;
    };

    const prepared = await step.run("prepare-context", async () => {
      const [row] = await db
        .select({
          assignmentId: serviceAssignments.id,
          organizationId: serviceAssignments.organizationId,
          serviceRunId: serviceAssignments.serviceRunId,
          roleName: serviceAssignments.roleName,
          roleSlotId: serviceAssignments.roleSlotId,
          assignmentStatus: serviceAssignments.status,
          serviceRunName: serviceRuns.name,
          serviceRunStatus: serviceRuns.status,
          serviceAt: serviceRuns.serviceAt,
          isRequired: serviceTemplateRoleSlots.isRequired,
          contactId: churchContacts.id,
          contactFirstName: churchContacts.firstName,
          contactLastName: churchContacts.lastName,
        })
        .from(serviceAssignments)
        .innerJoin(serviceRuns, eq(serviceAssignments.serviceRunId, serviceRuns.id))
        .leftJoin(
          serviceTemplateRoleSlots,
          eq(serviceAssignments.roleSlotId, serviceTemplateRoleSlots.id)
        )
        .leftJoin(volunteers, eq(serviceAssignments.volunteerId, volunteers.id))
        .leftJoin(churchContacts, eq(volunteers.contactId, churchContacts.id))
        .where(
          and(
            eq(serviceAssignments.organizationId, organizationId),
            eq(serviceAssignments.serviceRunId, serviceRunId),
            eq(serviceAssignments.id, assignmentId)
          )
        )
        .limit(1);

      if (!row) {
        throw new NonRetriableError(`Service assignment not found: ${assignmentId}`);
      }

      if (!["needs_replacement", "no_show"].includes(row.assignmentStatus)) {
        return {
          skip: true,
          reason: `Assignment status is ${row.assignmentStatus}`,
        } as const;
      }

      if (!SERVICE_RUN_ACTIVE_STATUSES.includes(row.serviceRunStatus as any)) {
        return {
          skip: true,
          reason: `Service run status is ${row.serviceRunStatus}`,
        } as const;
      }

      return {
        skip: false,
        context: {
          ...row,
          reasonStatus,
          occurredAt,
        },
      } as const;
    });

    if (prepared.skip) {
      logger.info("Service assignment replacement skipped", {
        organizationId,
        serviceRunId,
        assignmentId,
        reason: prepared.reason,
      });
      return { status: "skipped", reason: prepared.reason };
    }

    const run = prepared.context;

    const replacementTask = await step.run("ensure-replacement-task", async () => {
      const taskTitle = `URGENT ${run.reasonStatus.replaceAll("_", " ")} replacement · ${run.roleName} (${run.serviceRunId})`;
      const [existingTask] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, run.organizationId),
            eq(tasks.title, taskTitle),
            inArray(tasks.status, TASK_OPEN_STATUSES)
          )
        )
        .limit(1);

      if (existingTask) {
        return { taskId: existingTask.id, created: false };
      }

      const taskDescription = [
        `Grace flagged this seat as ${run.reasonStatus.replaceAll("_", " ")}.`,
        `Service: ${run.serviceRunName} at ${formatShortDateTime(run.serviceAt)}.`,
        `Role: ${run.roleName}.`,
        `Assignment ID: ${run.assignmentId}.`,
        "Action: assign replacement coverage and resend confirmation immediately.",
      ].join(" ");

      const [createdTask] = await db
        .insert(tasks)
        .values({
          organizationId: run.organizationId,
          title: taskTitle,
          description: taskDescription,
          dueDate: toValidDate(run.serviceAt),
          priority:
            run.reasonStatus === "no_show" || (run.isRequired ?? true)
              ? "urgent"
              : "high",
          status: "todo",
        })
        .returning({ id: tasks.id });

      return { taskId: createdTask.id, created: true };
    });

    const autostaffGoal = await step.run("ensure-autostaff-goal", async () => {
      const [activeGoal] = await db
        .select({
          id: graceGoals.id,
          status: graceGoals.status,
        })
        .from(graceGoals)
        .where(
          and(
            eq(graceGoals.organizationId, run.organizationId),
            eq(graceGoals.goalType, "service_staffing"),
            eq(graceGoals.serviceRunId, run.serviceRunId),
            inArray(graceGoals.status, ["queued", "in_progress", "waiting"])
          )
        )
        .orderBy(desc(graceGoals.createdAt))
        .limit(1);

      if (activeGoal) {
        return {
          goalId: activeGoal.id,
          status: activeGoal.status,
          created: false,
          dispatched: false,
          dispatchError: null,
        };
      }

      const [goal] = await db
        .insert(graceGoals)
        .values({
          organizationId: run.organizationId,
          goalType: "service_staffing",
          status: "queued",
          sourceChannel: "in_app",
          objectiveText: `Replace ${run.reasonStatus.replaceAll("_", " ")} coverage for ${run.roleName} in "${run.serviceRunName}".`,
          serviceRunId: run.serviceRunId,
          requestedByUserId: null,
          contextJson: {
            serviceRunId: run.serviceRunId,
            assignmentId: run.assignmentId,
            reasonStatus: run.reasonStatus,
            triggeredAt: run.occurredAt,
          },
        })
        .returning({ id: graceGoals.id, status: graceGoals.status });

      await seedAutostaffGoalSteps(goal.id, run.organizationId);

      let dispatched = false;
      let dispatchError: string | null = null;
      try {
        const idempotencyKey = buildGraceServiceAutostaffIdempotencyKey({
          organizationId: run.organizationId,
          serviceRunId: run.serviceRunId,
          goalId: goal.id,
        });

        await inngest.send({
          id: idempotencyKey,
          name: INNGEST_EVENTS.GRACE_SERVICE_AUTOSTAFF_REQUESTED,
          data: {
            organizationId: run.organizationId,
            serviceRunId: run.serviceRunId,
            goalId: goal.id,
            waitHours: 1,
            idempotencyKey,
          },
        });
        dispatched = true;
      } catch (error) {
        dispatchError =
          error instanceof Error
            ? error.message
            : "Failed to dispatch auto-staff workflow";
        await db
          .update(graceGoals)
          .set({
            status: "failed",
            errorText: dispatchError,
            updatedAt: new Date(),
          })
          .where(eq(graceGoals.id, goal.id));
      }

      return {
        goalId: goal.id,
        status: goal.status,
        created: true,
        dispatched,
        dispatchError,
      };
    });

    const escalation = await step.run("log-grace-escalation", async () => {
      const session = await getOrCreateGraceSession({
        organizationId: run.organizationId,
        channel: "in_app",
        actorType: "system",
        contactId: run.contactId ?? null,
      });

      const escalationKey = `service-replacement:${run.assignmentId}:${run.reasonStatus}:${run.occurredAt}`;
      const [alreadyLogged] = await db
        .select({ id: graceMessages.id })
        .from(graceMessages)
        .where(
          and(
            eq(graceMessages.organizationId, run.organizationId),
            eq(graceMessages.providerMessageId, escalationKey)
          )
        )
        .limit(1);

      if (alreadyLogged) {
        return { logged: false, reason: "already_logged" as const };
      }

      const contactName = `${run.contactFirstName ?? ""} ${run.contactLastName ?? ""}`.trim();
      const displayName = contactName || "Assigned volunteer";
      const messageText = `Grace escalated ${run.reasonStatus.replaceAll("_", " ")} replacement for ${run.roleName} in "${run.serviceRunName}" (${formatShortDateTime(
        run.serviceAt
      )}). ${displayName} is unavailable; replacement workflow is now active.`;

      await db.insert(graceFollowupProposals).values({
        organizationId: run.organizationId,
        sessionId: session.id,
        contactId: run.contactId ?? null,
        actorType: "system",
        channel: "in_app",
        proposedChannel: "in_app",
        recipient: null,
        subject: "Service replacement escalation",
        messageText,
        reason: "service_assignment_replacement_escalation",
        status: "pending",
        metadataJson: {
          sequence: "service_assignment_replacement",
          serviceRunId: run.serviceRunId,
          assignmentId: run.assignmentId,
          reasonStatus: run.reasonStatus,
          taskId: replacementTask.taskId,
          goalId: autostaffGoal.goalId,
        },
      });

      try {
        await db.insert(graceMessages).values({
          organizationId: run.organizationId,
          sessionId: session.id,
          contactId: run.contactId ?? null,
          direction: "outbound",
          channel: "in_app",
          messageText,
          providerMessageId: escalationKey,
          metadataJson: {
            sequence: "service_assignment_replacement",
            serviceRunId: run.serviceRunId,
            assignmentId: run.assignmentId,
            reasonStatus: run.reasonStatus,
            taskId: replacementTask.taskId,
            goalId: autostaffGoal.goalId,
          },
        });
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }

      return { logged: true };
    });

    logger.info("Service assignment replacement processed", {
      organizationId,
      serviceRunId,
      assignmentId,
      reasonStatus,
      taskId: replacementTask.taskId,
      goalId: autostaffGoal.goalId,
      goalDispatched: autostaffGoal.dispatched,
      escalationLogged: escalation.logged,
    });

    return {
      status: "completed",
      task: replacementTask,
      goal: autostaffGoal,
      escalation,
    };
  }
);
