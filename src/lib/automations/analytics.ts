const REPLY_KEYWORDS = ["reply", "respond", "response", "answered"];
const CONVERSION_KEYWORDS = [
  "conversion",
  "booked",
  "appointment",
  "rsvp",
  "confirmed",
  "attend",
];

type TraceEntry = Record<string, unknown>;

export type AutomationRunAnalyticsRow = {
  workflowId: string;
  status: "entered" | "running" | "failed" | "completed" | "exited";
  enteredAt: Date | string;
  metadataJson?: Record<string, unknown> | null;
};

export type AutomationWorkflowAnalyticsSnapshot = {
  workflowId: string;
  totalRuns: number;
  replyCount: number;
  completionCount: number;
  conversionCount: number;
  replyRatePercent: number;
  completionRatePercent: number;
  conversionRatePercent: number;
  daily: Array<{
    date: string;
    totalRuns: number;
    replyCount: number;
    completionCount: number;
    conversionCount: number;
  }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTrace(metadataJson: Record<string, unknown> | null | undefined) {
  const rawTrace = metadataJson?.trace;
  if (!Array.isArray(rawTrace)) return [] as TraceEntry[];
  return rawTrace.filter((item): item is TraceEntry => isRecord(item));
}

function includesKeyword(value: unknown, keywords: string[]) {
  if (value === null || value === undefined) return false;
  const text = String(value).toLowerCase();
  return keywords.some((keyword) => text.includes(keyword));
}

function runHasReplySignal(trace: TraceEntry[]) {
  return trace.some((entry) =>
    includesKeyword(entry.nodeId, REPLY_KEYWORDS) ||
    includesKeyword(entry.selectedNextNodeId, REPLY_KEYWORDS) ||
    includesKeyword(entry.actionType, REPLY_KEYWORDS) ||
    includesKeyword(entry.reason, REPLY_KEYWORDS)
  );
}

function runHasConversionSignal(trace: TraceEntry[]) {
  return trace.some((entry) =>
    includesKeyword(entry.nodeId, CONVERSION_KEYWORDS) ||
    includesKeyword(entry.selectedNextNodeId, CONVERSION_KEYWORDS) ||
    includesKeyword(entry.actionType, CONVERSION_KEYWORDS) ||
    includesKeyword(entry.reason, CONVERSION_KEYWORDS)
  );
}

function toDayKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 10);
}

function toPercent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

type MutableDailySummary = {
  totalRuns: number;
  replyCount: number;
  completionCount: number;
  conversionCount: number;
};

export function computeWorkflowAnalytics(
  workflowId: string,
  rows: ReadonlyArray<AutomationRunAnalyticsRow>
): AutomationWorkflowAnalyticsSnapshot {
  let replyCount = 0;
  let completionCount = 0;
  let conversionCount = 0;
  const daily = new Map<string, MutableDailySummary>();

  for (const row of rows) {
    const trace = normalizeTrace(row.metadataJson ?? null);
    const hasReplySignal = runHasReplySignal(trace);
    const hasConversionSignal = runHasConversionSignal(trace);
    const completed = row.status === "completed";

    if (hasReplySignal) {
      replyCount += 1;
    }
    if (completed) {
      completionCount += 1;
    }
    if (completed && hasConversionSignal) {
      conversionCount += 1;
    }

    const dayKey = toDayKey(row.enteredAt);
    const summary = daily.get(dayKey) ?? {
      totalRuns: 0,
      replyCount: 0,
      completionCount: 0,
      conversionCount: 0,
    };

    summary.totalRuns += 1;
    if (hasReplySignal) summary.replyCount += 1;
    if (completed) summary.completionCount += 1;
    if (completed && hasConversionSignal) summary.conversionCount += 1;

    daily.set(dayKey, summary);
  }

  const totalRuns = rows.length;

  return {
    workflowId,
    totalRuns,
    replyCount,
    completionCount,
    conversionCount,
    replyRatePercent: toPercent(replyCount, totalRuns),
    completionRatePercent: toPercent(completionCount, totalRuns),
    conversionRatePercent: toPercent(conversionCount, totalRuns),
    daily: Array.from(daily.entries())
      .map(([date, summary]) => ({
        date,
        totalRuns: summary.totalRuns,
        replyCount: summary.replyCount,
        completionCount: summary.completionCount,
        conversionCount: summary.conversionCount,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
  };
}
