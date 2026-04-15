import { beforeEach, describe, expect, it, vi } from "vitest";

const auditMocks = vi.hoisted(() => ({
  writeGraceAuditStreamSafe: vi.fn(),
}));

const dbMocks = vi.hoisted(() => {
  const select = vi.fn();
  const update = vi.fn();
  const insert = vi.fn();
  return { select, update, insert };
});

vi.mock("@/db", () => ({
  db: {
    select: dbMocks.select,
    update: dbMocks.update,
    insert: dbMocks.insert,
  },
}));

vi.mock("@/lib/grace/audit-stream", () => auditMocks);

import {
  buildPrayerCareCorrelationKey,
  ensurePrayerCareWorkflowGoal,
  updatePrayerCareWorkflowGoal,
} from "../prayer-care";

function makeActiveGoalsQuery(result: unknown) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(result),
        })),
      })),
    })),
  };
}

function makeStepKeysQuery(result: unknown) {
  return {
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(result),
    })),
  };
}

function makeCurrentGoalQuery(result: unknown) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(result),
      })),
    })),
  };
}

function makeGoalInsertChain(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  return {
    values: vi.fn(() => ({
      returning,
    })),
  };
}

function makeGoalUpdateChain(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  return {
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning,
      })),
    })),
  };
}

describe("prayer care workflow helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a stable correlation key from the prayer request id", () => {
    expect(buildPrayerCareCorrelationKey("req_123")).toBe(
      "prayer_care:prayer_request:req_123"
    );
  });

  it("creates a new workflow run and seeds missing step rows when no active goal exists", async () => {
    const createdGoal = {
      id: "goal_new",
      organizationId: "org_1",
      goalType: "communications_followup",
      status: "queued",
      sourceChannel: "in_app",
      objectiveText: "Prayer care workflow new for Prayer Team (normal): Please pray",
      serviceRunId: null,
      requestedByUserId: "user_1",
      contextJson: {
        workflowKey: "prayer_care",
        correlationKey: "prayer_care:prayer_request:req_1",
      },
      resultJson: null,
      errorText: null,
      startedAt: null,
      completedAt: null,
      nextRunAt: null,
      createdAt: new Date("2026-03-12T10:00:00.000Z"),
      updatedAt: new Date("2026-03-12T10:00:00.000Z"),
    };

    dbMocks.select
      .mockImplementationOnce(() => makeActiveGoalsQuery([]))
      .mockImplementationOnce(() =>
        makeStepKeysQuery([])
      );
    dbMocks.insert.mockReturnValue(makeGoalInsertChain([createdGoal]));

    const result = await ensurePrayerCareWorkflowGoal({
      organizationId: "org_1",
      requestId: "req_1",
      sourceChannel: "in_app",
      triggerSource: "prayer_request.create",
      status: "new",
      urgency: "normal",
      assignedTeam: "Prayer Team",
      content: "Please pray",
      contactId: "contact_1",
      objectiveText: "Prayer care workflow new for Prayer Team (normal): Please pray",
      requestedByUserId: "user_1",
      lastDecisionSummary: "Created and queued for Grace follow-up.",
      nextCheckpointAt: new Date("2026-03-12T10:15:00.000Z"),
    });

    expect(result.created).toBe(true);
    expect(result.goal.id).toBe("goal_new");
    expect(dbMocks.insert).toHaveBeenCalledTimes(2);
    expect(auditMocks.writeGraceAuditStreamSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        eventType: "workflow_execution",
        metadataJson: expect.objectContaining({
          goalId: "goal_new",
          workflowKey: "prayer_care",
        }),
      })
    );
  });

  it("reuses the active workflow run when the correlation key matches", async () => {
    const existingGoal = {
      id: "goal_existing",
      organizationId: "org_2",
      goalType: "communications_followup",
      status: "waiting",
      sourceChannel: "in_app",
      objectiveText: "Prayer care workflow praying for Prayer Team (urgent): Please pray",
      serviceRunId: null,
      requestedByUserId: "user_2",
      contextJson: {
        workflowKey: "prayer_care",
        correlationKey: "prayer_care:prayer_request:req_2",
      },
      resultJson: null,
      errorText: null,
      startedAt: new Date("2026-03-12T10:00:00.000Z"),
      completedAt: null,
      nextRunAt: null,
      createdAt: new Date("2026-03-12T09:00:00.000Z"),
      updatedAt: new Date("2026-03-12T09:30:00.000Z"),
    };

    dbMocks.select
      .mockImplementationOnce(() => makeActiveGoalsQuery([existingGoal]))
      .mockImplementationOnce(() =>
        makeStepKeysQuery([
          { stepKey: "kickoff_confirmation" },
          { stepKey: "context_collection" },
          { stepKey: "send_acknowledgment" },
          { stepKey: "route_escalation" },
          { stepKey: "completion" },
        ])
      );
    dbMocks.update.mockReturnValue(makeGoalUpdateChain([existingGoal]));

    const result = await ensurePrayerCareWorkflowGoal({
      organizationId: "org_2",
      requestId: "req_2",
      sourceChannel: "in_app",
      triggerSource: "prayer_request.update",
      status: "praying",
      urgency: "urgent",
      assignedTeam: "Care Team",
      content: "Please pray",
      contactId: "contact_2",
      objectiveText: "Prayer care workflow praying for Care Team (urgent): Please pray",
      requestedByUserId: "user_2",
      lastDecisionSummary: "Resumed and waiting.",
      nextCheckpointAt: new Date("2026-03-12T10:30:00.000Z"),
    });

    expect(result.created).toBe(false);
    expect(result.goal.id).toBe("goal_existing");
    expect(dbMocks.insert).not.toHaveBeenCalled();
    expect(dbMocks.update).toHaveBeenCalledTimes(1);
  });

  it("retries without requestedByUserId when the user foreign key is invalid", async () => {
    const createdGoal = {
      id: "goal_retry",
      organizationId: "org_9",
      goalType: "operations",
      status: "queued",
      sourceChannel: "in_app",
      objectiveText: "Prayer care workflow new for Prayer Team (normal): Please pray",
      serviceRunId: null,
      requestedByUserId: null,
      contextJson: {
        workflowKey: "prayer_care",
        correlationKey: "prayer_care:prayer_request:req_retry",
      },
      resultJson: null,
      errorText: null,
      startedAt: null,
      completedAt: null,
      nextRunAt: null,
      createdAt: new Date("2026-03-12T10:00:00.000Z"),
      updatedAt: new Date("2026-03-12T10:00:00.000Z"),
    };

    dbMocks.select
      .mockImplementationOnce(() => makeActiveGoalsQuery([]))
      .mockImplementationOnce(() => makeStepKeysQuery([]));

    const firstValues = vi.fn(() => ({
      returning: vi
        .fn()
        .mockRejectedValueOnce(
          new Error(
            'insert or update on table "grace_goal" violates foreign key constraint "grace_goal_requested_by_user_id_app_user_id_fk"'
          )
        ),
    }));
    const secondValues = vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([createdGoal]),
    }));

    dbMocks.insert
      .mockReturnValueOnce({ values: firstValues })
      .mockReturnValueOnce({ values: secondValues })
      .mockReturnValueOnce(makeGoalInsertChain([]));

    const result = await ensurePrayerCareWorkflowGoal({
      organizationId: "org_9",
      requestId: "req_retry",
      sourceChannel: "in_app",
      triggerSource: "prayer_request.create",
      status: "new",
      urgency: "normal",
      assignedTeam: "Prayer Team",
      content: "Please pray",
      contactId: "contact_9",
      objectiveText: "Prayer care workflow new for Prayer Team (normal): Please pray",
      requestedByUserId: "missing_user",
      lastDecisionSummary: "Created and queued for Grace follow-up.",
      nextCheckpointAt: new Date("2026-03-12T10:15:00.000Z"),
    });

    expect(result.goal.id).toBe("goal_retry");
    expect(firstValues).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedByUserId: "missing_user",
      })
    );
    expect(secondValues).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedByUserId: null,
      })
    );
  });

  it("marks the workflow run completed and preserves escalation-safe result state", async () => {
    const currentGoal = {
      id: "goal_progress",
      organizationId: "org_3",
      goalType: "communications_followup",
      status: "waiting",
      sourceChannel: "in_app",
      objectiveText: "Prayer care workflow",
      serviceRunId: null,
      requestedByUserId: "user_3",
      contextJson: {
        workflowKey: "prayer_care",
        correlationKey: "prayer_care:prayer_request:req_3",
      },
      resultJson: null,
      errorText: null,
      startedAt: new Date("2026-03-12T10:00:00.000Z"),
      completedAt: null,
      nextRunAt: new Date("2026-03-12T10:15:00.000Z"),
      createdAt: new Date("2026-03-12T09:00:00.000Z"),
      updatedAt: new Date("2026-03-12T10:00:00.000Z"),
    };
    const updatedGoal = {
      ...currentGoal,
      status: "escalated",
      resultJson: {
        prayerRequestStatus: "praying",
        urgency: "critical",
      },
      nextRunAt: null,
      completedAt: null,
      updatedAt: new Date("2026-03-12T10:30:00.000Z"),
    };

    dbMocks.select.mockReturnValue(makeCurrentGoalQuery([currentGoal]));
    dbMocks.update.mockReturnValue(makeGoalUpdateChain([updatedGoal]));

    const result = await updatePrayerCareWorkflowGoal({
      goalId: "goal_progress",
      organizationId: "org_3",
      status: "escalated",
      requestId: "req_3",
      summary: "Prayer request escalated to the care team.",
      nextCheckpointAt: null,
      resultJson: {
        prayerRequestStatus: "praying",
        urgency: "critical",
      },
    });

    expect(result?.status).toBe("escalated");
    expect(result?.resultJson).toEqual({
      prayerRequestStatus: "praying",
      urgency: "critical",
    });
    expect(auditMocks.writeGraceAuditStreamSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        metadataJson: expect.objectContaining({
          goalId: "goal_progress",
          workflowKey: "prayer_care",
        }),
      })
    );
  });
});
