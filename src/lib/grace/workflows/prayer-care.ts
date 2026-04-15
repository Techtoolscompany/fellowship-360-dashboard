import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { graceGoalSteps, graceGoals } from "@/db/schema";
import { writeGraceAuditStreamSafe } from "@/lib/grace/audit-stream";
import type { PrayerStatus, PrayerUrgency } from "@/lib/prayer/routing";

export const PRAYER_CARE_WORKFLOW_KEY = "prayer_care" as const;
export const PRAYER_CARE_GOAL_TYPE = "operations" as const;
const PRAYER_CARE_WORKFLOW_VERSION = 1;

export const PRAYER_CARE_STEP_KEYS = {
  kickoffConfirmation: "kickoff_confirmation",
  contextCollection: "context_collection",
  sendAcknowledgment: "send_acknowledgment",
  routeEscalation: "route_escalation",
  completion: "completion",
} as const;

export type PrayerCareStepKey =
  (typeof PRAYER_CARE_STEP_KEYS)[keyof typeof PRAYER_CARE_STEP_KEYS];

const PRAYER_CARE_STEP_DEFINITIONS = [
  {
    stepKey: PRAYER_CARE_STEP_KEYS.kickoffConfirmation,
    title: "Confirm prayer care kickoff",
    runOrder: 10,
  },
  {
    stepKey: PRAYER_CARE_STEP_KEYS.contextCollection,
    title: "Collect prayer care context",
    runOrder: 20,
  },
  {
    stepKey: PRAYER_CARE_STEP_KEYS.sendAcknowledgment,
    title: "Send prayer acknowledgment",
    runOrder: 30,
  },
  {
    stepKey: PRAYER_CARE_STEP_KEYS.routeEscalation,
    title: "Route prayer escalation",
    runOrder: 40,
  },
  {
    stepKey: PRAYER_CARE_STEP_KEYS.completion,
    title: "Complete prayer care run",
    runOrder: 50,
  },
] as const;

type PrayerCareWorkflowStatus =
  | "queued"
  | "in_progress"
  | "waiting"
  | "completed"
  | "failed"
  | "escalated";

type PrayerCareWorkflowContext = Record<string, unknown> & {
  workflowKey: typeof PRAYER_CARE_WORKFLOW_KEY;
  correlationKey: string;
  triggerSource: string;
  triggerChannel: string;
  subjectContactId: string | null;
  subjectEntityType: "prayer_request";
  subjectEntityId: string;
  policyMode: "standard" | "escalation";
  lastDecisionSummary: string;
  nextCheckpointAt: string | null;
  requestStatus: PrayerStatus;
  requestUrgency: PrayerUrgency;
  assignedTeam: string;
  requestContent: string;
  sourceChannel: string;
};

type PrayerCareGoalRow = typeof graceGoals.$inferSelect;

type PrayerCareWorkflowSnapshot = {
  goal: PrayerCareGoalRow;
  created: boolean;
};

function isRequestedByUserConstraintError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes(
    "grace_goal_requested_by_user_id_app_user_id_fk"
  );
}

function trimOrNull(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function ensurePrayerCareContext(input: {
  requestId: string;
  sourceChannel: string;
  triggerSource: string;
  status: PrayerStatus;
  urgency: PrayerUrgency;
  assignedTeam: string;
  content: string;
  contactId?: string | null;
  lastDecisionSummary: string;
  policyMode?: "standard" | "escalation";
  nextCheckpointAt?: Date | null;
}) {
  const nextCheckpointAt = input.nextCheckpointAt ? input.nextCheckpointAt.toISOString() : null;
  return {
    workflowKey: PRAYER_CARE_WORKFLOW_KEY,
    correlationKey: buildPrayerCareCorrelationKey(input.requestId),
    triggerSource: input.triggerSource,
    triggerChannel: input.sourceChannel,
    subjectContactId: input.contactId ?? null,
    subjectEntityType: "prayer_request" as const,
    subjectEntityId: input.requestId,
    policyMode: input.policyMode ?? (input.urgency === "critical" || input.urgency === "urgent" ? "escalation" : "standard"),
    lastDecisionSummary: input.lastDecisionSummary,
    nextCheckpointAt,
    requestStatus: input.status,
    requestUrgency: input.urgency,
    assignedTeam: input.assignedTeam,
    requestContent: input.content,
    sourceChannel: input.sourceChannel,
  } satisfies PrayerCareWorkflowContext;
}

export function buildPrayerCareCorrelationKey(requestId: string) {
  return `prayer_care:prayer_request:${requestId}`;
}

export async function findPrayerCareWorkflowGoal(params: {
  organizationId: string;
  requestId: string;
}) {
  const candidateGoals = await db
    .select()
    .from(graceGoals)
    .where(
      and(
        eq(graceGoals.organizationId, params.organizationId),
        eq(graceGoals.goalType, PRAYER_CARE_GOAL_TYPE),
        inArray(graceGoals.status, ["queued", "in_progress", "waiting"])
      )
    )
    .orderBy(desc(graceGoals.createdAt))
    .limit(25);

  const correlationKey = buildPrayerCareCorrelationKey(params.requestId);
  return (
    candidateGoals.find((goal) => {
      const context = goal.contextJson as PrayerCareWorkflowContext | null | undefined;
      return (
        context?.workflowKey === PRAYER_CARE_WORKFLOW_KEY &&
        context?.correlationKey === correlationKey
      );
    }) ?? null
  );
}

export async function ensurePrayerCareWorkflowGoal(params: {
  organizationId: string;
  requestId: string;
  sourceChannel: string;
  triggerSource: string;
  status: PrayerStatus;
  urgency: PrayerUrgency;
  assignedTeam: string;
  content: string;
  contactId?: string | null;
  objectiveText: string;
  requestedByUserId?: string | null;
  lastDecisionSummary: string;
  nextCheckpointAt?: Date | null;
}) {
  const existingGoal = await findPrayerCareWorkflowGoal({
    organizationId: params.organizationId,
    requestId: params.requestId,
  });

  const contextJson = ensurePrayerCareContext({
    requestId: params.requestId,
    sourceChannel: params.sourceChannel,
    triggerSource: params.triggerSource,
    status: params.status,
    urgency: params.urgency,
    assignedTeam: params.assignedTeam,
    content: params.content,
    contactId: params.contactId,
    lastDecisionSummary: params.lastDecisionSummary,
    nextCheckpointAt: params.nextCheckpointAt,
  });

  let goal: PrayerCareGoalRow;
  let created = false;

  if (existingGoal) {
    const updatePayload = {
      objectiveText: trimOrNull(params.objectiveText) ?? existingGoal.objectiveText,
      sourceChannel: params.sourceChannel,
      workflowKey: PRAYER_CARE_WORKFLOW_KEY,
      workflowVersion: PRAYER_CARE_WORKFLOW_VERSION,
      triggerSource: params.triggerSource,
      triggerChannel: params.sourceChannel,
      subjectContactId: params.contactId ?? null,
      subjectEntityType: "prayer_request" as const,
      subjectEntityId: params.requestId,
      correlationKey: buildPrayerCareCorrelationKey(params.requestId),
      policyMode:
        params.urgency === "critical" || params.urgency === "urgent"
          ? ("approval_required" as const)
          : ("confirm_once" as const),
      lastDecisionSummary: params.lastDecisionSummary,
      nextCheckpointAt: params.nextCheckpointAt ?? null,
      requestedByUserId:
        params.requestedByUserId === undefined
          ? existingGoal.requestedByUserId
          : params.requestedByUserId,
      contextJson: {
        ...((existingGoal.contextJson as Record<string, unknown> | null) ?? {}),
        ...contextJson,
      },
      nextRunAt: params.nextCheckpointAt ?? existingGoal.nextRunAt ?? null,
      updatedAt: new Date(),
    };

    try {
      [goal] = await db
        .update(graceGoals)
        .set(updatePayload)
        .where(eq(graceGoals.id, existingGoal.id))
        .returning();
    } catch (error) {
      if (
        updatePayload.requestedByUserId == null ||
        !isRequestedByUserConstraintError(error)
      ) {
        throw error;
      }

      [goal] = await db
        .update(graceGoals)
        .set({
          ...updatePayload,
          requestedByUserId: null,
        })
        .where(eq(graceGoals.id, existingGoal.id))
        .returning();
    }
  } else {
    const insertPayload = {
      organizationId: params.organizationId,
      goalType: PRAYER_CARE_GOAL_TYPE,
      status: "queued" as const,
      sourceChannel: params.sourceChannel,
      workflowKey: PRAYER_CARE_WORKFLOW_KEY,
      workflowVersion: PRAYER_CARE_WORKFLOW_VERSION,
      triggerSource: params.triggerSource,
      triggerChannel: params.sourceChannel,
      subjectContactId: params.contactId ?? null,
      subjectEntityType: "prayer_request" as const,
      subjectEntityId: params.requestId,
      correlationKey: buildPrayerCareCorrelationKey(params.requestId),
      policyMode:
        params.urgency === "critical" || params.urgency === "urgent"
          ? ("approval_required" as const)
          : ("confirm_once" as const),
      lastDecisionSummary: params.lastDecisionSummary,
      nextCheckpointAt: params.nextCheckpointAt ?? null,
      objectiveText:
        trimOrNull(params.objectiveText) ?? `Prayer care workflow for ${params.requestId}`,
      requestedByUserId: params.requestedByUserId ?? null,
      contextJson: contextJson,
      nextRunAt: params.nextCheckpointAt ?? null,
    };

    try {
      [goal] = await db.insert(graceGoals).values(insertPayload).returning();
    } catch (error) {
      if (
        insertPayload.requestedByUserId == null ||
        !isRequestedByUserConstraintError(error)
      ) {
        throw error;
      }

      [goal] = await db
        .insert(graceGoals)
        .values({
          ...insertPayload,
          requestedByUserId: null,
        })
        .returning();
    }
    created = true;
  }

  await ensurePrayerCareWorkflowSteps(goal.id, goal.organizationId);

  await writeGraceAuditStreamSafe({
    organizationId: goal.organizationId,
    workflowId: null,
    workflowRunId: null,
    eventType: "workflow_execution",
    source: "grace_executor",
    status: created ? "queued" : "success",
    actorType: "system",
    metadataJson: {
      workflowKey: PRAYER_CARE_WORKFLOW_KEY,
      workflowVersion: PRAYER_CARE_WORKFLOW_VERSION,
      goalId: goal.id,
      correlationKey: buildPrayerCareCorrelationKey(params.requestId),
      requestId: params.requestId,
      created,
      triggerSource: params.triggerSource,
      stepKeys: PRAYER_CARE_STEP_DEFINITIONS.map((step) => step.stepKey),
    },
  });

  return { goal, created } satisfies PrayerCareWorkflowSnapshot;
}

export async function ensurePrayerCareWorkflowSteps(goalId: string, organizationId: string) {
  const existingSteps = await db
    .select({ stepKey: graceGoalSteps.stepKey })
    .from(graceGoalSteps)
    .where(eq(graceGoalSteps.goalId, goalId));

  const existingKeys = new Set(existingSteps.map((row) => row.stepKey));
  const missingRows = PRAYER_CARE_STEP_DEFINITIONS.filter(
    (step) => !existingKeys.has(step.stepKey)
  ).map((step) => ({
    goalId,
    organizationId,
    stepKey: step.stepKey,
    title: step.title,
    status: "pending" as const,
    runOrder: step.runOrder,
  }));

  if (missingRows.length > 0) {
    await db.insert(graceGoalSteps).values(missingRows);
  }
}

export async function markPrayerCareWorkflowKickoffConfirmed(params: {
  goalId: string;
  organizationId: string;
  summary: string;
  source: string;
}) {
  await ensurePrayerCareWorkflowSteps(params.goalId, params.organizationId);

  await db
    .update(graceGoalSteps)
    .set({
      status: "completed",
      completedAt: new Date(),
      outputJson: {
        summary: params.summary,
        source: params.source,
      },
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(graceGoalSteps.goalId, params.goalId),
        eq(graceGoalSteps.stepKey, PRAYER_CARE_STEP_KEYS.kickoffConfirmation)
      )
    );
}

export async function startPrayerCareWorkflowStep(params: {
  goalId: string;
  organizationId: string;
  stepKey: PrayerCareStepKey;
  inputJson?: Record<string, unknown>;
}) {
  await ensurePrayerCareWorkflowSteps(params.goalId, params.organizationId);
  await db
    .update(graceGoalSteps)
    .set({
      status: "in_progress",
      startedAt: new Date(),
      completedAt: null,
      inputJson: params.inputJson ?? null,
      outputJson: null,
      errorText: null,
      attemptCount: sql`${graceGoalSteps.attemptCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(eq(graceGoalSteps.goalId, params.goalId), eq(graceGoalSteps.stepKey, params.stepKey))
    );
}

export async function finishPrayerCareWorkflowStep(params: {
  goalId: string;
  organizationId: string;
  stepKey: PrayerCareStepKey;
  status: "waiting" | "completed" | "failed" | "skipped";
  outputJson?: Record<string, unknown>;
  errorText?: string | null;
}) {
  await ensurePrayerCareWorkflowSteps(params.goalId, params.organizationId);
  await db
    .update(graceGoalSteps)
    .set({
      status: params.status,
      outputJson: params.outputJson ?? null,
      errorText: params.errorText ?? null,
      completedAt: params.status === "waiting" ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(graceGoalSteps.goalId, params.goalId), eq(graceGoalSteps.stepKey, params.stepKey))
    );
}

export async function updatePrayerCareWorkflowGoal(params: {
  goalId: string;
  organizationId: string;
  status: PrayerCareWorkflowStatus;
  requestId: string;
  summary: string;
  nextCheckpointAt?: Date | null;
  resultJson?: Record<string, unknown> | null;
  errorText?: string | null;
}) {
  const [currentGoal] = await db
    .select()
    .from(graceGoals)
    .where(
      and(eq(graceGoals.id, params.goalId), eq(graceGoals.organizationId, params.organizationId))
    )
    .limit(1);

  if (!currentGoal) {
    return null;
  }

  const currentContext = (currentGoal.contextJson as Record<string, unknown> | null) ?? {};
  const [updated] = await db
    .update(graceGoals)
    .set({
      status: params.status,
      nextRunAt: params.nextCheckpointAt ?? null,
      resultJson: params.resultJson ?? null,
      errorText: params.errorText ?? null,
      completedAt: params.status === "completed" ? new Date() : currentGoal.completedAt ?? null,
      startedAt:
        currentGoal.startedAt ?? (params.status === "queued" ? null : new Date()),
      updatedAt: new Date(),
      contextJson: {
        ...currentContext,
        workflowKey: PRAYER_CARE_WORKFLOW_KEY,
        workflowVersion: PRAYER_CARE_WORKFLOW_VERSION,
        correlationKey: buildPrayerCareCorrelationKey(params.requestId),
        lastDecisionSummary: params.summary,
        nextCheckpointAt: params.nextCheckpointAt ? params.nextCheckpointAt.toISOString() : null,
      },
      workflowKey: PRAYER_CARE_WORKFLOW_KEY,
      workflowVersion: PRAYER_CARE_WORKFLOW_VERSION,
      subjectEntityType: "prayer_request",
      subjectEntityId: params.requestId,
      correlationKey: buildPrayerCareCorrelationKey(params.requestId),
      lastDecisionSummary: params.summary,
      nextCheckpointAt: params.nextCheckpointAt ?? null,
    })
    .where(
      and(eq(graceGoals.id, params.goalId), eq(graceGoals.organizationId, params.organizationId))
    )
    .returning();

  if (updated) {
    await writeGraceAuditStreamSafe({
      organizationId: updated.organizationId,
      workflowId: null,
      workflowRunId: null,
      eventType: "workflow_execution",
      source: "grace_executor",
      status: params.status === "failed" ? "error" : "success",
      actorType: "system",
      metadataJson: {
        workflowKey: PRAYER_CARE_WORKFLOW_KEY,
        workflowVersion: PRAYER_CARE_WORKFLOW_VERSION,
        goalId: updated.id,
        requestId: params.requestId,
        status: params.status,
        summary: params.summary,
      },
      errorText: params.errorText ?? null,
    });
  }

  return updated ?? null;
}
