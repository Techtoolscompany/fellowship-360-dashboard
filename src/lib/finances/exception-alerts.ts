import type { WeeklyGivingReport } from "./weekly-report";

export type FinanceExceptionType =
  | "spike_drop"
  | "recurring_failure"
  | "reconciliation_mismatch";

export type FinanceExceptionSeverity = "medium" | "high";

export type FinanceException = {
  type: FinanceExceptionType;
  severity: FinanceExceptionSeverity;
  title: string;
  detail: string;
  metadata: Record<string, unknown>;
};

export type FinanceExceptionSnapshot = {
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  exceptions: FinanceException[];
};

const SPIKE_DROP_THRESHOLD_PERCENT = 30;
const SPIKE_DROP_MIN_BASELINE_AMOUNT = 1_000;
const RECURRING_FAILURE_MIN_MISSED_COUNT = 2;
const RECURRING_FAILURE_MIN_MISSED_RATIO = 0.2;
const RECONCILIATION_MIN_UNRECONCILED_COUNT = 3;
const RECONCILIATION_MIN_UNRECONCILED_AMOUNT = 1_000;

export function detectSpikeDropException(
  report: WeeklyGivingReport
): FinanceException | null {
  const current = report.totals.current;
  const previous = report.totals.previous;
  const baseline = Math.max(current, previous);
  const variancePercent = Math.abs(report.totals.variancePercent);
  const isMeaningfulBaseline = baseline >= SPIKE_DROP_MIN_BASELINE_AMOUNT;
  const isLargeVariance = variancePercent >= SPIKE_DROP_THRESHOLD_PERCENT;

  if (!isMeaningfulBaseline || !isLargeVariance) {
    return null;
  }

  const direction = report.totals.trend === "down" ? "drop" : "spike";
  return {
    type: "spike_drop",
    severity: variancePercent >= 50 ? "high" : "medium",
    title: `Week-over-week giving ${direction} detected`,
    detail: `${variancePercent.toFixed(1)}% ${direction} vs previous week (${previous.toFixed(
      2
    )} -> ${current.toFixed(2)}).`,
    metadata: {
      variancePercent: report.totals.variancePercent,
      previousTotal: previous,
      currentTotal: current,
      thresholdPercent: SPIKE_DROP_THRESHOLD_PERCENT,
      minBaselineAmount: SPIKE_DROP_MIN_BASELINE_AMOUNT,
    },
  };
}

export function detectRecurringFailureException(params: {
  activeRecurringPledgeCount: number;
  missedRecurringCount: number;
}): FinanceException | null {
  if (params.activeRecurringPledgeCount <= 0 || params.missedRecurringCount <= 0) {
    return null;
  }

  const missedRatio = params.missedRecurringCount / params.activeRecurringPledgeCount;
  const exceedsCount = params.missedRecurringCount >= RECURRING_FAILURE_MIN_MISSED_COUNT;
  const exceedsRatio = missedRatio >= RECURRING_FAILURE_MIN_MISSED_RATIO;

  if (!exceedsCount && !exceedsRatio) {
    return null;
  }

  return {
    type: "recurring_failure",
    severity: missedRatio >= 0.4 ? "high" : "medium",
    title: "Potential failed recurring gifts detected",
    detail: `${params.missedRecurringCount} of ${params.activeRecurringPledgeCount} recurring pledge${
      params.activeRecurringPledgeCount === 1 ? "" : "s"
    } have no matching donation inside their expected window.`,
    metadata: {
      activeRecurringPledgeCount: params.activeRecurringPledgeCount,
      missedRecurringCount: params.missedRecurringCount,
      missedRecurringRatio: Number((missedRatio * 100).toFixed(1)),
      minMissedCount: RECURRING_FAILURE_MIN_MISSED_COUNT,
      minMissedRatio: RECURRING_FAILURE_MIN_MISSED_RATIO,
    },
  };
}

export function detectReconciliationMismatchException(params: {
  unreconciledCount: number;
  unreconciledAmount: number;
}): FinanceException | null {
  const exceedsCount = params.unreconciledCount >= RECONCILIATION_MIN_UNRECONCILED_COUNT;
  const exceedsAmount = params.unreconciledAmount >= RECONCILIATION_MIN_UNRECONCILED_AMOUNT;

  if (!exceedsCount && !exceedsAmount) {
    return null;
  }

  return {
    type: "reconciliation_mismatch",
    severity: params.unreconciledAmount >= 2_500 ? "high" : "medium",
    title: "Unreconciled donation records require review",
    detail: `${params.unreconciledCount} donation record${
      params.unreconciledCount === 1 ? "" : "s"
    } (${params.unreconciledAmount.toFixed(
      2
    )} total) are missing receipt reconciliation in the weekly period.`,
    metadata: {
      unreconciledCount: params.unreconciledCount,
      unreconciledAmount: params.unreconciledAmount,
      minUnreconciledCount: RECONCILIATION_MIN_UNRECONCILED_COUNT,
      minUnreconciledAmount: RECONCILIATION_MIN_UNRECONCILED_AMOUNT,
    },
  };
}

export function buildFinanceExceptionSnapshot(input: {
  report: WeeklyGivingReport;
  activeRecurringPledgeCount: number;
  missedRecurringCount: number;
  unreconciledCount: number;
  unreconciledAmount: number;
}): FinanceExceptionSnapshot {
  const exceptions: FinanceException[] = [];

  const spikeDrop = detectSpikeDropException(input.report);
  if (spikeDrop) exceptions.push(spikeDrop);

  const recurringFailure = detectRecurringFailureException({
    activeRecurringPledgeCount: input.activeRecurringPledgeCount,
    missedRecurringCount: input.missedRecurringCount,
  });
  if (recurringFailure) exceptions.push(recurringFailure);

  const reconciliationMismatch = detectReconciliationMismatchException({
    unreconciledCount: input.unreconciledCount,
    unreconciledAmount: input.unreconciledAmount,
  });
  if (reconciliationMismatch) exceptions.push(reconciliationMismatch);

  return {
    periodStart: input.report.period.start,
    periodEnd: input.report.period.end,
    periodLabel: input.report.period.label,
    exceptions,
  };
}

export function buildFinanceExceptionSummary(params: {
  organizationName: string | null;
  snapshot: FinanceExceptionSnapshot;
}) {
  const orgName = params.organizationName || "Organization";
  if (params.snapshot.exceptions.length === 0) {
    return `${orgName}: no finance exceptions detected for ${params.snapshot.periodLabel}.`;
  }

  return `${orgName}: ${params.snapshot.exceptions.length} finance exception${
    params.snapshot.exceptions.length === 1 ? "" : "s"
  } detected for ${params.snapshot.periodLabel}.`;
}

export function buildFinanceExceptionDetails(params: {
  organizationName: string | null;
  snapshot: FinanceExceptionSnapshot;
  generatedAt: string;
}) {
  const lines = [
    "Finance Exception Alert",
    `Generated at: ${params.generatedAt}`,
    `Organization: ${params.organizationName || "Unknown"}`,
    `Period: ${params.snapshot.periodLabel}`,
    "",
  ];

  if (params.snapshot.exceptions.length === 0) {
    lines.push("No exceptions detected.");
    return lines.join("\n");
  }

  for (const item of params.snapshot.exceptions) {
    lines.push(`- [${item.severity.toUpperCase()}] ${item.title}`);
    lines.push(`  ${item.detail}`);
  }

  lines.push("");
  lines.push("Recommended action:");
  lines.push("- Review donations feed, recurring pledge follow-up, and reconciliation workflow.");

  return lines.join("\n");
}
