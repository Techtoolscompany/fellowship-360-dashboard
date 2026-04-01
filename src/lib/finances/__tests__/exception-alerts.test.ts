import { describe, expect, it } from "vitest";
import {
  buildFinanceExceptionSnapshot,
  detectRecurringFailureException,
  detectReconciliationMismatchException,
  detectSpikeDropException,
} from "../exception-alerts";
import type { WeeklyGivingReport } from "../weekly-report";

function makeReport(overrides?: Partial<WeeklyGivingReport["totals"]>): WeeklyGivingReport {
  const totals = {
    current: 1_500,
    previous: 1_000,
    currentCount: 20,
    previousCount: 18,
    varianceAmount: 500,
    variancePercent: 50,
    trend: "up" as const,
    ...overrides,
  };

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
    totals,
    breakdownBySource: [],
    breakdownByFund: [],
    breakdownByCategory: [],
    summary: "test summary",
    generatedAt: "2026-03-17T00:00:00.000Z",
  };
}

describe("finance exception alerts", () => {
  it("detects week-over-week spikes and drops with meaningful baseline", () => {
    const spike = detectSpikeDropException(makeReport());
    expect(spike?.type).toBe("spike_drop");
    expect(spike?.severity).toBe("high");

    const drop = detectSpikeDropException(
      makeReport({
        current: 900,
        previous: 1_600,
        varianceAmount: -700,
        variancePercent: -43.8,
        trend: "down",
      })
    );
    expect(drop?.type).toBe("spike_drop");
    expect(drop?.title).toContain("drop");
  });

  it("does not alert on low-volume variance spikes", () => {
    const lowVolume = detectSpikeDropException(
      makeReport({
        current: 150,
        previous: 50,
        varianceAmount: 100,
        variancePercent: 200,
      })
    );
    expect(lowVolume).toBeNull();
  });

  it("detects recurring failures by ratio or count", () => {
    const ratioDriven = detectRecurringFailureException({
      activeRecurringPledgeCount: 5,
      missedRecurringCount: 2,
    });
    expect(ratioDriven?.type).toBe("recurring_failure");

    const noAlert = detectRecurringFailureException({
      activeRecurringPledgeCount: 12,
      missedRecurringCount: 1,
    });
    expect(noAlert).toBeNull();
  });

  it("detects reconciliation mismatch by count or amount", () => {
    const countDriven = detectReconciliationMismatchException({
      unreconciledCount: 3,
      unreconciledAmount: 200,
    });
    expect(countDriven?.type).toBe("reconciliation_mismatch");

    const amountDriven = detectReconciliationMismatchException({
      unreconciledCount: 1,
      unreconciledAmount: 1_250,
    });
    expect(amountDriven?.type).toBe("reconciliation_mismatch");
  });

  it("builds combined exception snapshot", () => {
    const snapshot = buildFinanceExceptionSnapshot({
      report: makeReport(),
      activeRecurringPledgeCount: 8,
      missedRecurringCount: 3,
      unreconciledCount: 4,
      unreconciledAmount: 1_100,
    });

    expect(snapshot.exceptions).toHaveLength(3);
    expect(snapshot.periodLabel).toBe("Mar 8 – Mar 14, 2026");
  });
});
