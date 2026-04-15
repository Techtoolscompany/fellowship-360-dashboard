import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { graceGoalSteps, graceGoals } from "@/db/schema";

export const GUEST_FOLLOWUP_WORKFLOW_KEY = "guest_followup" as const;
const GUEST_FOLLOWUP_WORKFLOW_VERSION = 1;

const ACTIVE_GOAL_STATUSES = ["queued", "in_progress", "waiting"] as const;

const GUEST_FOLLOWUP_STEP_TEMPLATES = [
  {
    stepKey: "resolve_context",
    title: "Resolve guest follow-up context",
    runOrder: 10,
  },
  {
    stepKey: "send_initial_invite",
    title: "Send first appointment invite",
    runOrder: 20,
  },
  {
    stepKey: "wait_after_initial_invite",
    title: "Wait after initial invite",
    runOrder: 30,
  },
  {
    stepKey: "send_reminder",
    title: "Send reminder invite",
    runOrder: 40,
  },
  {
    stepKey: "wait_after_reminder",
    title: "Wait after reminder",
    runOrder: 50,
  },
  {
    stepKey: "manual_outreach",
    title: "Create manual outreach follow-up",
    runOrder: 60,
  },
  {
    stepKey: "complete",
    title: "Complete guest follow-up",
    runOrder: 70,
  },
] as const;

export type GuestFollowupWorkflowTrigger = "created" | "stage_changed" | "ai_categorized";

export type GuestFollowupWorkflowContext = {
  pipelineItemId: string;
  contactId: string;
  stageId: string;
  stageName: string;
  contactName: string;
  firstName: string;
  recipientPhone: string | null;
  recipientEmail: string | null;
  channel: "sms" | "email";
  churchName: string;
  sessionId: string;
  conversationId: string;
  sequenceStartedAtIso: string;
  trigger: GuestFollowupWorkflowTrigger;
};

export function buildGuestFollowupCorrelationKey(params: {
  organizationId: string;
  pipelineItemId: string;
}) {
  return `${GUEST_FOLLOWUP_WORKFLOW_KEY}:${params.organizationId}:${params.pipelineItemId}`;
}

function trimOrNull(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getWorkflowContext(row: { contextJson: unknown }) {
  const context = row.contextJson;
  if (!context || typeof context !== "object") {
    return {};
  }
  return context as Record<string, unknown>;
}

async function ensureGuestFollowupGoalSteps(goalId: string, organizationId: string) {
  const existing = await db
    .select({ stepKey: graceGoalSteps.stepKey })
    .from(graceGoalSteps)
    .where(eq(graceGoalSteps.goalId, goalId));

  const existingKeys = new Set(existing.map((row) => row.stepKey));
  const missingRows = GUEST_FOLLOWUP_STEP_TEMPLATES.filter(
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

export async function seedGuestFollowupGoalSteps(goalId: string, organizationId: string) {
  await ensureGuestFollowupGoalSteps(goalId, organizationId);
}

export async function createOrReuseGuestFollowupGoal(params: {
  organizationId: string;
  objectiveText: string;
  sourceChannel: string;
  requestedByUserId?: string | null;
  context: GuestFollowupWorkflowContext;
}) {
  const correlationKey = buildGuestFollowupCorrelationKey({
    organizationId: params.organizationId,
    pipelineItemId: params.context.pipelineItemId,
  });
  const nowIso = new Date().toISOString();
  const contextJson = {
    ...params.context,
    workflowKey: GUEST_FOLLOWUP_WORKFLOW_KEY,
    correlationKey,
    lastTriggeredAt: nowIso,
  };

  const recentGoals = await db
    .select()
    .from(graceGoals)
    .where(
      and(
        eq(graceGoals.organizationId, params.organizationId),
        eq(graceGoals.goalType, "communications_followup")
      )
    )
    .orderBy(desc(graceGoals.createdAt))
    .limit(10);

  const reusableGoal = recentGoals.find((goal) => {
    const workflowContext = getWorkflowContext(goal);
    return (
      ACTIVE_GOAL_STATUSES.includes(goal.status as (typeof ACTIVE_GOAL_STATUSES)[number]) &&
      workflowContext.workflowKey === GUEST_FOLLOWUP_WORKFLOW_KEY &&
      workflowContext.correlationKey === correlationKey
    );
  });

  if (reusableGoal) {
    const mergedContext = {
      ...getWorkflowContext(reusableGoal),
      ...contextJson,
    };

    const [updated] = await db
      .update(graceGoals)
      .set({
        objectiveText: params.objectiveText,
        sourceChannel: params.sourceChannel,
        workflowKey: GUEST_FOLLOWUP_WORKFLOW_KEY,
        workflowVersion: GUEST_FOLLOWUP_WORKFLOW_VERSION,
        triggerSource: params.sourceChannel,
        triggerChannel: params.sourceChannel,
        subjectContactId: params.context.contactId,
        subjectEntityType: "pipeline_item",
        subjectEntityId: params.context.pipelineItemId,
        correlationKey,
        policyMode: "confirm_once",
        lastDecisionSummary: params.objectiveText,
        requestedByUserId: params.requestedByUserId ?? reusableGoal.requestedByUserId,
        contextJson: mergedContext,
        updatedAt: new Date(),
      })
      .where(eq(graceGoals.id, reusableGoal.id))
      .returning();

    await ensureGuestFollowupGoalSteps(reusableGoal.id, params.organizationId);

    return {
      goal: updated ?? reusableGoal,
      created: false,
      reused: true,
      correlationKey,
    };
  }

  const [created] = await db
    .insert(graceGoals)
    .values({
      organizationId: params.organizationId,
      goalType: "communications_followup",
      status: "queued",
      sourceChannel: params.sourceChannel,
      workflowKey: GUEST_FOLLOWUP_WORKFLOW_KEY,
      workflowVersion: GUEST_FOLLOWUP_WORKFLOW_VERSION,
      triggerSource: params.sourceChannel,
      triggerChannel: params.sourceChannel,
      subjectContactId: params.context.contactId,
      subjectEntityType: "pipeline_item",
      subjectEntityId: params.context.pipelineItemId,
      correlationKey,
      policyMode: "confirm_once",
      lastDecisionSummary: params.objectiveText,
      objectiveText: params.objectiveText,
      requestedByUserId: params.requestedByUserId ?? null,
      contextJson,
    })
    .returning();

  await ensureGuestFollowupGoalSteps(created.id, params.organizationId);

  return {
    goal: created,
    created: true,
    reused: false,
    correlationKey,
  };
}

export async function updateGuestFollowupGoalState(
  goalId: string,
  patch: Partial<{
    status: "queued" | "in_progress" | "waiting" | "completed" | "failed" | "cancelled" | "escalated";
    startedAt: Date | null;
    completedAt: Date | null;
    nextRunAt: Date | null;
    resultJson: Record<string, unknown> | null;
    errorText: string | null;
    contextJson: Record<string, unknown>;
    objectiveText: string;
    sourceChannel: string;
    requestedByUserId: string | null;
  }>
) {
  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
    workflowKey: GUEST_FOLLOWUP_WORKFLOW_KEY,
    workflowVersion: GUEST_FOLLOWUP_WORKFLOW_VERSION,
  };

  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.startedAt !== undefined) updates.startedAt = patch.startedAt;
  if (patch.completedAt !== undefined) updates.completedAt = patch.completedAt;
  if (patch.nextRunAt !== undefined) {
    updates.nextRunAt = patch.nextRunAt;
    updates.nextCheckpointAt = patch.nextRunAt;
  }
  if (patch.resultJson !== undefined) updates.resultJson = patch.resultJson;
  if (patch.errorText !== undefined) updates.errorText = patch.errorText;
  if (patch.contextJson !== undefined) {
    updates.contextJson = patch.contextJson;
    updates.triggerSource =
      trimOrNull(String(patch.contextJson.triggerSource ?? "")) ?? undefined;
    updates.triggerChannel =
      trimOrNull(String(patch.contextJson.triggerChannel ?? "")) ?? undefined;
    updates.subjectContactId =
      trimOrNull(
        String(patch.contextJson.subjectContactId ?? patch.contextJson.contactId ?? "")
      ) ?? null;
    updates.subjectEntityType = "pipeline_item";
    updates.subjectEntityId =
      trimOrNull(
        String(patch.contextJson.subjectEntityId ?? patch.contextJson.pipelineItemId ?? "")
      ) ?? null;
    updates.correlationKey =
      trimOrNull(String(patch.contextJson.correlationKey ?? "")) ?? null;
    updates.policyMode = "confirm_once";
    updates.lastDecisionSummary =
      trimOrNull(
        String(
          patch.contextJson.lastDecisionSummary ??
            patch.resultJson?.summary ??
            patch.objectiveText ??
            ""
        )
      ) ?? undefined;
  }
  if (patch.objectiveText !== undefined) updates.objectiveText = patch.objectiveText;
  if (patch.sourceChannel !== undefined) updates.sourceChannel = patch.sourceChannel;
  if (patch.requestedByUserId !== undefined) {
    updates.requestedByUserId = patch.requestedByUserId;
  }

  const [updated] = await db
    .update(graceGoals)
    .set(updates)
    .where(eq(graceGoals.id, goalId))
    .returning();

  return updated ?? null;
}

export async function startGuestFollowupStep(
  goalId: string,
  stepKey: string,
  inputJson?: Record<string, unknown>
) {
  await db
    .update(graceGoalSteps)
    .set({
      status: "in_progress",
      startedAt: new Date(),
      completedAt: null,
      inputJson: inputJson ?? null,
      outputJson: null,
      errorText: null,
      attemptCount: sql`${graceGoalSteps.attemptCount} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(graceGoalSteps.goalId, goalId), eq(graceGoalSteps.stepKey, stepKey)));
}

export async function finishGuestFollowupStep(params: {
  goalId: string;
  stepKey: string;
  status: "waiting" | "completed" | "failed" | "skipped";
  outputJson?: Record<string, unknown>;
  errorText?: string | null;
}) {
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
