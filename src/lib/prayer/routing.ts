export const PRAYER_URGENCY_VALUES = ["normal", "urgent", "critical"] as const;
export const PRAYER_STATUS_VALUES = ["new", "praying", "answered", "archived"] as const;

export type PrayerUrgency = (typeof PRAYER_URGENCY_VALUES)[number];
export type PrayerStatus = (typeof PRAYER_STATUS_VALUES)[number];

export type PrayerEscalationPriority = "none" | "high" | "urgent";

export type PrayerRoutingDecision = {
  urgency: PrayerUrgency;
  assignedTeam: string;
  escalationPriority: PrayerEscalationPriority;
  escalationReason?: string;
};

const DEFAULT_TEAM_BY_URGENCY: Record<PrayerUrgency, string> = {
  normal: "Prayer Team",
  urgent: "Care Team",
  critical: "Pastoral Team",
};

const CRITICAL_ROUTING_PATTERN =
  /\b(suicid|self[- ]harm|abuse|assault|domestic violence|unsafe|emergency|overdose|violence)\b/i;
const URGENT_ROUTING_PATTERN =
  /\b(urgent|asap|right away|immediately|hospital|icu|critical condition|surgery|tonight)\b/i;

export function normalizePrayerUrgency(value: unknown): PrayerUrgency {
  if (typeof value !== "string") return "normal";
  if (value === "urgent" || value === "critical" || value === "normal") {
    return value;
  }
  return "normal";
}

export function normalizePrayerStatus(value: unknown): PrayerStatus {
  if (typeof value !== "string") return "new";
  if (value === "new" || value === "praying" || value === "answered" || value === "archived") {
    return value;
  }
  return "new";
}

export function isPrayerRequestActive(status: PrayerStatus): boolean {
  return status === "new" || status === "praying";
}

export function resolvePrayerRouting(params: {
  content: string;
  urgency?: unknown;
  assignedTeam?: string | null;
}): PrayerRoutingDecision {
  const content = params.content.trim();
  let urgency = normalizePrayerUrgency(params.urgency);

  let escalationReason: string | undefined;
  if (urgency === "normal" && CRITICAL_ROUTING_PATTERN.test(content)) {
    urgency = "critical";
    escalationReason = "Detected crisis language in request content";
  } else if (urgency === "normal" && URGENT_ROUTING_PATTERN.test(content)) {
    urgency = "urgent";
    escalationReason = "Detected urgent language in request content";
  } else if (urgency === "critical") {
    escalationReason = "Request marked critical by user";
  } else if (urgency === "urgent") {
    escalationReason = "Request marked urgent by user";
  }

  const assignedTeam =
    typeof params.assignedTeam === "string" && params.assignedTeam.trim().length > 0
      ? params.assignedTeam.trim()
      : DEFAULT_TEAM_BY_URGENCY[urgency];

  const escalationPriority: PrayerEscalationPriority =
    urgency === "critical" ? "urgent" : urgency === "urgent" ? "high" : "none";

  return {
    urgency,
    assignedTeam,
    escalationPriority,
    escalationReason,
  };
}

export function buildPrayerEscalationTaskMarker(requestId: string): string {
  return `[PrayerRequest:${requestId}]`;
}

export function buildPrayerEscalationTaskTitle(params: {
  requesterName: string;
  urgency: PrayerUrgency;
}): string {
  const prefix = params.urgency === "critical" ? "Critical" : "Urgent";
  return `${prefix} prayer follow-up: ${params.requesterName}`;
}
