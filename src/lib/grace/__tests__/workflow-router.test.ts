import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => "mock-model")),
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

const queryMock: any = {
  then: vi.fn((cb: (rows: never[]) => unknown) => cb([])),
};
queryMock.from = vi.fn(() => queryMock);
queryMock.where = vi.fn(() => queryMock);
queryMock.orderBy = vi.fn(() => queryMock);
queryMock.limit = vi.fn(() => queryMock);

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => queryMock),
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
  },
}));

const executorMocks = vi.hoisted(() => ({
  executePlannedActions: vi.fn().mockResolvedValue({
    results: [],
    queuedApprovals: [],
    actionOutcomes: [],
  }),
}));

vi.mock("../router/executor", () => executorMocks);

vi.mock("../contacts/matcher", () => ({
  matchContactForGraceSession: vi.fn().mockResolvedValue({
    contactId: null,
    confidenceTier: "low",
  }),
}));

const workflowRuntimeMocks = vi.hoisted(() => ({
  startGraceWorkflowFromDecision: vi.fn(),
}));

vi.mock("../workflows/runtime", () => workflowRuntimeMocks);

import { generateObject } from "ai";
import { runClawRouter } from "../router/index";
import type { GraceRouterInput } from "../types";

const baseInput: GraceRouterInput = {
  message: "Grace, fill Sunday's open roles.",
  state: {},
  context: {
    organizationId: "org_1",
    sessionId: "sess_1",
    channel: "in_app",
    actorType: "staff",
    userId: "user_1",
  },
};

describe("runClawRouter workflow confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
    workflowRuntimeMocks.startGraceWorkflowFromDecision.mockResolvedValue({
      status: "started",
      workflowKey: "volunteer_staffing",
      goalIds: ["goal_1"],
      createdCount: 1,
      reusedCount: 0,
      failedCount: 0,
      summary: "Grace is staffing that service run now.",
    });
  });

  it("stores a pending confirmation when Gemini chooses a staff workflow", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        intent: "follow_up_request",
        response: "I can run volunteer staffing for the 10am service.",
        workflowDecision: {
          decisionType: "start_workflow",
          workflowKey: "volunteer_staffing",
          workflowVersion: 1,
          workflowInput: {
            serviceRunId: "run_1",
          },
          missingInputs: [],
          kickoffSummary: "I’ll text open volunteers, watch replies, and escalate any remaining gaps.",
          nextBestAction: "Confirm the staffing run.",
          approvalMode: "confirm_once",
          confidence: 0.92,
        },
        proposedTools: [],
        stateUpdates: {},
      },
    } as never);

    const result = await runClawRouter(baseInput);

    expect(result.workflowStart).toMatchObject({
      status: "pending_confirmation",
      workflowKey: "volunteer_staffing",
    });
    expect(result.proposedActions).toEqual([]);
    expect(result.state.pendingWorkflowConfirmation).toMatchObject({
      workflowKey: "volunteer_staffing",
      workflowInput: {
        serviceRunId: "run_1",
      },
    });
  });

  it("starts the pending workflow when staff confirms", async () => {
    const result = await runClawRouter({
      ...baseInput,
      message: "yes",
      state: {
        pendingWorkflowConfirmation: {
          decisionType: "start_workflow",
          workflowKey: "volunteer_staffing",
          workflowVersion: 1,
          workflowInput: {
            serviceRunId: "run_1",
          },
          kickoffSummary: "I’ll text open volunteers, watch replies, and escalate any remaining gaps.",
          approvalMode: "confirm_once",
          requestedAt: "2026-04-07T12:00:00.000Z",
          sourceMessage: "Grace, fill Sunday's open roles.",
        },
      },
    });

    expect(generateObject).not.toHaveBeenCalled();
    expect(workflowRuntimeMocks.startGraceWorkflowFromDecision).toHaveBeenCalledWith({
      context: baseInput.context,
      decision: expect.objectContaining({
        workflowKey: "volunteer_staffing",
        workflowInput: {
          serviceRunId: "run_1",
        },
      }),
    });
    expect(result.workflowStart).toMatchObject({
      status: "started",
      workflowKey: "volunteer_staffing",
      goalIds: ["goal_1"],
    });
    expect(result.state.pendingWorkflowConfirmation).toBeUndefined();
  });
});

describe("runClawRouter agentic loop hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
    executorMocks.executePlannedActions.mockResolvedValue({
      results: [],
      queuedApprovals: [],
      actionOutcomes: [],
    });
  });

  it("chains tools across iterations and accumulates state updates", async () => {
    executorMocks.executePlannedActions.mockResolvedValueOnce({
      results: [{ success: true, output: { contactId: "contact_1", phone: "+15555550101" } }],
      queuedApprovals: [],
      actionOutcomes: [
        {
          actionId: "action_1",
          tool: "contacts.search",
          reason: "Find Maria's contact record.",
          requiresApproval: false,
          status: "executed",
          occurredAt: "2026-04-13T10:00:00.000Z",
          output: { contactId: "contact_1", phone: "+15555550101" },
        },
      ],
    });

    vi.mocked(generateObject)
      .mockResolvedValueOnce({
        object: {
          reasoning: "I need to find the right Maria before I respond.",
          continueThinking: true,
          intent: "follow_up_request",
          response: "",
          proposedTools: [
            {
              tool: "contacts.search",
              input: { query: "Maria" },
              reason: "Find Maria's contact record.",
              requiresApproval: false,
            },
          ],
          stateUpdates: {
            name: "Maria Chen",
          },
        },
      } as never)
      .mockResolvedValueOnce({
        object: {
          reasoning: "I found the contact and can summarize the next step safely.",
          continueThinking: false,
          intent: "follow_up_request",
          response: "I found Maria Chen and have the right contact details for follow-up.",
          proposedTools: [],
          stateUpdates: {
            phone: "+15555550101",
          },
        },
      } as never);

    const result = await runClawRouter({
      ...baseInput,
      message: "Follow up with Maria",
    });

    expect(executorMocks.executePlannedActions).toHaveBeenCalledTimes(1);
    expect(result.state).toMatchObject({
      name: "Maria Chen",
      phone: "+15555550101",
    });
    expect(result.iterationCount).toBe(2);
    expect(result.reasoningSteps).toHaveLength(2);
    expect(result.response).toBe(
      "I found Maria Chen and have the right contact details for follow-up."
    );

    const secondCall = vi.mocked(generateObject).mock.calls[1]?.[0] as { prompt?: string };
    expect(secondCall.prompt).toContain("Tool Results from Previous Steps");
    expect(secondCall.prompt).toContain("contacts.search");
    expect(secondCall.prompt).toContain("SUCCESS");
  });

  it("stops deterministically when the model asks to continue without useful progress", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        reasoning: "I should keep thinking, but I do not have a concrete next action yet.",
        continueThinking: true,
        intent: "follow_up_request",
        response: "",
        proposedTools: [],
      },
    } as never);

    const result = await runClawRouter({
      ...baseInput,
      message: "Check on Maria",
    });

    expect(executorMocks.executePlannedActions).not.toHaveBeenCalled();
    expect(result.iterationCount).toBe(1);
    expect(result.response).toContain("I stopped before guessing");
  });
});
