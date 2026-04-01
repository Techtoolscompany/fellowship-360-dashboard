import { db } from "@/db";
import {
  automationWorkflows,
  automationWorkflowRuns,
  graceAuditStream,
  organizations,
  plans,
  providerConfigs,
  smsDevices,
} from "@/db/schema";
import { and, eq, gte, inArray } from "drizzle-orm";
import { buildAgencyOrgHealthRows } from "./agency-health";
import {
  AGENCY_HEALTH_CRITICAL_ERROR_RATE_PERCENT,
  AGENCY_HEALTH_CRITICAL_SMS_HEARTBEAT_MINUTES,
  AGENCY_HEALTH_DEGRADED_ERROR_RATE_PERCENT,
  type LaunchReportPayload,
} from "./agency-launch-contracts";

type LaunchReportProviderConfigRow = {
  organizationId: string;
  channel: string;
  provider: string;
  isActive: boolean;
  mode: string;
};

type LaunchReportSmsDeviceRow = {
  organizationId: string;
  isActive: boolean;
  lastSeenAt: Date | string | null;
};

type LaunchReportGraceAuditRow = {
  organizationId: string;
  eventType: "ai_decision" | "action_execution";
  status: string;
  createdAt: Date | string;
};

type LaunchReportWorkflowRunRow = {
  organizationId: string;
  status: string;
  enteredAt: Date | string;
};

type LaunchReportWorkflowRow = {
  organizationId: string;
  status: "draft" | "published" | "paused" | "archived";
  mode: "template" | "builder";
  templateKey: string | null;
};

type LaunchReportSource = {
  organization: {
    organizationId: string;
    organizationName: string;
    planName: string | null;
  };
  providerConfigs: ReadonlyArray<LaunchReportProviderConfigRow>;
  smsDevices: ReadonlyArray<LaunchReportSmsDeviceRow>;
  graceAuditRows: ReadonlyArray<LaunchReportGraceAuditRow>;
  workflowRuns: ReadonlyArray<LaunchReportWorkflowRunRow>;
  automationWorkflows: ReadonlyArray<LaunchReportWorkflowRow>;
  now?: Date;
};

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function dedupe(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function countActiveProviders(
  providerConfigs: ReadonlyArray<LaunchReportProviderConfigRow>
) {
  return providerConfigs.filter(
    (row) => row.isActive && row.mode !== "disabled"
  ).length;
}

function hasActiveProvider(
  providerConfigs: ReadonlyArray<LaunchReportProviderConfigRow>,
  channel: string,
  provider: string
) {
  return providerConfigs.some(
    (row) =>
      row.channel === channel &&
      row.provider === provider &&
      row.isActive &&
      row.mode !== "disabled"
  );
}

function computeSmsHeartbeatMinutes(
  smsDevices: ReadonlyArray<LaunchReportSmsDeviceRow>,
  now: Date
) {
  const activeDevices = smsDevices.filter((device) => device.isActive);
  const heartbeats = activeDevices
    .map((device) => {
      const timestamp = toTimestamp(device.lastSeenAt);
      if (timestamp === null) return null;
      return Math.max(0, Math.floor((now.getTime() - timestamp) / 60_000));
    })
    .filter((value): value is number => value !== null);

  return heartbeats.length > 0 ? Math.min(...heartbeats) : null;
}

function buildRequiredProviderGaps(input: {
  providerConfigs: ReadonlyArray<LaunchReportProviderConfigRow>;
  smsDevices: ReadonlyArray<LaunchReportSmsDeviceRow>;
  smsHeartbeatMinutes: number | null;
}) {
  const gaps: string[] = [];
  const hasAiProvider = hasActiveProvider(
    input.providerConfigs,
    "ai",
    "gemini"
  );
  const hasSmsProvider = hasActiveProvider(
    input.providerConfigs,
    "sms",
    "textbee"
  );
  const hasActiveSmsDevice = input.smsDevices.some((device) => device.isActive);

  if (!hasAiProvider) {
    gaps.push("AI provider is not configured");
  }
  if (!hasSmsProvider) {
    gaps.push("SMS provider is not configured");
  }
  if (!hasActiveSmsDevice) {
    gaps.push("No active SMS device is assigned");
  } else if (
    input.smsHeartbeatMinutes !== null &&
    input.smsHeartbeatMinutes > AGENCY_HEALTH_CRITICAL_SMS_HEARTBEAT_MINUTES
  ) {
    gaps.push(`SMS heartbeat is ${input.smsHeartbeatMinutes} minutes old`);
  }

  return dedupe(gaps);
}

function buildProviderSummary(input: {
  providerHealthStatus: "configured" | "partial" | "missing";
  requiredProviderGaps: string[];
  smsHeartbeatMinutes: number | null;
  activeProviders: number;
}) {
  const parts: string[] = [];

  if (input.activeProviders > 0) {
    parts.push(`${input.activeProviders} active provider${input.activeProviders === 1 ? "" : "s"}`);
  } else {
    parts.push("No active providers");
  }

  if (input.smsHeartbeatMinutes !== null) {
    parts.push(`SMS heartbeat ${input.smsHeartbeatMinutes}m`);
  } else {
    parts.push("No SMS heartbeat available");
  }

  if (input.requiredProviderGaps.length > 0) {
    parts.push(`Gaps: ${input.requiredProviderGaps.join("; ")}`);
  } else if (input.providerHealthStatus === "configured") {
    parts.push("All required provider checks are green");
  }

  return parts.join(". ") + ".";
}

function buildBlockingActions(input: {
  nextActionLabel: string;
  requiredProviderGaps: string[];
  aiErrorRate24h: number;
  totalAiEvents24h: number;
  automationFailures24h: number;
  workflowFailures7d: number;
}) {
  const actions: string[] = [input.nextActionLabel];

  for (const gap of input.requiredProviderGaps) {
    if (gap === "AI provider is not configured") {
      actions.push("Configure AI provider");
    } else if (gap === "SMS provider is not configured") {
      actions.push("Configure SMS provider");
    } else if (gap === "No active SMS device is assigned") {
      actions.push("Assign an SMS device");
    } else if (gap.startsWith("SMS heartbeat is ")) {
      actions.push("Refresh SMS device heartbeat");
    }
  }

  if (
    input.totalAiEvents24h >= 20 &&
    input.aiErrorRate24h >= AGENCY_HEALTH_CRITICAL_ERROR_RATE_PERCENT
  ) {
    actions.push("Review AI and action failures");
  } else if (
    input.totalAiEvents24h >= 20 &&
    input.aiErrorRate24h >= AGENCY_HEALTH_DEGRADED_ERROR_RATE_PERCENT
  ) {
    actions.push("Review elevated AI and action errors");
  }

  if (input.automationFailures24h > 0 || input.workflowFailures7d > 0) {
    actions.push("Review automation failures");
  }

  return dedupe(actions);
}

function buildRecommendedActions(input: {
  blockingActions: string[];
  installedCount: number;
  publishedCount: number;
  aiSuccessRate: number;
  actionErrorRate: number;
  workflowFailures7d: number;
}) {
  const actions: string[] = [];

  if (input.blockingActions[0]) {
    actions.push(input.blockingActions[0]);
  }

  if (input.workflowFailures7d > 0) {
    actions.push("Review failed workflow runs from the last 7 days");
  }

  if (input.publishedCount === 0) {
    actions.push("Publish the first automation template");
  }

  if (input.actionErrorRate > 10) {
    actions.push("Inspect action execution errors");
  }

  if (input.aiSuccessRate < 95) {
    actions.push("Tune AI prompts and guardrails");
  }

  if (input.installedCount === 0) {
    actions.push("Install a proven automation template");
  }

  if (actions.length < 3) {
    actions.push("Review readiness trend this week");
    actions.push("Validate org integrations and access");
  }

  return dedupe(actions).slice(0, 3);
}

function build7DayReliability(input: {
  graceAuditRows: ReadonlyArray<LaunchReportGraceAuditRow>;
  workflowRuns: ReadonlyArray<LaunchReportWorkflowRunRow>;
  now: Date;
}) {
  const lookbackStart = input.now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const aiRows = input.graceAuditRows.filter(
    (row) => row.eventType === "ai_decision" && (toTimestamp(row.createdAt) ?? 0) >= lookbackStart
  );
  const actionRows = input.graceAuditRows.filter(
    (row) =>
      row.eventType === "action_execution" && (toTimestamp(row.createdAt) ?? 0) >= lookbackStart
  );

  const aiSuccesses = aiRows.filter((row) => row.status === "success").length;
  const actionFailures = actionRows.filter((row) => row.status === "error").length;

  const aiSuccessRate =
    aiRows.length > 0
      ? Number(((aiSuccesses / aiRows.length) * 100).toFixed(1))
      : 0;
  const actionErrorRate =
    actionRows.length > 0
      ? Number(((actionFailures / actionRows.length) * 100).toFixed(1))
      : 0;

  return {
    aiSuccessRate,
    actionErrorRate,
    workflowFailures: input.workflowRuns.filter(
      (run) => (toTimestamp(run.enteredAt) ?? 0) >= lookbackStart
    ).length,
    totalAiEvents: aiRows.length,
    totalActionEvents: actionRows.length,
  };
}

function getAutomationFootprint(input: {
  automationWorkflows: ReadonlyArray<LaunchReportWorkflowRow>;
}) {
  const installedCount = input.automationWorkflows.filter(
    (workflow) => workflow.mode === "template" && workflow.status !== "archived"
  ).length;

  const publishedCount = input.automationWorkflows.filter(
    (workflow) => workflow.status === "published"
  ).length;

  const archivedCount = input.automationWorkflows.filter(
    (workflow) => workflow.status === "archived"
  ).length;

  return {
    installedCount,
    publishedCount,
    archivedCount,
  };
}

export function buildLaunchReportPayload(input: LaunchReportSource): LaunchReportPayload {
  const now = input.now ?? new Date();
  const lookbackStart = now.getTime() - 24 * 60 * 60 * 1000;
  const activeProviders = countActiveProviders(input.providerConfigs);
  const smsHeartbeatMinutes = computeSmsHeartbeatMinutes(input.smsDevices, now);
  const requiredProviderGaps = buildRequiredProviderGaps({
    providerConfigs: input.providerConfigs,
    smsDevices: input.smsDevices,
    smsHeartbeatMinutes,
  });
  const providerHealthStatus =
    requiredProviderGaps.length === 0
      ? "configured"
      : requiredProviderGaps.length >= 3
        ? "missing"
        : "partial";

  const [healthRow] = buildAgencyOrgHealthRows(
    [
      {
        organizationId: input.organization.organizationId,
        organizationName: input.organization.organizationName,
        planName: input.organization.planName,
      },
    ],
    {
      providerConfigs: input.providerConfigs,
      smsDevices: input.smsDevices,
      graceAuditRows: input.graceAuditRows.filter(
        (row) => (toTimestamp(row.createdAt) ?? 0) >= lookbackStart
      ),
      automationFailures: [
        {
          organizationId: input.organization.organizationId,
          failedCount: input.workflowRuns.filter(
            (run) => (toTimestamp(run.enteredAt) ?? 0) >= lookbackStart
          ).length,
        },
      ],
      now,
    }
  );

  const automationFootprint = getAutomationFootprint({
    automationWorkflows: input.automationWorkflows,
  });
  const reliability = build7DayReliability({
    graceAuditRows: input.graceAuditRows,
    workflowRuns: input.workflowRuns,
    now,
  });
  const blockingActions = buildBlockingActions({
    nextActionLabel: healthRow.nextActionLabel,
    requiredProviderGaps,
    aiErrorRate24h: healthRow.aiErrorRate24h,
    totalAiEvents24h: healthRow.totalAiEvents24h,
    automationFailures24h: healthRow.automationFailures24h,
    workflowFailures7d: reliability.workflowFailures,
  });

  return {
    organizationId: input.organization.organizationId,
    organizationName: input.organization.organizationName,
    generatedAt: now.toISOString(),
    readiness: {
      score: healthRow.readinessScore,
      status: healthRow.status,
      blockingActions,
    },
    providerHealth: {
      status: providerHealthStatus,
      summary: buildProviderSummary({
        providerHealthStatus,
        requiredProviderGaps,
        smsHeartbeatMinutes,
        activeProviders,
      }),
      activeProviders,
      requiredProviderGaps,
    },
    automationFootprint,
    operationalReliability7d: reliability,
    recommendedNextActions: buildRecommendedActions({
      blockingActions,
      installedCount: automationFootprint.installedCount,
      publishedCount: automationFootprint.publishedCount,
      aiSuccessRate: reliability.aiSuccessRate,
      actionErrorRate: reliability.actionErrorRate,
      workflowFailures7d: reliability.workflowFailures,
    }),
  };
}

function escapeCsvCell(value: string | number | null | undefined) {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[,"\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function joinList(values: string[]) {
  return values.length > 0 ? values.join("; ") : "";
}

export function formatLaunchReportCsv(report: LaunchReportPayload) {
  const headers = [
    "organizationId",
    "organizationName",
    "generatedAt",
    "readinessScore",
    "readinessStatus",
    "blockingActions",
    "providerHealthStatus",
    "providerHealthSummary",
    "activeProviders",
    "requiredProviderGaps",
    "installedCount",
    "publishedCount",
    "archivedCount",
    "aiSuccessRate",
    "actionErrorRate",
    "workflowFailures",
    "totalAiEvents",
    "totalActionEvents",
    "recommendedNextActions",
  ];

  const row = [
    report.organizationId,
    report.organizationName,
    report.generatedAt,
    report.readiness.score,
    report.readiness.status,
    joinList(report.readiness.blockingActions),
    report.providerHealth.status,
    report.providerHealth.summary,
    report.providerHealth.activeProviders,
    joinList(report.providerHealth.requiredProviderGaps),
    report.automationFootprint.installedCount,
    report.automationFootprint.publishedCount,
    report.automationFootprint.archivedCount,
    report.operationalReliability7d.aiSuccessRate,
    report.operationalReliability7d.actionErrorRate,
    report.operationalReliability7d.workflowFailures,
    report.operationalReliability7d.totalAiEvents,
    report.operationalReliability7d.totalActionEvents,
    joinList(report.recommendedNextActions),
  ].map(escapeCsvCell);

  return `${headers.join(",")}\n${row.join(",")}\n`;
}

function buildLaunchReportFilename(report: LaunchReportPayload) {
  const safeName = report.organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const date = report.generatedAt.slice(0, 10);
  return `launch-report-${safeName || report.organizationId}-${date}.csv`;
}

export async function getLaunchReportForOrganization(organizationId: string) {
  const now = new Date();
  const lookback7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [organization] = await db
    .select({
      organizationId: organizations.id,
      organizationName: organizations.name,
      planName: plans.name,
    })
    .from(organizations)
    .leftJoin(plans, eq(organizations.planId, plans.id))
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const [
    providerConfigRows,
    smsDeviceRowsRaw,
    graceAuditRowsRaw,
    workflowRunRowsRaw,
    workflowRows,
  ] = await Promise.all([
      db
        .select({
          organizationId: providerConfigs.organizationId,
          channel: providerConfigs.channel,
          provider: providerConfigs.provider,
          isActive: providerConfigs.isActive,
          mode: providerConfigs.mode,
        })
        .from(providerConfigs)
        .where(eq(providerConfigs.organizationId, organizationId)),
      db
        .select({
          organizationId: smsDevices.organizationId,
          isActive: smsDevices.isActive,
          lastSeenAt: smsDevices.lastSeenAt,
        })
        .from(smsDevices)
        .where(eq(smsDevices.organizationId, organizationId)),
      db
        .select({
          organizationId: graceAuditStream.organizationId,
          eventType: graceAuditStream.eventType,
          status: graceAuditStream.status,
          createdAt: graceAuditStream.createdAt,
        })
        .from(graceAuditStream)
        .where(
          and(
            eq(graceAuditStream.organizationId, organizationId),
            gte(graceAuditStream.createdAt, lookback7d),
            inArray(graceAuditStream.eventType, ["ai_decision", "action_execution"])
          )
        ),
      db
        .select({
          organizationId: automationWorkflowRuns.organizationId,
          status: automationWorkflowRuns.status,
          enteredAt: automationWorkflowRuns.enteredAt,
        })
        .from(automationWorkflowRuns)
        .where(
          and(
            eq(automationWorkflowRuns.organizationId, organizationId),
            eq(automationWorkflowRuns.status, "failed"),
            gte(automationWorkflowRuns.enteredAt, lookback7d)
          )
        ),
      db
        .select({
          organizationId: automationWorkflows.organizationId,
          status: automationWorkflows.status,
          mode: automationWorkflows.mode,
          templateKey: automationWorkflows.templateKey,
        })
        .from(automationWorkflows)
        .where(eq(automationWorkflows.organizationId, organizationId)),
    ]);

  const smsDeviceRows: LaunchReportSmsDeviceRow[] = smsDeviceRowsRaw.map((row) => ({
    organizationId: row.organizationId ?? organizationId,
    isActive: row.isActive,
    lastSeenAt: row.lastSeenAt,
  }));

  const graceAuditRows: LaunchReportGraceAuditRow[] = graceAuditRowsRaw.map((row) => ({
    organizationId: row.organizationId,
    eventType:
      (row.eventType === "workflow_execution" ? "action_execution" : row.eventType) as
        | "ai_decision"
        | "action_execution",
    status: row.status,
    createdAt: row.createdAt,
  }));

  const workflowRunRows: LaunchReportWorkflowRunRow[] = workflowRunRowsRaw.map((row) => ({
    organizationId: row.organizationId,
    status: "failed",
    enteredAt: row.enteredAt,
  }));

  return buildLaunchReportPayload({
    organization: {
      organizationId: organization.organizationId,
      organizationName: organization.organizationName,
      planName: organization.planName ?? null,
    },
    providerConfigs: providerConfigRows,
    smsDevices: smsDeviceRows,
    graceAuditRows,
    workflowRuns: workflowRunRows,
    automationWorkflows: workflowRows,
    now,
  });
}

export async function getLaunchReportCsv(organizationId: string) {
  const report = await getLaunchReportForOrganization(organizationId);
  return {
    report,
    csv: formatLaunchReportCsv(report),
    filename: buildLaunchReportFilename(report),
  };
}
