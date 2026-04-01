import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const select = vi.fn();
  const update = vi.fn();
  const requireOrgMembership = vi.fn();

  return {
    select,
    update,
    requireOrgMembership,
  };
});

vi.mock("@/db", () => ({
  db: {
    select: mocks.select,
    update: mocks.update,
  },
}));

vi.mock("../utils", () => ({
  requireOrgMembership: mocks.requireOrgMembership,
}));

import { updatePrayerRequest } from "../prayer";

function mockSelectWithWhereLimit(result: unknown) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(result),
      })),
    })),
  };
}

describe("prayer actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrgMembership.mockResolvedValue({ userId: "user_1" });
  });

  it("throws when prayer request is not found", async () => {
    mocks.select.mockReturnValueOnce(mockSelectWithWhereLimit([]));

    await expect(
      updatePrayerRequest("missing_request", { status: "archived" })
    ).rejects.toThrow("Prayer request not found");

    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("archives request and closes escalation tasks for inactive status", async () => {
    mocks.select.mockReturnValueOnce(
      mockSelectWithWhereLimit([
        {
          id: "req_1",
          organizationId: "org_1",
          content: "Please pray for my family",
          contactName: "Jane Doe",
          status: "new",
          urgency: "normal",
          assignedTeam: "Prayer Team",
          isAnonymous: "false",
        },
      ])
    );

    const prayerReturning = vi.fn().mockResolvedValueOnce([
      {
        id: "req_1",
        organizationId: "org_1",
        content: "Please pray for my family",
        contactName: "Jane Doe",
        status: "archived",
        urgency: "normal",
        assignedTeam: "Prayer Team",
        isAnonymous: "false",
        updatedAt: new Date("2026-03-13T12:00:00.000Z"),
      },
    ]);
    const prayerWhere = vi.fn(() => ({ returning: prayerReturning }));
    const prayerSet = vi.fn(() => ({ where: prayerWhere }));

    const closeWhere = vi.fn().mockResolvedValueOnce(undefined);
    const closeSet = vi.fn(() => ({ where: closeWhere }));

    mocks.update
      .mockImplementationOnce(() => ({ set: prayerSet }))
      .mockImplementationOnce(() => ({ set: closeSet }));

    const updated = await updatePrayerRequest("req_1", { status: "archived" });

    expect(updated).toMatchObject({
      id: "req_1",
      organizationId: "org_1",
      status: "archived",
    });
    expect(mocks.requireOrgMembership).toHaveBeenCalledWith("org_1");
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(closeSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "done",
      })
    );
  });
});
