import { db } from "@/db";
import { organizations } from "@/db/schema";
import {
  replayDueAutomationDeadLetters,
  triggerAutomationWorkflowsForEvent,
} from "@/app/actions/automations";
import { inngest } from "../client";
import { INNGEST_RETRY_PROFILES } from "../policy";

const DAILY_MINISTRY_OPS_TRIGGER = "ministry.ops.daily.v1";
const WEEKLY_MINISTRY_OPS_TRIGGER = "ministry.ops.weekly.v1";

function getSystemToken() {
  return (
    process.env.AUTOMATION_SYSTEM_TOKEN ??
    process.env.INNGEST_EVENT_KEY ??
    process.env.INNGEST_SIGNING_KEY ??
    ""
  );
}

async function dispatchScheduledAutomationTrigger(params: {
  triggerEvent: string;
  scheduleType: "daily" | "weekly";
}) {
  const systemToken = getSystemToken();
  const orgs = await db.select({ id: organizations.id }).from(organizations);

  let organizationsProcessed = 0;
  let organizationsFailed = 0;
  let workflowsDispatched = 0;
  let throttled = 0;

  for (const org of orgs) {
    try {
      const result = await triggerAutomationWorkflowsForEvent({
        organizationId: org.id,
        triggerEvent: params.triggerEvent,
        metadata: {
          scheduleType: params.scheduleType,
          scheduledAt: new Date().toISOString(),
        },
        systemToken,
      });

      organizationsProcessed += 1;
      workflowsDispatched += Number(result.dispatched ?? 0);
      throttled += Number(result.throttled ?? 0);
    } catch {
      organizationsFailed += 1;
    }
  }

  return {
    organizations: orgs.length,
    organizationsProcessed,
    organizationsFailed,
    workflowsDispatched,
    throttled,
    triggerEvent: params.triggerEvent,
    scheduleType: params.scheduleType,
  };
}

export const dispatchDailyMinistryOps = inngest.createFunction(
  {
    id: "automation-dispatch-daily-ministry-ops",
    retries: INNGEST_RETRY_PROFILES.SCHEDULED,
  },
  { cron: "15 13 * * *" }, // daily 13:15 UTC
  async ({ step, logger }) => {
    const result = await step.run("dispatch-daily-ministry-ops", async () =>
      dispatchScheduledAutomationTrigger({
        triggerEvent: DAILY_MINISTRY_OPS_TRIGGER,
        scheduleType: "daily",
      })
    );

    logger.info("Daily ministry ops automation dispatch complete", result);
    return result;
  }
);

export const dispatchWeeklyMinistryOps = inngest.createFunction(
  {
    id: "automation-dispatch-weekly-ministry-ops",
    retries: INNGEST_RETRY_PROFILES.SCHEDULED,
  },
  { cron: "15 14 * * MON" }, // weekly Monday 14:15 UTC
  async ({ step, logger }) => {
    const result = await step.run("dispatch-weekly-ministry-ops", async () =>
      dispatchScheduledAutomationTrigger({
        triggerEvent: WEEKLY_MINISTRY_OPS_TRIGGER,
        scheduleType: "weekly",
      })
    );

    logger.info("Weekly ministry ops automation dispatch complete", result);
    return result;
  }
);

export const replayAutomationDeadLetterQueue = inngest.createFunction(
  {
    id: "automation-dead-letter-replay",
    retries: INNGEST_RETRY_PROFILES.SCHEDULED,
  },
  { cron: "*/30 * * * *" }, // every 30 minutes
  async ({ step, logger }) => {
    const systemToken = getSystemToken();
    const result = await step.run("replay-due-dead-letters", async () =>
      replayDueAutomationDeadLetters({
        limit: 200,
        systemToken,
      })
    );

    logger.info("Automation dead-letter replay run complete", result);
    return result;
  }
);
