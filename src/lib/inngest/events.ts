export const INNGEST_EVENTS = {
  TEST_HELLO_WORLD_REQUESTED: "test.hello-world.requested.v1",
  GRACE_LEAD_RECEIVED: "grace.lead.received.v1",
  CONTACT_CREATED: "contacts.created.v1",
  COMMUNICATIONS_BROADCAST_SEND_REQUESTED: "communications.broadcast.send.requested.v1",
  GRACE_MISSED_CALL_RECOVERY_REQUESTED: "grace.call.missed.v1",
  GRACE_SERVICE_AUTOSTAFF_REQUESTED: "grace.service.autostaff.requested.v1",
  ORG_CREATED: "org.created.v1",
} as const;

export type InngestEventName = (typeof INNGEST_EVENTS)[keyof typeof INNGEST_EVENTS];

function hashParts(prefix: string, parts: Array<string | number | null | undefined>) {
  const payload = parts.map((part) => String(part ?? "")).join("|");
  // Deterministic non-cryptographic hash that works in both Node and Edge runtimes.
  let h1 = 0xdeadbeef ^ payload.length;
  let h2 = 0x41c6ce57 ^ payload.length;

  for (let i = 0; i < payload.length; i += 1) {
    const code = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }

  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hash = `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
  return `${prefix}:${hash}`;
}

export function buildLeadReceivedIdempotencyKey(params: {
  organizationId: string;
  contactEmail: string;
  message: string;
}) {
  return hashParts("lead", [
    params.organizationId,
    params.contactEmail.trim().toLowerCase(),
    params.message.trim(),
  ]);
}

export function buildBroadcastSendIdempotencyKey(params: {
  organizationId: string;
  broadcastId: string;
}) {
  return hashParts("broadcast", [params.organizationId, params.broadcastId]);
}

export function buildContactCreatedIdempotencyKey(params: {
  organizationId: string;
  contactId: string;
}) {
  return hashParts("contact", [params.organizationId, params.contactId]);
}

export function buildMissedCallRecoveryIdempotencyKey(params: {
  organizationId: string;
  callId?: string | null;
  sessionId?: string | null;
  fromNumber?: string | null;
  endedAt?: string | null;
}) {
  return hashParts("missed-call", [
    params.organizationId,
    params.callId ?? "",
    params.sessionId ?? "",
    params.fromNumber ?? "",
    params.endedAt ?? "",
  ]);
}

export function buildGraceServiceAutostaffIdempotencyKey(params: {
  organizationId: string;
  serviceRunId: string;
  goalId?: string | null;
}) {
  return hashParts("service-autostaff", [
    params.organizationId,
    params.serviceRunId,
    params.goalId ?? "",
  ]);
}

export function buildOrgCreatedIdempotencyKey(params: {
  organizationId: string;
}) {
  return hashParts("org-created", [params.organizationId]);
}
