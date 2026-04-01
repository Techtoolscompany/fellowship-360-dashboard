import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLaunchReportPayload,
  formatLaunchReportCsv,
} from "../launch-report";

describe("launch report helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a report payload from existing organization data", () => {
    const now = new Date("2026-03-19T12:00:00.000Z");
    const payload = buildLaunchReportPayload({
      organization: {
        organizationId: "org_1",
        organizationName: "Grace Church",
        planName: "Launch",
      },
      providerConfigs: [
        {
          organizationId: "org_1",
          channel: "sms",
          provider: "textbee",
          isActive: true,
          mode: "agency_managed",
        },
      ],
      smsDevices: [
        {
          organizationId: "org_1",
          isActive: true,
          lastSeenAt: "2026-03-19T11:20:00.000Z",
        },
      ],
      graceAuditRows: [
        ...Array.from({ length: 20 }, (_, index) => ({
          organizationId: "org_1",
          eventType: "ai_decision" as const,
          status: index === 0 ? ("error" as const) : ("success" as const),
          createdAt: `2026-03-19T11:${String(59 - index).padStart(2, "0")}:00.000Z`,
        })),
        ...Array.from({ length: 10 }, (_, index) => ({
          organizationId: "org_1",
          eventType: "action_execution" as const,
          status: index < 2 ? ("error" as const) : ("success" as const),
          createdAt: `2026-03-19T10:${String(59 - index).padStart(2, "0")}:00.000Z`,
        })),
      ],
      workflowRuns: [
        {
          organizationId: "org_1",
          status: "failed",
          enteredAt: "2026-03-19T10:00:00.000Z",
        },
      ],
      automationWorkflows: [
        {
          organizationId: "org_1",
          status: "published",
          mode: "template",
          templateKey: "visitor_follow_up",
        },
        {
          organizationId: "org_1",
          status: "archived",
          mode: "template",
          templateKey: "old_template",
        },
      ],
      now,
    });

    expect(payload.organizationId).toBe("org_1");
    expect(payload.readiness.status).toBe("critical");
    expect(payload.providerHealth.status).toBe("partial");
    expect(payload.providerHealth.requiredProviderGaps).toEqual([
      "AI provider is not configured",
    ]);
    expect(payload.readiness.blockingActions).toContain("Configure AI provider");
    expect(payload.operationalReliability7d.aiSuccessRate).toBe(95);
    expect(payload.operationalReliability7d.actionErrorRate).toBe(20);
    expect(payload.operationalReliability7d.workflowFailures).toBe(1);
    expect(payload.recommendedNextActions).toHaveLength(3);
    expect(payload.generatedAt).toBe(now.toISOString());
  });

  it("serializes the report to a stable csv schema", () => {
    const csv = formatLaunchReportCsv({
      organizationId: "org_1",
      organizationName: "Grace Church",
      generatedAt: "2026-03-19T12:00:00.000Z",
      readiness: {
        score: 72,
        status: "critical",
        blockingActions: ["Configure AI provider", "Review automation failures"],
      },
      providerHealth: {
        status: "partial",
        summary: "1 active provider. SMS heartbeat 20m. Gaps: AI provider is not configured.",
        activeProviders: 1,
        requiredProviderGaps: ["AI provider is not configured"],
      },
      automationFootprint: {
        installedCount: 1,
        publishedCount: 1,
        archivedCount: 1,
      },
      operationalReliability7d: {
        aiSuccessRate: 95,
        actionErrorRate: 20,
        workflowFailures: 1,
        totalAiEvents: 20,
        totalActionEvents: 10,
      },
      recommendedNextActions: [
        "Configure AI provider",
        "Review failed workflow runs from the last 7 days",
        "Tune AI prompts and guardrails",
      ],
    });

    expect(csv.startsWith("organizationId,organizationName,generatedAt")).toBe(true);
    expect(csv).toContain("Grace Church");
    expect(csv).toContain("Configure AI provider; Review automation failures");
    expect(csv).toContain("AI provider is not configured");
  });
});

describe("launch report route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns json and csv responses", async () => {
    const report = {
      organizationId: "org_1",
      organizationName: "Grace Church",
      generatedAt: "2026-03-19T12:00:00.000Z",
      readiness: {
        score: 72,
        status: "critical",
        blockingActions: ["Configure AI provider"],
      },
      providerHealth: {
        status: "partial",
        summary: "1 active provider.",
        activeProviders: 1,
        requiredProviderGaps: ["AI provider is not configured"],
      },
      automationFootprint: {
        installedCount: 1,
        publishedCount: 1,
        archivedCount: 0,
      },
      operationalReliability7d: {
        aiSuccessRate: 95,
        actionErrorRate: 20,
        workflowFailures: 1,
        totalAiEvents: 20,
        totalActionEvents: 10,
      },
      recommendedNextActions: ["Configure AI provider"],
    };
    const csv = "organizationId,organizationName\norg_1,Grace Church\n";
    const getLaunchReportForOrganization = vi.fn().mockResolvedValue(report);
    const getLaunchReportCsv = vi.fn().mockResolvedValue({
      report,
      csv,
      filename: "launch-report-grace-church-2026-03-19.csv",
    });

    vi.doMock("@/lib/auth/withSuperAdminAuthRequired", () => ({
      default: (handler: unknown) => handler,
    }));
    vi.doMock("@/lib/super-admin/launch-report", () => ({
      getLaunchReportForOrganization,
      getLaunchReportCsv,
    }));

    const { GET } = await import(
      "../../../app/api/super-admin/organizations/[id]/launch-report/route"
    );

    const jsonResponse = await GET(new Request("http://localhost") as never, {
      params: Promise.resolve({ id: "org_1" }),
    } as never);

    expect(jsonResponse.status).toBe(200);
    expect(await jsonResponse.json()).toEqual(report);
    expect(getLaunchReportForOrganization).toHaveBeenCalledWith("org_1");

    const csvResponse = await GET(
      new Request("http://localhost?format=csv") as never,
      { params: Promise.resolve({ id: "org_1" }) } as never
    );

    expect(csvResponse.status).toBe(200);
    expect(csvResponse.headers.get("Content-Type")).toContain("text/csv");
    expect(csvResponse.headers.get("Content-Disposition")).toContain(
      'filename="launch-report-grace-church-2026-03-19.csv"'
    );
    expect(await csvResponse.text()).toBe(csv);
    expect(getLaunchReportCsv).toHaveBeenCalledWith("org_1");
  });
});
