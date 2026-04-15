import { describe, expect, it } from "vitest";
import {
  buildVolunteerStaffingGoalContext,
  buildVolunteerStaffingGoalResult,
  buildVolunteerStaffingStepTemplates,
  deriveVolunteerStaffingReplyProgress,
  VOLUNTEER_STAFFING_WORKFLOW_KEY,
  VOLUNTEER_STAFFING_WORKFLOW_VERSION,
} from "../volunteer";

describe("volunteer staffing workflow helpers", () => {
  it("builds workflow context with a stable workflow key and correlation key", () => {
    const context = buildVolunteerStaffingGoalContext({
      serviceRunId: "service-run-1",
      templateId: "template-1",
      serviceAt: "2026-04-07T10:00:00.000Z",
      triggerSource: "service_page",
      triggerChannel: "in_app",
      requestedByUserId: "user-1",
      objectiveText: "Fill Sunday roles",
      waitHours: 6,
    });

    expect(context).toMatchObject({
      workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
      workflowVersion: VOLUNTEER_STAFFING_WORKFLOW_VERSION,
      correlationKey: "service-run-1",
      triggerSource: "service_page",
      triggerChannel: "in_app",
      serviceRunId: "service-run-1",
      templateId: "template-1",
      requestedByUserId: "user-1",
      objectiveText: "Fill Sunday roles",
      waitHours: 6,
    });
  });

  it("derives reply progress from unresolved seat counts", () => {
    const waiting = deriveVolunteerStaffingReplyProgress({
      assignmentStatus: "declined",
      unresolvedRequiredSeats: 2,
    });

    const completed = deriveVolunteerStaffingReplyProgress({
      assignmentStatus: "confirmed",
      unresolvedRequiredSeats: 0,
    });

    expect(waiting).toMatchObject({
      workflowStatus: "waiting",
      stepStatus: "waiting",
      unresolvedRequiredSeats: 2,
      replyState: "still_waiting",
      lastReplyState: "declined",
    });
    expect(completed).toMatchObject({
      workflowStatus: "completed",
      stepStatus: "completed",
      unresolvedRequiredSeats: 0,
      replyState: "fully_staffed",
      lastReplyState: "confirmed",
    });
  });

  it("keeps result payloads keyed to the volunteer staffing workflow", () => {
    const result = buildVolunteerStaffingGoalResult({
      serviceRunId: "service-run-1",
      status: "waiting",
      summary: {
        sent: 4,
      },
      openRequiredSeats: 1,
      openRoles: ["Greeter"],
      lastReply: {
        assignmentId: "assignment-1",
        assignmentStatus: "confirmed",
      },
    });

    expect(result).toMatchObject({
      workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
      workflowVersion: VOLUNTEER_STAFFING_WORKFLOW_VERSION,
      serviceRunId: "service-run-1",
      status: "waiting",
      openRequiredSeats: 1,
      openRoles: ["Greeter"],
    });
  });

  it("uses the canonical volunteer staffing step order", () => {
    expect(buildVolunteerStaffingStepTemplates().map((step) => step.stepKey)).toEqual([
      "ensure_assignments",
      "seed_assignments",
      "send_offers",
      "wait_responses",
      "escalate_gaps",
    ]);
  });
});
