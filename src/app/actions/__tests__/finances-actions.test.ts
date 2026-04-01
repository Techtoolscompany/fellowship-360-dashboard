import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectWhere = vi.fn();
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const requireOrganizationSectionAccess = vi.fn();

  return {
    select,
    selectFrom,
    selectWhere,
    requireOrganizationSectionAccess,
  };
});

vi.mock("@/db", () => ({
  db: {
    select: mocks.select,
  },
}));

vi.mock("../utils", () => ({
  auditAction: vi.fn(),
}));

vi.mock("@/lib/access/section-guard", () => ({
  requireOrganizationSectionAccess: mocks.requireOrganizationSectionAccess,
}));

import { getWeeklyGivingReport } from "../finances";

describe("finances actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrganizationSectionAccess.mockResolvedValue({
      userId: "user_1",
      role: "admin",
      allowedSections: ["finance"],
    });
  });

  it("builds weekly totals, source normalization, and fund/category breakdown", async () => {
    mocks.selectWhere
      .mockResolvedValueOnce([
        { id: "d1", amount: 100, method: "cash", fund: "General", memo: null },
        { id: "d2", amount: 50, method: "online", fund: "Missions", memo: "text to give" },
        { id: "d3", amount: 75, method: "card", fund: "Building Fund", memo: "mobile app" },
        { id: "d4", amount: 25, method: "bank_transfer", fund: "General", memo: null },
      ])
      .mockResolvedValueOnce([{ total: 100, count: 2 }]);

    const report = await getWeeklyGivingReport({ organizationId: "org_1" });

    expect(mocks.requireOrganizationSectionAccess).toHaveBeenCalledWith({
      organizationId: "org_1",
      section: "finance",
    });
    expect(report.totals).toMatchObject({
      current: 250,
      previous: 100,
      currentCount: 4,
      previousCount: 2,
      varianceAmount: 150,
      variancePercent: 150,
      trend: "up",
    });

    expect(report.breakdownBySource).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "cash", total: 100, count: 1 }),
        expect.objectContaining({ source: "text", total: 50, count: 1 }),
        expect.objectContaining({ source: "app", total: 75, count: 1 }),
        expect.objectContaining({ source: "online", total: 25, count: 1 }),
      ])
    );

    expect(report.breakdownByFund[0]).toMatchObject({
      fund: "General",
      category: "General",
      total: 125,
      count: 2,
    });
    expect(report.breakdownByCategory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "General", total: 125, count: 2 }),
        expect.objectContaining({ category: "Missions", total: 50, count: 1 }),
        expect.objectContaining({ category: "Building", total: 75, count: 1 }),
      ])
    );
  });

  it("rejects invalid explicit date windows", async () => {
    await expect(
      getWeeklyGivingReport({
        organizationId: "org_1",
        startDate: new Date("2026-03-10T00:00:00.000Z"),
        endDate: new Date("2026-03-01T00:00:00.000Z"),
      })
    ).rejects.toThrow("endDate must be after startDate");
  });
});
