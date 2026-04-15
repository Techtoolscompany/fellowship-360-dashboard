import { describe, it, expect } from "vitest";
import { evaluatePolicy } from "../policy/engine";
import type { GraceSessionContext } from "../types";

const baseCtx = (overrides: Partial<GraceSessionContext> = {}): GraceSessionContext => ({
  organizationId: "org-1",
  sessionId: "sess-1",
  channel: "in_app",
  actorType: "staff",
  ...overrides,
});

// ── Static channel rules ────────────────────────────────────────────────────

describe("evaluatePolicy — static channel rules", () => {
  it("allows staff tools on in_app channel", () => {
    const result = evaluatePolicy(baseCtx(), "contacts.upsert");
    expect(result.allowed).toBe(true);
  });

  it("blocks staff-only tools on public channel", () => {
    const result = evaluatePolicy(baseCtx({ channel: "web_public", actorType: "public" }), "contacts.upsert");
    expect(result.allowed).toBe(false);
  });

  it("allows church info search on public channel", () => {
    const result = evaluatePolicy(baseCtx({ channel: "sms_public", actorType: "public" }), "churchInfo.search");
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
  });

  it("allows contacts.upsert for staff without approval", () => {
    const result = evaluatePolicy(baseCtx(), "contacts.upsert");
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
  });

  it("allows one-to-one messages.sendSMS for staff without approval", () => {
    const result = evaluatePolicy(baseCtx(), "messages.sendSMS");
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
  });

  it("still requires approval for invariant destructive tools", () => {
    const result = evaluatePolicy(baseCtx(), "contacts.delete");
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it("allows non-high-risk staff tool without approval", () => {
    const result = evaluatePolicy(baseCtx(), "tasks.update");
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
  });

  it("allows finance.weeklyReport for staff without approval", () => {
    const result = evaluatePolicy(baseCtx(), "finance.weeklyReport");
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
  });

  it("blocks finance.weeklyReport for public channels", () => {
    const result = evaluatePolicy(
      baseCtx({ channel: "web_public", actorType: "public" }),
      "finance.weeklyReport"
    );
    expect(result.allowed).toBe(false);
  });
});

// ── Org policy overrides ────────────────────────────────────────────────────

describe("evaluatePolicy — org policy overrides (public actor)", () => {
  const publicCtxWithPolicy = (allowedPublicTools: string[], highRiskTools: string[] = [], approvalsEnabled = true) =>
    baseCtx({
      channel: "voice_public",
      actorType: "public",
      policy: { allowedPublicTools, highRiskTools, approvalsEnabled },
    });

  it("blocks tool not in org allowedPublicTools", () => {
    const result = evaluatePolicy(publicCtxWithPolicy(["churchInfo.search"]), "prayerRequests.create");
    expect(result.allowed).toBe(false);
  });

  it("allows tool in org allowedPublicTools", () => {
    const result = evaluatePolicy(publicCtxWithPolicy(["prayerRequests.create"]), "prayerRequests.create");
    expect(result.allowed).toBe(true);
  });

  it("requires approval when tool is in org highRiskTools", () => {
    const result = evaluatePolicy(publicCtxWithPolicy(["prayerRequests.create"], ["prayerRequests.create"]), "prayerRequests.create");
    expect(result.requiresApproval).toBe(true);
  });

  it("skips approval requirement when approvalsEnabled is false", () => {
    const result = evaluatePolicy(
      publicCtxWithPolicy(["prayerRequests.create"], ["prayerRequests.create"], false),
      "prayerRequests.create"
    );
    expect(result.requiresApproval).toBe(false);
  });

  it("uses invariant highRisk list even without org override", () => {
    const result = evaluatePolicy(publicCtxWithPolicy(["contacts.upsert"]), "contacts.upsert");
    expect(result.requiresApproval).toBe(false);
  });
});

describe("evaluatePolicy — bulk targeting and staff overrides", () => {
  it("requires approval when an org marks a routine staff tool as high risk", () => {
    const result = evaluatePolicy(
      baseCtx({
        policy: {
          approvalsEnabled: true,
          highRiskTools: ["messages.sendSMS"],
          allowedPublicTools: [],
        },
      }),
      "messages.sendSMS"
    );

    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it("requires approval for explicit bulk recipient arrays", () => {
    const result = evaluatePolicy(
      baseCtx(),
      "messages.sendSMS",
      {
        recipientIds: Array.from({ length: 10 }, (_, index) => `contact_${index + 1}`),
        message: "Reminder",
      }
    );

    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it("does not require approval for a single-recipient send", () => {
    const result = evaluatePolicy(
      baseCtx(),
      "messages.sendSMS",
      {
        to: "+15555550101",
        message: "Thanks for visiting.",
      }
    );

    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
  });
});
