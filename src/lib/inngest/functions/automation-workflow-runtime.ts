import { inngest } from "../client";
import { INNGEST_EVENTS } from "../events";
import { INNGEST_RETRY_PROFILES } from "../policy";
import { executeAutomationWorkflowRunById } from "@/lib/automations/runtime-execution";

export const executeAutomationWorkflowRunRequested = inngest.createFunction(
  {
    id: "automation-workflow-runtime",
    retries: INNGEST_RETRY_PROFILES.LOW_RISK,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.AUTOMATION_WORKFLOW_RUN_REQUESTED },
  async ({ event, step, logger }) => {
    const result = await executeAutomationWorkflowRunById({
      runId: event.data.runId,
      step,
    });

    logger.info("Automation workflow runtime complete", {
      runId: event.data.runId,
      workflowId: event.data.workflowId,
      organizationId: event.data.organizationId,
      status: result.run.status,
      deadLetterId: result.deadLetterId,
    });

    return {
      runId: result.run.id,
      status: result.run.status,
      deadLetterId: result.deadLetterId,
    };
  }
);
