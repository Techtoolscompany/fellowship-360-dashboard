import { beforeEach, describe, expect, it, vi } from "vitest";
import { INNGEST_EVENTS } from "@/lib/inngest/events";

const workflowMocks = vi.hoisted(() => ({
  ensurePrayerCareWorkflowGoal: vi.fn(),
  finishPrayerCareWorkflowStep: vi.fn(),
  startPrayerCareWorkflowStep: vi.fn(),
  updatePrayerCareWorkflowGoal: vi.fn(),
  PRAYER_CARE_STEP_KEYS: {
    kickoffConfirmation: "kickoff_confirmation",
    contextCollection: "context_collection",
    sendAcknowledgment: "send_acknowledgment",
    routeEscalation: "route_escalation",
    completion: "completion",
  },
}));

const dbMocks = vi.hoisted(() => {
  const select = vi.fn();
  const insert = vi.fn();
  const update = vi.fn();
  return { select, insert, update };
});

const mailMocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
}));

const runtimeMocks = vi.hoisted(() => ({
  getOrCreateGraceSession: vi.fn(),
}));

const smsMocks = vi.hoisted(() => ({
  sendOrganizationSms: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: dbMocks.select,
    insert: dbMocks.insert,
    update: dbMocks.update,
  },
}));

vi.mock("@/lib/email/sendMail", () => ({
  default: mailMocks.sendMail,
}));

vi.mock("@/lib/grace/runtime", () => runtimeMocks);

vi.mock("@/lib/grace/workflows/prayer-care", () => workflowMocks);

vi.mock("@/lib/sms-gateway/send", () => smsMocks);

import { prayerRequestFollowupSequence } from "../prayer-request-followup";

function makeSelectChain(result: unknown) {
  return {
    from: vi.fn(() => ({
      leftJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(result),
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue(result),
          })),
        })),
      })),
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(result),
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(result),
        })),
      })),
    })),
  };
}

function makeInsertChain(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  return {
    values: vi.fn(() => ({
      returning,
    })),
  };
}

function makeUpdateChain(result: unknown) {
  const returning = vi.fn().mockResolvedValue(result);
  return {
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning,
      })),
    })),
  };
}

describe("prayer request follow-up sequence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtimeMocks.getOrCreateGraceSession.mockResolvedValue({ id: "session_1" });
    workflowMocks.ensurePrayerCareWorkflowGoal.mockResolvedValue({
      goal: { id: "goal_1", organizationId: "org_1" },
      created: false,
    });
    workflowMocks.startPrayerCareWorkflowStep.mockResolvedValue(undefined);
    workflowMocks.finishPrayerCareWorkflowStep.mockResolvedValue(undefined);
    workflowMocks.updatePrayerCareWorkflowGoal.mockResolvedValue({
      id: "goal_1",
      organizationId: "org_1",
      status: "escalated",
    });
    mailMocks.sendMail.mockResolvedValue(undefined);
    smsMocks.sendOrganizationSms.mockResolvedValue({
      success: true,
      providerMessageId: "msg_1",
      deviceId: "device_1",
      messageIds: ["message_1"],
      queuedCount: 1,
      error: null,
    });
  });

  it("advances the prayer workflow through the canonical helper steps", async () => {
    dbMocks.select
      .mockImplementationOnce(() =>
        makeSelectChain([
          {
            requestId: "req_1",
            organizationId: "org_1",
            contactId: "contact_1",
            contactName: "Jane Doe",
            content: "Please pray for my family",
            status: "praying",
            urgency: "critical",
            assignedTeam: "Prayer Team",
            contactFirstName: "Jane",
            contactLastName: "Doe",
            contactPhone: "+15555550101",
            contactEmail: null,
          },
        ])
      )
      .mockImplementationOnce(() => makeSelectChain([{ churchName: "Fellowship 360" }]))
      .mockImplementationOnce(() => makeSelectChain([]))
      .mockImplementationOnce(() => makeSelectChain([]))
      .mockImplementationOnce(() => makeSelectChain([]))
      .mockImplementationOnce(() => makeSelectChain([]))
      .mockImplementationOnce(() => makeSelectChain([]));
    dbMocks.insert.mockReturnValue(makeInsertChain([{ id: "conv_1" }]));
    dbMocks.update.mockReturnValue(makeUpdateChain([{ id: "updated_1" }]));

    const step = {
      run: vi.fn(async (_name: string, callback: () => Promise<unknown>) => callback()),
    };
    const logger = { info: vi.fn() };

    const result = await (prayerRequestFollowupSequence as unknown as {
      fn: (input: {
        event: { data: Record<string, unknown> };
        step: { run: (name: string, callback: () => Promise<unknown>) => Promise<unknown> };
        logger: { info: (...args: unknown[]) => void };
      }) => Promise<unknown>;
    }).fn({
      event: {
        data: {
          organizationId: "org_1",
          requestId: "req_1",
          trigger: "created",
          status: "praying",
          urgency: "critical",
          occurredAt: "2026-03-12T10:00:00.000Z",
          idempotencyKey: "idem_1",
        },
      },
      step,
      logger,
    });

    expect(result).toMatchObject({
      status: "completed",
      trigger: "created",
    });
    expect(workflowMocks.ensurePrayerCareWorkflowGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req_1",
        triggerSource: "prayer_request_followup.created",
      })
    );
    expect(workflowMocks.updatePrayerCareWorkflowGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        goalId: "goal_1",
        status: "in_progress",
      })
    );
    expect(workflowMocks.updatePrayerCareWorkflowGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        goalId: "goal_1",
        status: "escalated",
      })
    );
    expect(workflowMocks.startPrayerCareWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({
        goalId: "goal_1",
        stepKey: "context_collection",
      })
    );
    expect(workflowMocks.startPrayerCareWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({
        goalId: "goal_1",
        stepKey: "send_acknowledgment",
      })
    );
    expect(workflowMocks.startPrayerCareWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({
        goalId: "goal_1",
        stepKey: "route_escalation",
      })
    );
    expect(workflowMocks.finishPrayerCareWorkflowStep).toHaveBeenCalledWith(
      expect.objectContaining({
        goalId: "goal_1",
        stepKey: "completion",
        status: "completed",
      })
    );
    expect(step.run).toHaveBeenCalledWith("send-acknowledgment", expect.any(Function));
    expect(step.run).toHaveBeenCalledWith("route-escalation", expect.any(Function));
    expect(logger.info).toHaveBeenCalledWith("Prayer request follow-up processed", {
      organizationId: "org_1",
      requestId: "req_1",
      trigger: "created",
      acknowledgment: expect.any(Object),
      escalation: expect.any(Object),
    });
    expect(mailMocks.sendMail).not.toHaveBeenCalled();
    expect(smsMocks.sendOrganizationSms).toHaveBeenCalledTimes(1);
  });
});
