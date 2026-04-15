import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const send = vi.fn();
  const createOrReuseGuestFollowupGoal = vi.fn();
  const db = {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  };

  return {
    send,
    createOrReuseGuestFollowupGoal,
    db,
  };
});

vi.mock("@/db", () => ({
  db: mocks.db,
}));

vi.mock("../utils", () => ({
  auditAction: vi.fn(),
  requireOrgMembership: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: mocks.send,
  },
}));

vi.mock("@/lib/grace/workflows/guest-followup", () => ({
  createOrReuseGuestFollowupGoal: mocks.createOrReuseGuestFollowupGoal,
}));

import { INNGEST_EVENTS } from "@/lib/inngest/events";
import { enqueueFirstTimeGuestAppointment } from "../pipeline";

describe("guest follow-up pipeline trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches the first-time guest event when a workflow run is created", async () => {
    mocks.createOrReuseGuestFollowupGoal.mockResolvedValueOnce({
      goal: { id: "goal_1" },
      created: true,
      reused: false,
      correlationKey: "guest_followup:org_1:pipeline_1",
    });

    await enqueueFirstTimeGuestAppointment({
      organizationId: "org_1",
      pipelineItemId: "pipeline_1",
      contactId: "contact_1",
      stageId: "stage_1",
      stageName: "New Guest",
      trigger: "stage_changed",
      occurredAt: new Date("2026-03-12T12:00:00.000Z"),
      requestedByUserId: "user_1",
    });

    expect(mocks.createOrReuseGuestFollowupGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "org_1",
        sourceChannel: "in_app",
      })
    );
    expect(mocks.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: INNGEST_EVENTS.GRACE_FIRST_TIME_GUEST_APPOINTMENT_REQUESTED,
      })
    );
  });

  it("does not dispatch a duplicate event when an active workflow run already exists", async () => {
    mocks.createOrReuseGuestFollowupGoal.mockResolvedValueOnce({
      goal: { id: "goal_2" },
      created: false,
      reused: true,
      correlationKey: "guest_followup:org_1:pipeline_1",
    });

    await enqueueFirstTimeGuestAppointment({
      organizationId: "org_1",
      pipelineItemId: "pipeline_1",
      contactId: "contact_1",
      stageId: "stage_1",
      stageName: "New Guest",
      trigger: "stage_changed",
      occurredAt: new Date("2026-03-12T12:00:00.000Z"),
      requestedByUserId: "user_1",
    });

    expect(mocks.createOrReuseGuestFollowupGoal).toHaveBeenCalledTimes(1);
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
