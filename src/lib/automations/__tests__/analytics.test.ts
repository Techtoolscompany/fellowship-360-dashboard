import { describe, expect, it } from "vitest";
import { computeWorkflowAnalytics } from "../analytics";

describe("computeWorkflowAnalytics", () => {
  it("computes reply, completion, and conversion metrics from run traces", () => {
    const snapshot = computeWorkflowAnalytics("wf_1", [
      {
        workflowId: "wf_1",
        status: "completed",
        enteredAt: "2026-03-10T10:00:00.000Z",
        metadataJson: {
          trace: [
            { event: "condition_branch", nodeId: "condition_reply_received" },
            { event: "stop", nodeId: "stop_conversion" },
          ],
        },
      },
      {
        workflowId: "wf_1",
        status: "completed",
        enteredAt: "2026-03-10T12:00:00.000Z",
        metadataJson: {
          trace: [{ event: "action_executed", nodeId: "action_send_followup" }],
        },
      },
      {
        workflowId: "wf_1",
        status: "failed",
        enteredAt: "2026-03-11T09:00:00.000Z",
        metadataJson: {
          trace: [{ event: "condition_branch", nodeId: "condition_reply_received" }],
        },
      },
    ]);

    expect(snapshot.totalRuns).toBe(3);
    expect(snapshot.replyCount).toBe(2);
    expect(snapshot.completionCount).toBe(2);
    expect(snapshot.conversionCount).toBe(1);
    expect(snapshot.replyRatePercent).toBe(66.7);
    expect(snapshot.completionRatePercent).toBe(66.7);
    expect(snapshot.conversionRatePercent).toBe(33.3);
    expect(snapshot.daily).toHaveLength(2);
    expect(snapshot.daily[0]).toMatchObject({
      date: "2026-03-10",
      totalRuns: 2,
      replyCount: 1,
      completionCount: 2,
      conversionCount: 1,
    });
  });
});
