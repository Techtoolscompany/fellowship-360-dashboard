export type GraceWorkflowKey =
  | "volunteer_staffing"
  | "guest_followup"
  | "prayer_care"
  | "operations"
  | "custom";

export type GraceWorkflowStatus =
  | "queued"
  | "in_progress"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "escalated";

export type GraceWorkflowTone = "emerald" | "cyan" | "amber" | "rose" | "slate";

export type GraceWorkflowStepView = {
  stepKey: string;
  title: string;
  status: string;
  runOrder: number;
  attemptCount: number;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  errorText?: string | null;
  summary?: string | null;
};

export type GraceWorkflowCardView = {
  id: string;
  workflowKey: GraceWorkflowKey;
  workflowLabel: string;
  workflowVersion: string;
  status: GraceWorkflowStatus;
  statusLabel: string;
  statusTone: GraceWorkflowTone;
  headline: string;
  summary: string;
  meta: string[];
  objectiveText: string;
  triggerSource: string;
  triggerChannel: string;
  subjectEntityType: string | null;
  subjectEntityId: string | null;
  subjectContactId: string | null;
  correlationKey: string;
  policyMode: string;
  nextCheckpointAt: Date | string | null;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  stepSummary: string;
  stepTimeline: GraceWorkflowStepView[];
};

type GraceGoalLike = {
  id: string;
  goalType: string;
  workflowKey?: string | null;
  workflowVersion?: number | string | null;
  triggerSource?: string | null;
  triggerChannel?: string | null;
  subjectContactId?: string | null;
  subjectEntityType?: string | null;
  subjectEntityId?: string | null;
  correlationKey?: string | null;
  policyMode?: string | null;
  lastDecisionSummary?: string | null;
  nextCheckpointAt?: Date | string | null;
  status: GraceWorkflowStatus;
  sourceChannel: string;
  objectiveText: string;
  serviceRunId?: string | null;
  contextJson?: Record<string, unknown> | null;
  resultJson?: Record<string, unknown> | null;
  errorText?: string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  nextRunAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type GraceGoalStepLike = {
  stepKey: string;
  title: string;
  status: string;
  runOrder: number;
  attemptCount: number;
  inputJson?: Record<string, unknown> | null;
  outputJson?: Record<string, unknown> | null;
  errorText?: string | null;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
};

function trimString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractRecordValue(record: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    const trimmed = trimString(value);
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}

function normalizeWorkflowKey(goal: GraceGoalLike): GraceWorkflowKey {
  if (goal.workflowKey === "volunteer_staffing") return goal.workflowKey;
  if (goal.workflowKey === "guest_followup") return goal.workflowKey;
  if (goal.workflowKey === "prayer_care") return goal.workflowKey;
  if (goal.workflowKey === "operations") return goal.workflowKey;
  if (goal.workflowKey === "custom") return goal.workflowKey;

  const explicit = extractRecordValue(goal.contextJson, ["workflowKey"]);
  if (explicit === "volunteer_staffing") return explicit;
  if (explicit === "guest_followup") return explicit;
  if (explicit === "prayer_care") return explicit;
  if (explicit === "operations") return explicit;
  if (explicit === "custom") return explicit;

  if (goal.goalType === "service_staffing") return "volunteer_staffing";
  if (goal.goalType === "communications_followup") return "guest_followup";
  if (goal.goalType === "operations") return "operations";
  return "custom";
}

function formatWorkflowLabel(workflowKey: GraceWorkflowKey) {
  switch (workflowKey) {
    case "volunteer_staffing":
      return "Volunteer staffing";
    case "guest_followup":
      return "Guest follow-up";
    case "prayer_care":
      return "Prayer care";
    case "operations":
      return "Operations";
    default:
      return "Custom workflow";
  }
}

function formatWorkflowStatusLabel(status: GraceWorkflowStatus) {
  switch (status) {
    case "queued":
      return "Queued";
    case "in_progress":
      return "In progress";
    case "waiting":
      return "Waiting";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "escalated":
      return "Escalated";
  }

  return "Queued";
}

function formatWorkflowTone(status: GraceWorkflowStatus): GraceWorkflowTone {
  switch (status) {
    case "completed":
      return "emerald";
    case "in_progress":
      return "cyan";
    case "queued":
    case "waiting":
      return "amber";
    case "failed":
    case "cancelled":
    case "escalated":
      return "rose";
  }

  return "slate";
}

function inferSubjectEntityType(workflowKey: GraceWorkflowKey, goal: GraceGoalLike) {
  if (goal.subjectEntityType) return goal.subjectEntityType;
  const explicit = extractRecordValue(goal.contextJson, ["subjectEntityType"]);
  if (explicit) return explicit;

  switch (workflowKey) {
    case "volunteer_staffing":
      return "service_run";
    case "guest_followup":
      return "pipeline_item";
    case "prayer_care":
      return "prayer_request";
    case "operations":
      return "organization";
    default:
      return extractRecordValue(goal.contextJson, ["entityType"]) ?? null;
  }
}

function inferSubjectEntityId(goal: GraceGoalLike) {
  return (
    trimString(goal.subjectEntityId) ??
    extractRecordValue(goal.contextJson, ["subjectEntityId", "entityId"]) ??
    goal.serviceRunId ??
    extractRecordValue(goal.contextJson, ["serviceRunId", "pipelineItemId", "requestId"]) ??
    null
  );
}

function inferSubjectContactId(goal: GraceGoalLike) {
  return (
    trimString(goal.subjectContactId) ??
    extractRecordValue(goal.contextJson, ["subjectContactId", "contactId"]) ??
    null
  );
}

function inferCorrelationKey(workflowKey: GraceWorkflowKey, goal: GraceGoalLike, subjectEntityId: string | null) {
  return (
    trimString(goal.correlationKey) ??
    extractRecordValue(goal.contextJson, ["correlationKey"]) ??
    [workflowKey, inferSubjectEntityType(workflowKey, goal), subjectEntityId]
      .filter(Boolean)
      .join(":")
  );
}

function inferWorkflowVersion(goal: GraceGoalLike) {
  if (goal.workflowVersion !== null && goal.workflowVersion !== undefined) {
    return `v${String(goal.workflowVersion).replace(/^v/i, "")}`;
  }
  return extractRecordValue(goal.contextJson, ["workflowVersion"]) ?? "v1";
}

function inferTriggerSource(goal: GraceGoalLike) {
  return trimString(goal.triggerSource) ??
    extractRecordValue(goal.contextJson, ["triggerSource"]) ??
    goal.sourceChannel ??
    "in_app";
}

function inferTriggerChannel(goal: GraceGoalLike) {
  return trimString(goal.triggerChannel) ??
    extractRecordValue(goal.contextJson, ["triggerChannel"]) ??
    goal.sourceChannel ??
    "in_app";
}

function inferPolicyMode(goal: GraceGoalLike) {
  return trimString(goal.policyMode) ?? extractRecordValue(goal.contextJson, ["policyMode"]) ?? "standard";
}

function inferLastDecisionSummary(goal: GraceGoalLike) {
  if (trimString(goal.lastDecisionSummary)) {
    return trimString(goal.lastDecisionSummary);
  }
  const resultSummary = extractRecordValue(goal.resultJson, ["summary", "lastDecisionSummary"]);
  return resultSummary ?? goal.errorText ?? goal.objectiveText;
}

function summarizeSteps(steps: GraceGoalStepLike[] | undefined) {
  const timeline = (steps ?? [])
    .slice()
    .sort((a, b) => a.runOrder - b.runOrder || a.stepKey.localeCompare(b.stepKey))
    .map((step) => ({
      stepKey: step.stepKey,
      title: step.title,
      status: step.status,
      runOrder: step.runOrder,
      attemptCount: step.attemptCount,
      startedAt: step.startedAt ?? null,
      completedAt: step.completedAt ?? null,
      errorText: step.errorText ?? null,
      summary:
        extractRecordValue(step.outputJson, ["summary", "message", "status"]) ??
        extractRecordValue(step.inputJson, ["summary", "message"]) ??
        null,
    }));

  const counts = timeline.reduce(
    (acc, step) => {
      acc.total += 1;
      if (step.status === "pending") acc.pending += 1;
      if (step.status === "in_progress") acc.inProgress += 1;
      if (step.status === "waiting") acc.waiting += 1;
      if (step.status === "completed") acc.completed += 1;
      if (step.status === "failed") acc.failed += 1;
      if (step.status === "skipped") acc.skipped += 1;
      return acc;
    },
    {
      total: 0,
      pending: 0,
      inProgress: 0,
      waiting: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    }
  );

  const activeStep = timeline.find((step) => step.status === "in_progress" || step.status === "waiting");
  const stepSummary =
    counts.total === 0
      ? "No workflow steps recorded yet"
      : `${counts.completed}/${counts.total} complete${counts.waiting > 0 ? ` · ${counts.waiting} waiting` : ""}${counts.inProgress > 0 ? ` · ${counts.inProgress} in progress` : ""}`;

  return {
    timeline,
    counts,
    stepSummary,
    activeStep,
  };
}

export function buildGraceWorkflowCardView(
  goal: GraceGoalLike,
  options?: { steps?: GraceGoalStepLike[] }
): GraceWorkflowCardView {
  const workflowKey = normalizeWorkflowKey(goal);
  const subjectEntityId = inferSubjectEntityId(goal);
  const { timeline, counts, stepSummary, activeStep } = summarizeSteps(options?.steps);

  const headline = goal.objectiveText.trim();
  const lastDecisionSummary = inferLastDecisionSummary(goal);
  const summary =
    activeStep?.title ??
    lastDecisionSummary ??
    headline;

  const meta = [
    `Trigger: ${inferTriggerSource(goal)}`,
    `Channel: ${inferTriggerChannel(goal)}`,
    `Target: ${inferSubjectEntityType(workflowKey, goal) ?? "n/a"}${subjectEntityId ? ` ${subjectEntityId}` : ""}`,
  ];

  return {
    id: goal.id,
    workflowKey,
    workflowLabel: formatWorkflowLabel(workflowKey),
    workflowVersion: inferWorkflowVersion(goal),
    status: goal.status,
    statusLabel: formatWorkflowStatusLabel(goal.status),
    statusTone: formatWorkflowTone(goal.status),
    headline,
    summary,
    meta,
    objectiveText: goal.objectiveText,
    triggerSource: inferTriggerSource(goal),
    triggerChannel: inferTriggerChannel(goal),
    subjectEntityType: inferSubjectEntityType(workflowKey, goal),
    subjectEntityId,
    subjectContactId: inferSubjectContactId(goal),
    correlationKey: inferCorrelationKey(workflowKey, goal, subjectEntityId),
    policyMode: inferPolicyMode(goal),
    nextCheckpointAt: goal.nextCheckpointAt ?? goal.nextRunAt ?? null,
    startedAt: goal.startedAt ?? null,
    completedAt: goal.completedAt ?? null,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
    stepSummary: counts.total > 0 ? stepSummary : "Waiting for the next step",
    stepTimeline: timeline,
  };
}

export function getGraceWorkflowToneClasses(tone: GraceWorkflowTone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200";
    case "cyan":
      return "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-200";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200";
    case "rose":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-200";
    case "slate":
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-200";
  }
}

export function getGraceWorkflowStatusTone(status: GraceWorkflowStatus) {
  return formatWorkflowTone(status);
}

export function getGraceWorkflowStatusLabel(status: GraceWorkflowStatus) {
  return formatWorkflowStatusLabel(status);
}

export function getGraceWorkflowLabel(workflowKey: GraceWorkflowKey) {
  return formatWorkflowLabel(workflowKey);
}
