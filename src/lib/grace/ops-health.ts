export const APPROVAL_QUEUE_SLA_MINUTES = 30;
export const RUNTIME_FAILURE_ALERT_THRESHOLD_PERCENT = 10;
export const RUNTIME_HEALTH_LOOKBACK_HOURS = 24;

export type ApprovalQueueHealthRow = {
  status: string;
  createdAt: Date | string;
  decidedAt?: Date | string | null;
};

export type RuntimeHealthRow = {
  status: string;
  createdAt: Date | string;
  channel?: string | null;
  toolName?: string | null;
};

export type ApprovalQueueHealthSnapshot = {
  pendingCount: number;
  overduePendingCount: number;
  avgPendingAgeMinutes: number;
  oldestPendingAgeMinutes: number;
  decidedLast7Days: number;
  avgDecisionMinutes: number;
  hasSlaBreach: boolean;
};

export type RuntimeHealthSnapshot = {
  last24hRuns: number;
  last24hFailures: number;
  last24hSuccesses: number;
  failureRatePercent: number;
  alerting: boolean;
  failureByChannel: Array<{ channel: string; count: number }>;
  topFailedTools: Array<{ tool: string; count: number }>;
};

export type GraceOpsHealthSnapshot = {
  approvalQueue: ApprovalQueueHealthSnapshot;
  runtime: RuntimeHealthSnapshot;
  alerting: boolean;
};

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) return null;
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) return null;
  return asDate.getTime();
}

function normalizeNow(value: Date | number | undefined) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return Date.now();
}

export function computeApprovalQueueHealth(
  approvals: ReadonlyArray<ApprovalQueueHealthRow>,
  options?: { now?: Date | number; slaMinutes?: number }
): ApprovalQueueHealthSnapshot {
  const now = normalizeNow(options?.now);
  const slaMinutes = options?.slaMinutes ?? APPROVAL_QUEUE_SLA_MINUTES;
  const decidedLookbackStart = now - 7 * 24 * 60 * 60 * 1000;

  const pending = approvals.filter((approval) => approval.status === "pending");
  const pendingAgeMinutes = pending
    .map((approval) => {
      const createdAtMs = toTimestamp(approval.createdAt);
      if (createdAtMs === null) return null;
      return Math.max(0, Math.round((now - createdAtMs) / 60_000));
    })
    .filter((value): value is number => value !== null);

  const overduePendingCount = pendingAgeMinutes.filter(
    (minutes) => minutes > slaMinutes
  ).length;

  const decidedInLast7Days = approvals.filter((approval) => {
    if (!approval.decidedAt || approval.status === "pending") return false;
    const decidedAtMs = toTimestamp(approval.decidedAt);
    if (decidedAtMs === null) return false;
    return decidedAtMs >= decidedLookbackStart;
  });

  const decisionDurations = decidedInLast7Days
    .map((approval) => {
      if (!approval.decidedAt) return null;
      const createdAtMs = toTimestamp(approval.createdAt);
      const decidedAtMs = toTimestamp(approval.decidedAt);
      if (createdAtMs === null || decidedAtMs === null || decidedAtMs < createdAtMs) {
        return null;
      }
      return Math.round((decidedAtMs - createdAtMs) / 60_000);
    })
    .filter((value): value is number => value !== null);

  return {
    pendingCount: pending.length,
    overduePendingCount,
    avgPendingAgeMinutes:
      pendingAgeMinutes.length > 0
        ? Math.round(
            pendingAgeMinutes.reduce((total, minutes) => total + minutes, 0) /
              pendingAgeMinutes.length
          )
        : 0,
    oldestPendingAgeMinutes:
      pendingAgeMinutes.length > 0 ? Math.max(...pendingAgeMinutes) : 0,
    decidedLast7Days: decidedInLast7Days.length,
    avgDecisionMinutes:
      decisionDurations.length > 0
        ? Math.round(
            decisionDurations.reduce((total, minutes) => total + minutes, 0) /
              decisionDurations.length
          )
        : 0,
    hasSlaBreach: overduePendingCount > 0,
  };
}

export function computeRuntimeHealth(
  toolAuditRows: ReadonlyArray<RuntimeHealthRow>,
  options?: {
    now?: Date | number;
    lookbackHours?: number;
    failureAlertThresholdPercent?: number;
  }
): RuntimeHealthSnapshot {
  const now = normalizeNow(options?.now);
  const lookbackHours = options?.lookbackHours ?? RUNTIME_HEALTH_LOOKBACK_HOURS;
  const failureAlertThresholdPercent =
    options?.failureAlertThresholdPercent ?? RUNTIME_FAILURE_ALERT_THRESHOLD_PERCENT;
  const windowStart = now - lookbackHours * 60 * 60 * 1000;

  const recentRows = toolAuditRows.filter((row) => {
    const createdAtMs = toTimestamp(row.createdAt);
    if (createdAtMs === null) return false;
    return createdAtMs >= windowStart;
  });

  const failures = recentRows.filter((row) => row.status === "error");
  const successes = recentRows.length - failures.length;
  const failureRatePercent =
    recentRows.length > 0
      ? Number(((failures.length / recentRows.length) * 100).toFixed(1))
      : 0;

  const failureByChannel = new Map<string, number>();
  for (const row of failures) {
    const channel = row.channel || "unknown";
    failureByChannel.set(channel, (failureByChannel.get(channel) ?? 0) + 1);
  }

  const failureByTool = new Map<string, number>();
  for (const row of failures) {
    const tool = row.toolName || "unknown.tool";
    failureByTool.set(tool, (failureByTool.get(tool) ?? 0) + 1);
  }

  return {
    last24hRuns: recentRows.length,
    last24hFailures: failures.length,
    last24hSuccesses: successes,
    failureRatePercent,
    alerting: failureRatePercent >= failureAlertThresholdPercent,
    failureByChannel: Array.from(failureByChannel.entries())
      .map(([channel, count]) => ({ channel, count }))
      .sort((a, b) => b.count - a.count),
    topFailedTools: Array.from(failureByTool.entries())
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}

export function computeGraceOpsHealth(input: {
  approvals: ReadonlyArray<ApprovalQueueHealthRow>;
  toolAuditRows: ReadonlyArray<RuntimeHealthRow>;
  now?: Date | number;
}): GraceOpsHealthSnapshot {
  const approvalQueue = computeApprovalQueueHealth(input.approvals, {
    now: input.now,
  });
  const runtime = computeRuntimeHealth(input.toolAuditRows, {
    now: input.now,
  });

  return {
    approvalQueue,
    runtime,
    alerting: approvalQueue.hasSlaBreach || runtime.alerting,
  };
}
