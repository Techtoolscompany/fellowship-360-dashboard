import { describe, expect, it } from "vitest";
import {
  buildServiceRunRoleMatrix,
  getNextUpcomingServiceRun,
  getPreferredServiceRunId,
  summarizeRoleMatrix,
  type AssignmentRowLike,
  type RoleSlotLike,
} from "@/lib/grace/service-planning";

describe("service-planning utils", () => {
  it("selects the nearest upcoming run", () => {
    const now = Date.now();
    const runs = [
      {
        run: {
          id: "completed",
          status: "completed",
          serviceAt: new Date(now - 86_400_000),
        },
      },
      {
        run: {
          id: "upcoming-2",
          status: "planned",
          serviceAt: new Date(now + 86_400_000),
        },
      },
      {
        run: {
          id: "upcoming-1",
          status: "planned",
          serviceAt: new Date(now + 3_600_000),
        },
      },
    ];

    const next = getNextUpcomingServiceRun(runs);
    expect(next?.run.id).toBe("upcoming-1");
    expect(getPreferredServiceRunId(runs, null)).toBe("upcoming-1");
    expect(getPreferredServiceRunId(runs, "upcoming-2")).toBe("upcoming-2");
  });

  it("builds matrix coverage and ignores at-risk seats as filled", () => {
    const roleSlots: Array<RoleSlotLike<"volunteer" | "paid_staff" | "either">> = [
      {
        id: "slot-greeter",
        roleName: "Greeter",
        assignmentType: "volunteer",
        isRequired: true,
        requiredCount: 2,
      },
      {
        id: "slot-audio",
        roleName: "Audio Engineer",
        assignmentType: "either",
        isRequired: true,
        requiredCount: 1,
      },
    ];

    const assignments: AssignmentRowLike[] = [
      {
        assignment: {
          roleSlotId: "slot-greeter",
          roleName: "Greeter",
          status: "confirmed",
          volunteerId: "vol-1",
          staffUserId: null,
        },
      },
      {
        assignment: {
          roleSlotId: "slot-greeter",
          roleName: "Greeter",
          status: "needs_replacement",
          volunteerId: "vol-2",
          staffUserId: null,
        },
      },
      {
        assignment: {
          roleSlotId: "slot-audio",
          roleName: "Audio Engineer",
          status: "proposed",
          volunteerId: null,
          staffUserId: null,
        },
      },
    ];

    const matrix = buildServiceRunRoleMatrix(roleSlots, assignments, [
      "declined",
      "needs_replacement",
      "no_show",
      "cancelled",
    ]);
    const summary = summarizeRoleMatrix(matrix);

    const greeter = matrix.find((row) => row.roleSlotId === "slot-greeter");
    expect(greeter?.seatsNeeded).toBe(2);
    expect(greeter?.seatsFilled).toBe(1);
    expect(greeter?.seatsAtRisk).toBe(1);
    expect(greeter?.seatsOpen).toBe(1);

    expect(summary.seatsNeeded).toBe(3);
    expect(summary.seatsFilled).toBe(1);
    expect(summary.seatsAtRisk).toBe(1);
    expect(summary.coveragePercent).toBe(33);
  });
});
