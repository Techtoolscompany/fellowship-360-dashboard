import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  graceGoals,
  graceGoalSteps,
  serviceAssignments,
  serviceTemplateRoleSlots,
} from "@/db/schema";
import type { GraceActorType, GraceChannel } from "@/lib/grace/types";
import { writeGraceAuditStreamSafe } from "@/lib/grace/audit-stream";

export const VOLUNTEER_STAFFING_WORKFLOW_KEY = "volunteer_staffing" as const;
export const VOLUNTEER_STAFFING_WORKFLOW_VERSION = "v1" as const;
const VOLUNTEER_STAFFING_WORKFLOW_VERSION_NUMBER = 1;

export const VOLUNTEER_STAFFING_STEP_TEMPLATES = [
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
] as const;

export const VOLUNTEER_STAFFING_ACTIVE_STATUSES = [
  "queued",
  "in_progress",
  "waiting",
] as const;

export type VolunteerStaffingGoalStatus =
  | "queued"
  | "in_progress"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "escalated";

export type VolunteerStaffingStepStatus =
  | "pending"
  | "in_progress"
  | "waiting"
  | "completed"
  | "failed"
  | "skipped";

export type VolunteerStaffingTriggerSource =
  | "service_page"
  | "grace_tool"
  | "sms_reply"
  | "automation_runtime"
  | "service_replacement";

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

function isVolunteerStaffingContext(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value &&
      typeof value === "object" &&
      value !== null &&
      (value as Record<string, unknown>).workflowKey === VOLUNTEER_STAFFING_WORKFLOW_KEY
  );
}

export function buildVolunteerStaffingStepTemplates() {
  return VOLUNTEER_STAFFING_STEP_TEMPLATES.map((step) => ({ ...step }));
}

export function buildVolunteerStaffingGoalContext(params: {
  serviceRunId: string;
  templateId?: string | null;
  serviceAt: Date | string;
  triggerSource: VolunteerStaffingTriggerSource;
  triggerChannel: string;
  requestedByUserId?: string | null;
  objectiveText: string;
  waitHours?: number | null;
}) {
  return {
    workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
    workflowVersion: VOLUNTEER_STAFFING_WORKFLOW_VERSION,
    correlationKey: params.serviceRunId,
    triggerSource: params.triggerSource,
    triggerChannel: params.triggerChannel,
    serviceRunId: params.serviceRunId,
    templateId: params.templateId ?? null,
    serviceAt: new Date(params.serviceAt).toISOString(),
    requestedByUserId: params.requestedByUserId ?? null,
    objectiveText: params.objectiveText,
    waitHours: params.waitHours ?? null,
  };
}

export function buildVolunteerStaffingGoalResult(params: {
  serviceRunId: string;
  status: VolunteerStaffingGoalStatus;
  summary?: Record<string, unknown>;
  lastReply?: Record<string, unknown> | null;
  openRequiredSeats?: number | null;
  openRoles?: string[] | null;
}) {
  return {
    workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
    workflowVersion: VOLUNTEER_STAFFING_WORKFLOW_VERSION,
    serviceRunId: params.serviceRunId,
    status: params.status,
    openRequiredSeats: params.openRequiredSeats ?? null,
    openRoles: params.openRoles ?? [],
    summary: params.summary ?? null,
    lastReply: params.lastReply ?? null,
    updatedAt: new Date().toISOString(),
  };
}

export function deriveVolunteerStaffingReplyProgress(params: {
  assignmentStatus: string;
  unresolvedRequiredSeats: number;
}) {
  const completed = params.unresolvedRequiredSeats <= 0;
  return {
    workflowStatus: completed ? ("completed" as const) : ("waiting" as const),
    stepStatus: completed ? ("completed" as const) : ("waiting" as const),
    unresolvedRequiredSeats: Math.max(0, Math.floor(params.unresolvedRequiredSeats)),
    replyState: completed ? ("fully_staffed" as const) : ("still_waiting" as const),
    lastReplyState: params.assignmentStatus,
  };
}

export async function seedVolunteerStaffingGoalSteps(goalId: string, organizationId: string) {
  const existing = await db
    .select({ stepKey: graceGoalSteps.stepKey })
    .from(graceGoalSteps)
    .where(eq(graceGoalSteps.goalId, goalId));

  const existingKeys = new Set(existing.map((row) => row.stepKey));
  const missingRows = VOLUNTEER_STAFFING_STEP_TEMPLATES.filter(
    (step) => !existingKeys.has(step.stepKey)
  ).map((step) => ({
    goalId,
    organizationId,
    stepKey: step.stepKey,
    title: step.title,
    runOrder: step.runOrder,
    status: "pending" as const,
  }));

  if (missingRows.length > 0) {
    await db.insert(graceGoalSteps).values(missingRows);
  }
}

export async function findActiveVolunteerStaffingGoal(params: {
  organizationId: string;
  serviceRunId: string;
}) {
  const [goal] = await db
    .select()
    .from(graceGoals)
    .where(
      and(
        eq(graceGoals.organizationId, params.organizationId),
        eq(graceGoals.goalType, "service_staffing"),
        eq(graceGoals.serviceRunId, params.serviceRunId),
        inArray(graceGoals.status, [...VOLUNTEER_STAFFING_ACTIVE_STATUSES])
      )
    )
    .orderBy(desc(graceGoals.createdAt))
    .limit(1);

  return goal ?? null;
}

async function backfillVolunteerStaffingGoalContext(goal: typeof graceGoals.$inferSelect) {
  const contextJson = isVolunteerStaffingContext(goal.contextJson)
    ? goal.contextJson
    : {
        ...(goal.contextJson ?? {}),
        workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
        workflowVersion: VOLUNTEER_STAFFING_WORKFLOW_VERSION,
        correlationKey: goal.serviceRunId,
      };

  const [updatedGoal] = await db
    .update(graceGoals)
    .set({
      workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
      workflowVersion: VOLUNTEER_STAFFING_WORKFLOW_VERSION_NUMBER,
      triggerSource:
        (contextJson.triggerSource as string | undefined) ?? goal.triggerSource ?? "legacy",
      triggerChannel:
        (contextJson.triggerChannel as string | undefined) ?? goal.triggerChannel ?? goal.sourceChannel,
      subjectEntityType: "service_run",
      subjectEntityId: goal.serviceRunId,
      correlationKey: goal.serviceRunId,
      contextJson,
      updatedAt: new Date(),
    })
    .where(eq(graceGoals.id, goal.id))
    .returning();

  return updatedGoal ?? goal;
}

export async function ensureVolunteerStaffingGoalRecord(params: {
  organizationId: string;
  serviceRunId: string;
  serviceRunName: string;
  serviceAt: Date | string;
  templateId?: string | null;
  sourceChannel: string;
  triggerSource: VolunteerStaffingTriggerSource;
  objectiveText?: string;
  requestedByUserId?: string | null;
  waitHours?: number | null;
}) {
  const existingGoal = await findActiveVolunteerStaffingGoal({
    organizationId: params.organizationId,
    serviceRunId: params.serviceRunId,
  });

  if (existingGoal) {
    const goal = isVolunteerStaffingContext(existingGoal.contextJson)
      ? existingGoal
      : await backfillVolunteerStaffingGoalContext(existingGoal);

    await seedVolunteerStaffingGoalSteps(goal.id, params.organizationId);

    return {
      goal,
      created: false,
    };
  }

  const objectiveText =
    trimOrNull(params.objectiveText) ||
    `Auto-staff "${params.serviceRunName}" for ${formatShortDateTime(params.serviceAt)}.`;

  const [goal] = await db
    .insert(graceGoals)
    .values({
      organizationId: params.organizationId,
      goalType: "service_staffing",
      status: "queued",
      sourceChannel: params.sourceChannel,
      workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
      workflowVersion: VOLUNTEER_STAFFING_WORKFLOW_VERSION_NUMBER,
      triggerSource: params.triggerSource,
      triggerChannel: params.sourceChannel,
      subjectEntityType: "service_run",
      subjectEntityId: params.serviceRunId,
      correlationKey: params.serviceRunId,
      policyMode: "confirm_once",
      lastDecisionSummary: objectiveText,
      objectiveText,
      serviceRunId: params.serviceRunId,
      requestedByUserId: params.requestedByUserId ?? null,
      contextJson: buildVolunteerStaffingGoalContext({
        serviceRunId: params.serviceRunId,
        templateId: params.templateId ?? null,
        serviceAt: params.serviceAt,
        triggerSource: params.triggerSource,
        triggerChannel: params.sourceChannel,
        requestedByUserId: params.requestedByUserId ?? null,
        objectiveText,
        waitHours: params.waitHours ?? null,
      }),
    })
    .returning();

  await seedVolunteerStaffingGoalSteps(goal.id, params.organizationId);

  return {
    goal,
    created: true,
  };
}

export async function summarizeVolunteerStaffingAssignmentProgress(params: {
  organizationId: string;
  serviceRunId: string;
}) {
  const rows = await db
    .select({
      assignment: serviceAssignments,
      roleSlot: serviceTemplateRoleSlots,
    })
    .from(serviceAssignments)
    .leftJoin(serviceTemplateRoleSlots, eq(serviceAssignments.roleSlotId, serviceTemplateRoleSlots.id))
    .where(
      and(
        eq(serviceAssignments.organizationId, params.organizationId),
        eq(serviceAssignments.serviceRunId, params.serviceRunId)
      )
    )
    .orderBy(serviceAssignments.roleName, desc(serviceAssignments.createdAt));

  const satisfiedStatuses = new Set(["confirmed", "checked_in", "checked_out"]);
  const statusCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.assignment.status] = (acc[row.assignment.status] ?? 0) + 1;
    return acc;
  }, {});

  const requiredOpenRows = rows.filter((row) => {
    const isRequired = row.roleSlot?.isRequired ?? true;
    if (!isRequired) return false;
    return !satisfiedStatuses.has(row.assignment.status);
  });

  const openRequiredRoles = Array.from(
    new Set(requiredOpenRows.map((row) => row.assignment.roleName))
  );

  return {
    statusCounts,
    unresolvedRequiredSeats: requiredOpenRows.length,
    openRequiredRoles,
  };
}

export async function updateVolunteerStaffingGoalStatus(params: {
  organizationId?: string;
  goalId: string;
  serviceRunId?: string;
  status: VolunteerStaffingGoalStatus;
  source: "grace_router" | "grace_executor" | "automation_runtime";
  actorType?: GraceActorType;
  channel?: GraceChannel;
  sessionId?: string | null;
  startedAt?: Date | null;
  nextRunAt?: Date | null;
  completedAt?: Date | null;
  errorText?: string | null;
  contextJsonPatch?: Record<string, unknown>;
  resultJsonPatch?: Record<string, unknown>;
  actionName?: string | null;
}) {
  const [goal] = await db
    .select()
    .from(graceGoals)
    .where(eq(graceGoals.id, params.goalId))
    .limit(1);

  if (!goal) {
    return null;
  }

  const organizationId = params.organizationId ?? goal.organizationId;
  const serviceRunId = params.serviceRunId ?? goal.serviceRunId ?? "";

  const contextJson = {
    ...(goal.contextJson ?? {}),
    workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
    workflowVersion: VOLUNTEER_STAFFING_WORKFLOW_VERSION,
    correlationKey: serviceRunId,
    ...(params.contextJsonPatch ?? {}),
  };

  const resultJson = params.resultJsonPatch
    ? {
        workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
        workflowVersion: VOLUNTEER_STAFFING_WORKFLOW_VERSION,
        serviceRunId: params.serviceRunId,
        ...(goal.resultJson ?? {}),
        ...params.resultJsonPatch,
      }
    : goal.resultJson ?? null;

  const [updatedGoal] = await db
    .update(graceGoals)
    .set({
      status: params.status,
      workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
      workflowVersion: VOLUNTEER_STAFFING_WORKFLOW_VERSION_NUMBER,
      startedAt: params.startedAt ?? goal.startedAt ?? null,
      nextRunAt: params.nextRunAt ?? null,
      nextCheckpointAt: params.nextRunAt ?? null,
      completedAt: params.completedAt ?? goal.completedAt ?? null,
      errorText: params.errorText ?? null,
      triggerChannel: params.channel ?? goal.triggerChannel ?? goal.sourceChannel,
      subjectEntityType: "service_run",
      subjectEntityId: serviceRunId || null,
      correlationKey: serviceRunId || null,
      lastDecisionSummary:
        (params.resultJsonPatch?.summary as string | undefined) ??
        params.actionName ??
        goal.lastDecisionSummary,
      contextJson,
      resultJson,
      updatedAt: new Date(),
    })
    .where(eq(graceGoals.id, params.goalId))
    .returning();

  await writeGraceAuditStreamSafe({
    organizationId,
    sessionId: params.sessionId ?? null,
    eventType: "workflow_execution",
    source: params.source,
    status: params.errorText ? "error" : "success",
    actorType: params.actorType ?? "system",
    channel: params.channel,
    workflowId: null,
    workflowRunId: null,
    actionName: params.actionName ?? null,
    errorText: params.errorText ?? null,
    metadataJson: {
      workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
      workflowVersion: VOLUNTEER_STAFFING_WORKFLOW_VERSION,
      goalId: params.goalId,
      serviceRunId,
      workflowStatus: params.status,
    },
  });

  return updatedGoal ?? goal;
}

export async function updateVolunteerStaffingGoalStep(params: {
  organizationId?: string;
  goalId: string;
  serviceRunId?: string;
  stepKey: string;
  status: VolunteerStaffingStepStatus;
  source: "grace_router" | "grace_executor" | "automation_runtime";
  actorType?: GraceActorType;
  channel?: GraceChannel;
  sessionId?: string | null;
  inputJson?: Record<string, unknown> | null;
  outputJson?: Record<string, unknown> | null;
  errorText?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  attemptCountDelta?: number;
  actionName?: string | null;
}) {
  const stepUpdate: Record<string, unknown> = {
    status: params.status,
    startedAt:
      params.startedAt !== undefined
        ? params.startedAt
        : params.status === "in_progress"
          ? new Date()
          : undefined,
    inputJson: params.inputJson ?? null,
    outputJson: params.outputJson ?? null,
    errorText: params.errorText ?? null,
    completedAt:
      params.completedAt !== undefined
        ? params.completedAt
        : params.status === "waiting"
          ? null
          : new Date(),
    updatedAt: new Date(),
  };

  if (typeof params.attemptCountDelta === "number" && params.attemptCountDelta !== 0) {
    stepUpdate.attemptCount = sql`${graceGoalSteps.attemptCount} + ${params.attemptCountDelta}`;
  }

  const [updatedStep] = await db
    .update(graceGoalSteps)
    .set(stepUpdate)
    .where(and(eq(graceGoalSteps.goalId, params.goalId), eq(graceGoalSteps.stepKey, params.stepKey)))
    .returning();

  const [goal] = await db
    .select({
      organizationId: graceGoals.organizationId,
      serviceRunId: graceGoals.serviceRunId,
    })
    .from(graceGoals)
    .where(eq(graceGoals.id, params.goalId))
    .limit(1);

  const organizationId = params.organizationId ?? goal?.organizationId ?? "";
  const serviceRunId = params.serviceRunId ?? goal?.serviceRunId ?? "";

  await writeGraceAuditStreamSafe({
    organizationId,
    sessionId: params.sessionId ?? null,
    eventType: "workflow_execution",
    source: params.source,
    status: params.errorText ? "error" : "success",
    actorType: params.actorType ?? "system",
    channel: params.channel,
    workflowId: null,
    workflowRunId: null,
    actionName: params.actionName ?? params.stepKey,
    errorText: params.errorText ?? null,
    metadataJson: {
      workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
      workflowVersion: VOLUNTEER_STAFFING_WORKFLOW_VERSION,
      goalId: params.goalId,
      serviceRunId,
      stepKey: params.stepKey,
      stepStatus: params.status,
    },
  });

  return updatedStep ?? null;
}
