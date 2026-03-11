import { describe, expect, it } from "vitest";
import {
  hasPreferredRoleMatch,
  isAvailabilityMatch,
  normalizeAvailabilitySlots,
  scoreStaffCandidate,
  scoreVolunteerCandidate,
} from "@/lib/grace/assignment-scoring";

describe("assignment scoring helpers", () => {
  it("normalizes availability slots and drops invalid entries", () => {
    const slots = normalizeAvailabilitySlots([
      { dayOfWeek: 0, startTime: "08:00", endTime: "11:00" },
      { dayOfWeek: 0, startTime: "11:00", endTime: "09:00" },
      { dayOfWeek: 8, startTime: "08:00", endTime: "10:00" },
      { dayOfWeek: 6, startTime: "09:00", endTime: "10:00" },
    ]);

    expect(slots).toEqual([
      { dayOfWeek: 0, startTime: "08:00", endTime: "11:00" },
      { dayOfWeek: 6, startTime: "09:00", endTime: "10:00" },
    ]);
  });

  it("checks availability against service time", () => {
    const sundayTenAm = new Date(2026, 2, 15, 10, 0, 0, 0);

    expect(
      isAvailabilityMatch(sundayTenAm, [
        { dayOfWeek: sundayTenAm.getDay(), startTime: "09:00", endTime: "12:00" },
      ])
    ).toBe(true);

    expect(
      isAvailabilityMatch(sundayTenAm, [
        { dayOfWeek: sundayTenAm.getDay(), startTime: "12:00", endTime: "14:00" },
      ])
    ).toBe(false);
  });

  it("matches preferred roles with partial matches", () => {
    expect(hasPreferredRoleMatch("Audio Engineer", ["Audio"])).toBe(true);
    expect(hasPreferredRoleMatch("Greeter", ["Prayer"])).toBe(false);
  });

  it("scores staff candidates with load and availability penalties", () => {
    const candidate = scoreStaffCandidate({
      roleName: "Service Leader",
      membershipRole: "admin",
      preferredRoles: ["Service Leader"],
      recentLoad: 4,
      isSchedulable: true,
      isAvailabilityMatch: false,
    });

    expect(candidate.score).toBeGreaterThan(1);
    expect(candidate.available).toBe(false);
    expect(candidate.reasons).toContain("Leadership role alignment");
    expect(candidate.reasons).toContain("Outside saved availability");
  });

  it("scores volunteers with experience and conflict penalties", () => {
    const candidate = scoreVolunteerCandidate({
      roleName: "Greeter",
      volunteerRole: "Greeter",
      totalHours: 120,
      preferredRoles: ["Hospitality"],
      recentLoad: 2,
      conflictReason: "Already assigned",
    });

    expect(candidate.score).toBeGreaterThan(1);
    expect(candidate.available).toBe(false);
    expect(candidate.reasons).toContain("Exact role match");
    expect(candidate.reasons).toContain("Conflict at service time");
  });
});
