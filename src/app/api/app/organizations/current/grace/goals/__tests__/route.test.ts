import { beforeEach, describe, expect, it, vi } from "vitest";

const operations = vi.hoisted(() => ({
  getGraceGoals: vi.fn(),
  getGraceGoalWithSteps: vi.fn(),
  startServiceRunAutostaffGoal: vi.fn(),
}));

vi.mock("@/lib/auth/withOrganizationAuthRequired", () => ({
  default: (handler: unknown) => handler,
}));

vi.mock("@/app/actions/operations", () => operations);

describe("grace goals API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /grace/goals includes workflow summaries", async () => {
    operations.getGraceGoals.mockResolvedValueOnce([
      {
        goal: {
          id: "goal_1",
          goalType: "service_staffing",
          status: "in_progress",
          sourceChannel: "in_app",
          objectiveText: "Staff Sunday service",
          serviceRunId: "run_1",
          contextJson: {
            triggerSource: "grace",
            triggerChannel: "in_app",
            policyMode: "standard",
          },
          resultJson: { summary: "Grace is waiting on two replies" },
          errorText: null,
          startedAt: new Date("2026-04-01T10:00:00.000Z"),
          completedAt: null,
          nextRunAt: new Date("2026-04-01T12:00:00.000Z"),
          createdAt: new Date("2026-04-01T09:00:00.000Z"),
          updatedAt: new Date("2026-04-01T10:15:00.000Z"),
        },
        serviceRun: {
          id: "run_1",
          name: "Sunday AM",
        },
      },
    ]);

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost") as never, {
      session: { organization: { id: "org_1" } },
    } as never);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      success: true,
      goals: [
        {
          goal: {
            id: "goal_1",
            goalType: "service_staffing",
          },
          workflow: {
            workflowKey: "volunteer_staffing",
            workflowLabel: "Volunteer staffing",
            statusLabel: "In progress",
            triggerSource: "grace",
            triggerChannel: "in_app",
            policyMode: "standard",
          },
        },
      ],
    });
    expect(operations.getGraceGoals).toHaveBeenCalledWith("org_1", {
      status: undefined,
      goalType: undefined,
      workflowKey: undefined,
      serviceRunId: undefined,
    });
  });

  it("GET /grace/goals/[goalId] includes workflow timeline data", async () => {
    operations.getGraceGoalWithSteps.mockResolvedValueOnce({
      goal: {
        id: "goal_1",
        goalType: "service_staffing",
        status: "waiting",
        sourceChannel: "in_app",
        objectiveText: "Staff Sunday service",
        serviceRunId: "run_1",
        contextJson: {
          workflowKey: "volunteer_staffing",
          correlationKey: "volunteer_staffing:run_1",
        },
        resultJson: null,
        errorText: null,
        startedAt: new Date("2026-04-01T10:00:00.000Z"),
        completedAt: null,
        nextRunAt: new Date("2026-04-01T12:00:00.000Z"),
        createdAt: new Date("2026-04-01T09:00:00.000Z"),
        updatedAt: new Date("2026-04-01T10:15:00.000Z"),
      },
      steps: [
        {
          stepKey: "send_offers",
          title: "Send SMS offers",
          status: "waiting",
          runOrder: 30,
          attemptCount: 1,
          createdAt: new Date("2026-04-01T10:05:00.000Z"),
          updatedAt: new Date("2026-04-01T10:10:00.000Z"),
        },
      ],
    });

    const { GET } = await import("../[goalId]/route");
    const response = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ goalId: "goal_1" }),
    } as never);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.workflow).toMatchObject({
      workflowKey: "volunteer_staffing",
      workflowLabel: "Volunteer staffing",
      statusLabel: "Waiting",
      stepSummary: "0/1 complete · 1 waiting",
      correlationKey: "volunteer_staffing:run_1",
    });
    expect(payload.workflow.stepTimeline).toEqual([
      {
        stepKey: "send_offers",
        title: "Send SMS offers",
        status: "waiting",
        runOrder: 30,
        attemptCount: 1,
        startedAt: null,
        completedAt: null,
        errorText: null,
        summary: null,
      },
    ]);
  });
});
