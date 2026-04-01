import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const selectLimit = vi.fn();
  const selectWhere = vi.fn(() => ({ limit: selectLimit }));
  const selectFrom = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from: selectFrom }));

  const insertReturning = vi.fn();
  const insertOnConflictDoNothing = vi.fn(() => ({ returning: insertReturning }));
  const insertValues = vi.fn(() => ({ onConflictDoNothing: insertOnConflictDoNothing }));
  const insert = vi.fn(() => ({ values: insertValues }));

  return {
    select,
    selectFrom,
    selectWhere,
    selectLimit,
    insert,
    insertValues,
    insertOnConflictDoNothing,
    insertReturning,
  };
});

vi.mock("@/db", () => ({
  db: {
    select: mocks.select,
    insert: mocks.insert,
  },
}));

vi.mock("@/lib/automations/templates", () => ({
  getAutomationTemplateByKey: vi.fn(),
}));

vi.mock("@/lib/automations/validation", () => ({
  validateAutomationDefinition: vi.fn(() => []),
}));

import { getAutomationTemplateByKey } from "@/lib/automations/templates";
import { deployAutomationTemplateBatch, mapWithConcurrency } from "../deploy-template";

describe("deploy template helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("caps concurrent work at five tasks", async () => {
    let active = 0;
    let maxActive = 0;

    const results = await mapWithConcurrency(
      Array.from({ length: 8 }, (_, index) => index + 1),
      5,
      async (value) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return value * 2;
      }
    );

    expect(results).toEqual([2, 4, 6, 8, 10, 12, 14, 16]);
    expect(maxActive).toBeLessThanOrEqual(5);
  });

  it("returns already_installed when the template is already present", async () => {
    vi.mocked(getAutomationTemplateByKey).mockReturnValueOnce({
      key: "visitor_follow_up",
      name: "Visitor Follow-Up",
      description: "Follow-up template",
      category: "Follow-Up",
      triggerEvent: "contacts.created.v1",
      mode: "template",
      recommendedChannels: ["sms"],
      definition: {
        version: 1,
        startNodeId: "trigger_1",
        nodes: [
          {
            id: "trigger_1",
            type: "trigger",
            label: "Trigger",
            nextIds: ["stop_1"],
          },
          {
            id: "stop_1",
            type: "stop",
            label: "Stop",
            nextIds: [],
          },
        ],
      },
    });

    mocks.selectLimit
      .mockResolvedValueOnce([{ id: "org_1", name: "Church One" }])
      .mockResolvedValueOnce([{ id: "existing_wf" }]);

    const result = await deployAutomationTemplateBatch({
      request: {
        templateKey: "visitor_follow_up",
        organizationIds: ["org_1"],
        skipIfInstalled: true,
      },
      actor: {
        userId: "super_admin_1",
        email: "admin@example.com",
      },
    });

    expect(result).toEqual({
      templateKey: "visitor_follow_up",
      skipIfInstalled: true,
      results: [
        {
          organizationId: "org_1",
          status: "already_installed",
          workflowId: "existing_wf",
        },
      ],
    });
    expect(mocks.insert).toHaveBeenCalledTimes(1);
  });

  it("dedupes duplicate organization ids in batch deploys", async () => {
    vi.mocked(getAutomationTemplateByKey).mockReturnValueOnce({
      key: "visitor_follow_up",
      name: "Visitor Follow-Up",
      description: "Follow-up template",
      category: "Follow-Up",
      triggerEvent: "contacts.created.v1",
      mode: "template",
      recommendedChannels: ["sms"],
      definition: {
        version: 1,
        startNodeId: "trigger_1",
        nodes: [
          {
            id: "trigger_1",
            type: "trigger",
            label: "Trigger",
            nextIds: ["stop_1"],
          },
          {
            id: "stop_1",
            type: "stop",
            label: "Stop",
            nextIds: [],
          },
        ],
      },
    });

    mocks.select.mockImplementation(((selection: Record<string, unknown>) => {
      const keys = Object.keys(selection);
      const kind = keys.includes("latestVersionNumber")
        ? "version"
        : keys.includes("templateKey")
          ? "existing"
          : "organization";

      return {
        from: () => ({
          where: () => ({
            limit: async () => {
              if (kind === "organization") {
                return [{ id: "org_1", name: "Church One" }];
              }
              if (kind === "existing") {
                return [{ id: "existing_wf" }];
              }
              return [{ latestVersionNumber: 0 }];
            },
          }),
        }),
      };
    }) as never);

    const result = await deployAutomationTemplateBatch({
      request: {
        templateKey: "visitor_follow_up",
        organizationIds: ["org_1", "org_1", "org_2"],
      },
      actor: {
        userId: "super_admin_1",
        email: "admin@example.com",
      },
    });

    expect(result.results).toEqual([
      {
        organizationId: "org_1",
        status: "already_installed",
        workflowId: "existing_wf",
      },
      {
        organizationId: "org_2",
        status: "already_installed",
        workflowId: "existing_wf",
      },
    ]);
  });
});
