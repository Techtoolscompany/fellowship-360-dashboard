import { inngest } from "../client";
import { INNGEST_EVENTS } from "../events";
import { INNGEST_RETRY_PROFILES } from "../policy";
import { triggerAutomationWorkflowsForEvent } from "@/app/actions/automations";

function getSystemToken() {
  return (
    process.env.AUTOMATION_SYSTEM_TOKEN ??
    process.env.INNGEST_EVENT_KEY ??
    process.env.INNGEST_SIGNING_KEY ??
    ""
  );
}

async function dispatchFromEvent(params: {
  organizationId: string;
  triggerEvent: string;
  contactId?: string;
  metadata?: Record<string, unknown>;
}) {
  return triggerAutomationWorkflowsForEvent({
    organizationId: params.organizationId,
    triggerEvent: params.triggerEvent,
    contactId: params.contactId,
    metadata: params.metadata,
    systemToken: getSystemToken(),
  });
}

export const dispatchAutomationsOnContactCreated = inngest.createFunction(
  {
    id: "automation-dispatch-contact-created",
    retries: INNGEST_RETRY_PROFILES.STANDARD,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.CONTACT_CREATED },
  async ({ event, step, logger }) => {
    const result = await step.run("dispatch-automations", async () =>
      dispatchFromEvent({
        organizationId: event.data.organizationId,
        triggerEvent: INNGEST_EVENTS.CONTACT_CREATED,
        contactId: event.data.contactId,
        metadata: {
          eventIdempotencyKey: event.data.idempotencyKey,
        },
      })
    );

    logger.info("Automation dispatch complete", {
      event: INNGEST_EVENTS.CONTACT_CREATED,
      organizationId: event.data.organizationId,
      dispatched: result.dispatched,
    });

    return result;
  }
);

export const dispatchAutomationsOnContactMemberCreated = inngest.createFunction(
  {
    id: "automation-dispatch-contact-member-created",
    retries: INNGEST_RETRY_PROFILES.STANDARD,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.CONTACT_MEMBER_CREATED },
  async ({ event, step, logger }) => {
    const result = await step.run("dispatch-automations", async () =>
      dispatchFromEvent({
        organizationId: event.data.organizationId,
        triggerEvent: INNGEST_EVENTS.CONTACT_MEMBER_CREATED,
        contactId: event.data.contactId,
        metadata: {
          memberStatus: event.data.memberStatus,
          occurredAt: event.data.occurredAt,
          source: event.data.source,
          eventIdempotencyKey: event.data.idempotencyKey,
        },
      })
    );

    logger.info("Automation dispatch complete", {
      event: INNGEST_EVENTS.CONTACT_MEMBER_CREATED,
      organizationId: event.data.organizationId,
      dispatched: result.dispatched,
    });

    return result;
  }
);

export const dispatchAutomationsOnAppointmentScheduled = inngest.createFunction(
  {
    id: "automation-dispatch-appointment-scheduled",
    retries: INNGEST_RETRY_PROFILES.STANDARD,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.APPOINTMENT_SCHEDULED },
  async ({ event, step, logger }) => {
    const result = await step.run("dispatch-automations", async () =>
      dispatchFromEvent({
        organizationId: event.data.organizationId,
        triggerEvent: INNGEST_EVENTS.APPOINTMENT_SCHEDULED,
        contactId: event.data.contactId,
        metadata: {
          appointmentId: event.data.appointmentId,
          staffId: event.data.staffId,
          title: event.data.title,
          dateTime: event.data.dateTime,
          duration: event.data.duration,
          type: event.data.type,
          status: event.data.status,
          eventIdempotencyKey: event.data.idempotencyKey,
        },
      })
    );

    logger.info("Automation dispatch complete", {
      event: INNGEST_EVENTS.APPOINTMENT_SCHEDULED,
      organizationId: event.data.organizationId,
      dispatched: result.dispatched,
    });

    return result;
  }
);

export const dispatchAutomationsOnFirstTimeGuestRequested = inngest.createFunction(
  {
    id: "automation-dispatch-first-time-guest",
    retries: INNGEST_RETRY_PROFILES.CORE_AUTOMATION,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.GRACE_FIRST_TIME_GUEST_APPOINTMENT_REQUESTED },
  async ({ event, step, logger }) => {
    const result = await step.run("dispatch-automations", async () =>
      dispatchFromEvent({
        organizationId: event.data.organizationId,
        triggerEvent: INNGEST_EVENTS.GRACE_FIRST_TIME_GUEST_APPOINTMENT_REQUESTED,
        contactId: event.data.contactId,
        metadata: {
          pipelineItemId: event.data.pipelineItemId,
          stageId: event.data.stageId,
          stageName: event.data.stageName,
          trigger: event.data.trigger,
          occurredAt: event.data.occurredAt,
          eventIdempotencyKey: event.data.idempotencyKey,
        },
      })
    );

    logger.info("Automation dispatch complete", {
      event: INNGEST_EVENTS.GRACE_FIRST_TIME_GUEST_APPOINTMENT_REQUESTED,
      organizationId: event.data.organizationId,
      dispatched: result.dispatched,
    });

    return result;
  }
);

export const dispatchAutomationsOnMissedCall = inngest.createFunction(
  {
    id: "automation-dispatch-missed-call",
    retries: INNGEST_RETRY_PROFILES.CORE_AUTOMATION,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.GRACE_MISSED_CALL_RECOVERY_REQUESTED },
  async ({ event, step, logger }) => {
    const result = await step.run("dispatch-automations", async () =>
      dispatchFromEvent({
        organizationId: event.data.organizationId,
        triggerEvent: INNGEST_EVENTS.GRACE_MISSED_CALL_RECOVERY_REQUESTED,
        metadata: {
          sessionId: event.data.sessionId,
          callId: event.data.callId,
          fromNumber: event.data.fromNumber,
          toNumber: event.data.toNumber,
          startedAt: event.data.startedAt,
          endedAt: event.data.endedAt,
          eventIdempotencyKey: event.data.idempotencyKey,
        },
      })
    );

    logger.info("Automation dispatch complete", {
      event: INNGEST_EVENTS.GRACE_MISSED_CALL_RECOVERY_REQUESTED,
      organizationId: event.data.organizationId,
      dispatched: result.dispatched,
    });

    return result;
  }
);

export const dispatchAutomationsOnPrayerFollowup = inngest.createFunction(
  {
    id: "automation-dispatch-prayer-followup",
    retries: INNGEST_RETRY_PROFILES.CORE_AUTOMATION,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.GRACE_PRAYER_REQUEST_FOLLOWUP_REQUESTED },
  async ({ event, step, logger }) => {
    const result = await step.run("dispatch-automations", async () =>
      dispatchFromEvent({
        organizationId: event.data.organizationId,
        triggerEvent: INNGEST_EVENTS.GRACE_PRAYER_REQUEST_FOLLOWUP_REQUESTED,
        metadata: {
          requestId: event.data.requestId,
          trigger: event.data.trigger,
          status: event.data.status,
          urgency: event.data.urgency,
          occurredAt: event.data.occurredAt,
          eventIdempotencyKey: event.data.idempotencyKey,
        },
      })
    );

    logger.info("Automation dispatch complete", {
      event: INNGEST_EVENTS.GRACE_PRAYER_REQUEST_FOLLOWUP_REQUESTED,
      organizationId: event.data.organizationId,
      dispatched: result.dispatched,
    });

    return result;
  }
);

export const dispatchAutomationsOnVolunteerCreated = inngest.createFunction(
  {
    id: "automation-dispatch-volunteer-created",
    retries: INNGEST_RETRY_PROFILES.STANDARD,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.VOLUNTEER_CREATED },
  async ({ event, step, logger }) => {
    const result = await step.run("dispatch-automations", async () =>
      dispatchFromEvent({
        organizationId: event.data.organizationId,
        triggerEvent: INNGEST_EVENTS.VOLUNTEER_CREATED,
        contactId: event.data.contactId,
        metadata: {
          volunteerId: event.data.volunteerId,
          role: event.data.role,
          status: event.data.status,
          eventIdempotencyKey: event.data.idempotencyKey,
        },
      })
    );

    logger.info("Automation dispatch complete", {
      event: INNGEST_EVENTS.VOLUNTEER_CREATED,
      organizationId: event.data.organizationId,
      dispatched: result.dispatched,
    });

    return result;
  }
);
