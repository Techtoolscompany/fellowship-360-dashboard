import { generateDueServiceRunRecaps } from "@/app/actions/operations";
import { inngest } from "../client";
import { INNGEST_RETRY_PROFILES } from "../policy";

function getSystemToken() {
  return (
    process.env.OPERATIONS_SYSTEM_TOKEN ??
    process.env.AUTOMATION_SYSTEM_TOKEN ??
    process.env.INNGEST_EVENT_KEY ??
    process.env.INNGEST_SIGNING_KEY ??
    ""
  );
}

export const generateServiceRunRecapsSchedule = inngest.createFunction(
  {
    id: "grace-service-run-recap-schedule",
    retries: INNGEST_RETRY_PROFILES.SCHEDULED,
  },
  { cron: "20 * * * *" }, // hourly at minute 20
  async ({ step, logger }) => {
    const systemToken = getSystemToken();
    const result = await step.run("generate-due-service-run-recaps", async () =>
      generateDueServiceRunRecaps({
        limit: 120,
        lookbackHours: 72,
        systemToken,
      })
    );

    logger.info("Service run recap schedule complete", result);
    return result;
  }
);
