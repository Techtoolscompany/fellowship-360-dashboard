import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Gemini and DB before importing the router
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => "mock-model")),
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

const queryMock: any = {
  then: vi.fn((cb: any) => cb([])),
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

vi.mock("../router/executor", () => ({
  executePlannedActions: vi.fn().mockResolvedValue([]),
}));

vi.mock("../contacts/matcher", () => ({
  matchContactForGraceSession: vi.fn().mockResolvedValue({ contactId: null, confidenceTier: "low" }),
}));

import { generateObject } from "ai";
import { runClawRouter } from "../router/index";
import type { GraceRouterInput } from "../types";

const baseInput: GraceRouterInput = {
  message: "Hello, what are your service times?",
  state: {},
  context: {
    organizationId: "org-1",
    sessionId: "sess-1",
    channel: "web_public",
    actorType: "public",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_API_KEY = "test-key";
});

describe("runClawRouter — Gemini fallback", () => {
  it("returns a graceful fallback response when Gemini throws", async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(new Error("Service unavailable"));

    const result = await runClawRouter(baseInput);

    expect(result.intent).toBe("unknown");
    expect(result.response).toContain("temporarily unavailable");
    expect(result.proposedActions).toEqual([]);
    expect(result.state).toEqual(baseInput.state);
  });

  it("returns a successful response when Gemini succeeds", async () => {
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        reasoning: "User is asking about service times. I can answer directly.",
        continueThinking: false,
        intent: "info_request",
        response: "We hold services every Sunday at 10am.",
        proposedTools: [],
        stateUpdates: {},
      },
    } as any);

    const result = await runClawRouter(baseInput);

    expect(result.intent).toBe("info_request");
    expect(result.response).toBe("We hold services every Sunday at 10am.");
    expect(result.proposedActions).toEqual([]);
  });

  it("preserves existing state on fallback", async () => {
    vi.mocked(generateObject).mockRejectedValueOnce(new Error("Timeout"));

    const inputWithState: GraceRouterInput = {
      ...baseInput,
      state: { name: "John", phone: "5551234567" },
    };

    const result = await runClawRouter(inputWithState);

    expect(result.state).toEqual({ name: "John", phone: "5551234567" });
  });
});
