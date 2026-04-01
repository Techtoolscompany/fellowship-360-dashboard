import { db } from "@/db";
import {
  automationWorkflowRuns,
  graceAuditStream,
  organizations,
  plans,
  providerConfigs,
  smsDevices,
} from "@/db/schema";
import { and, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import {
  AGENCY_HEALTH_CRITICAL_ERROR_RATE_PERCENT,
  AGENCY_HEALTH_CRITICAL_SMS_HEARTBEAT_MINUTES,
  AGENCY_HEALTH_DEGRADED_ERROR_RATE_PERCENT,
  AGENCY_HEALTH_DEGRADED_SMS_HEARTBEAT_MINUTES,
  AGENCY_HEALTH_MIN_EVENTS,
  type AgencyOrgHealthRow,
  type AgencyHealthStatus,
  classifyAgencyHealthStatus,
} from "./agency-launch-contracts";

const MS_PER_MINUTE = 60_000;
const HOURS_24_MS = 24 * 60 * MS_PER_MINUTE;

type ProviderHealthStatus = AgencyOrgHealthRow["providerHealthStatus"];

export type AgencyHealthSourceOrgRow = {
  organizationId: string;
  organizationName: string;
  planName: string | null;
};

export type AgencyHealthSourceData = {
  providerConfigs: ReadonlyArray<{
    organizationId: string;
    channel: string;
    provider: string;
    isActive: boolean;
    mode: string;
  }>;
  smsDevices: ReadonlyArray<{
    organizationId: string | null;
    isActive: boolean;
    lastSeenAt: Date | string | null;
  }>;
  graceAuditRows: ReadonlyArray<{
    organizationId: string | null;
    eventType: string;
    status: string;
    createdAt: Date | string;
  }>;
  automationFailures: ReadonlyArray<{
    organizationId: string;
    failedCount: number;
  }>;
  now?: Date;
};

export type AgencyHealthFilters = {
  status?: AgencyHealthStatus | "all";
  search?: string;
  plan?: string;
  organizationIds?: string[];
};

export type AgencyHealthResponse = {
  rows: AgencyOrgHealthRow[];
  planOptions: string[];
  summary: {
    total: number;
    critical: number;
    degraded: number;
    healthy: number;
  };
};

type HealthSignals = {
  providerMissing: boolean;
  heartbeatCritical: boolean;
  heartbeatDegraded: boolean;
  aiCritical: boolean;
  aiDegraded: boolean;
};

function roundOne(value: number) {
  return Number(value.toFixed(1));
}

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function toMinutesSince(date: Date | null, now: Date) {
  if (!date) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / MS_PER_MINUTE));
}

function resolveProviderHealthStatus(input: {
  hasAiProvider: boolean;
  hasSmsProvider: boolean;
  hasActiveSmsDevice: boolean;
}): ProviderHealthStatus {
  const presentCount =
    Number(input.hasAiProvider) + Number(input.hasSmsProvider) + Number(input.hasActiveSmsDevice);

  if (presentCount === 0) {
    return "missing";
  }
  if (presentCount < 3) {
    return "partial";
  }
  return "configured";
}

function computeHealthSignals(params: {
  providerHealthStatus: ProviderHealthStatus;
  smsHeartbeatMinutes: number | null;
  aiErrorRate24h: number;
  totalAiEvents24h: number;
}) {
  const hasEnoughEvents = params.totalAiEvents24h >= AGENCY_HEALTH_MIN_EVENTS;

  const heartbeatCritical =
    params.smsHeartbeatMinutes !== null &&
    params.smsHeartbeatMinutes > AGENCY_HEALTH_CRITICAL_SMS_HEARTBEAT_MINUTES;

  const heartbeatDegraded =
    params.smsHeartbeatMinutes !== null &&
    params.smsHeartbeatMinutes >= AGENCY_HEALTH_DEGRADED_SMS_HEARTBEAT_MINUTES &&
    params.smsHeartbeatMinutes <= AGENCY_HEALTH_CRITICAL_SMS_HEARTBEAT_MINUTES;

  const aiCritical =
    hasEnoughEvents &&
    params.aiErrorRate24h >= AGENCY_HEALTH_CRITICAL_ERROR_RATE_PERCENT;

  const aiDegraded =
    hasEnoughEvents &&
    params.aiErrorRate24h >= AGENCY_HEALTH_DEGRADED_ERROR_RATE_PERCENT &&
    params.aiErrorRate24h < AGENCY_HEALTH_CRITICAL_ERROR_RATE_PERCENT;

  return {
    providerMissing: params.providerHealthStatus !== "configured",
    heartbeatCritical,
    heartbeatDegraded,
    aiCritical,
    aiDegraded,
  } satisfies HealthSignals;
}

export function buildHealthBlockingActions(params: {
  providerHealthStatus: ProviderHealthStatus;
  smsHeartbeatMinutes: number | null;
  aiErrorRate24h: number;
  totalAiEvents24h: number;
  automationFailures24h: number;
}) {
  const signals = computeHealthSignals({
    providerHealthStatus: params.providerHealthStatus,
    smsHeartbeatMinutes: params.smsHeartbeatMinutes,
    aiErrorRate24h: params.aiErrorRate24h,
    totalAiEvents24h: params.totalAiEvents24h,
  });

  const blockers: string[] = [];

  if (signals.providerMissing) {
    blockers.push("Restore required AI/SMS providers or SMS device");
  }
  if (signals.heartbeatCritical) {
    blockers.push("Restore SMS gateway heartbeat to under 60 minutes");
  }
  if (signals.aiCritical) {
    blockers.push("Reduce AI/action error rate below 40% (24h)");
  }
  if (params.automationFailures24h > 0) {
    blockers.push(`Resolve ${params.automationFailures24h} automation failures (24h)`);
  }

  return blockers;
}

export function computeReadinessScore(params: {
  providerHealthStatus: ProviderHealthStatus;
  smsHeartbeatMinutes: number | null;
  aiErrorRate24h: number;
  totalAiEvents24h: number;
  automationFailures24h: number;
}) {
  let score = 100;

  if (params.providerHealthStatus === "missing") {
    score -= 35;
  } else if (params.providerHealthStatus === "partial") {
    score -= 20;
  }

  if (params.smsHeartbeatMinutes === null) {
    score -= 10;
  } else if (params.smsHeartbeatMinutes > AGENCY_HEALTH_CRITICAL_SMS_HEARTBEAT_MINUTES) {
    score -= 30;
  } else if (params.smsHeartbeatMinutes >= AGENCY_HEALTH_DEGRADED_SMS_HEARTBEAT_MINUTES) {
    score -= 15;
  }

  if (params.totalAiEvents24h >= AGENCY_HEALTH_MIN_EVENTS) {
    if (params.aiErrorRate24h >= AGENCY_HEALTH_CRITICAL_ERROR_RATE_PERCENT) {
      score -= 25;
    } else if (params.aiErrorRate24h >= AGENCY_HEALTH_DEGRADED_ERROR_RATE_PERCENT) {
      score -= 12;
    }
  }

  score -= Math.min(20, params.automationFailures24h * 5);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildAgencyOrgHealthRow(input: {
  organizationId: string;
  organizationName: string;
  planName: string | null;
  providerConfigs: AgencyHealthSourceData["providerConfigs"];
  smsDevices: AgencyHealthSourceData["smsDevices"];
  graceAuditRows: AgencyHealthSourceData["graceAuditRows"];
  automationFailures: AgencyHealthSourceData["automationFailures"];
  now?: Date;
}): AgencyOrgHealthRow {
  const now = input.now ?? new Date();
  const providerStats = input.providerConfigs.filter(
    (row) =>
      row.organizationId === input.organizationId &&
      row.isActive &&
      row.mode !== "disabled"
  );
  const hasAiProvider = providerStats.some(
    (row) => row.channel === "ai" && row.provider === "gemini"
  );
  const hasSmsProvider = providerStats.some(
    (row) => row.channel === "sms" && row.provider === "textbee"
  );
  const activeSmsDevices = input.smsDevices.filter(
    (row) => row.organizationId === input.organizationId && row.isActive
  );
  const lastSeenAt = activeSmsDevices
    .map((row) => row.lastSeenAt)
    .filter((value): value is Date | string => Boolean(value))
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const smsHeartbeatMinutes =
    activeSmsDevices.length > 0
      ? toMinutesSince(lastSeenAt, now) ?? 9999
      : null;

  const aiRows = input.graceAuditRows.filter(
    (row) =>
      row.organizationId === input.organizationId &&
      row.eventType !== "workflow_execution" &&
      (toTimestamp(row.createdAt) ?? 0) >= now.getTime() - HOURS_24_MS
  );
  const totalAiEvents24h = aiRows.length;
  const errorCount24h = aiRows.filter((row) => row.status === "error").length;
  const aiErrorRate24h =
    totalAiEvents24h > 0 ? roundOne((errorCount24h / totalAiEvents24h) * 100) : 0;
  const automationFailures24h =
    input.automationFailures.find((row) => row.organizationId === input.organizationId)
      ?.failedCount ?? 0;

  const providerHealthStatus = resolveProviderHealthStatus({
    hasAiProvider,
    hasSmsProvider,
    hasActiveSmsDevice: activeSmsDevices.length > 0,
  });

  const readinessScore = computeReadinessScore({
    providerHealthStatus,
    smsHeartbeatMinutes,
    aiErrorRate24h,
    totalAiEvents24h,
    automationFailures24h,
  });

  const status = classifyAgencyHealthStatus({
    hasProviderGap: providerHealthStatus !== "configured",
    smsHeartbeatMinutes,
    aiErrorRate24h,
    totalAiEvents24h,
  });

  const signals = computeHealthSignals({
    providerHealthStatus,
    smsHeartbeatMinutes,
    aiErrorRate24h,
    totalAiEvents24h,
  });

  const criticalIssuesCount =
    Number(!hasAiProvider) +
    Number(!hasSmsProvider) +
    Number(activeSmsDevices.length === 0) +
    Number(signals.heartbeatCritical) +
    Number(signals.aiCritical) +
    Number(automationFailures24h > 0);

  const nextAction = buildNextAction({
    organizationId: input.organizationId,
    providerHealthStatus,
    smsHeartbeatMinutes,
    aiErrorRate24h,
    totalAiEvents24h,
    automationFailures24h,
  });

  return {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    readinessScore,
    providerHealthStatus,
    criticalIssuesCount,
    aiErrorRate24h,
    automationFailures24h,
    smsHeartbeatMinutes,
    nextActionLabel: nextAction.nextActionLabel,
    nextActionHref: nextAction.nextActionHref,
    status,
    planName: input.planName ?? "No Plan",
    totalAiEvents24h,
  };
}

export function buildAgencyOrgHealthRows(
  orgRows: ReadonlyArray<AgencyHealthSourceOrgRow>,
  sourceData: AgencyHealthSourceData
) {
  return orgRows
    .map((org) =>
      buildAgencyOrgHealthRow({
        organizationId: org.organizationId,
        organizationName: org.organizationName,
        planName: org.planName,
        providerConfigs: sourceData.providerConfigs,
        smsDevices: sourceData.smsDevices,
        graceAuditRows: sourceData.graceAuditRows,
        automationFailures: sourceData.automationFailures,
        now: sourceData.now,
      })
    )
    .sort((a, b) => {
      const rank = { critical: 0, degraded: 1, healthy: 2 } as const;
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      if (a.readinessScore !== b.readinessScore) {
        return a.readinessScore - b.readinessScore;
      }
      if (a.criticalIssuesCount !== b.criticalIssuesCount) {
        return b.criticalIssuesCount - a.criticalIssuesCount;
      }
      return a.organizationName.localeCompare(b.organizationName);
    });
}

function buildNextAction(row: {
  organizationId: string;
  providerHealthStatus: ProviderHealthStatus;
  smsHeartbeatMinutes: number | null;
  aiErrorRate24h: number;
  totalAiEvents24h: number;
  automationFailures24h: number;
}) {
  const baseOrgPath = `/super-admin/organizations/${row.organizationId}`;

  if (row.providerHealthStatus === "missing") {
    return {
      nextActionLabel: "Configure provider",
      nextActionHref: `${baseOrgPath}/integrations`,
    };
  }

  if (
    row.smsHeartbeatMinutes !== null &&
    row.smsHeartbeatMinutes >= AGENCY_HEALTH_DEGRADED_SMS_HEARTBEAT_MINUTES
  ) {
    return {
      nextActionLabel: "Check SMS device",
      nextActionHref: `${baseOrgPath}/integrations`,
    };
  }

  if (
    row.totalAiEvents24h >= AGENCY_HEALTH_MIN_EVENTS &&
    row.aiErrorRate24h >= AGENCY_HEALTH_DEGRADED_ERROR_RATE_PERCENT
  ) {
    return {
      nextActionLabel: "Review launch checklist",
      nextActionHref: `${baseOrgPath}#organization-checklist`,
    };
  }

  if (row.automationFailures24h > 0) {
    return {
      nextActionLabel: "Open organization",
      nextActionHref: baseOrgPath,
    };
  }

  return {
    nextActionLabel: "View details",
    nextActionHref: baseOrgPath,
  };
}

function statusPriority(status: AgencyHealthStatus) {
  if (status === "critical") return 0;
  if (status === "degraded") return 1;
  return 2;
}

export async function getAgencyHealthBoardData(
  filters: AgencyHealthFilters = {}
): Promise<AgencyHealthResponse> {
  const now = new Date();
  const since24h = new Date(now.getTime() - HOURS_24_MS);
  const search = filters.search?.trim() ?? "";
  const requestedPlan = filters.plan?.trim() ?? "";

  const organizationFilters = [];
  if (search) {
    organizationFilters.push(
      or(
        ilike(organizations.name, `%${search}%`),
        ilike(organizations.slug, `%${search}%`)
      )
    );
  }
  if (filters.organizationIds && filters.organizationIds.length > 0) {
    organizationFilters.push(inArray(organizations.id, filters.organizationIds));
  }

  const organizationRows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      planName: plans.name,
    })
    .from(organizations)
    .leftJoin(plans, eq(organizations.planId, plans.id))
    .where(organizationFilters.length > 0 ? and(...organizationFilters) : undefined);

  const planOptions = Array.from(
    new Set(organizationRows.map((row) => row.planName ?? "No Plan"))
  ).sort((a, b) => a.localeCompare(b));

  const organizationRowsAfterPlanFilter =
    requestedPlan && requestedPlan !== "all"
      ? organizationRows.filter((row) => (row.planName ?? "No Plan") === requestedPlan)
      : organizationRows;

  if (organizationRowsAfterPlanFilter.length === 0) {
    return {
      rows: [],
      planOptions,
      summary: { total: 0, critical: 0, degraded: 0, healthy: 0 },
    };
  }

  const organizationIds = organizationRowsAfterPlanFilter.map((row) => row.id);

  const [providerStatsRows, smsStatsRows, aiStatsRows, automationFailureRows] = await Promise.all([
    db
      .select({
        organizationId: providerConfigs.organizationId,
        activeAiProviders:
          sql<number>`count(*) filter (where ${providerConfigs.channel} = 'ai' and ${providerConfigs.provider} = 'gemini' and ${providerConfigs.isActive} = true and ${providerConfigs.mode} <> 'disabled')`,
        activeSmsProviders:
          sql<number>`count(*) filter (where ${providerConfigs.channel} = 'sms' and ${providerConfigs.provider} = 'textbee' and ${providerConfigs.isActive} = true and ${providerConfigs.mode} <> 'disabled')`,
      })
      .from(providerConfigs)
      .where(inArray(providerConfigs.organizationId, organizationIds))
      .groupBy(providerConfigs.organizationId),
    db
      .select({
        organizationId: smsDevices.organizationId,
        activeSmsDevices: sql<number>`count(*)`,
        lastSeenAt: sql<Date | null>`max(${smsDevices.lastSeenAt})`,
      })
      .from(smsDevices)
      .where(
        and(
          inArray(smsDevices.organizationId, organizationIds),
          eq(smsDevices.isActive, true)
        )
      )
      .groupBy(smsDevices.organizationId),
    db
      .select({
        organizationId: graceAuditStream.organizationId,
        total: sql<number>`count(*)`,
        errors: sql<number>`count(*) filter (where ${graceAuditStream.status} = 'error')`,
      })
      .from(graceAuditStream)
      .where(
        and(
          inArray(graceAuditStream.organizationId, organizationIds),
          gte(graceAuditStream.createdAt, since24h),
          inArray(graceAuditStream.eventType, ["ai_decision", "action_execution"])
        )
      )
      .groupBy(graceAuditStream.organizationId),
    db
      .select({
        organizationId: automationWorkflowRuns.organizationId,
        failedRuns: sql<number>`count(*)`,
      })
      .from(automationWorkflowRuns)
      .where(
        and(
          inArray(automationWorkflowRuns.organizationId, organizationIds),
          eq(automationWorkflowRuns.status, "failed"),
          gte(automationWorkflowRuns.enteredAt, since24h)
        )
      )
      .groupBy(automationWorkflowRuns.organizationId),
  ]);

  const providerStatsMap = new Map(
    providerStatsRows.map((row) => [
      row.organizationId,
      {
        hasAiProvider: Number(row.activeAiProviders ?? 0) > 0,
        hasSmsProvider: Number(row.activeSmsProviders ?? 0) > 0,
      },
    ])
  );
  const smsStatsMap = new Map(
    smsStatsRows.map((row) => [
      row.organizationId,
      {
        activeSmsDevices: Number(row.activeSmsDevices ?? 0),
        lastSeenAt: row.lastSeenAt,
      },
    ])
  );
  const aiStatsMap = new Map(
    aiStatsRows.map((row) => [
      row.organizationId,
      {
        total: Number(row.total ?? 0),
        errors: Number(row.errors ?? 0),
      },
    ])
  );
  const automationFailuresMap = new Map(
    automationFailureRows.map((row) => [row.organizationId, Number(row.failedRuns ?? 0)])
  );

  const rows = organizationRowsAfterPlanFilter.map<AgencyOrgHealthRow>((organization) => {
    const providerStats = providerStatsMap.get(organization.id) ?? {
      hasAiProvider: false,
      hasSmsProvider: false,
    };
    const providerHealthStatus = resolveProviderHealthStatus(
      {
        hasAiProvider: providerStats.hasAiProvider,
        hasSmsProvider: providerStats.hasSmsProvider,
        hasActiveSmsDevice: (smsStatsMap.get(organization.id)?.activeSmsDevices ?? 0) > 0,
      }
    );

    const smsStats = smsStatsMap.get(organization.id) ?? {
      activeSmsDevices: 0,
      lastSeenAt: null as Date | null,
    };
    const smsHeartbeatMinutes =
      smsStats.activeSmsDevices > 0
        ? toMinutesSince(smsStats.lastSeenAt, now) ?? 9999
        : null;

    const aiStats = aiStatsMap.get(organization.id) ?? { total: 0, errors: 0 };
    const aiErrorRate24h =
      aiStats.total > 0 ? roundOne((aiStats.errors / aiStats.total) * 100) : 0;
    const automationFailures24h = automationFailuresMap.get(organization.id) ?? 0;

    const readinessScore = computeReadinessScore({
      providerHealthStatus,
      smsHeartbeatMinutes,
      aiErrorRate24h,
      totalAiEvents24h: aiStats.total,
      automationFailures24h,
    });

    const status = classifyAgencyHealthStatus({
      hasProviderGap: providerHealthStatus !== "configured",
      smsHeartbeatMinutes,
      aiErrorRate24h,
      totalAiEvents24h: aiStats.total,
    });

    const signals = computeHealthSignals({
      providerHealthStatus,
      smsHeartbeatMinutes,
      aiErrorRate24h,
      totalAiEvents24h: aiStats.total,
    });

    const criticalIssuesCount =
      Number(providerStats.hasAiProvider === false) +
      Number(providerStats.hasSmsProvider === false) +
      Number((smsStats.activeSmsDevices ?? 0) === 0) +
      Number(signals.heartbeatCritical) +
      Number(signals.aiCritical) +
      Number(automationFailures24h > 0);

    const nextAction = buildNextAction({
      organizationId: organization.id,
      providerHealthStatus,
      smsHeartbeatMinutes,
      aiErrorRate24h,
      totalAiEvents24h: aiStats.total,
      automationFailures24h,
    });

    return {
      organizationId: organization.id,
      organizationName: organization.name,
      readinessScore,
      providerHealthStatus,
      criticalIssuesCount,
      aiErrorRate24h,
      automationFailures24h,
      smsHeartbeatMinutes,
      nextActionLabel: nextAction.nextActionLabel,
      nextActionHref: nextAction.nextActionHref,
      status,
      planName: organization.planName ?? "No Plan",
      totalAiEvents24h: aiStats.total,
    };
  });

  const statusFilter = filters.status ?? "all";
  const filteredRows =
    statusFilter === "all" ? rows : rows.filter((row) => row.status === statusFilter);

  filteredRows.sort((a, b) => {
    const statusDelta = statusPriority(a.status) - statusPriority(b.status);
    if (statusDelta !== 0) return statusDelta;
    if (a.readinessScore !== b.readinessScore) return a.readinessScore - b.readinessScore;
    if (a.criticalIssuesCount !== b.criticalIssuesCount) {
      return b.criticalIssuesCount - a.criticalIssuesCount;
    }
    return a.organizationName.localeCompare(b.organizationName);
  });

  return {
    rows: filteredRows,
    planOptions,
    summary: {
      total: filteredRows.length,
      critical: filteredRows.filter((row) => row.status === "critical").length,
      degraded: filteredRows.filter((row) => row.status === "degraded").length,
      healthy: filteredRows.filter((row) => row.status === "healthy").length,
    },
  };
}
