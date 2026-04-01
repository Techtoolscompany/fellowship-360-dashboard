import { describe, expect, it } from "vitest";

import { shapeReportMinistryRows } from "@/lib/reports/ministry-row";

describe("reports ministry row shaping", () => {
  it("resolves leader names and calculates growth + participation", () => {
    const rows = shapeReportMinistryRows([
      {
        name: "Hospitality",
        members: 20,
        growth: 5,
        leaderFirstName: "Avery",
        leaderLastName: "Johnson",
      },
      {
        name: "Youth",
        members: 10,
        growth: 0,
        leaderFirstName: null,
        leaderLastName: null,
      },
    ]);

    expect(rows[0]).toMatchObject({
      name: "Hospitality",
      leaderName: "Avery Johnson",
      members: 20,
      newMembersInWindow: 5,
      growthRatePercent: 33,
      participation: 100,
    });
    expect(rows[1]).toMatchObject({
      name: "Youth",
      leaderName: null,
      members: 10,
      newMembersInWindow: 0,
      growthRatePercent: 0,
      participation: 50,
    });
  });

  it("returns 100% growth when there is no baseline but has new members", () => {
    const rows = shapeReportMinistryRows([
      {
        name: "Outreach",
        members: 4,
        growth: 4,
        leaderFirstName: "Sam",
        leaderLastName: "Lee",
      },
    ]);

    expect(rows[0]?.growthRatePercent).toBe(100);
    expect(rows[0]?.participation).toBe(100);
  });
});
