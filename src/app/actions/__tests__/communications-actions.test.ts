import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectLimit = vi.fn();
  const selectWhere = vi.fn(() => ({ limit: selectLimit }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const updateReturning = vi.fn();
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  const requireOrgMembership = vi.fn();

  return {
    select,
    selectFrom,
    selectWhere,
    selectLimit,
    update,
    updateSet,
    updateWhere,
    updateReturning,
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

import { updateConversationStatus } from "../communications";

describe("communications actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrgMembership.mockResolvedValue({ userId: "user_1" });
  });

  it("rejects invalid conversation statuses before touching the database", async () => {
    await expect(
      updateConversationStatus("conv_1", "pending")
    ).rejects.toThrow("Invalid conversation status: pending");
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("blocks invalid status transitions", async () => {
    mocks.selectLimit.mockResolvedValueOnce([
      {
        id: "conv_1",
        organizationId: "org_1",
        status: "archived",
      },
    ]);

    await expect(
      updateConversationStatus("conv_1", "resolved")
    ).rejects.toThrow("Cannot transition conversation from archived to resolved");

    expect(mocks.requireOrgMembership).toHaveBeenCalledWith("org_1");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("throws when conversation is not found in org scope", async () => {
    mocks.selectLimit.mockResolvedValueOnce([]);

    await expect(
      updateConversationStatus("conv_missing", "open")
    ).rejects.toThrow("Conversation not found");

    expect(mocks.requireOrgMembership).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("updates conversation status for valid transitions", async () => {
    mocks.selectLimit.mockResolvedValueOnce([
      {
        id: "conv_2",
        organizationId: "org_2",
        status: "waiting",
      },
    ]);
    mocks.updateReturning.mockResolvedValueOnce([
      {
        id: "conv_2",
        organizationId: "org_2",
        status: "resolved",
      },
    ]);

    const updated = await updateConversationStatus("conv_2", "resolved");
    expect(updated).toMatchObject({
      id: "conv_2",
      organizationId: "org_2",
      status: "resolved",
    });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.updateReturning).toHaveBeenCalledTimes(1);
  });
});
