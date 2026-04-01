import { describe, expect, it } from "vitest";
import {
  mergeContactNotes,
  normalizeContactEmail,
  normalizeContactPhone,
  resolveMergedMemberStatus,
} from "@/lib/operations/contacts-lifecycle";

describe("contacts lifecycle helpers", () => {
  it("normalizes identifiers", () => {
    expect(normalizeContactEmail("  USER@Example.COM  ")).toBe(
      "user@example.com"
    );
    expect(normalizeContactEmail(undefined)).toBeNull();

    expect(normalizeContactPhone("(555) 123-4567")).toBe("5551234567");
    expect(normalizeContactPhone("")).toBeNull();
  });

  it("merges notes without losing context", () => {
    expect(mergeContactNotes(null, null)).toBeNull();
    expect(mergeContactNotes("Primary note", null)).toBe("Primary note");
    expect(mergeContactNotes("Same", "Same")).toBe("Same");
    expect(mergeContactNotes("Primary", "Duplicate")).toBe(
      "Primary\n\nMerged note:\nDuplicate"
    );
  });

  it("prefers active status from duplicate when primary is inactive", () => {
    expect(resolveMergedMemberStatus("inactive", "member")).toBe("member");
    expect(resolveMergedMemberStatus("inactive", "inactive")).toBe("inactive");
    expect(resolveMergedMemberStatus("leader", "inactive")).toBe("leader");
  });
});
