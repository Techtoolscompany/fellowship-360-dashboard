import { db } from "@/db";
import { graceApprovals, graceMemory, graceToolAudit, organizations, tasks } from "@/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  APPROVAL_QUEUE_SLA_MINUTES,
  RUNTIME_FAILURE_ALERT_THRESHOLD_PERCENT,
  computeGraceOpsHealth,
} from "@/lib/grace/ops-health";
import { inngest } from "../client";
import { INNGEST_RETRY_PROFILES } from "../policy";

const ALERT_SUPPRESSION_WINDOW_MINUTES = 60;
const ALERT_TASK_DUE_WINDOW_MINUTES = 30;
const ALERT_TASK_OPEN_STATUSES: Array<typeof tasks.$inferSelect.status> = [
  "todo",
  "in_progress",
];

function buildAlertFingerprint(params: {
  hasApprovalSlaBreach: boolean;
  runtimeAlerting: boolean;
}) {
  const segments: string[] = [];
  if (params.hasApprovalSlaBreach) segments.push("approval_sla");
  if (params.runtimeAlerting) segments.push("runtime_failure_rate");
  return segments.join("+");
}

function buildAlertTitle(params: {
  hasApprovalSlaBreach: boolean;
  runtimeAlerting: boolean;
}) {
  if (params.hasApprovalSlaBreach && params.runtimeAlerting) {
    return "Grace ops alert (approval_sla+runtime_failure_rate)";
  }
  if (params.hasApprovalSlaBreach) {
    return "Grace ops alert (approval_sla)";
  }
  return "Grace ops alert (runtime_failure_rate)";
}

function buildAlertSummary(params: {
  organizationName: string | null;
  hasApprovalSlaBreach: boolean;
  runtimeAlerting: boolean;
  overduePendingCount: number;
  failureRatePercent: number;
}) {
  const orgName = params.organizationName || "Organization";
  const parts: string[] = [];

  if (params.hasApprovalSlaBreach) {
    parts.push(
      `${params.overduePendingCount} approval${
        params.overduePendingCount === 1 ? "" : "s"
      } exceeded the ${APPROVAL_QUEUE_SLA_MINUTES} minute SLA`
    );
  }

  if (params.runtimeAlerting) {
    parts.push(
      `runtime failure rate hit ${params.failureRatePercent.toFixed(1)}% (threshold ${RUNTIME_FAILURE_ALERT_THRESHOLD_PERCENT}%)`
    );
  }

  return `${orgName}: ${parts.join("; ")}.`;
}

function buildAlertDetails(params: {
  organizationName: string | null;
  generatedAt: Date;
  hasApprovalSlaBreach: boolean;
  runtimeAlerting: boolean;
  pendingCount: number;
  overduePendingCount: number;
  oldestPendingAgeMinutes: number;
  avgDecisionMinutes: number;
  last24hRuns: number;
  last24hFailures: number;
  failureRatePercent: number;
  topFailedTools: Array<{ tool: string; count: number }>;
  failureByChannel: Array<{ channel: string; count: number }>;
}) {
  const lines: string[] = [
    "Grace Ops Health Alert",
    `Generated at: ${params.generatedAt.toISOString()}`,
    `Organization: ${params.organizationName || "Unknown"}`,
    "",
  ];

  if (params.hasApprovalSlaBreach) {
    lines.push("Approval queue SLA breach:");
    lines.push(
      `- Pending approvals: ${params.pendingCount} (${params.overduePendingCount} over ${APPROVAL_QUEUE_SLA_MINUTES} minutes)`
    );
    lines.push(
      `- Oldest pending age: ${params.oldestPendingAgeMinutes} minutes; avg decision time (last 7 days): ${params.avgDecisionMinutes} minutes`
    );
    lines.push("");
  }

  if (params.runtimeAlerting) {
    lines.push("Runtime failure alert:");
    lines.push(
      `- Failure rate: ${params.failureRatePercent.toFixed(1)}% (${params.last24hFailures}/${params.last24hRuns}) in last 24 hours`
    );
    if (params.topFailedTools.length > 0) {
      lines.push(
        `- Top failed tools: ${params.topFailedTools
          .map((row) => `${row.tool} (${row.count})`)
          .join(", ")}`
      );
    }
    if (params.failureByChannel.length > 0) {
      lines.push(
        `- Failures by channel: ${params.failureByChannel
          .map((row) => `${row.channel} (${row.count})`)
          .join(", ")}`
      );
    }
    lines.push("");
  }

  lines.push(
    "Recommended action: review Grace approvals queue and workflow/tool logs in Grace Command Center."
  );

  return lines.join("\n");
}

export const graceOpsHealthMonitor = inngest.createFunction(
  { id: "grace-ops-health-monitor", retries: INNGEST_RETRY_PROFILES.SCHEDULED },
  { cron: "*/15 * * * *" },
  async ({ step, logger }) => {
    const now = new Date();
    const suppressionWindowStart = new Date(
      now.getTime() - ALERT_SUPPRESSION_WINDOW_MINUTES * 60 * 1000
    );
    const runtimeWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const orgs = await step.run("load-organizations", async () => {
      return db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations);
    });

    let alertsRaised = 0;
    let alertsSuppressed = 0;
    let openTasksCreated = 0;

    for (const org of orgs) {
      const snapshot = await step.run(`compute-snapshot-${org.id}`, async () => {
        const approvals = await db
          .select({
            status: graceApprovals.status,
            createdAt: graceApprovals.createdAt,
            decidedAt: graceApprovals.decidedAt,
          })
          .from(graceApprovals)
          .where(eq(graceApprovals.organizationId, org.id))
          .orderBy(desc(graceApprovals.createdAt))
          .limit(500);

        const toolAuditRows = await db
          .select({
            status: graceToolAudit.status,
            createdAt: graceToolAudit.createdAt,
            channel: graceToolAudit.channel,
            toolName: graceToolAudit.toolName,
          })
          .from(graceToolAudit)
          .where(
            and(
              eq(graceToolAudit.organizationId, org.id),
              gte(graceToolAudit.createdAt, runtimeWindowStart)
            )
          )
          .orderBy(desc(graceToolAudit.createdAt))
          .limit(1000);

        return computeGraceOpsHealth({
          approvals,
          toolAuditRows,
          now,
        });
      });

      if (!snapshot.alerting) {
        continue;
      }

      const fingerprint = buildAlertFingerprint({
        hasApprovalSlaBreach: snapshot.approvalQueue.hasSlaBreach,
        runtimeAlerting: snapshot.runtime.alerting,
      });
      const alertTitle = buildAlertTitle({
        hasApprovalSlaBreach: snapshot.approvalQueue.hasSlaBreach,
        runtimeAlerting: snapshot.runtime.alerting,
      });
      const alertSummary = buildAlertSummary({
        organizationName: org.name,
        hasApprovalSlaBreach: snapshot.approvalQueue.hasSlaBreach,
        runtimeAlerting: snapshot.runtime.alerting,
        overduePendingCount: snapshot.approvalQueue.overduePendingCount,
        failureRatePercent: snapshot.runtime.failureRatePercent,
      });
      const alertDetails = buildAlertDetails({
        organizationName: org.name,
        generatedAt: now,
        hasApprovalSlaBreach: snapshot.approvalQueue.hasSlaBreach,
        runtimeAlerting: snapshot.runtime.alerting,
        pendingCount: snapshot.approvalQueue.pendingCount,
        overduePendingCount: snapshot.approvalQueue.overduePendingCount,
        oldestPendingAgeMinutes: snapshot.approvalQueue.oldestPendingAgeMinutes,
        avgDecisionMinutes: snapshot.approvalQueue.avgDecisionMinutes,
        last24hRuns: snapshot.runtime.last24hRuns,
        last24hFailures: snapshot.runtime.last24hFailures,
        failureRatePercent: snapshot.runtime.failureRatePercent,
        topFailedTools: snapshot.runtime.topFailedTools,
        failureByChannel: snapshot.runtime.failureByChannel,
      });

      const alertState = await step.run(`persist-alert-${org.id}`, async () => {
        const [existingRecentAlert] = await db
          .select({ id: graceMemory.id })
          .from(graceMemory)
          .where(
            and(
              eq(graceMemory.organizationId, org.id),
              eq(graceMemory.memoryType, "org_pattern"),
              gte(graceMemory.createdAt, suppressionWindowStart),
              sql`${graceMemory.metadataJson} ->> 'reportType' = ${"grace_ops_health_alert"}`,
              sql`${graceMemory.metadataJson} ->> 'fingerprint' = ${fingerprint}`
            )
          )
          .limit(1);

        if (existingRecentAlert) {
          return { status: "suppressed" as const, taskCreated: false };
        }

        await db.insert(graceMemory).values({
          organizationId: org.id,
          memoryType: "org_pattern",
          summary: alertSummary,
          details: alertDetails,
          tags: ["grace_ops_health", "launch_gate", ...fingerprint.split("+")],
          metadataJson: {
            reportType: "grace_ops_health_alert",
            fingerprint,
            generatedAt: now.toISOString(),
            thresholds: {
              approvalQueueSlaMinutes: APPROVAL_QUEUE_SLA_MINUTES,
              runtimeFailurePercent: RUNTIME_FAILURE_ALERT_THRESHOLD_PERCENT,
            },
            snapshot,
          },
          createdByActorType: "system",
        });

        const [existingOpenTask] = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              eq(tasks.organizationId, org.id),
              eq(tasks.title, alertTitle),
              inArray(tasks.status, ALERT_TASK_OPEN_STATUSES)
            )
          )
          .limit(1);

        if (existingOpenTask) {
          return { status: "created" as const, taskCreated: false };
        }

        await db.insert(tasks).values({
          organizationId: org.id,
          title: alertTitle,
          description: alertDetails,
          priority: "urgent",
          status: "todo",
          dueDate: new Date(now.getTime() + ALERT_TASK_DUE_WINDOW_MINUTES * 60 * 1000),
        });

        return { status: "created" as const, taskCreated: true };
      });

      if (alertState.status === "suppressed") {
        alertsSuppressed += 1;
        continue;
      }

      alertsRaised += 1;
      if (alertState.taskCreated) {
        openTasksCreated += 1;
      }
    }

    logger.info("Grace ops health monitor run complete", {
      organizations: orgs.length,
      alertsRaised,
      alertsSuppressed,
      openTasksCreated,
      generatedAt: now.toISOString(),
    });

    return {
      organizations: orgs.length,
      alertsRaised,
      alertsSuppressed,
      openTasksCreated,
      generatedAt: now.toISOString(),
    };
  }
);
