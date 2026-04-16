import { describe, expect, it } from "vitest";
import {
  getServiceRunWindow,
  parseAssignmentResponse,
  scoreStaffCandidate,
  scoreVolunteerCandidate,
  windowsOverlap,
} from "@/lib/operations/service-staffing";

describe("service staffing helpers", () => {
  it("parses assignment replies into workflow statuses", () => {
    expect(parseAssignmentResponse("Yes, I can serve")).toEqual({
      nextStatus: "confirmed",
      label: "confirmed",
    });
    expect(parseAssignmentResponse("declined")).toEqual({
      nextStatus: "declined",
      label: "declined",
    });
    expect(parseAssignmentResponse("different time please")).toEqual({
      nextStatus: "needs_replacement",
      label: "needs replacement",
    });
    expect(parseAssignmentResponse("maybe")).toBeNull();
  });

  it("builds buffered service windows and detects overlap", () => {
    const primary = getServiceRunWindow(new Date("2026-04-19T09:00:00.000Z"), 90);
    const overlapping = getServiceRunWindow(new Date("2026-04-19T10:15:00.000Z"), 60);
    const separate = getServiceRunWindow(new Date("2026-04-19T13:00:00.000Z"), 60);

    expect(windowsOverlap(primary, overlapping)).toBe(true);
    expect(windowsOverlap(primary, separate)).toBe(false);
  });

  it("scores staff candidates with leadership fit and conflict penalties", () => {
    const candidate = scoreStaffCandidate({
      roleName: "Service Leader",
      membershipRole: "admin",
      recentLoad: 3,
      conflictReason: "Already assigned elsewhere",
    });

    expect(candidate.score).toBeGreaterThan(1);
    expect(candidate.reasons).toContain("Leadership role alignment");
    expect(candidate.reasons).toContain("Recent load: 3 appointments");
    expect(candidate.reasons).toContain("Conflict at service time");
  });

  it("scores volunteers with role fit, experience, and load penalties", () => {
    const candidate = scoreVolunteerCandidate({
      roleName: "Greeter",
      volunteerRole: "Greeter",
      totalHours: 120,
      recentLoad: 2,
    });

    expect(candidate.score).toBeGreaterThan(1);
    expect(candidate.reasons).toContain("Exact role match");
    expect(candidate.reasons).toContain("High volunteer experience");
    expect(candidate.reasons).toContain("Recent load: 2 shifts");
  });
});
