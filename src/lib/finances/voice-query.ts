import type { GraceActionOutcome } from "@/lib/grace/types";
import { endOfWeek, startOfWeek, subWeeks } from "date-fns";
import type { WeeklyGivingReport } from "./weekly-report";

const FINANCE_DOMAIN_TERMS = /\b(finance|giving|donation|donations|offering|offerings|tithe|tithes|fund)\b/i;
const WEEKLY_TIMEFRAME_TERMS = /\b(weekly|week|week-over-week|week over week|wow)\b/i;
const CURRENT_WEEK_TERMS = /\b(this|current)\s+week\b/i;
const PREVIOUS_WEEK_TERMS = /\b(last|previous|past)\s+week\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWeeklyGivingReport(value: unknown): value is WeeklyGivingReport {
  if (!isRecord(value)) return false;
  if (typeof value.summary !== "string") return false;
  if (!isRecord(value.period) || typeof value.period.label !== "string") return false;

  if (
    !isRecord(value.totals) ||
    typeof value.totals.current !== "number" ||
    typeof value.totals.variancePercent !== "number" ||
    (value.totals.trend !== "up" &&
      value.totals.trend !== "down" &&
      value.totals.trend !== "flat")
  ) {
    return false;
  }

  return true;
}

export function isVoiceWeeklyFinanceSummaryQuery(message: string): boolean {
  return FINANCE_DOMAIN_TERMS.test(message) && WEEKLY_TIMEFRAME_TERMS.test(message);
}

export function resolveVoiceWeeklyFinanceRange(message: string, now = new Date()) {
  const wantsCurrentWeek = CURRENT_WEEK_TERMS.test(message);
  const wantsPreviousWeek = PREVIOUS_WEEK_TERMS.test(message);
  const baseDate = wantsCurrentWeek ? now : wantsPreviousWeek ? subWeeks(now, 1) : subWeeks(now, 1);

  return {
    startDate: startOfWeek(baseDate, { weekStartsOn: 0 }),
    endDate: endOfWeek(baseDate, { weekStartsOn: 0 }),
  };
}

export function extractWeeklyGivingReportFromActionOutcomes(
  actionOutcomes: GraceActionOutcome[]
): WeeklyGivingReport | null {
  const financeOutcome = actionOutcomes
    .slice()
    .reverse()
    .find(
      (outcome) =>
        outcome.tool === "finance.weeklyReport" &&
        (outcome.status === "executed" || outcome.status === "retried") &&
        isWeeklyGivingReport(outcome.output)
    );

  if (!financeOutcome || !isWeeklyGivingReport(financeOutcome.output)) {
    return null;
  }

  return financeOutcome.output;
}

export function buildVoiceWeeklyFinanceReply(report: WeeklyGivingReport): string {
  return report.summary;
}
