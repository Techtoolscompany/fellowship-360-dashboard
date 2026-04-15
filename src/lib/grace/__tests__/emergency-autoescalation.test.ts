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

const executorMock = vi.hoisted(() => ({
  executePlannedActions: vi.fn(),
}));

vi.mock("../router/executor", () => executorMock);

vi.mock("../contacts/matcher", () => ({
  matchContactForGraceSession: vi.fn().mockResolvedValue({
    contactId: null,
    confidenceTier: "low",
  }),
}));

import { generateObject } from "ai";
import { runClawRouter } from "../router/index";
import { executePlannedActions } from "../router/executor";
import type { GraceRouterInput } from "../types";

const baseInput: GraceRouterInput = {
  message: "I might hurt myself and this is an emergency.",
  state: {},
  context: {
    organizationId: "org_1",
    sessionId: "sess_1",
    channel: "web_public",
    actorType: "public",
    policy: {
      approvalsEnabled: true,
      highRiskTools: [],
      allowedPublicTools: ["churchInfo.search"],
      autoEscalateOnEmergency: true,
    },
  },
};

describe("runClawRouter deterministic emergency escalation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = "test-key";
    executorMock.executePlannedActions.mockResolvedValue({
      results: [{ success: true, output: { transferred: true, handoffId: "handoff_1" } }],
      queuedApprovals: [],
      actionOutcomes: [
        {
          actionId: "action_1",
          tool: "handoff.transfer",
          reason: "Deterministic emergency policy triggered escalation",
          requiresApproval: false,
          status: "executed",
          occurredAt: "2026-03-17T00:00:00.000Z",
          output: { transferred: true, handoffId: "handoff_1" },
        },
      ],
    });
  });

  it("auto-escalates emergency content without model planning", async () => {
    const result = await runClawRouter(baseInput);

    expect(result.intent).toBe("emergency");
    expect(result.response).toContain("call 911");
    expect(result.state.urgency).toBe("critical");
    expect(result.proposedActions[0]?.tool).toBe("handoff.transfer");
    expect(generateObject).not.toHaveBeenCalled();
    expect(executePlannedActions).toHaveBeenCalledWith(
      expect.objectContaining({
        skipApprovals: true,
      })
    );
  });

  it("uses normal model routing when emergency auto-escalation is disabled", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        intent: "info_request",
        response: "Let's connect you with support options.",
        proposedTools: [],
        stateUpdates: {},
      },
    } as never);

    const result = await runClawRouter({
      ...baseInput,
      context: {
        ...baseInput.context,
        policy: {
          ...baseInput.context.policy!,
          autoEscalateOnEmergency: false,
          allowedPublicTools: [
            "churchInfo.search",
            "prayerRequests.create",
            "handoff.transfer",
          ],
        },
      },
    });

    expect(generateObject).toHaveBeenCalledTimes(1);
    expect(result.intent).toBe("info_request");
  });
});
