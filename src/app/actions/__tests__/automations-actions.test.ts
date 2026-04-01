import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectLimit = vi.fn();
  const selectOrderBy = vi.fn(() => ({ limit: selectLimit }));
  const selectWhere = vi.fn(() => ({ limit: selectLimit, orderBy: selectOrderBy }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const updateReturning = vi.fn();
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const updateSet = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set: updateSet }));

  const requireOrgMembership = vi.fn();
  const auditAction = vi.fn();

  return {
    select,
    selectFrom,
    selectWhere,
    selectOrderBy,
    selectLimit,
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

import {
  getAutomationWorkflowVersions,
  rollbackAutomationWorkflowVersion,
} from "../automations";

const validDefinition = {
  version: 1,
  startNodeId: "node_trigger",
  nodes: [
    {
      id: "node_trigger",
      type: "trigger",
      label: "Trigger",
      nextIds: ["node_stop"],
    },
    {
      id: "node_stop",
      type: "stop",
      label: "Stop",
      nextIds: [],
    },
  ],
} as const;

const validPolicy = {
  quietHoursEnabled: true,
  quietHoursStart: "21:00",
  quietHoursEnd: "08:00",
  dailySendCap: 250,
  respectOptOut: true,
  enrollmentMode: "once_per_contact",
  reentryCooldownMinutes: 10080,
} as const;

describe("automation actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns workflow versions in descending order", async () => {
    mocks.requireOrgMembership.mockResolvedValueOnce({ userId: "user_1" });
    mocks.selectLimit
      .mockResolvedValueOnce([{ id: "wf_1", organizationId: "org_1" }])
      .mockResolvedValueOnce([
        {
          id: "ver_2",
          organizationId: "org_1",
          workflowId: "wf_1",
          versionNumber: 2,
          triggerEvent: "contacts.created.v1",
          createdAt: new Date("2026-03-14T10:00:00.000Z"),
        },
        {
          id: "ver_1",
          organizationId: "org_1",
          workflowId: "wf_1",
          versionNumber: 1,
          triggerEvent: "contacts.created.v1",
          createdAt: new Date("2026-03-13T10:00:00.000Z"),
        },
      ]);

    const versions = await getAutomationWorkflowVersions({
      organizationId: "org_1",
      workflowId: "wf_1",
      limit: 5,
    });

    expect(versions).toHaveLength(2);
    expect(versions[0]?.versionNumber).toBe(2);
    expect(mocks.requireOrgMembership).toHaveBeenCalledWith("org_1", "user");
    expect(mocks.selectLimit).toHaveBeenNthCalledWith(1, 1);
    expect(mocks.selectLimit).toHaveBeenNthCalledWith(2, 5);
  });

  it("restores a prior version as a draft", async () => {
    mocks.requireOrgMembership.mockResolvedValueOnce({ userId: "admin_1" });
    mocks.selectLimit
      .mockResolvedValueOnce([
        {
          id: "wf_1",
          organizationId: "org_1",
          validationErrors: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "ver_2",
          organizationId: "org_1",
          workflowId: "wf_1",
          versionNumber: 2,
          triggerEvent: "contacts.created.v1",
          definitionJson: validDefinition,
          policyJson: validPolicy,
        },
      ]);

    mocks.updateReturning.mockResolvedValueOnce([
      {
        id: "wf_1",
        organizationId: "org_1",
        status: "draft",
      },
    ]);

    const restored = await rollbackAutomationWorkflowVersion({
      organizationId: "org_1",
      workflowId: "wf_1",
      versionNumber: 2,
    });

    expect(restored).toMatchObject({
      id: "wf_1",
      organizationId: "org_1",
      status: "draft",
    });
    expect(mocks.requireOrgMembership).toHaveBeenCalledWith("org_1", "admin");
    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        triggerEvent: "contacts.created.v1",
        definitionJson: expect.objectContaining({
          startNodeId: "node_trigger",
        }),
      })
    );
    expect(mocks.auditAction).toHaveBeenCalledTimes(1);
  });
});
