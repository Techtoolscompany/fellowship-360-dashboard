import { describe, expect, it } from "vitest";
import {
  getMemberStatusLabel,
  getMemberStatusPluralLabel,
  normalizeImportedMemberStatus,
} from "../member-status";

describe("member status labels", () => {
  it("renders prospect as New Guest", () => {
    expect(getMemberStatusLabel("prospect")).toBe("New Guest");
    expect(getMemberStatusPluralLabel("prospect")).toBe("New Guests");
  });

  it("normalizes import aliases to canonical enum values", () => {
    expect(normalizeImportedMemberStatus("new_guest")).toBe("prospect");
    expect(normalizeImportedMemberStatus("new guest")).toBe("prospect");
    expect(normalizeImportedMemberStatus("PROSPECT")).toBe("prospect");
    expect(normalizeImportedMemberStatus("regular attendee")).toBe(
      "regular_attendee"
    );
  });

  it("returns null for unknown import statuses", () => {
    expect(normalizeImportedMemberStatus("mystery_status")).toBeNull();
  });
});
