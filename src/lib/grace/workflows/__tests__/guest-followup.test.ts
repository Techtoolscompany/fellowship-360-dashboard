import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const select = vi.fn();
  const update = vi.fn();
  const insert = vi.fn();

  return {
    select,
    update,
    insert,
  };
});

vi.mock("@/db", () => ({
  db: {
    select: mocks.select,
    update: mocks.update,
    insert: mocks.insert,
  },
}));

import {
  buildGuestFollowupCorrelationKey,
  createOrReuseGuestFollowupGoal,
} from "../guest-followup";

function mockGoalSelectChain(result: unknown) {
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

function mockStepSelectChain(result: unknown) {
  return {
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue(result),
    })),
  };
}

describe("guest follow-up workflow helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a stable correlation key per pipeline item", () => {
    expect(
      buildGuestFollowupCorrelationKey({
        organizationId: "org_1",
        pipelineItemId: "pipeline_1",
      })
    ).toBe("guest_followup:org_1:pipeline_1");
  });

  it("reuses an active workflow run instead of creating a duplicate", async () => {
    const reusableGoal = {
      id: "goal_1",
      organizationId: "org_1",
      goalType: "communications_followup",
      status: "in_progress",
      sourceChannel: "in_app",
      objectiveText: "Existing guest follow-up",
      requestedByUserId: "user_1",
      contextJson: {
        workflowKey: "guest_followup",
        correlationKey: "guest_followup:org_1:pipeline_1",
      },
    };
    const existingSteps = [
      "resolve_context",
      "send_initial_invite",
      "wait_after_initial_invite",
      "send_reminder",
      "wait_after_reminder",
      "manual_outreach",
      "complete",
    ].map((stepKey) => ({ stepKey }));

    const updatedGoal = {
      ...reusableGoal,
      objectiveText: "Refreshed guest follow-up",
    };

    mocks.select
      .mockReturnValueOnce(mockGoalSelectChain([reusableGoal]))
      .mockReturnValueOnce(mockStepSelectChain(existingSteps));

    const updateReturning = vi.fn().mockResolvedValueOnce([updatedGoal]);
    const updateWhere = vi.fn(() => ({ returning: updateReturning }));
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    mocks.update.mockReturnValueOnce({ set: updateSet });

    const result = await createOrReuseGuestFollowupGoal({
      organizationId: "org_1",
      sourceChannel: "in_app",
      requestedByUserId: "user_2",
      objectiveText: "Refreshed guest follow-up",
      context: {
        pipelineItemId: "pipeline_1",
        contactId: "contact_1",
        stageId: "stage_1",
        stageName: "New Guest",
        contactName: "Jane Doe",
        firstName: "Jane",
        recipientPhone: "+15555550123",
        recipientEmail: null,
        channel: "sms",
        churchName: "Fellowship 360",
        sessionId: "session_1",
        conversationId: "conversation_1",
        sequenceStartedAtIso: "2026-03-12T12:00:00.000Z",
        trigger: "stage_changed",
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        created: false,
        reused: true,
        correlationKey: "guest_followup:org_1:pipeline_1",
        goal: expect.objectContaining({
          id: "goal_1",
          objectiveText: "Refreshed guest follow-up",
        }),
      })
    );
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        objectiveText: "Refreshed guest follow-up",
        sourceChannel: "in_app",
      })
    );
  });

  it("creates a new workflow run and seeds guest workflow steps", async () => {
    mocks.select
      .mockReturnValueOnce(mockGoalSelectChain([]))
      .mockReturnValueOnce(mockStepSelectChain([]));

    const goalReturning = vi.fn().mockResolvedValueOnce([
      {
        id: "goal_2",
        organizationId: "org_2",
        goalType: "communications_followup",
        status: "queued",
        sourceChannel: "sms",
        objectiveText: "New guest follow-up",
        requestedByUserId: null,
        contextJson: {
          workflowKey: "guest_followup",
          correlationKey: "guest_followup:org_2:pipeline_2",
        },
      },
    ]);
    const goalValues = vi.fn(() => ({ returning: goalReturning }));
    const stepValues = vi.fn();

    mocks.insert
      .mockImplementationOnce(() => ({ values: goalValues }))
      .mockImplementationOnce(() => ({ values: stepValues }));

    const result = await createOrReuseGuestFollowupGoal({
      organizationId: "org_2",
      sourceChannel: "sms",
      objectiveText: "New guest follow-up",
      context: {
        pipelineItemId: "pipeline_2",
        contactId: "contact_2",
        stageId: "stage_2",
        stageName: "New Guest",
        contactName: "Guest Person",
        firstName: "Guest",
        recipientPhone: "+15555550999",
        recipientEmail: null,
        channel: "sms",
        churchName: "Fellowship 360",
        sessionId: "session_2",
        conversationId: "conversation_2",
        sequenceStartedAtIso: "2026-03-12T12:00:00.000Z",
        trigger: "created",
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        created: true,
        reused: false,
        correlationKey: "guest_followup:org_2:pipeline_2",
      })
    );
    expect(goalValues).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_2",
        goalType: "communications_followup",
        status: "queued",
      })
    );
    expect(stepValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          goalId: "goal_2",
          stepKey: "resolve_context",
        }),
        expect.objectContaining({
          goalId: "goal_2",
          stepKey: "complete",
        }),
      ])
    );
  });
});
