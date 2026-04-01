import { describe, expect, it } from "vitest";
import {
  APPROVAL_QUEUE_SLA_MINUTES,
  RUNTIME_FAILURE_ALERT_THRESHOLD_PERCENT,
  computeApprovalQueueHealth,
  computeGraceOpsHealth,
  computeRuntimeHealth,
} from "../ops-health";

const FIXED_NOW = new Date("2026-03-17T12:00:00.000Z");

describe("grace ops health metrics", () => {
  it("computes approval queue SLA metrics and decision latency", () => {
    const snapshot = computeApprovalQueueHealth(
      [
        {
          status: "pending",
          createdAt: "2026-03-17T11:00:00.000Z",
          decidedAt: null,
        },
        {
          status: "pending",
          createdAt: "2026-03-17T11:40:00.000Z",
          decidedAt: null,
        },
        {
          status: "approved",
          createdAt: "2026-03-17T10:00:00.000Z",
          decidedAt: "2026-03-17T10:30:00.000Z",
        },
        {
          status: "rejected",
          createdAt: "2026-03-15T10:00:00.000Z",
          decidedAt: "2026-03-15T10:10:00.000Z",
        },
        {
          status: "approved",
          createdAt: "2026-03-01T10:00:00.000Z",
          decidedAt: "2026-03-01T10:20:00.000Z",
        },
      ],
      { now: FIXED_NOW }
    );

    expect(snapshot.pendingCount).toBe(2);
    expect(snapshot.overduePendingCount).toBe(1);
    expect(snapshot.hasSlaBreach).toBe(true);
    expect(snapshot.avgPendingAgeMinutes).toBe(40);
    expect(snapshot.oldestPendingAgeMinutes).toBe(60);
    expect(snapshot.decidedLast7Days).toBe(2);
    expect(snapshot.avgDecisionMinutes).toBe(20);
    expect(APPROVAL_QUEUE_SLA_MINUTES).toBe(30);
  });

  it("computes runtime failure rates, channels, and top failed tools", () => {
    const snapshot = computeRuntimeHealth(
      [
        {
          status: "success",
          createdAt: "2026-03-17T11:58:00.000Z",
          channel: "in_app",
          toolName: "tasks.create",
        },
        {
          status: "error",
          createdAt: "2026-03-17T11:56:00.000Z",
          channel: "sms",
          toolName: "messages.sendSMS",
        },
        {
          status: "error",
          createdAt: "2026-03-17T11:54:00.000Z",
          channel: "sms",
          toolName: "messages.sendSMS",
        },
        {
          status: "error",
          createdAt: "2026-03-17T11:52:00.000Z",
          channel: "web",
          toolName: "contacts.upsert",
        },
        {
          status: "success",
          createdAt: "2026-03-16T13:00:00.000Z",
          channel: "web",
          toolName: "contacts.upsert",
        },
        {
          status: "error",
          createdAt: "2026-03-16T10:00:00.000Z",
          channel: "in_app",
          toolName: "tasks.create",
        },
      ],
      { now: FIXED_NOW }
    );

    expect(snapshot.last24hRuns).toBe(5);
    expect(snapshot.last24hFailures).toBe(3);
    expect(snapshot.last24hSuccesses).toBe(2);
    expect(snapshot.failureRatePercent).toBe(60);
    expect(snapshot.alerting).toBe(true);
    expect(snapshot.failureByChannel[0]).toEqual({ channel: "sms", count: 2 });
    expect(snapshot.topFailedTools[0]).toEqual({
      tool: "messages.sendSMS",
      count: 2,
    });
    expect(RUNTIME_FAILURE_ALERT_THRESHOLD_PERCENT).toBe(10);
  });

  it("combines approval and runtime health into one alert decision", () => {
    const snapshot = computeGraceOpsHealth({
      approvals: [
        {
          status: "pending",
          createdAt: "2026-03-17T10:00:00.000Z",
          decidedAt: null,
        },
      ],
      toolAuditRows: [
        {
          status: "success",
          createdAt: "2026-03-17T11:00:00.000Z",
          channel: "in_app",
          toolName: "tasks.create",
        },
      ],
      now: FIXED_NOW,
    });

    expect(snapshot.approvalQueue.hasSlaBreach).toBe(true);
    expect(snapshot.runtime.alerting).toBe(false);
    expect(snapshot.alerting).toBe(true);
  });
});
