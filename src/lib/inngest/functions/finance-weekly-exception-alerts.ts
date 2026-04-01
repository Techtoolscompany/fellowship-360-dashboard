import { db } from "@/db";
import { donations, graceMemory, organizations, pledges, tasks } from "@/db/schema";
import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { endOfWeek, startOfWeek, subDays, subWeeks } from "date-fns";
import {
  buildFinanceExceptionDetails,
  buildFinanceExceptionSnapshot,
  buildFinanceExceptionSummary,
} from "@/lib/finances/exception-alerts";
import { computeWeeklyGivingReport } from "@/lib/finances/weekly-report";
import { inngest } from "../client";
import { INNGEST_RETRY_PROFILES } from "../policy";

const ALERT_TASK_OPEN_STATUSES: Array<typeof tasks.$inferSelect.status> = [
  "todo",
  "in_progress",
];

const RECURRING_LOOKBACK_DAYS: Record<typeof pledges.$inferSelect.frequency, number> = {
  one_time: 0,
  weekly: 10,
  biweekly: 21,
  monthly: 45,
  quarterly: 120,
  annually: 400,
};

function resolveRecurringLookbackDays(frequency: typeof pledges.$inferSelect.frequency) {
  return RECURRING_LOOKBACK_DAYS[frequency] ?? 45;
}

export const financeWeeklyExceptionAlerts = inngest.createFunction(
  { id: "finance-weekly-exception-alerts", retries: INNGEST_RETRY_PROFILES.SCHEDULED },
  { cron: "30 13 * * MON" }, // Monday 13:30 UTC
  async ({ step, logger }) => {
    const targetWeek = subWeeks(new Date(), 1);
    const periodStart = startOfWeek(targetWeek, { weekStartsOn: 0 });
    const periodEnd = endOfWeek(targetWeek, { weekStartsOn: 0 });

    const orgs = await step.run("load-organizations", async () => {
      return db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations);
    });

    let alertsCreated = 0;
    let alertsSkipped = 0;
    let organizationsWithNoExceptions = 0;
    let tasksCreated = 0;

    for (const org of orgs) {
      const result = await step.run(`finance-exceptions-org-${org.id}`, async () => {
        const report = await computeWeeklyGivingReport({
          organizationId: org.id,
          startDate: periodStart,
          endDate: periodEnd,
        });

        const activeRecurringPledges = await db
          .select({
            id: pledges.id,
            contactId: pledges.contactId,
            frequency: pledges.frequency,
            fund: pledges.fund,
          })
          .from(pledges)
          .where(
            and(
              eq(pledges.organizationId, org.id),
              ne(pledges.frequency, "one_time"),
              isNotNull(pledges.contactId),
              lte(pledges.startDate, periodEnd),
              or(isNull(pledges.endDate), gte(pledges.endDate, periodStart))
            )
          );

        let missedRecurringCount = 0;

        for (const pledge of activeRecurringPledges) {
          if (!pledge.contactId) continue;
          const lookbackDays = resolveRecurringLookbackDays(pledge.frequency);
          const windowStart = subDays(periodEnd, lookbackDays);

          const [recentGift] = await db
            .select({ id: donations.id })
            .from(donations)
            .where(
              and(
                eq(donations.organizationId, org.id),
                eq(donations.contactId, pledge.contactId),
                gte(donations.date, windowStart),
                lte(donations.date, periodEnd),
                pledge.fund
                  ? eq(donations.fund, pledge.fund)
                  : sql`true`
              )
            )
            .limit(1);

          if (!recentGift) {
            missedRecurringCount += 1;
          }
        }

        const [unreconciledSummary] = await db
          .select({
            count: sql<number>`count(*)`,
            total: sql<number>`coalesce(sum(${donations.amount}), 0)`,
          })
          .from(donations)
          .where(
            and(
              eq(donations.organizationId, org.id),
              gte(donations.date, periodStart),
              lte(donations.date, periodEnd),
              eq(donations.receiptSent, false)
            )
          );

        const snapshot = buildFinanceExceptionSnapshot({
          report,
          activeRecurringPledgeCount: activeRecurringPledges.length,
          missedRecurringCount,
          unreconciledCount: Number(unreconciledSummary?.count ?? 0),
          unreconciledAmount: Number(unreconciledSummary?.total ?? 0),
        });

        if (snapshot.exceptions.length === 0) {
          return { status: "clean" as const, taskCreated: false };
        }

        const [existingAlert] = await db
          .select({ id: graceMemory.id })
          .from(graceMemory)
          .where(
            and(
              eq(graceMemory.organizationId, org.id),
              eq(graceMemory.memoryType, "org_pattern"),
              sql`${graceMemory.metadataJson} ->> 'reportType' = ${"finance_weekly_exceptions"}`,
              sql`${graceMemory.metadataJson} ->> 'periodStart' = ${snapshot.periodStart}`
            )
          )
          .orderBy(desc(graceMemory.createdAt))
          .limit(1);

        if (existingAlert) {
          return { status: "skipped" as const, taskCreated: false };
        }

        const summary = buildFinanceExceptionSummary({
          organizationName: org.name,
          snapshot,
        });
        const details = buildFinanceExceptionDetails({
          organizationName: org.name,
          snapshot,
          generatedAt: new Date().toISOString(),
        });

        await db.insert(graceMemory).values({
          organizationId: org.id,
          memoryType: "org_pattern",
          summary,
          details,
          tags: ["finance_weekly_exceptions", "finance", "alerts"],
          metadataJson: {
            reportType: "finance_weekly_exceptions",
            periodStart: snapshot.periodStart,
            periodEnd: snapshot.periodEnd,
            periodLabel: snapshot.periodLabel,
            exceptionCount: snapshot.exceptions.length,
            exceptions: snapshot.exceptions,
          },
          createdByActorType: "system",
        });

        const taskTitle = `Finance exceptions review (${snapshot.periodLabel})`;
        const [openTask] = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(
              eq(tasks.organizationId, org.id),
              eq(tasks.title, taskTitle),
              inArray(tasks.status, ALERT_TASK_OPEN_STATUSES)
            )
          )
          .limit(1);

        if (openTask) {
          return { status: "created" as const, taskCreated: false };
        }

        await db.insert(tasks).values({
          organizationId: org.id,
          title: taskTitle,
          description: details,
          priority: "high",
          status: "todo",
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        return { status: "created" as const, taskCreated: true };
      });

      if (result.status === "created") {
        alertsCreated += 1;
        if (result.taskCreated) tasksCreated += 1;
      } else if (result.status === "skipped") {
        alertsSkipped += 1;
      } else {
        organizationsWithNoExceptions += 1;
      }
    }

    logger.info("Finance weekly exception alerts run complete", {
      organizations: orgs.length,
      alertsCreated,
      alertsSkipped,
      organizationsWithNoExceptions,
      tasksCreated,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    });

    return {
      organizations: orgs.length,
      alertsCreated,
      alertsSkipped,
      organizationsWithNoExceptions,
      tasksCreated,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    };
  }
);
