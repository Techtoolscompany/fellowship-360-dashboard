import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { INNGEST_EVENTS } from "@/lib/inngest/events";

const automationActions = vi.hoisted(() => ({
  triggerAutomationWorkflowsForEvent: vi.fn(),
}));

vi.mock("@/app/actions/automations", () => automationActions);

import {
  dispatchAutomationsOnContactCreated,
  dispatchAutomationsOnFirstTimeGuestRequested,
  dispatchAutomationsOnMissedCall,
  dispatchAutomationsOnPrayerFollowup,
} from "../automation-event-dispatcher";

type DispatchFunction = {
  fn: (ctx: {
    event: { data: Record<string, unknown> };
    step: { run: (name: string, cb: () => Promise<unknown>) => Promise<unknown> };
    logger: { info: (...args: unknown[]) => void };
  }) => Promise<unknown>;
};

const ORIGINAL_AUTOMATION_SYSTEM_TOKEN = process.env.AUTOMATION_SYSTEM_TOKEN;
const ORIGINAL_INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY;
const ORIGINAL_INNGEST_SIGNING_KEY = process.env.INNGEST_SIGNING_KEY;

async function runDispatch(
  workflowFn: DispatchFunction,
  eventData: Record<string, unknown>
) {
  const step = {
    run: vi.fn(async (_name: string, cb: () => Promise<unknown>) => cb()),
  };
  const logger = { info: vi.fn() };

  const result = await workflowFn.fn({
    event: { data: eventData },
    step,
    logger,
  });

  return { result, step, logger };
}

describe("automation event dispatcher functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AUTOMATION_SYSTEM_TOKEN;
    delete process.env.INNGEST_EVENT_KEY;
    delete process.env.INNGEST_SIGNING_KEY;
    automationActions.triggerAutomationWorkflowsForEvent.mockResolvedValue({
      dispatched: 1,
      results: [],
    });
  });

  afterAll(() => {
    if (ORIGINAL_AUTOMATION_SYSTEM_TOKEN === undefined) {
      delete process.env.AUTOMATION_SYSTEM_TOKEN;
    } else {
      process.env.AUTOMATION_SYSTEM_TOKEN = ORIGINAL_AUTOMATION_SYSTEM_TOKEN;
    }

    if (ORIGINAL_INNGEST_EVENT_KEY === undefined) {
      delete process.env.INNGEST_EVENT_KEY;
    } else {
      process.env.INNGEST_EVENT_KEY = ORIGINAL_INNGEST_EVENT_KEY;
    }

    if (ORIGINAL_INNGEST_SIGNING_KEY === undefined) {
      delete process.env.INNGEST_SIGNING_KEY;
    } else {
      process.env.INNGEST_SIGNING_KEY = ORIGINAL_INNGEST_SIGNING_KEY;
    }
  });

  it("dispatches contact-created automations with automation system token", async () => {
    process.env.AUTOMATION_SYSTEM_TOKEN = "automation-token";
    process.env.INNGEST_EVENT_KEY = "event-key";

    const { result, step, logger } = await runDispatch(
      dispatchAutomationsOnContactCreated as unknown as DispatchFunction,
      {
        organizationId: "org_1",
        contactId: "contact_1",
        idempotencyKey: "idem_contact_1",
      }
    );

    expect(result).toEqual({ dispatched: 1, results: [] });
    expect(step.run).toHaveBeenCalledWith("dispatch-automations", expect.any(Function));
    expect(automationActions.triggerAutomationWorkflowsForEvent).toHaveBeenCalledWith({
      organizationId: "org_1",
      triggerEvent: INNGEST_EVENTS.CONTACT_CREATED,
      contactId: "contact_1",
      metadata: {
        eventIdempotencyKey: "idem_contact_1",
      },
      systemToken: "automation-token",
    });
    expect(logger.info).toHaveBeenCalledWith("Automation dispatch complete", {
      event: INNGEST_EVENTS.CONTACT_CREATED,
      organizationId: "org_1",
      dispatched: 1,
    });
  });

  it("falls back to INNGEST_EVENT_KEY for first-time guest dispatch", async () => {
    process.env.INNGEST_EVENT_KEY = "event-token";

    await runDispatch(
      dispatchAutomationsOnFirstTimeGuestRequested as unknown as DispatchFunction,
      {
        organizationId: "org_2",
        contactId: "contact_2",
        pipelineItemId: "pipe_1",
        stageId: "stage_qual",
        stageName: "Qualified",
        trigger: "created",
        occurredAt: "2026-03-12T12:00:00.000Z",
        idempotencyKey: "idem_first_time",
      }
    );

    expect(automationActions.triggerAutomationWorkflowsForEvent).toHaveBeenCalledWith({
      organizationId: "org_2",
      triggerEvent: INNGEST_EVENTS.GRACE_FIRST_TIME_GUEST_APPOINTMENT_REQUESTED,
      contactId: "contact_2",
      metadata: {
        pipelineItemId: "pipe_1",
        stageId: "stage_qual",
        stageName: "Qualified",
        trigger: "created",
        occurredAt: "2026-03-12T12:00:00.000Z",
        eventIdempotencyKey: "idem_first_time",
      },
      systemToken: "event-token",
    });
  });

  it("falls back to INNGEST_SIGNING_KEY for missed-call dispatch", async () => {
    process.env.INNGEST_SIGNING_KEY = "signing-token";

    await runDispatch(dispatchAutomationsOnMissedCall as unknown as DispatchFunction, {
      organizationId: "org_3",
      sessionId: "session_1",
      callId: "call_1",
      fromNumber: "+15555550101",
      toNumber: "+15555550999",
      startedAt: "2026-03-12T13:00:00.000Z",
      endedAt: "2026-03-12T13:03:00.000Z",
      idempotencyKey: "idem_missed_call",
    });

    const call =
      automationActions.triggerAutomationWorkflowsForEvent.mock.calls[0]?.[0] ?? null;
    expect(call).not.toBeNull();
    expect(call.organizationId).toBe("org_3");
    expect(call.triggerEvent).toBe(INNGEST_EVENTS.GRACE_MISSED_CALL_RECOVERY_REQUESTED);
    expect(call.contactId).toBeUndefined();
    expect(call.systemToken).toBe("signing-token");
    expect(call.metadata).toEqual({
      sessionId: "session_1",
      callId: "call_1",
      fromNumber: "+15555550101",
      toNumber: "+15555550999",
      startedAt: "2026-03-12T13:00:00.000Z",
      endedAt: "2026-03-12T13:03:00.000Z",
      eventIdempotencyKey: "idem_missed_call",
    });
  });

  it("passes an empty token when no system token source exists", async () => {
    await runDispatch(dispatchAutomationsOnPrayerFollowup as unknown as DispatchFunction, {
      organizationId: "org_4",
      requestId: "prayer_1",
      trigger: "updated",
      status: "praying",
      urgency: "urgent",
      occurredAt: "2026-03-12T14:00:00.000Z",
      idempotencyKey: "idem_prayer_1",
    });

    expect(automationActions.triggerAutomationWorkflowsForEvent).toHaveBeenCalledWith({
      organizationId: "org_4",
      triggerEvent: INNGEST_EVENTS.GRACE_PRAYER_REQUEST_FOLLOWUP_REQUESTED,
      contactId: undefined,
      metadata: {
        requestId: "prayer_1",
        trigger: "updated",
        status: "praying",
        urgency: "urgent",
        occurredAt: "2026-03-12T14:00:00.000Z",
        eventIdempotencyKey: "idem_prayer_1",
      },
      systemToken: "",
    });
  });

  it("bubbles dispatch failures so retry policy can handle them", async () => {
    automationActions.triggerAutomationWorkflowsForEvent.mockRejectedValueOnce(
      new Error("dispatch_failed")
    );

    await expect(
      runDispatch(dispatchAutomationsOnContactCreated as unknown as DispatchFunction, {
        organizationId: "org_retry",
        contactId: "contact_retry",
        idempotencyKey: "idem_retry",
      })
    ).rejects.toThrow("dispatch_failed");
  });
});
