import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => "mock-model")),
}));

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

const dbMocks = vi.hoisted(() => {
  const insertOperations: Array<{ table: unknown; values: ReturnType<typeof vi.fn> }> = [];
  const select = vi.fn();
  const insert = vi.fn((table: unknown) => {
    const values = vi.fn().mockResolvedValue(undefined);
    insertOperations.push({ table, values });
    return { values };
  });
  return { select, insert, insertOperations };
});

const runtimeMocks = vi.hoisted(() => ({
  getOrCreateGraceSession: vi.fn(),
  loadOrgPolicy: vi.fn(),
}));

const resolverMocks = vi.hoisted(() => ({
  resolveGeminiApiKey: vi.fn(),
}));

const executorMocks = vi.hoisted(() => ({
  executePlannedActions: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: dbMocks.select,
    insert: dbMocks.insert,
  },
}));

vi.mock("@/lib/grace/runtime", () => runtimeMocks);
vi.mock("@/lib/grace/providers/resolver", () => resolverMocks);
vi.mock("@/lib/grace/router/executor", () => executorMocks);

import { generateObject } from "ai";
import { graceAuditStream } from "@/db/schema/grace-audit-stream";
import { graceFollowupProposals } from "@/db/schema/grace-followup-proposals";
import { graceMemory } from "@/db/schema/grace-memory";
import { graceProactiveThinker } from "../grace-proactive-thinker";

function makeSelectChain(result: unknown) {
  const chain: any = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain;
}

function primeSelectResults(results: unknown[]) {
  let index = 0;
  dbMocks.select.mockImplementation(() => {
    const next = index < results.length ? results[index] : [];
    index += 1;
    return makeSelectChain(next);
  });
}

function getInsertPayload(table: unknown) {
  const op = dbMocks.insertOperations.find((entry) => entry.table === table);
  return op?.values.mock.calls[0]?.[0];
}

function makeStep() {
  return {
    run: vi.fn(async (_name: string, callback: () => Promise<unknown>) => callback()),
  };
}

const baseObservation = {
  category: "engagement_concern" as const,
  summary: "Maria Chen has not attended in 60 days.",
  urgency: "medium" as const,
  tier: "suggest" as const,
  suggestedMessage: "Maria Chen has not attended in 60 days. Should I send a check-in?",
  proposedTools: [
    {
      tool: "messages.sendSMS",
      input: {
        to: "+15555550101",
        message: "Hi Maria, just checking in and praying for you.",
      },
      reason: "Send a one-to-one re-engagement text.",
    },
  ],
};

const basePolicy = {
  approvalsEnabled: true,
  highRiskTools: [],
  allowedPublicTools: [],
  autoEscalateOnEmergency: true,
};

describe("graceProactiveThinker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.insertOperations.length = 0;
    runtimeMocks.getOrCreateGraceSession.mockResolvedValue({ id: "sess_proactive" });
    runtimeMocks.loadOrgPolicy.mockResolvedValue(basePolicy);
    resolverMocks.resolveGeminiApiKey.mockResolvedValue("gemini-key");
    executorMocks.executePlannedActions.mockResolvedValue({
      results: [],
      queuedApprovals: [],
      actionOutcomes: [],
    });
  });

  it("skips organizations with proactive mode off", async () => {
    primeSelectResults([
      [{ id: "org_1", name: "Grace Church" }],
      [{ customSystemPrompt: null, proactiveMode: "off" }],
    ]);

    const result = await (graceProactiveThinker as unknown as {
      fn: (input: {
        step: { run: (name: string, callback: () => Promise<unknown>) => Promise<unknown> };
        logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
      }) => Promise<{ results: Array<Record<string, unknown>> }>;
    }).fn({
      step: makeStep(),
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(result.results[0]).toMatchObject({
      orgId: "org_1",
      skipped: true,
      reason: "proactive_mode_off",
    });
    expect(generateObject).not.toHaveBeenCalled();
    expect(runtimeMocks.getOrCreateGraceSession).not.toHaveBeenCalled();
    expect(resolverMocks.resolveGeminiApiKey).not.toHaveBeenCalled();
  });

  it("suppresses suggest-tier output while in quiet mode", async () => {
    primeSelectResults([
      [{ id: "org_1", name: "Grace Church" }],
      [{ customSystemPrompt: null, proactiveMode: "quiet" }],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
    ]);
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        reasoning: "Maria Chen is inactive, but quiet mode should avoid creating suggestions.",
        observations: [baseObservation],
      },
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    } as never);

    const result = await (graceProactiveThinker as unknown as {
      fn: (input: {
        step: { run: (name: string, callback: () => Promise<unknown>) => Promise<unknown> };
        logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
      }) => Promise<{ results: Array<Record<string, unknown>> }>;
    }).fn({
      step: makeStep(),
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(result.results[0]).toMatchObject({
      orgId: "org_1",
      observationCount: 1,
      actionsExecuted: 0,
      suggestionsMade: 0,
    });
    expect(getInsertPayload(graceFollowupProposals)).toBeUndefined();
    expect(getInsertPayload(graceMemory)).toBeUndefined();
    expect(getInsertPayload(graceAuditStream)).toBeTruthy();
  });

  it("creates proactive suggestions with a real Grace session id", async () => {
    primeSelectResults([
      [{ id: "org_1", name: "Grace Church" }],
      [{ customSystemPrompt: null, proactiveMode: "normal" }],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
    ]);
    runtimeMocks.getOrCreateGraceSession.mockResolvedValue({ id: "sess_real" });
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        reasoning: "Maria Chen is inactive and should be surfaced as a suggestion.",
        observations: [baseObservation],
      },
      usage: { inputTokens: 120, outputTokens: 60, totalTokens: 180 },
    } as never);

    await (graceProactiveThinker as unknown as {
      fn: (input: {
        step: { run: (name: string, callback: () => Promise<unknown>) => Promise<unknown> };
        logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
      }) => Promise<unknown>;
    }).fn({
      step: makeStep(),
      logger: { info: vi.fn(), error: vi.fn() },
    });

    const proposalPayload = getInsertPayload(graceFollowupProposals) as Record<string, unknown>;
    expect(proposalPayload).toMatchObject({
      organizationId: "org_1",
      sessionId: "sess_real",
      actorType: "system",
      channel: "in_app",
      status: "pending",
      reason: "Maria Chen has not attended in 60 days.",
    });
    expect(proposalPayload.metadataJson).toMatchObject({
      source: "proactive_thinker",
      tier: "suggest",
    });
    expect((proposalPayload.metadataJson as Record<string, unknown>).fingerprint).toEqual(
      expect.any(String)
    );
    expect(runtimeMocks.getOrCreateGraceSession).toHaveBeenCalledWith({
      organizationId: "org_1",
      channel: "in_app",
      actorType: "system",
    });
  });

  it("deduplicates observations that already exist in recent proactive history", async () => {
    const existingFingerprint =
      "org_1::engagement_concern::suggest::to:+15555550101::messages sendsms";

    primeSelectResults([
      [{ id: "org_1", name: "Grace Church" }],
      [{ customSystemPrompt: null, proactiveMode: "normal" }],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [{ metadataJson: { fingerprint: existingFingerprint } }],
      [],
      [],
    ]);
    vi.mocked(generateObject).mockResolvedValueOnce({
      object: {
        reasoning: "Maria Chen still looks inactive, but this observation already exists.",
        observations: [baseObservation],
      },
      usage: { inputTokens: 90, outputTokens: 40, totalTokens: 130 },
    } as never);

    const result = await (graceProactiveThinker as unknown as {
      fn: (input: {
        step: { run: (name: string, callback: () => Promise<unknown>) => Promise<unknown> };
        logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };
      }) => Promise<{ results: Array<Record<string, unknown>> }>;
    }).fn({
      step: makeStep(),
      logger: { info: vi.fn(), error: vi.fn() },
    });

    expect(result.results[0]).toMatchObject({
      orgId: "org_1",
      observationCount: 1,
      actionsExecuted: 0,
      suggestionsMade: 0,
    });
    expect(getInsertPayload(graceFollowupProposals)).toBeUndefined();
  });
});
