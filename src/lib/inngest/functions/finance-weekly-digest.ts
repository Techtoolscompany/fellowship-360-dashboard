import { inngest } from "../client";
import { INNGEST_RETRY_PROFILES } from "../policy";
import { db } from "@/db";
import {
  conversations,
  graceMemory,
  messages,
  organizationMemberships,
  organizations,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { endOfWeek, startOfWeek, subWeeks } from "date-fns";
import { computeWeeklyGivingReport } from "@/lib/finances/weekly-report";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function buildDigestDetails(params: {
  organizationName: string | null;
  report: Awaited<ReturnType<typeof computeWeeklyGivingReport>>;
}) {
  const topFunds = params.report.breakdownByFund.slice(0, 5);
  const topFundLines = topFunds.length
    ? topFunds
        .map(
          (row) =>
            `- ${row.fund} (${row.category}): ${formatCurrency(row.total)} (${row.sharePercent.toFixed(1)}%)`
        )
        .join("\n")
    : "- No fund activity this period.";

  const sourceLines = params.report.breakdownBySource
    .map(
      (row) =>
        `- ${row.source}: ${formatCurrency(row.total)} (${row.count} donation${row.count === 1 ? "" : "s"})`
    )
    .join("\n");

  return [
    `Weekly Finance Digest for ${params.organizationName || "Organization"}`,
    `Period: ${params.report.period.label}`,
    params.report.summary,
    "",
    "Breakdown by source:",
    sourceLines,
    "",
    "Top funds:",
    topFundLines,
  ].join("\n");
}

function buildLeadershipDigestSubject(params: {
  organizationName: string | null;
  report: Awaited<ReturnType<typeof computeWeeklyGivingReport>>;
}) {
  return `${params.organizationName || "Organization"} Finance Digest (${params.report.period.label})`;
}

function buildLeadershipDigestMessage(params: {
  organizationName: string | null;
  report: Awaited<ReturnType<typeof computeWeeklyGivingReport>>;
}) {
  return [
    buildDigestDetails(params),
    "",
    "Action requested:",
    "- Review week-over-week variance.",
    "- Confirm any large source/fund shifts and reconcile exceptions.",
  ].join("\n");
}

export const financeWeeklyDigest = inngest.createFunction(
  { id: "finance-weekly-digest", retries: INNGEST_RETRY_PROFILES.SCHEDULED },
  { cron: "0 13 * * MON" }, // Monday 13:00 UTC
  async ({ step, logger }) => {
    const targetWeek = subWeeks(new Date(), 1);
    const periodStart = startOfWeek(targetWeek, { weekStartsOn: 0 });
    const periodEnd = endOfWeek(targetWeek, { weekStartsOn: 0 });

    const orgs = await step.run("load-organizations", async () => {
      return db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations);
    });

    let created = 0;
    let skipped = 0;
    let failed = 0;
    let leadershipInboxDelivered = 0;
    let leadershipInboxSkipped = 0;

    for (const org of orgs) {
      const result = await step.run(`digest-org-${org.id}`, async () => {
        try {
          const report = await computeWeeklyGivingReport({
            organizationId: org.id,
            startDate: periodStart,
            endDate: periodEnd,
          });

          const [existing] = await db
            .select({ id: graceMemory.id })
            .from(graceMemory)
            .where(
              and(
                eq(graceMemory.organizationId, org.id),
                eq(graceMemory.memoryType, "org_pattern"),
                sql`${graceMemory.metadataJson} ->> 'reportType' = ${"finance_weekly_digest"}`,
                sql`${graceMemory.metadataJson} ->> 'periodStart' = ${report.period.start}`
              )
            )
            .limit(1);

          if (existing) {
            return { status: "skipped" as const };
          }

          const digestDetails = buildDigestDetails({
            organizationName: org.name,
            report,
          });

          await db.insert(graceMemory).values({
            organizationId: org.id,
            memoryType: "org_pattern",
            summary: report.summary.slice(0, 320),
            details: digestDetails,
            tags: ["finance_weekly_digest", "finance", "weekly_digest"],
            metadataJson: {
              reportType: "finance_weekly_digest",
              periodStart: report.period.start,
              periodEnd: report.period.end,
              periodLabel: report.period.label,
              totals: report.totals,
              breakdownBySource: report.breakdownBySource,
              breakdownByFund: report.breakdownByFund,
              breakdownByCategory: report.breakdownByCategory,
              generatedAt: report.generatedAt,
            },
            createdByActorType: "system",
          });

          const leadershipMembers = await db
            .select({ userId: organizationMemberships.userId })
            .from(organizationMemberships)
            .where(
              and(
                eq(organizationMemberships.organizationId, org.id),
                inArray(organizationMemberships.role, ["owner", "admin"])
              )
            );

          const subject = buildLeadershipDigestSubject({
            organizationName: org.name,
            report,
          });
          const messageContent = buildLeadershipDigestMessage({
            organizationName: org.name,
            report,
          });
          let delivered = 0;
          let skippedExisting = 0;

          for (const leader of leadershipMembers) {
            const [existingConversation] = await db
              .select({ id: conversations.id })
              .from(conversations)
              .where(
                and(
                  eq(conversations.organizationId, org.id),
                  eq(conversations.assigneeId, leader.userId),
                  eq(conversations.subject, subject)
                )
              )
              .limit(1);

            const conversationId =
              existingConversation?.id ??
              (
                await db
                  .insert(conversations)
                  .values({
                    organizationId: org.id,
                    channel: "email",
                    status: "open",
                    subject,
                    assigneeId: leader.userId,
                    lastMessageAt: new Date(),
                    updatedAt: new Date(),
                  })
                  .returning({ id: conversations.id })
              )[0]?.id;

            if (!conversationId) {
              continue;
            }

            const [existingDigestMessage] = await db
              .select({ id: messages.id })
              .from(messages)
              .where(
                and(
                  eq(messages.conversationId, conversationId),
                  eq(messages.content, messageContent)
                )
              )
              .limit(1);

            if (existingDigestMessage) {
              skippedExisting += 1;
              continue;
            }

            await db.insert(messages).values({
              conversationId,
              content: messageContent,
              direction: "inbound",
              senderType: "system",
              senderId: null,
            });

            await db
              .update(conversations)
              .set({ lastMessageAt: new Date(), updatedAt: new Date() })
              .where(eq(conversations.id, conversationId));

            delivered += 1;
          }

          return {
            status: "created" as const,
            leadershipInbox: {
              recipients: leadershipMembers.length,
              delivered,
              skippedExisting,
            },
          };
        } catch (error) {
          return {
            status: "failed" as const,
            error: error instanceof Error ? error.message : "finance_digest_failed",
          };
        }
      });

      if (result.status === "created") created += 1;
      if (result.status === "created") {
        leadershipInboxDelivered += result.leadershipInbox.delivered;
        leadershipInboxSkipped += result.leadershipInbox.skippedExisting;
      }
      if (result.status === "skipped") skipped += 1;
      if (result.status === "failed") {
        failed += 1;
        logger.error("Finance weekly digest failed for organization", {
          organizationId: org.id,
          error: result.error,
        });
      }
    }

    logger.info("Finance weekly digest run complete", {
      organizations: orgs.length,
      created,
      skipped,
      failed,
      leadershipInboxDelivered,
      leadershipInboxSkipped,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });

    return {
      organizations: orgs.length,
      created,
      skipped,
      failed,
      leadershipInboxDelivered,
      leadershipInboxSkipped,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    };
  }
);
