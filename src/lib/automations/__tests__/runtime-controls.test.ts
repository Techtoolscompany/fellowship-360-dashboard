import { describe, expect, it } from "vitest";
import {
  computeDeadLetterRetryAt,
  evaluateAutomationConcurrency,
  resolveWorkflowDispatchWindow,
} from "@/lib/automations/runtime-controls";

describe("automation runtime controls", () => {
  it("throttles when concurrent run limit is reached", () => {
    const now = new Date("2026-03-17T12:00:00.000Z");
    const decision = evaluateAutomationConcurrency({
      activeRuns: 25,
      maxConcurrentRuns: 25,
      retryMinutes: 5,
      now,
    });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toBe("concurrency_limit_reached");
    expect(decision.retryAt.toISOString()).toBe("2026-03-17T12:05:00.000Z");
  });

  it("allows execution when active runs are below limit", () => {
    const decision = evaluateAutomationConcurrency({
      activeRuns: 4,
      maxConcurrentRuns: 25,
    });
    expect(decision.allowed).toBe(true);
  });

  it("limits workflows dispatched per event tick", () => {
    const window = resolveWorkflowDispatchWindow({
      workflowCount: 27,
      maxWorkflowsPerEvent: 20,
    });
    expect(window.selectedCount).toBe(20);
    expect(window.throttledCount).toBe(7);
  });

  it("computes capped exponential backoff for dead-letter retries", () => {
    const now = new Date("2026-03-17T12:00:00.000Z");
    const attempt1 = computeDeadLetterRetryAt({
      attemptCount: 1,
      now,
      baseMinutes: 15,
      maxMinutes: 360,
    });
    const attempt4 = computeDeadLetterRetryAt({
      attemptCount: 4,
      now,
      baseMinutes: 15,
      maxMinutes: 360,
    });
    const attempt20 = computeDeadLetterRetryAt({
      attemptCount: 20,
      now,
      baseMinutes: 15,
      maxMinutes: 360,
    });

    expect(attempt1.toISOString()).toBe("2026-03-17T12:15:00.000Z");
    expect(attempt4.toISOString()).toBe("2026-03-17T14:00:00.000Z");
    expect(attempt20.toISOString()).toBe("2026-03-17T18:00:00.000Z");
  });
});
