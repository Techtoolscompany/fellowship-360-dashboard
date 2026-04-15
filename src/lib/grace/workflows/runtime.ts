import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  churchContacts,
  graceGoals,
  graceGoalSteps,
  pipelineItems,
  pipelineStages,
  prayerRequests,
  serviceRuns,
} from "@/db/schema";
import { inngest } from "@/lib/inngest/client";
import {
  INNGEST_EVENTS,
  buildFirstTimeGuestAppointmentIdempotencyKey,
  buildGraceServiceAutostaffIdempotencyKey,
  buildPrayerRequestFollowupIdempotencyKey,
} from "@/lib/inngest/events";
import { isFirstTimeGuestStageName } from "@/lib/pipeline/first-time-guest";
import { isPrayerRequestActive } from "@/lib/prayer/routing";
import { writeGraceAuditStreamSafe } from "../audit-stream";
import type {
  GraceSessionContext,
  GraceWorkflowDecision,
  GraceWorkflowEvent,
  GraceWorkflowKey,
  GraceWorkflowStartSummary,
  GraceWorkflowSubjectEntityType,
  GraceWorkflowTriggerSource,
} from "../types";
import { getGraceWorkflowDefinition, isGraceWorkflowKey } from "./registry";

const ACTIVE_WORKFLOW_STATUSES: Array<"queued" | "in_progress" | "waiting"> = [
  "queued",
  "in_progress",
  "waiting",
];

type GraceGoalRow = typeof graceGoals.$inferSelect;
type GraceGoalStepStatus = typeof graceGoalSteps.$inferInsert.status;

function coerceString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function coerceOptionalString(value: unknown) {
  const normalized = coerceString(value);
  return normalized.length > 0 ? normalized : null;
}

function coercePositiveInteger(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  const rounded = Math.floor(numeric);
  return rounded > 0 ? rounded : undefined;
}

function hasInngestEventKey() {
  return Boolean(process.env.INNGEST_EVENT_KEY?.trim());
}

function isInngestDispatchConfigurationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /event key not found/i.test(message) || /\b401\b/.test(message);
}

function withWorkflowContext(
  value: Record<string, unknown> | null | undefined,
  extras: Record<string, unknown>
) {
  return {
    ...(value ?? {}),
    ...extras,
  };
}

export function buildGraceWorkflowCorrelationKey(params: {
  workflowKey: GraceWorkflowKey;
  organizationId: string;
  subjectEntityType: GraceWorkflowSubjectEntityType;
  subjectEntityId?: string | null;
  subjectContactId?: string | null;
  scope?: string | null;
}) {
  if (params.workflowKey === "volunteer_staffing") {
    return params.subjectEntityId ?? "";
  }

  if (params.workflowKey === "guest_followup") {
    return `${params.workflowKey}:${params.organizationId}:${params.subjectEntityId ?? ""}`;
  }

  if (params.workflowKey === "prayer_care") {
    return `${params.workflowKey}:prayer_request:${params.subjectEntityId ?? ""}`;
  }

  return [
    params.workflowKey,
    params.organizationId,
    params.subjectEntityType,
    params.subjectEntityId ?? "",
    params.subjectContactId ?? "",
    params.scope ?? "",
  ].join(":");
}

export async function createOrReuseGraceWorkflowGoal(params: {
  organizationId: string;
  workflowKey: GraceWorkflowKey;
  triggerSource: GraceWorkflowTriggerSource;
  triggerChannel: string;
  objectiveText: string;
  requestedByUserId?: string | null;
  subjectContactId?: string | null;
  subjectEntityType?: GraceWorkflowSubjectEntityType | null;
  subjectEntityId?: string | null;
  serviceRunId?: string | null;
  correlationKey?: string | null;
  policyMode?: string | null;
  lastDecisionSummary?: string | null;
  nextCheckpointAt?: Date | null;
  contextJson?: Record<string, unknown>;
}) {
  const definition = getGraceWorkflowDefinition(params.workflowKey);
  const correlationKey = params.correlationKey ?? null;

  const lookupClauses = [
    eq(graceGoals.organizationId, params.organizationId),
    eq(graceGoals.workflowKey, params.workflowKey),
    inArray(graceGoals.status, ACTIVE_WORKFLOW_STATUSES),
  ];

  if (correlationKey) {
    lookupClauses.push(eq(graceGoals.correlationKey, correlationKey));
  } else if (params.subjectEntityId && params.subjectEntityType) {
    lookupClauses.push(eq(graceGoals.subjectEntityType, params.subjectEntityType));
    lookupClauses.push(eq(graceGoals.subjectEntityId, params.subjectEntityId));
  }

  const [existingGoal] = await db
    .select()
    .from(graceGoals)
    .where(and(...lookupClauses))
    .orderBy(desc(graceGoals.createdAt))
    .limit(1);

  if (existingGoal) {
    return { goal: existingGoal, created: false };
  }

  const [goal] = await db
    .insert(graceGoals)
    .values({
      organizationId: params.organizationId,
      goalType: definition.goalType,
      status: "queued",
      sourceChannel: params.triggerChannel,
      workflowKey: params.workflowKey,
      workflowVersion: definition.version,
      triggerSource: params.triggerSource,
      triggerChannel: params.triggerChannel,
      subjectContactId: params.subjectContactId ?? null,
      subjectEntityType: params.subjectEntityType ?? definition.subjectEntityType,
      subjectEntityId: params.subjectEntityId ?? null,
      correlationKey,
      policyMode: params.policyMode ?? definition.approvalMode,
      lastDecisionSummary: params.lastDecisionSummary ?? null,
      nextCheckpointAt: params.nextCheckpointAt ?? null,
      objectiveText: params.objectiveText,
      serviceRunId: params.serviceRunId ?? null,
      requestedByUserId: params.requestedByUserId ?? null,
      contextJson: withWorkflowContext(params.contextJson, {
        workflowKey: params.workflowKey,
        workflowVersion: definition.version,
        correlationKey,
        triggerSource: params.triggerSource,
        triggerChannel: params.triggerChannel,
      }),
    })
    .returning();

  await writeGraceAuditStreamSafe({
    organizationId: params.organizationId,
    sessionId: null,
    actorType: "system",
    channel: undefined,
    eventType: "workflow_execution",
    source: "grace_router",
    status: "queued",
    actionName: `${params.workflowKey}.goal_created`,
    metadataJson: {
      goalId: goal.id,
      workflowKey: params.workflowKey,
      triggerSource: params.triggerSource,
      triggerChannel: params.triggerChannel,
      correlationKey,
    },
  });

  return { goal, created: true };
}

export async function upsertGraceWorkflowStep(params: {
  goalId: string;
  organizationId: string;
  stepKey: string;
  title: string;
  runOrder: number;
  status?: GraceGoalStepStatus;
  inputJson?: Record<string, unknown>;
  outputJson?: Record<string, unknown>;
}) {
  const [existing] = await db
    .select({ id: graceGoalSteps.id })
    .from(graceGoalSteps)
    .where(and(eq(graceGoalSteps.goalId, params.goalId), eq(graceGoalSteps.stepKey, params.stepKey)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(graceGoalSteps)
      .set({
        title: params.title,
        runOrder: params.runOrder,
        status: params.status ?? "pending",
        inputJson: params.inputJson ?? null,
        outputJson: params.outputJson ?? null,
        updatedAt: new Date(),
      })
      .where(eq(graceGoalSteps.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(graceGoalSteps)
    .values({
      goalId: params.goalId,
      organizationId: params.organizationId,
      stepKey: params.stepKey,
      title: params.title,
      runOrder: params.runOrder,
      status: params.status ?? "pending",
      inputJson: params.inputJson ?? null,
      outputJson: params.outputJson ?? null,
    })
    .returning();

  return created;
}

async function markWorkflowDispatchFailed(goalId: string, errorText: string) {
  const [updatedGoal] = await db
    .update(graceGoals)
    .set({
      status: "failed",
      errorText,
      updatedAt: new Date(),
    })
    .where(eq(graceGoals.id, goalId))
    .returning();

  if (updatedGoal) {
    await writeGraceAuditStreamSafe({
      organizationId: updatedGoal.organizationId,
      eventType: "workflow_execution",
      source: "grace_router",
      status: "error",
      actorType: "system",
      actionName: `${updatedGoal.workflowKey}.dispatch_failed`,
      errorText,
      metadataJson: {
        goalId: updatedGoal.id,
        workflowKey: updatedGoal.workflowKey,
      },
    });
  }

  return updatedGoal;
}

async function dispatchGuestWorkflowStart(params: {
  goal: GraceGoalRow;
  organizationId: string;
  pipelineItemId: string;
  contactId: string;
  stageId: string;
  stageName: string;
  trigger: "created" | "stage_changed" | "ai_categorized";
  occurredAt: Date;
}) {
  const occurredAtIso = params.occurredAt.toISOString();
  const idempotencyKey = buildFirstTimeGuestAppointmentIdempotencyKey({
    organizationId: params.organizationId,
    pipelineItemId: params.pipelineItemId,
    contactId: params.contactId,
    stageId: params.stageId,
    trigger: params.trigger,
    occurredAt: occurredAtIso,
  });

  await inngest.send({
    id: `${idempotencyKey}:${params.goal.id}`,
    name: INNGEST_EVENTS.GRACE_FIRST_TIME_GUEST_APPOINTMENT_REQUESTED,
    data: {
      organizationId: params.organizationId,
      pipelineItemId: params.pipelineItemId,
      contactId: params.contactId,
      stageId: params.stageId,
      stageName: params.stageName,
      trigger: params.trigger,
      occurredAt: occurredAtIso,
      idempotencyKey,
      goalId: params.goal.id,
      workflowKey: "guest_followup",
      correlationKey: params.goal.correlationKey ?? null,
    },
  });
}

async function dispatchPrayerWorkflowStart(params: {
  goal: GraceGoalRow;
  organizationId: string;
  requestId: string;
  trigger: "created" | "updated";
  status: "new" | "praying" | "answered" | "archived";
  urgency: "normal" | "urgent" | "critical";
  occurredAt: Date;
}) {
  const occurredAtIso = params.occurredAt.toISOString();
  const idempotencyKey = buildPrayerRequestFollowupIdempotencyKey({
    organizationId: params.organizationId,
    requestId: params.requestId,
    trigger: params.trigger,
    status: params.status,
    urgency: params.urgency,
    occurredAt: occurredAtIso,
  });

  await inngest.send({
    id: `${idempotencyKey}:${params.goal.id}`,
    name: INNGEST_EVENTS.GRACE_PRAYER_REQUEST_FOLLOWUP_REQUESTED,
    data: {
      organizationId: params.organizationId,
      requestId: params.requestId,
      trigger: params.trigger,
      status: params.status,
      urgency: params.urgency,
      occurredAt: occurredAtIso,
      idempotencyKey,
      goalId: params.goal.id,
      workflowKey: "prayer_care",
      correlationKey: params.goal.correlationKey ?? null,
    },
  });
}

function summarizeWorkflowStart(params: {
  workflowKey: GraceWorkflowKey;
  createdCount: number;
  reusedCount: number;
  failedCount: number;
  totalCount: number;
}) {
  const definition = getGraceWorkflowDefinition(params.workflowKey);

  if (params.totalCount === 0) {
    return {
      status: "failed" as const,
      summary: `Grace did not find any eligible ${definition.title.toLowerCase()} targets to start.`,
    };
  }

  if (params.failedCount > 0 && params.createdCount === 0 && params.reusedCount === 0) {
    return {
      status: "failed" as const,
      summary: `Grace could not start ${definition.title.toLowerCase()} because the workflow dispatch failed.`,
    };
  }

  if (params.createdCount === 0 && params.reusedCount > 0) {
    return {
      status: "reused" as const,
      summary: `Grace is already running ${definition.title.toLowerCase()} for ${params.reusedCount} item${params.reusedCount === 1 ? "" : "s"}.`,
    };
  }

  return {
    status: "started" as const,
    summary: `Grace started ${definition.title.toLowerCase()} for ${params.createdCount + params.reusedCount} item${params.createdCount + params.reusedCount === 1 ? "" : "s"}.`,
  };
}

async function startVolunteerStaffingWorkflow(params: {
  context: GraceSessionContext;
  decision: GraceWorkflowDecision;
}) {
  const serviceRunId = coerceString(params.decision.workflowInput?.serviceRunId);
  if (!serviceRunId) {
    return {
      status: "failed" as const,
      workflowKey: "volunteer_staffing" as const,
      failedCount: 1,
      summary: "Grace needs a specific service run before volunteer staffing can begin.",
    };
  }

  const [serviceRun] = await db
    .select({
      id: serviceRuns.id,
      organizationId: serviceRuns.organizationId,
      name: serviceRuns.name,
      serviceAt: serviceRuns.serviceAt,
      templateId: serviceRuns.templateId,
    })
    .from(serviceRuns)
    .where(
      and(
        eq(serviceRuns.organizationId, params.context.organizationId),
        eq(serviceRuns.id, serviceRunId)
      )
    )
    .limit(1);

  if (!serviceRun) {
    return {
      status: "failed" as const,
      workflowKey: "volunteer_staffing" as const,
      failedCount: 1,
      summary: "Grace could not find that service run.",
    };
  }

  const correlationKey = buildGraceWorkflowCorrelationKey({
    workflowKey: "volunteer_staffing",
    organizationId: params.context.organizationId,
    subjectEntityType: "service_run",
    subjectEntityId: serviceRun.id,
  });

  const { goal, created } = await createOrReuseGraceWorkflowGoal({
    organizationId: params.context.organizationId,
    workflowKey: "volunteer_staffing",
    triggerSource: "staff_prompt",
    triggerChannel: params.context.channel,
    requestedByUserId: params.context.userId,
    subjectEntityType: "service_run",
    subjectEntityId: serviceRun.id,
    serviceRunId: serviceRun.id,
    correlationKey,
    lastDecisionSummary: params.decision.kickoffSummary ?? null,
    objectiveText:
      params.decision.kickoffSummary ??
      `Fill open volunteer roles for ${serviceRun.name} on ${serviceRun.serviceAt.toLocaleString()}.`,
    contextJson: {
      serviceRunId: serviceRun.id,
      templateId: serviceRun.templateId,
      serviceAt: serviceRun.serviceAt.toISOString(),
      workflowInput: params.decision.workflowInput ?? {},
    },
  });

  if (!created) {
    return {
      status: "reused" as const,
      workflowKey: "volunteer_staffing" as const,
      goalIds: [goal.id],
      createdCount: 0,
      reusedCount: 1,
      failedCount: 0,
      summary: "Grace is already staffing that service run.",
    };
  }

  if (!hasInngestEventKey()) {
    await markWorkflowDispatchFailed(
      goal.id,
      "Volunteer staffing workflow was created, but Inngest event dispatch is not configured."
    );
    return {
      status: "failed" as const,
      workflowKey: "volunteer_staffing" as const,
      goalIds: [goal.id],
      createdCount: 0,
      reusedCount: 0,
      failedCount: 1,
      summary:
        "Grace created the staffing workflow record, but the background runner is not configured.",
    };
  }

  try {
    await upsertGraceWorkflowStep({
      goalId: goal.id,
      organizationId: goal.organizationId,
      stepKey: "kickoff_confirmation",
      title: "Workflow approved by staff",
      runOrder: 5,
      status: "completed",
      outputJson: {
        source: "grace_router",
        approvedByUserId: params.context.userId ?? null,
      },
    });

    await inngest.send({
      name: INNGEST_EVENTS.GRACE_SERVICE_AUTOSTAFF_REQUESTED,
      data: {
        organizationId: params.context.organizationId,
        serviceRunId: serviceRun.id,
        goalId: goal.id,
        waitHours: coercePositiveInteger(params.decision.workflowInput?.waitHours),
        idempotencyKey: buildGraceServiceAutostaffIdempotencyKey({
          organizationId: params.context.organizationId,
          serviceRunId: serviceRun.id,
          goalId: goal.id,
        }),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to dispatch volunteer staffing workflow";
    await markWorkflowDispatchFailed(goal.id, message);

    return {
      status: "failed" as const,
      workflowKey: "volunteer_staffing" as const,
      goalIds: [goal.id],
      createdCount: 0,
      reusedCount: 0,
      failedCount: 1,
      summary: isInngestDispatchConfigurationError(error)
        ? "Grace created the staffing workflow record, but the background runner could not be reached."
        : message,
    };
  }

  return {
    status: "started" as const,
    workflowKey: "volunteer_staffing" as const,
    goalIds: [goal.id],
    createdCount: 1,
    reusedCount: 0,
    failedCount: 0,
    summary: "Grace is staffing that service run now and will monitor replies automatically.",
  };
}

async function startGuestFollowupWorkflow(params: {
  context: GraceSessionContext;
  decision: GraceWorkflowDecision;
}) {
  const requestedPipelineItemId = coerceOptionalString(params.decision.workflowInput?.pipelineItemId);
  const requestedStageId = coerceOptionalString(params.decision.workflowInput?.stageId);

  const rows = await db
    .select({
      pipelineItemId: pipelineItems.id,
      organizationId: pipelineItems.organizationId,
      contactId: pipelineItems.contactId,
      stageId: pipelineStages.id,
      stageName: pipelineStages.name,
      contactFirstName: churchContacts.firstName,
      contactLastName: churchContacts.lastName,
    })
    .from(pipelineItems)
    .innerJoin(pipelineStages, eq(pipelineItems.stageId, pipelineStages.id))
    .leftJoin(churchContacts, eq(pipelineItems.contactId, churchContacts.id))
    .where(eq(pipelineItems.organizationId, params.context.organizationId))
    .orderBy(desc(pipelineItems.updatedAt));

  const eligibleRows = rows.filter((row) => {
    if (!row.contactId) return false;
    if (requestedPipelineItemId && row.pipelineItemId !== requestedPipelineItemId) return false;
    if (requestedStageId && row.stageId !== requestedStageId) return false;
    return isFirstTimeGuestStageName(row.stageName);
  });

  let createdCount = 0;
  let reusedCount = 0;
  let failedCount = 0;
  const goalIds: string[] = [];

  for (const row of eligibleRows) {
    const contactName = `${row.contactFirstName ?? ""} ${row.contactLastName ?? ""}`
      .trim()
      .replace(/\s+/g, " ") || "Guest";

    const correlationKey = buildGraceWorkflowCorrelationKey({
      workflowKey: "guest_followup",
      organizationId: params.context.organizationId,
      subjectEntityType: "pipeline_item",
      subjectEntityId: row.pipelineItemId,
      subjectContactId: row.contactId,
    });

    const { goal, created } = await createOrReuseGraceWorkflowGoal({
      organizationId: params.context.organizationId,
      workflowKey: "guest_followup",
      triggerSource: "staff_prompt",
      triggerChannel: params.context.channel,
      requestedByUserId: params.context.userId,
      subjectContactId: row.contactId,
      subjectEntityType: "pipeline_item",
      subjectEntityId: row.pipelineItemId,
      correlationKey,
      lastDecisionSummary: params.decision.kickoffSummary ?? null,
      objectiveText: `Follow up with ${contactName} as a first-time guest.`,
      contextJson: {
        pipelineItemId: row.pipelineItemId,
        stageId: row.stageId,
        stageName: row.stageName,
        workflowInput: params.decision.workflowInput ?? {},
      },
    });

    goalIds.push(goal.id);
    if (!created) {
      reusedCount += 1;
      continue;
    }

    if (!hasInngestEventKey()) {
      failedCount += 1;
      await markWorkflowDispatchFailed(
        goal.id,
        "Guest follow-up workflow was created, but Inngest event dispatch is not configured."
      );
      continue;
    }

    try {
      await upsertGraceWorkflowStep({
        goalId: goal.id,
        organizationId: goal.organizationId,
        stepKey: "kickoff_confirmation",
        title: "Workflow approved by staff",
        runOrder: 5,
        status: "completed",
        outputJson: {
          source: "grace_router",
          approvedByUserId: params.context.userId ?? null,
        },
      });

      await dispatchGuestWorkflowStart({
        goal,
        organizationId: params.context.organizationId,
        pipelineItemId: row.pipelineItemId,
        contactId: row.contactId,
        stageId: row.stageId,
        stageName: row.stageName,
        trigger: "stage_changed",
        occurredAt: new Date(),
      });
      createdCount += 1;
    } catch (error) {
      failedCount += 1;
      await markWorkflowDispatchFailed(
        goal.id,
        error instanceof Error ? error.message : "Failed to dispatch guest follow-up workflow"
      );
    }
  }

  const summary = summarizeWorkflowStart({
    workflowKey: "guest_followup",
    createdCount,
    reusedCount,
    failedCount,
    totalCount: eligibleRows.length,
  });

  return {
    workflowKey: "guest_followup" as const,
    goalIds,
    createdCount,
    reusedCount,
    failedCount,
    ...summary,
  };
}

async function startPrayerCareWorkflow(params: {
  context: GraceSessionContext;
  decision: GraceWorkflowDecision;
}) {
  const requestedRequestId = coerceOptionalString(params.decision.workflowInput?.requestId);
  const requestedUrgency = coerceOptionalString(params.decision.workflowInput?.urgency);

  const rows = await db
    .select({
      requestId: prayerRequests.id,
      organizationId: prayerRequests.organizationId,
      contactId: prayerRequests.contactId,
      contactName: prayerRequests.contactName,
      content: prayerRequests.content,
      status: prayerRequests.status,
      urgency: prayerRequests.urgency,
    })
    .from(prayerRequests)
    .where(eq(prayerRequests.organizationId, params.context.organizationId))
    .orderBy(desc(prayerRequests.createdAt));

  const eligibleRows = rows.filter((row) => {
    if (requestedRequestId && row.requestId !== requestedRequestId) return false;
    if (requestedUrgency && row.urgency !== requestedUrgency) return false;
    return isPrayerRequestActive(row.status);
  });

  let createdCount = 0;
  let reusedCount = 0;
  let failedCount = 0;
  const goalIds: string[] = [];

  for (const row of eligibleRows) {
    const correlationKey = buildGraceWorkflowCorrelationKey({
      workflowKey: "prayer_care",
      organizationId: params.context.organizationId,
      subjectEntityType: "prayer_request",
      subjectEntityId: row.requestId,
      subjectContactId: row.contactId,
    });

    const { goal, created } = await createOrReuseGraceWorkflowGoal({
      organizationId: params.context.organizationId,
      workflowKey: "prayer_care",
      triggerSource: "staff_prompt",
      triggerChannel: params.context.channel,
      requestedByUserId: params.context.userId,
      subjectContactId: row.contactId ?? null,
      subjectEntityType: "prayer_request",
      subjectEntityId: row.requestId,
      correlationKey,
      lastDecisionSummary: params.decision.kickoffSummary ?? null,
      objectiveText: `Follow up on prayer care for ${row.contactName ?? "community member"}.`,
      contextJson: {
        requestId: row.requestId,
        status: row.status,
        urgency: row.urgency,
        workflowInput: params.decision.workflowInput ?? {},
      },
    });

    goalIds.push(goal.id);
    if (!created) {
      reusedCount += 1;
      continue;
    }

    if (!hasInngestEventKey()) {
      failedCount += 1;
      await markWorkflowDispatchFailed(
        goal.id,
        "Prayer care workflow was created, but Inngest event dispatch is not configured."
      );
      continue;
    }

    try {
      await upsertGraceWorkflowStep({
        goalId: goal.id,
        organizationId: goal.organizationId,
        stepKey: "kickoff_confirmation",
        title: "Workflow approved by staff",
        runOrder: 5,
        status: "completed",
        outputJson: {
          source: "grace_router",
          approvedByUserId: params.context.userId ?? null,
        },
      });

      await dispatchPrayerWorkflowStart({
        goal,
        organizationId: params.context.organizationId,
        requestId: row.requestId,
        trigger: "updated",
        status: row.status,
        urgency: row.urgency,
        occurredAt: new Date(),
      });
      createdCount += 1;
    } catch (error) {
      failedCount += 1;
      await markWorkflowDispatchFailed(
        goal.id,
        error instanceof Error ? error.message : "Failed to dispatch prayer care workflow"
      );
    }
  }

  const summary = summarizeWorkflowStart({
    workflowKey: "prayer_care",
    createdCount,
    reusedCount,
    failedCount,
    totalCount: eligibleRows.length,
  });

  return {
    workflowKey: "prayer_care" as const,
    goalIds,
    createdCount,
    reusedCount,
    failedCount,
    ...summary,
  };
}

export async function startGraceWorkflowFromDecision(params: {
  context: GraceSessionContext;
  decision: GraceWorkflowDecision;
}): Promise<GraceWorkflowStartSummary> {
  if (!params.decision.workflowKey || !isGraceWorkflowKey(params.decision.workflowKey)) {
    return {
      status: "failed",
      failedCount: 1,
      summary: "Grace could not identify a supported workflow to start.",
    };
  }

  switch (params.decision.workflowKey) {
    case "volunteer_staffing":
      return startVolunteerStaffingWorkflow(params);
    case "guest_followup":
      return startGuestFollowupWorkflow(params);
    case "prayer_care":
      return startPrayerCareWorkflow(params);
    default:
      return {
        status: "failed",
        workflowKey: params.decision.workflowKey,
        failedCount: 1,
        summary: "Grace does not support that workflow yet.",
      };
  }
}

export function buildGraceWorkflowStartEvent(params: {
  organizationId: string;
  workflowId: string;
  eventType: string;
  channel?: GraceWorkflowEvent["channel"];
  contactId?: string | null;
  entityType?: GraceWorkflowSubjectEntityType | null;
  entityId?: string | null;
  payload: Record<string, unknown>;
  occurredAt?: string;
}): GraceWorkflowEvent {
  return {
    eventType: params.eventType,
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    channel: params.channel ?? "system",
    contactId: params.contactId ?? null,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    payload: params.payload,
    occurredAt: params.occurredAt ?? new Date().toISOString(),
  };
}
