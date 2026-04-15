import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => "mock-gemini-model")),
}));

const aiMocks = vi.hoisted(() => ({
  generateObject: vi.fn(),
  generateText: vi.fn(),
  stepCountIs: vi.fn((count: number) => ({ type: "step-count", count })),
  tool: vi.fn((definition: unknown) => definition),
}));

vi.mock("ai", () => aiMocks);

vi.mock("../providers/anthropic", () => ({
  DEFAULT_GRACE_CLAUDE_MODEL: "claude-test-model",
  createGraceAnthropicModel: vi.fn(() => "mock-claude-model"),
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
  executePlannedActions: vi.fn(),
}));

vi.mock("../router/executor", () => executorMocks);

vi.mock("../contacts/matcher", () => ({
  matchContactForGraceSession: vi.fn().mockResolvedValue({
    contactId: null,
    confidenceTier: "low",
  }),
}));

import { generateObject, generateText } from "ai";
import { runClawRouter } from "../router/index";
import type { GraceRouterInput } from "../types";

const baseInput: GraceRouterInput = {
  message: "Find Maria before I call her back.",
  state: {},
  context: {
    organizationId: "org_1",
    sessionId: "sess_1",
    channel: "in_app",
    actorType: "staff",
    userId: "user_1",
  },
};

describe("runClawRouter with Claude native tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GRACE_ROUTER_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    delete process.env.GEMINI_API_KEY;

    executorMocks.executePlannedActions.mockResolvedValue({
      results: [
        {
          success: true,
          output: {
            contacts: [
              {
                id: "contact_1",
                firstName: "Maria",
                lastName: "Chen",
                phone: "+15555550101",
              },
            ],
            count: 1,
          },
        },
      ],
      queuedApprovals: [],
      actionOutcomes: [
        {
          actionId: "action_1",
          tool: "contacts.search",
          reason: "Claude tool call: contacts.search",
          requiresApproval: false,
          status: "executed",
          occurredAt: "2026-04-15T12:00:00.000Z",
          output: {
            contacts: [
              {
                id: "contact_1",
                firstName: "Maria",
                lastName: "Chen",
                phone: "+15555550101",
              },
            ],
            count: 1,
          },
        },
      ],
    });
  });

  afterEach(() => {
    delete process.env.GRACE_ROUTER_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  it("uses Claude generateText with native tool execution instead of Gemini generateObject", async () => {
    vi.mocked(generateText).mockImplementationOnce(async (options: any) => {
      expect(options.tools.contacts_search).toBeDefined();
      await options.tools.contacts_search.execute({ query: "Maria" });

      return {
        text: JSON.stringify({
          reasoning: "Searched contacts and found the likely Maria record.",
          continueThinking: false,
          intent: "contact_request",
          response: "I found Maria Chen with the right phone number.",
          stateUpdates: {
            name: "Maria Chen",
            phone: "+15555550101",
          },
        }),
        usage: {
          inputTokens: 120,
          outputTokens: 80,
          totalTokens: 200,
        },
      } as never;
    });

    const result = await runClawRouter(baseInput);

    expect(generateObject).not.toHaveBeenCalled();
    expect(generateText).toHaveBeenCalledTimes(1);
    expect(executorMocks.executePlannedActions).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            tool: "contacts.search",
            input: { query: "Maria" },
          }),
        ],
        context: baseInput.context,
        returnToolResults: true,
      })
    );
    expect(result.intent).toBe("contact_request");
    expect(result.response).toBe("I found Maria Chen with the right phone number.");
    expect(result.proposedActions[0]?.tool).toBe("contacts.search");
    expect(result.reasoningSteps?.[0]?.toolsCalled[0]?.tool).toBe("contacts.search");
  });
});
