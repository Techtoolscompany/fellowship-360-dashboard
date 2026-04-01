import { describe, expect, it } from "vitest";
import { buildChurchOnboardingChecklist } from "../onboarding-checklist";

describe("church onboarding checklist", () => {
  it("derives a completion-ready checklist from launch report data", () => {
    const checklist = buildChurchOnboardingChecklist({
      organizationId: "org_1",
      organizationName: "Grace Church",
      hasPlan: true,
      memberRoles: ["owner", "admin", "user"],
      launchReport: {
        organizationId: "org_1",
        organizationName: "Grace Church",
        generatedAt: "2026-03-19T12:00:00.000Z",
        readiness: {
          score: 94,
          status: "healthy",
          blockingActions: [],
        },
        providerHealth: {
          status: "configured",
          summary: "2 active providers. SMS heartbeat 15m. All required provider checks are green.",
          activeProviders: 2,
          requiredProviderGaps: [],
        },
        automationFootprint: {
          installedCount: 2,
          publishedCount: 1,
          archivedCount: 0,
        },
        operationalReliability7d: {
          aiSuccessRate: 99,
          actionErrorRate: 2,
          workflowFailures: 0,
          totalAiEvents: 30,
          totalActionEvents: 12,
        },
        recommendedNextActions: [
          "Validate org integrations and access",
          "Review readiness trend this week",
        ],
      },
    });

    expect(checklist.completedItems).toBe(checklist.totalItems);
    expect(checklist.completionPercent).toBe(100);
    expect(checklist.readinessStatus).toBe("healthy");
    expect(checklist.topNextAction).toBe("Validate org integrations and access");
    expect(checklist.items.map((item) => item.status)).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
      "complete",
      "complete",
    ]);
  });

  it("marks church onboarding gaps as actionable items", () => {
    const checklist = buildChurchOnboardingChecklist({
      organizationId: "org_2",
      organizationName: "New Hope",
      hasPlan: false,
      memberRoles: ["owner"],
      launchReport: {
        organizationId: "org_2",
        organizationName: "New Hope",
        generatedAt: "2026-03-19T12:00:00.000Z",
        readiness: {
          score: 42,
          status: "critical",
          blockingActions: ["Configure AI provider", "Assign an SMS device"],
        },
        providerHealth: {
          status: "missing",
          summary: "No active providers. No SMS heartbeat available. Gaps: AI provider is not configured; SMS provider is not configured; No active SMS device is assigned.",
          activeProviders: 0,
          requiredProviderGaps: [
            "AI provider is not configured",
            "SMS provider is not configured",
            "No active SMS device is assigned",
          ],
        },
        automationFootprint: {
          installedCount: 0,
          publishedCount: 0,
          archivedCount: 0,
        },
        operationalReliability7d: {
          aiSuccessRate: 0,
          actionErrorRate: 0,
          workflowFailures: 0,
          totalAiEvents: 0,
          totalActionEvents: 0,
        },
        recommendedNextActions: [
          "Configure AI provider",
          "Review readiness trend this week",
        ],
      },
    });

    expect(checklist.completionPercent).toBeLessThan(100);
    expect(checklist.items[0].status).toBe("needs_attention");
    expect(checklist.items[1].status).toBe("in_progress");
    expect(checklist.items[2].status).toBe("needs_attention");
    expect(checklist.items[3].status).toBe("needs_attention");
    expect(checklist.items[4].status).toBe("needs_attention");
    expect(checklist.items[5].status).toBe("needs_attention");
  });
});
