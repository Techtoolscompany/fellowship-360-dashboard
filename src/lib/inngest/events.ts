export const INNGEST_EVENTS = {
  TEST_HELLO_WORLD_REQUESTED: "test.hello-world.requested.v1",
  GRACE_LEAD_RECEIVED: "grace.lead.received.v1",
  CONTACT_CREATED: "contacts.created.v1",
  CONTACT_MEMBER_CREATED: "contacts.member.created.v1",
  APPOINTMENT_SCHEDULED: "appointments.scheduled.v1",
  VOLUNTEER_CREATED: "volunteers.created.v1",
  GRACE_FIRST_TIME_GUEST_APPOINTMENT_REQUESTED:
    "grace.guest.first-time-appointment.requested.v1",
  COMMUNICATIONS_BROADCAST_SEND_REQUESTED: "communications.broadcast.send.requested.v1",
  GRACE_MISSED_CALL_RECOVERY_REQUESTED: "grace.call.missed.v1",
  GRACE_SERVICE_AUTOSTAFF_REQUESTED: "grace.service.autostaff.requested.v1",
  GRACE_SERVICE_ASSIGNMENT_REPLACEMENT_REQUESTED:
    "grace.service.assignment.replacement.requested.v1",
  GRACE_PRAYER_REQUEST_FOLLOWUP_REQUESTED: "grace.prayer-request.followup.requested.v1",
  ORG_CREATED: "org.created.v1",
  AUTOMATION_WORKFLOW_RUN_REQUESTED: "automation.workflow.run.requested.v1",
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

export function buildContactMemberCreatedIdempotencyKey(params: {
  organizationId: string;
  contactId: string;
  memberStatus: "member" | "leader";
  occurredAt: string;
}) {
  return hashParts("contact-member", [
    params.organizationId,
    params.contactId,
    params.memberStatus,
    params.occurredAt,
  ]);
}

export function buildAppointmentScheduledIdempotencyKey(params: {
  organizationId: string;
  appointmentId: string;
}) {
  return hashParts("appointment-scheduled", [params.organizationId, params.appointmentId]);
}

export function buildVolunteerCreatedIdempotencyKey(params: {
  organizationId: string;
  volunteerId: string;
}) {
  return hashParts("volunteer-created", [params.organizationId, params.volunteerId]);
}

export function buildFirstTimeGuestAppointmentIdempotencyKey(params: {
  organizationId: string;
  pipelineItemId: string;
  contactId: string;
  stageId: string;
  trigger: "created" | "stage_changed" | "ai_categorized";
  occurredAt: string;
}) {
  return hashParts("first-time-guest-appointment", [
    params.organizationId,
    params.pipelineItemId,
    params.contactId,
    params.stageId,
    params.trigger,
    params.occurredAt,
  ]);
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

export function buildServiceAssignmentReplacementIdempotencyKey(params: {
  organizationId: string;
  serviceRunId: string;
  assignmentId: string;
  reasonStatus: "needs_replacement" | "no_show";
  occurredAt: string;
}) {
  return hashParts("service-assignment-replacement", [
    params.organizationId,
    params.serviceRunId,
    params.assignmentId,
    params.reasonStatus,
    params.occurredAt,
  ]);
}

export function buildPrayerRequestFollowupIdempotencyKey(params: {
  organizationId: string;
  requestId: string;
  trigger: "created" | "updated";
  status: "new" | "praying" | "answered" | "archived";
  urgency: "normal" | "urgent" | "critical";
  occurredAt: string;
}) {
  return hashParts("prayer-followup", [
    params.organizationId,
    params.requestId,
    params.trigger,
    params.status,
    params.urgency,
    params.occurredAt,
  ]);
}

export function buildOrgCreatedIdempotencyKey(params: {
  organizationId: string;
}) {
  return hashParts("org-created", [params.organizationId]);
}

export function buildAutomationWorkflowRunExecutionIdempotencyKey(params: {
  organizationId: string;
  workflowId: string;
  runId: string;
}) {
  return hashParts("automation-run", [
    params.organizationId,
    params.workflowId,
    params.runId,
  ]);
}
