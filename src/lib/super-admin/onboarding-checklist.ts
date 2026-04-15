import type { LaunchReportPayload } from "./agency-launch-contracts";

export type ChurchOnboardingChecklistStatus =
  | "complete"
  | "in_progress"
  | "needs_attention";

export type ChurchOnboardingChecklistItem = {
  id: string;
  title: string;
  description: string;
  details: string[];
  status: ChurchOnboardingChecklistStatus;
  actionLabel?: string;
  actionHref?: string;
};

export type ChurchOnboardingChecklist = {
  organizationId: string;
  organizationName: string;
  generatedAt: string;
  readinessScore: number;
  readinessStatus: LaunchReportPayload["readiness"]["status"];
  completionPercent: number;
  completedItems: number;
  totalItems: number;
  topNextAction: string | null;
  items: ChurchOnboardingChecklistItem[];
};

export type BuildChurchOnboardingChecklistInput = {
  organizationId: string;
  organizationName: string;
  hasPlan: boolean;
  memberRoles: Array<"owner" | "admin" | "user">;
  launchReport: LaunchReportPayload;
};

function countRole(memberRoles: Array<"owner" | "admin" | "user">, role: "owner" | "admin" | "user") {
  return memberRoles.filter((memberRole) => memberRole === role).length;
}

function badgeStatusForReadiness(status: LaunchReportPayload["readiness"]["status"]): ChurchOnboardingChecklistStatus {
  if (status === "healthy") return "complete";
  if (status === "degraded") return "in_progress";
  return "needs_attention";
}

function badgeStatusForProviderHealth(
  status: LaunchReportPayload["providerHealth"]["status"]
): ChurchOnboardingChecklistStatus {
  if (status === "configured") return "complete";
  if (status === "partial") return "in_progress";
  return "needs_attention";
}

function badgeStatusForSms(requiredProviderGaps: string[]) {
  const hasSmsGap = requiredProviderGaps.some(
    (gap) =>
      gap === "No active SMS device is assigned" || gap.startsWith("SMS heartbeat is ")
  );

  return hasSmsGap ? ("needs_attention" as const) : ("complete" as const);
}

function badgeStatusForAutomations(
  installedCount: number,
  publishedCount: number
): ChurchOnboardingChecklistStatus {
  if (installedCount === 0) return "needs_attention";
  if (publishedCount === 0) return "in_progress";
  return "complete";
}

export function buildChurchOnboardingChecklist(
  input: BuildChurchOnboardingChecklistInput
): ChurchOnboardingChecklist {
  const ownerCount = countRole(input.memberRoles, "owner");
  const adminCount = countRole(input.memberRoles, "admin");
  const providerHealth = input.launchReport.providerHealth;
  const automationFootprint = input.launchReport.automationFootprint;
  const readiness = input.launchReport.readiness;

  const items: ChurchOnboardingChecklistItem[] = [
    {
      id: "plan",
      title: "Assign a launch plan",
      description: input.hasPlan
        ? "The church already has a plan attached."
        : "Attach the right plan before handing off launch materials.",
      details: input.hasPlan ? ["Plan selected in organization settings."] : ["No plan selected yet."],
      status: input.hasPlan ? "complete" : "needs_attention",
      actionLabel: "Review plan",
      actionHref: "#organization-details",
    },
    {
      id: "leadership",
      title: "Confirm leadership coverage",
      description:
        ownerCount > 0 && adminCount > 0
          ? "Owner and admin coverage is in place for launch handoff."
          : ownerCount > 0
            ? "An owner is present, but no admin backup has been assigned yet."
            : "No owner has been assigned to this church yet.",
      details: [`${ownerCount} owner${ownerCount === 1 ? "" : "s"}`, `${adminCount} admin${adminCount === 1 ? "" : "s"}`],
      status:
        ownerCount > 0 && adminCount > 0
          ? "complete"
          : ownerCount > 0
            ? "in_progress"
            : "needs_attention",
      actionLabel: "Review members",
      actionHref: "#organization-members",
    },
    {
      id: "integrations",
      title: "Confirm Grace integrations",
      description:
        providerHealth.status === "configured"
          ? "Core AI and SMS integrations are fully configured."
          : providerHealth.status === "partial"
            ? "One or more core integrations still need attention."
            : "No core AI or SMS integrations are active yet.",
      details: [providerHealth.summary, ...providerHealth.requiredProviderGaps],
      status: badgeStatusForProviderHealth(providerHealth.status),
      actionLabel: "Open integrations",
      actionHref: `/super-admin/organizations/${input.organizationId}/integrations`,
    },
    {
      id: "sms",
      title: "Verify SMS delivery readiness",
      description:
        badgeStatusForSms(providerHealth.requiredProviderGaps) === "complete"
          ? "The assigned SMS device is healthy enough for launch."
          : "The SMS gateway still needs a device or a fresher heartbeat.",
      details:
        providerHealth.requiredProviderGaps.filter(
          (gap) =>
            gap === "No active SMS device is assigned" ||
            gap.startsWith("SMS heartbeat is ")
        ).length > 0
          ? providerHealth.requiredProviderGaps.filter(
              (gap) =>
                gap === "No active SMS device is assigned" ||
                gap.startsWith("SMS heartbeat is ")
            )
          : ["No SMS-specific gaps detected."],
      status: badgeStatusForSms(providerHealth.requiredProviderGaps),
      actionLabel: "Open integrations",
      actionHref: `/super-admin/organizations/${input.organizationId}/integrations`,
    },
    {
      id: "automations",
      title: "Install a starter automation template",
      description:
        automationFootprint.installedCount > 0
          ? `${automationFootprint.installedCount} template${automationFootprint.installedCount === 1 ? "" : "s"} installed, ${automationFootprint.publishedCount} published.`
          : "No starter automation templates have been installed yet.",
      details: [
        `${automationFootprint.installedCount} installed`,
        `${automationFootprint.publishedCount} published`,
        `${automationFootprint.archivedCount} archived`,
      ],
      status: badgeStatusForAutomations(
        automationFootprint.installedCount,
        automationFootprint.publishedCount
      ),
      actionLabel: "Open automations",
      actionHref: "/super-admin/automations",
    },
    {
      id: "readiness",
      title: "Review launch readiness",
      description:
        readiness.status === "healthy"
          ? `Readiness score is ${input.launchReport.readiness.score}/100 and the church is launch ready.`
          : `Readiness score is ${input.launchReport.readiness.score}/100 with ${readiness.blockingActions.length} blocker${readiness.blockingActions.length === 1 ? "" : "s"}.`,
      details:
        readiness.blockingActions.length > 0
          ? readiness.blockingActions
          : [
              "No blocking actions are currently open.",
              ...input.launchReport.recommendedNextActions.slice(0, 2),
            ],
      status: badgeStatusForReadiness(readiness.status),
      actionLabel: "Export launch report",
      actionHref: `/api/super-admin/organizations/${input.organizationId}/launch-report?format=csv`,
    },
  ];

  const completedItems = items.filter((item) => item.status === "complete").length;
  const totalItems = items.length;

  return {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    generatedAt: input.launchReport.generatedAt,
    readinessScore: input.launchReport.readiness.score,
    readinessStatus: input.launchReport.readiness.status,
    completionPercent: Math.round((completedItems / totalItems) * 100),
    completedItems,
    totalItems,
    topNextAction: input.launchReport.recommendedNextActions[0] ?? null,
    items,
  };
}
