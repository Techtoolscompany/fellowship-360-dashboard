import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const select = vi.fn();

  const updateReturning = vi.fn();
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  const requireOrgMembership = vi.fn();
  const auditAction = vi.fn();

  return {
    select,
    update,
    updateSet,
    updateWhere,
    updateReturning,
    requireOrgMembership,
    auditAction,
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
  auditAction: mocks.auditAction,
}));

import { transitionTaskStatus } from "../tasks";

function mockSelectWithWhereLimit(result: unknown) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(result),
      })),
    })),
  };
}

function mockSelectWithLeftJoinWhereLimit(result: unknown) {
  return {
    from: vi.fn(() => ({
      leftJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(result),
        })),
      })),
    })),
  };
}

describe("tasks actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOrgMembership.mockResolvedValue({ userId: "user_1" });
  });

  it("throws when task is not found in organization scope", async () => {
    mocks.select.mockReturnValueOnce(mockSelectWithWhereLimit([]));

    await expect(
      transitionTaskStatus({
        taskId: "task_missing",
        organizationId: "org_1",
        status: "todo",
      })
    ).rejects.toThrow("Task not found");

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.auditAction).not.toHaveBeenCalled();
  });

  it("blocks invalid task status transitions", async () => {
    mocks.select.mockReturnValueOnce(
      mockSelectWithWhereLimit([{ id: "task_1", status: "done" }])
    );

    await expect(
      transitionTaskStatus({
        taskId: "task_1",
        organizationId: "org_1",
        status: "cancelled",
      })
    ).rejects.toThrow('Cannot transition task from "done" to "cancelled"');

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.auditAction).not.toHaveBeenCalled();
  });

  it("updates task status for valid transitions", async () => {
    mocks.select
      .mockReturnValueOnce(
        mockSelectWithWhereLimit([{ id: "task_2", status: "todo" }])
      )
      .mockReturnValueOnce(
        mockSelectWithLeftJoinWhereLimit([
          {
            task: {
              id: "task_2",
              organizationId: "org_2",
              status: "in_progress",
              dueDate: null,
              assigneeId: null,
            },
            assigneeName: null,
            assigneeEmail: null,
          },
        ])
      );
    mocks.updateReturning.mockResolvedValueOnce([{ id: "task_2" }]);

    const updated = await transitionTaskStatus({
      taskId: "task_2",
      organizationId: "org_2",
      status: "in_progress",
    });

    expect(updated).toMatchObject({
      id: "task_2",
      status: "in_progress",
      slaStatus: "no_due_date",
    });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.auditAction).toHaveBeenCalledTimes(1);
  });
});
