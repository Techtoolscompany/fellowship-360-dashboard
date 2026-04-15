import { normalizeContactPhone } from "@/lib/operations/contacts-lifecycle";

export type GraceSmsSessionCandidateMessage = {
  sessionId: string;
  metadataJson: Record<string, unknown> | null;
};

export type GraceSmsSessionCandidate = {
  id: string;
  status: "open" | "closed" | "escalated";
};

export function normalizeSmsThreadPhone(value: string | null | undefined) {
  const normalized = normalizeContactPhone(value);
  if (!normalized) return null;
  return normalized.length > 10 ? normalized.slice(-10) : normalized;
}

export function getThreadPhoneFromMetadata(
  metadata: Record<string, unknown> | null | undefined
) {
  if (!metadata || typeof metadata !== "object") return null;

  const candidates = [
    metadata.normalizedFromNumber,
    metadata.fromNumber,
    metadata.fromPhone,
    metadata.phone,
  ];

  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const normalized = normalizeSmsThreadPhone(value);
    if (normalized) return normalized;
  }

  return null;
}

export function selectReusableSmsGraceSessionId(params: {
  fromNumber?: string | null;
  recentMessages: GraceSmsSessionCandidateMessage[];
  sessions: GraceSmsSessionCandidate[];
}) {
  const targetPhone = normalizeSmsThreadPhone(params.fromNumber);
  if (!targetPhone) {
    return null;
  }

  const sessionStatusById = new Map(params.sessions.map((session) => [session.id, session.status]));
  const seenSessionIds = new Set<string>();

  for (const row of params.recentMessages) {
    if (seenSessionIds.has(row.sessionId)) {
      continue;
    }
    seenSessionIds.add(row.sessionId);

    if (getThreadPhoneFromMetadata(row.metadataJson) !== targetPhone) {
      continue;
    }

    if (sessionStatusById.get(row.sessionId) === "open") {
      return row.sessionId;
    }
  }

  return null;
}
