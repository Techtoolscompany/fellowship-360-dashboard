import { describe, expect, it } from "vitest";
import {
  assertConversationStatusTransition,
  canTransitionConversationStatus,
  parseConversationLifecycleStatus,
} from "@/lib/operations/conversations-lifecycle";

describe("conversations lifecycle helpers", () => {
  it("parses supported statuses", () => {
    expect(parseConversationLifecycleStatus("open")).toBe("open");
    expect(parseConversationLifecycleStatus("waiting")).toBe("waiting");
    expect(parseConversationLifecycleStatus("resolved")).toBe("resolved");
    expect(parseConversationLifecycleStatus("archived")).toBe("archived");
  });

  it("rejects unsupported statuses", () => {
    expect(() => parseConversationLifecycleStatus("pending")).toThrow(
      "Invalid conversation status: pending"
    );
  });

  it("allows and blocks transitions correctly", () => {
    expect(canTransitionConversationStatus("open", "waiting")).toBe(true);
    expect(canTransitionConversationStatus("waiting", "resolved")).toBe(true);
    expect(canTransitionConversationStatus("archived", "open")).toBe(true);
    expect(canTransitionConversationStatus("archived", "resolved")).toBe(false);
    expect(() =>
      assertConversationStatusTransition("archived", "resolved")
    ).toThrow("Cannot transition conversation from archived to resolved");
  });
});
