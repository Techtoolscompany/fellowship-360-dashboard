import { helloWorld } from "./hello-world";
import { expireCredits } from "./expire-credits";
import { aiBrain } from "./ai-brain";
import { processContactCreated } from "./process-contact";
import { dailyBriefing } from "./daily-briefing";
import { memberRetention } from "./member-retention";
import { sendBroadcast } from "./send-broadcast";
import { visitorFollowupSequence } from "./visitor-followup";
import { missedCallRecoverySequence } from "./missed-call-recovery";
import { graceServiceAutostaff } from "./grace-service-autostaff";
import { provisionOrgProviders } from "./provision-org-providers";
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
  missedCallRecoverySequence,
  graceServiceAutostaff,
  provisionOrgProviders,
];
