export const AGENCY_HEALTH_MIN_EVENTS = 20;
export const AGENCY_HEALTH_CRITICAL_ERROR_RATE_PERCENT = 40;
export const AGENCY_HEALTH_DEGRADED_ERROR_RATE_PERCENT = 15;
export const AGENCY_HEALTH_CRITICAL_SMS_HEARTBEAT_MINUTES = 60;
export const AGENCY_HEALTH_DEGRADED_SMS_HEARTBEAT_MINUTES = 30;

export type AgencyHealthStatus = "critical" | "degraded" | "healthy";

export type AgencyOrgHealthRow = {
  organizationId: string;
  organizationName: string;
  readinessScore: number;
  providerHealthStatus: "configured" | "partial" | "missing";
  criticalIssuesCount: number;
  aiErrorRate24h: number;
  automationFailures24h: number;
  smsHeartbeatMinutes: number | null;
  nextActionLabel: string;
  nextActionHref: string;
  status: AgencyHealthStatus;
  planName: string | null;
  totalAiEvents24h: number;
};

export type BulkTemplateDeployRequest = {
  templateKey: string;
  organizationIds: string[];
  skipIfInstalled?: boolean;
};

export type BulkTemplateDeployOrgStatus =
  | "installed"
  | "already_installed"
  | "failed";

export type BulkTemplateDeployOrgResult = {
  organizationId: string;
  status: BulkTemplateDeployOrgStatus;
  workflowId?: string;
  error?: string;
};

export type BulkTemplateDeployResult = {
  templateKey: string;
  skipIfInstalled: boolean;
  results: BulkTemplateDeployOrgResult[];
};

export type LaunchReportPayload = {
  organizationId: string;
  organizationName: string;
  generatedAt: string;
  readiness: {
    score: number;
    status: AgencyHealthStatus;
    blockingActions: string[];
  };
  providerHealth: {
    status: "configured" | "partial" | "missing";
    summary: string;
    activeProviders: number;
    requiredProviderGaps: string[];
  };
  automationFootprint: {
    installedCount: number;
    publishedCount: number;
    archivedCount: number;
  };
  operationalReliability7d: {
    aiSuccessRate: number;
    actionErrorRate: number;
    workflowFailures: number;
    totalAiEvents: number;
    totalActionEvents: number;
  };
  recommendedNextActions: string[];
};

export type AgencyHealthClassifyInput = {
  hasProviderGap: boolean;
  smsHeartbeatMinutes: number | null;
  aiErrorRate24h: number;
  totalAiEvents24h: number;
};

export function classifyAgencyHealthStatus(
  input: AgencyHealthClassifyInput
): AgencyHealthStatus {
  const hasEnoughEvents = input.totalAiEvents24h >= AGENCY_HEALTH_MIN_EVENTS;
  const hasCriticalSmsGap =
    input.smsHeartbeatMinutes !== null &&
    input.smsHeartbeatMinutes > AGENCY_HEALTH_CRITICAL_SMS_HEARTBEAT_MINUTES;
  const hasCriticalAiErrorRate =
    hasEnoughEvents &&
    input.aiErrorRate24h >= AGENCY_HEALTH_CRITICAL_ERROR_RATE_PERCENT;

  if (input.hasProviderGap || hasCriticalSmsGap || hasCriticalAiErrorRate) {
    return "critical";
  }

  const hasDegradedSmsGap =
    input.smsHeartbeatMinutes !== null &&
    input.smsHeartbeatMinutes >= AGENCY_HEALTH_DEGRADED_SMS_HEARTBEAT_MINUTES;
  const hasDegradedAiErrorRate =
    hasEnoughEvents &&
    input.aiErrorRate24h >= AGENCY_HEALTH_DEGRADED_ERROR_RATE_PERCENT;

  if (hasDegradedSmsGap || hasDegradedAiErrorRate) {
    return "degraded";
  }

  return "healthy";
}
