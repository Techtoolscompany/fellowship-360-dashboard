import { describe, expect, it } from "vitest";
import type { GraceActionOutcome } from "@/lib/grace/types";
import type { WeeklyGivingReport } from "../weekly-report";
import {
  buildVoiceWeeklyFinanceReply,
  extractWeeklyGivingReportFromActionOutcomes,
  isVoiceWeeklyFinanceSummaryQuery,
  resolveVoiceWeeklyFinanceRange,
} from "../voice-query";

function makeReport(summary = "Weekly giving summary for voice playback"): WeeklyGivingReport {
  return {
    period: {
      start: "2026-03-08T00:00:00.000Z",
      end: "2026-03-14T23:59:59.999Z",
      label: "Mar 8 – Mar 14, 2026",
    },
    previousPeriod: {
      start: "2026-03-01T00:00:00.000Z",
      end: "2026-03-07T23:59:59.999Z",
      label: "Mar 1 – Mar 7, 2026",
    },
    totals: {
      current: 5_000,
      previous: 4_200,
      currentCount: 42,
      previousCount: 39,
      varianceAmount: 800,
      variancePercent: 19,
      trend: "up",
    },
    breakdownBySource: [],
    breakdownByFund: [],
    breakdownByCategory: [],
    summary,
    generatedAt: "2026-03-17T00:00:00.000Z",
  };
}

describe("finance voice query helpers", () => {
  it("detects weekly finance voice intents", () => {
    expect(
      isVoiceWeeklyFinanceSummaryQuery("Grace, give me the weekly giving summary.")
    ).toBe(true);
    expect(
      isVoiceWeeklyFinanceSummaryQuery("What was finance week over week?")
    ).toBe(true);
  });

  it("ignores non-finance intents", () => {
    expect(
      isVoiceWeeklyFinanceSummaryQuery("Send an SMS reminder to the worship team.")
    ).toBe(false);
  });

  it("defaults weekly range to the previous week", () => {
    const now = new Date("2026-03-17T12:00:00.000Z");
    const range = resolveVoiceWeeklyFinanceRange("Give me the weekly giving summary", now);

    expect(range.startDate.getFullYear()).toBe(2026);
    expect(range.startDate.getMonth()).toBe(2);
    expect(range.startDate.getDate()).toBe(8);
    expect(range.startDate.getDay()).toBe(0);
    expect(range.endDate.getFullYear()).toBe(2026);
    expect(range.endDate.getMonth()).toBe(2);
    expect(range.endDate.getDate()).toBe(14);
    expect(range.endDate.getDay()).toBe(6);
  });

  it("resolves current week when explicitly requested", () => {
    const now = new Date("2026-03-17T12:00:00.000Z");
    const range = resolveVoiceWeeklyFinanceRange("How is giving this week?", now);

    expect(range.startDate.getFullYear()).toBe(2026);
    expect(range.startDate.getMonth()).toBe(2);
    expect(range.startDate.getDate()).toBe(15);
    expect(range.startDate.getDay()).toBe(0);
    expect(range.endDate.getFullYear()).toBe(2026);
    expect(range.endDate.getMonth()).toBe(2);
    expect(range.endDate.getDate()).toBe(21);
    expect(range.endDate.getDay()).toBe(6);
  });

  it("extracts weekly report payload from finance action outcomes", () => {
    const report = makeReport();
    const outcomes: GraceActionOutcome[] = [
      {
        actionId: "a1",
        tool: "tasks.search",
        reason: "lookup tasks",
        requiresApproval: false,
        status: "executed",
        occurredAt: "2026-03-17T00:00:00.000Z",
        output: { tasks: [] },
      },
      {
        actionId: "a2",
        tool: "finance.weeklyReport",
        reason: "finance summary",
        requiresApproval: false,
        status: "executed",
        occurredAt: "2026-03-17T00:00:00.000Z",
        output: report as unknown as Record<string, unknown>,
      },
    ];

    expect(extractWeeklyGivingReportFromActionOutcomes(outcomes)).toEqual(report);
  });

  it("builds voice reply from report summary", () => {
    const reply = buildVoiceWeeklyFinanceReply(makeReport("Weekly giving totaled $5,000."));
    expect(reply).toBe("Weekly giving totaled $5,000.");
  });
});
