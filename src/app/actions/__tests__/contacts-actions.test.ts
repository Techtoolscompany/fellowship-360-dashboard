import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectLimit = vi.fn();
  const selectWhere = vi.fn(() => ({ limit: selectLimit }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const insert = vi.fn();
  const update = vi.fn();
  const transaction = vi.fn();

  const requireOrgMembership = vi.fn();

  return {
    select,
    selectFrom,
    selectWhere,
    selectLimit,
    insert,
    update,
    transaction,
    requireOrgMembership,
  };
});

vi.mock("@/db", () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
    update: mocks.update,
    transaction: mocks.transaction,
  },
}));

vi.mock("../utils", () => ({
  requireOrgMembership: mocks.requireOrgMembership,
}));

vi.mock("@/lib/dittofeed/contacts", () => ({
  syncContactArchivedToDittofeed: vi.fn(),
  syncContactCreatedToDittofeed: vi.fn(),
  syncContactRestoredToDittofeed: vi.fn(),
  syncContactUpdatedToDittofeed: vi.fn(),
  syncContactToDittofeedBestEffort: vi.fn(async (_operation, task) => task()),
}));

import { createContact, importContacts, restoreContact } from "../contacts";

describe("contacts actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrgMembership.mockResolvedValue({ userId: "user_1" });
  });

  it("rejects invalid restore status before touching data", async () => {
    await expect(restoreContact("contact_1", "archived")).rejects.toThrow(
      "Invalid restore status"
    );
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("blocks contact creation when duplicate identifiers already exist", async () => {
    mocks.selectLimit.mockResolvedValueOnce([
      {
        id: "existing_1",
        email: "jane@example.com",
        phone: "5551234567",
      },
    ]);

    await expect(
      createContact({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phone: "(555) 123-4567",
        organizationId: "org_1",
      })
    ).rejects.toThrow(
      "Potential duplicate detected (email + phone). Merge with contact existing_1 or update identifiers."
    );

    expect(mocks.requireOrgMembership).toHaveBeenCalledWith("org_1");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("restores contact with a valid active status", async () => {
    const updateReturning = vi.fn().mockResolvedValueOnce([
      {
        id: "contact_2",
        organizationId: "org_2",
        memberStatus: "member",
      },
    ]);
    const updateWhere = vi.fn(() => ({ returning: updateReturning }));
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    mocks.update.mockReturnValueOnce({ set: updateSet });

    mocks.selectLimit
      .mockResolvedValueOnce([
        {
          id: "contact_2",
          organizationId: "org_2",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "contact_2",
          organizationId: "org_2",
          memberStatus: "inactive",
        },
      ]);

    const restored = await restoreContact("contact_2", "member");
    expect(restored).toMatchObject({
      id: "contact_2",
      organizationId: "org_2",
      memberStatus: "member",
    });
    expect(mocks.requireOrgMembership).toHaveBeenCalledWith("org_2");
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it("normalizes import aliases and persists canonical status values", async () => {
    const insertReturning = vi.fn().mockResolvedValueOnce([
      {
        id: "contact_1",
        organizationId: "org_1",
        memberStatus: "prospect",
      },
    ]);
    const insertValues = vi.fn(() => ({ returning: insertReturning }));
    mocks.insert.mockReturnValueOnce({ values: insertValues });
    mocks.selectLimit.mockResolvedValueOnce([]);

    const updateReturning = vi.fn().mockResolvedValueOnce([
      {
        id: "contact_2",
        organizationId: "org_1",
        memberStatus: "prospect",
      },
    ]);
    const updateWhere = vi.fn(() => ({ returning: updateReturning }));
    const updateSet = vi.fn(() => ({ where: updateWhere }));
    mocks.update.mockReturnValueOnce({ set: updateSet });
    mocks.selectLimit.mockResolvedValueOnce([{ id: "contact_2" }]);

    const result = await importContacts("org_1", [
      {
        firstName: "Sam",
        lastName: "Guest",
        email: "sam@example.com",
        memberStatus: "new guest",
        source: "web_form",
      },
      {
        firstName: "Rae",
        lastName: "Family",
        email: "rae@example.com",
        memberStatus: "new_guest",
        source: "web_form",
      },
    ]);

    expect(result).toMatchObject({
      inserted: 1,
      updated: 1,
      failed: 0,
    });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        memberStatus: "prospect",
      })
    );
    expect(insertReturning).toHaveBeenCalledTimes(1);
    expect(updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        memberStatus: "prospect",
      })
    );
    expect(updateReturning).toHaveBeenCalledTimes(1);
  });
});
