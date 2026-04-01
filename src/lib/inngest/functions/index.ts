import { helloWorld } from "./hello-world";
import { expireCredits } from "./expire-credits";
import { aiBrain } from "./ai-brain";
import { processContactCreated } from "./process-contact";
import { dailyBriefing } from "./daily-briefing";
import { memberRetention } from "./member-retention";
import { sendBroadcast } from "./send-broadcast";
import { visitorFollowupSequence } from "./visitor-followup";
import { firstTimeGuestAppointmentSequence } from "./first-time-guest-appointment";
import { missedCallRecoverySequence } from "./missed-call-recovery";
import { graceServiceAutostaff } from "./grace-service-autostaff";
import { serviceConfirmationReminders } from "./service-confirmation-reminders";
import { serviceAssignmentReplacementSequence } from "./service-assignment-replacement";
import { prayerRequestFollowupSequence } from "./prayer-request-followup";
import { appointmentRemindersNoShowRecovery } from "./appointment-reminders-no-show-recovery";
import { provisionOrgProviders } from "./provision-org-providers";
import { financeWeeklyDigest } from "./finance-weekly-digest";
import { financeWeeklyExceptionAlerts } from "./finance-weekly-exception-alerts";
import { graceOpsHealthMonitor } from "./grace-ops-health-monitor";
import {
  dispatchAutomationsOnContactCreated,
  dispatchAutomationsOnFirstTimeGuestRequested,
  dispatchAutomationsOnMissedCall,
  dispatchAutomationsOnPrayerFollowup,
} from "./automation-event-dispatcher";
import {
  dispatchDailyMinistryOps,
  dispatchWeeklyMinistryOps,
  replayAutomationDeadLetterQueue,
} from "./automation-runtime-schedules";
import { generateServiceRunRecapsSchedule } from "./service-run-recap-schedule";
import { INNGEST_EVENTS } from "../events";

export type InngestEvents = {
  [INNGEST_EVENTS.TEST_HELLO_WORLD_REQUESTED]: {
    data: {
      email: string;
    };
  };
  [INNGEST_EVENTS.GRACE_LEAD_RECEIVED]: {
    data: {
      organizationId: string;
      contactName: string;
      contactEmail: string;
      message: string;
      idempotencyKey: string;
    };
  };
  [INNGEST_EVENTS.CONTACT_CREATED]: {
    data: {
      organizationId: string;
      contactId: string;
      idempotencyKey: string;
    };
  };
  [INNGEST_EVENTS.GRACE_FIRST_TIME_GUEST_APPOINTMENT_REQUESTED]: {
    data: {
      organizationId: string;
      pipelineItemId: string;
      contactId: string;
      stageId: string;
      stageName: string;
      trigger: "created" | "stage_changed" | "ai_categorized";
      occurredAt: string;
      idempotencyKey: string;
    };
  };
  [INNGEST_EVENTS.COMMUNICATIONS_BROADCAST_SEND_REQUESTED]: {
    data: {
      organizationId: string;
      broadcastId: string;
      idempotencyKey: string;
    };
  };
  [INNGEST_EVENTS.GRACE_MISSED_CALL_RECOVERY_REQUESTED]: {
    data: {
      organizationId: string;
      sessionId?: string;
      callId?: string;
      fromNumber?: string;
      toNumber?: string;
      startedAt?: string;
      endedAt?: string;
      idempotencyKey: string;
    };
  };
  [INNGEST_EVENTS.GRACE_SERVICE_AUTOSTAFF_REQUESTED]: {
    data: {
      organizationId: string;
      serviceRunId: string;
      goalId: string;
      waitHours?: number;
      idempotencyKey: string;
    };
  };
  [INNGEST_EVENTS.GRACE_SERVICE_ASSIGNMENT_REPLACEMENT_REQUESTED]: {
    data: {
      organizationId: string;
      serviceRunId: string;
      assignmentId: string;
      reasonStatus: "needs_replacement" | "no_show";
      occurredAt: string;
      idempotencyKey: string;
    };
  };
  [INNGEST_EVENTS.GRACE_PRAYER_REQUEST_FOLLOWUP_REQUESTED]: {
    data: {
      organizationId: string;
      requestId: string;
      trigger: "created" | "updated";
      status: "new" | "praying" | "answered" | "archived";
      urgency: "normal" | "urgent" | "critical";
      occurredAt: string;
      idempotencyKey: string;
    };
  };
  [INNGEST_EVENTS.ORG_CREATED]: {
    data: {
      organizationId: string;
      churchName?: string;
      churchDenomination?: string;
      churchCity?: string;
      idempotencyKey: string;
    };
  };
};

export const functions = [
  helloWorld,
  expireCredits,
  aiBrain,
  processContactCreated,
  dailyBriefing,
  memberRetention,
  sendBroadcast,
  visitorFollowupSequence,
  firstTimeGuestAppointmentSequence,
  missedCallRecoverySequence,
  graceServiceAutostaff,
  serviceConfirmationReminders,
  serviceAssignmentReplacementSequence,
  prayerRequestFollowupSequence,
  appointmentRemindersNoShowRecovery,
  provisionOrgProviders,
  financeWeeklyDigest,
  financeWeeklyExceptionAlerts,
  graceOpsHealthMonitor,
  dispatchAutomationsOnContactCreated,
  dispatchAutomationsOnFirstTimeGuestRequested,
  dispatchAutomationsOnMissedCall,
  dispatchAutomationsOnPrayerFollowup,
  dispatchDailyMinistryOps,
  dispatchWeeklyMinistryOps,
  replayAutomationDeadLetterQueue,
  generateServiceRunRecapsSchedule,
];
