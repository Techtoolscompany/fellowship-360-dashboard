"use server";

import { db } from "@/db";
import {
  appointments,
  broadcasts,
  churchContacts,
  conversations,
  graceAuditStream,
  ministries,
  ministryMembers,
  prayerRequests,
  tasks,
  volunteers,
} from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { requireOrganizationSectionAccess } from "@/lib/access/section-guard";
import { shapeReportMinistryRows } from "@/lib/reports/ministry-row";
import * as z from "zod";

type Timeframe = "week" | "month" | "quarter" | "year";

const organizationIdSchema = z.string().trim().min(1);
const timeframeSchema = z.enum(["week", "month", "quarter", "year"]);
const modelHealthDaysSchema = z.coerce.number().int().min(1).max(90);

function getWindowStart(timeframe: Timeframe) {
  const now = new Date();
  const d = new Date(now);

  if (timeframe === "week") {
    d.setDate(now.getDate() - 7);
    return d;
  }
  if (timeframe === "quarter") {
    d.setMonth(now.getMonth() - 3);
    return d;
  }
  if (timeframe === "year") {
    d.setFullYear(now.getFullYear() - 1);
    return d;
  }

  d.setMonth(now.getMonth() - 1);
  return d;
}

function getMonthsBack(count: number) {
  const months: { key: string; label: string; start: Date; end: Date }[] = [];
  const now = new Date();
  const startOfCurrent = new Date(now.getFullYear(), now.getMonth(), 1);

  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(startOfCurrent.getFullYear(), startOfCurrent.getMonth() - i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const label = start.toLocaleDateString("en-US", { month: "short" });
    months.push({ key, label, start, end });
  }

  return months;
}

function percentChange(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[index] ?? 0;
}

export async function getReportsData(orgId: string, timeframe: Timeframe = "month") {
  const parsedOrgId = organizationIdSchema.parse(orgId);
  const parsedTimeframe = timeframeSchema.parse(timeframe);
  await requireOrganizationSectionAccess({
    organizationId: parsedOrgId,
    section: "reports",
  });
  const windowStart = getWindowStart(parsedTimeframe);
  const previousWindowStart = new Date(windowStart);

  if (parsedTimeframe === "week") previousWindowStart.setDate(windowStart.getDate() - 7);
  else if (parsedTimeframe === "quarter") previousWindowStart.setMonth(windowStart.getMonth() - 3);
  else if (parsedTimeframe === "year") previousWindowStart.setFullYear(windowStart.getFullYear() - 1);
  else previousWindowStart.setMonth(windowStart.getMonth() - 1);

  const [
    totalMembersRow,
    memberGrowthCurrentRow,
    memberGrowthPreviousRow,
    activeVolunteersRow,
    appointmentsCurrentRow,
    appointmentsPreviousRow,
    tasksStatsRow,
    conversationStatsRow,
    prayerStatsRow,
    broadcastStatsRow,
    ministryRows,
    contactRows,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(churchContacts)
      .where(eq(churchContacts.organizationId, parsedOrgId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.organizationId, parsedOrgId),
          gte(churchContacts.createdAt, windowStart)
        )
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.organizationId, parsedOrgId),
          gte(churchContacts.createdAt, previousWindowStart),
          sql`${churchContacts.createdAt} < ${windowStart}`
        )
      ),
    db
      .select({
        active: sql<number>`count(*) filter (where ${volunteers.status} = 'active')`,
        total: sql<number>`count(*)`,
      })
      .from(volunteers)
      .where(eq(volunteers.organizationId, parsedOrgId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, parsedOrgId),
          gte(appointments.dateTime, windowStart)
        )
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, parsedOrgId),
          gte(appointments.dateTime, previousWindowStart),
          sql`${appointments.dateTime} < ${windowStart}`
        )
      ),
    db
      .select({
        total: sql<number>`count(*)`,
        done: sql<number>`count(*) filter (where ${tasks.status} = 'done')`,
      })
      .from(tasks)
      .where(eq(tasks.organizationId, parsedOrgId)),
    db
      .select({
        total: sql<number>`count(*)`,
        resolved: sql<number>`count(*) filter (where ${conversations.status} = 'resolved')`,
      })
      .from(conversations)
      .where(eq(conversations.organizationId, parsedOrgId)),
    db
      .select({
        total: sql<number>`count(*)`,
        answered: sql<number>`count(*) filter (where ${prayerRequests.status} = 'answered')`,
      })
      .from(prayerRequests)
      .where(eq(prayerRequests.organizationId, parsedOrgId)),
    db
      .select({
        total: sql<number>`count(*)`,
        sent: sql<number>`count(*) filter (where ${broadcasts.status} = 'sent')`,
      })
      .from(broadcasts)
      .where(eq(broadcasts.organizationId, parsedOrgId)),
    db
      .select({
        id: ministries.id,
        name: ministries.name,
        leaderFirstName: churchContacts.firstName,
        leaderLastName: churchContacts.lastName,
        members: sql<number>`count(${ministryMembers.id})`,
        growth: sql<number>`count(${ministryMembers.id}) filter (where ${ministryMembers.joinedAt} >= ${windowStart})`,
      })
      .from(ministries)
      .leftJoin(ministryMembers, eq(ministryMembers.ministryId, ministries.id))
      .leftJoin(churchContacts, eq(ministries.leaderId, churchContacts.id))
      .where(eq(ministries.organizationId, parsedOrgId))
      .groupBy(
        ministries.id,
        ministries.name,
        churchContacts.firstName,
        churchContacts.lastName
      )
      .orderBy(sql`count(${ministryMembers.id}) desc`),
    db
      .select({
        createdAt: churchContacts.createdAt,
        memberStatus: churchContacts.memberStatus,
      })
      .from(churchContacts)
      .where(eq(churchContacts.organizationId, parsedOrgId)),
  ]);

  const months = getMonthsBack(6);

  const monthlyTrends = months.map((month) => {
    const contactRowsInMonth = contactRows.filter(
      (row) => row.createdAt >= month.start && row.createdAt < month.end
    );

    const visitors = contactRowsInMonth.length;
    const members = contactRowsInMonth.filter((row) =>
      row.memberStatus === "member" || row.memberStatus === "leader"
    ).length;

    return { month: month.label, visitors, members };
  });

  const tasksTotal = Number(tasksStatsRow[0]?.total ?? 0);
  const tasksDone = Number(tasksStatsRow[0]?.done ?? 0);
  const conversationTotal = Number(conversationStatsRow[0]?.total ?? 0);
  const conversationResolved = Number(conversationStatsRow[0]?.resolved ?? 0);
  const prayerTotal = Number(prayerStatsRow[0]?.total ?? 0);
  const prayerAnswered = Number(prayerStatsRow[0]?.answered ?? 0);
  const volunteerTotal = Number(activeVolunteersRow[0]?.total ?? 0);
  const volunteerActive = Number(activeVolunteersRow[0]?.active ?? 0);
  const broadcastTotal = Number(broadcastStatsRow[0]?.total ?? 0);
  const broadcastSent = Number(broadcastStatsRow[0]?.sent ?? 0);
  const appointmentsCurrent = Number(appointmentsCurrentRow[0]?.count ?? 0);
  const appointmentsPrevious = Number(appointmentsPreviousRow[0]?.count ?? 0);
  const memberGrowthCurrent = Number(memberGrowthCurrentRow[0]?.count ?? 0);
  const memberGrowthPrevious = Number(memberGrowthPreviousRow[0]?.count ?? 0);

  return {
    kpis: [
      {
        label: "Total Members",
        value: String(Number(totalMembersRow[0]?.count ?? 0)),
        change: `${percentChange(memberGrowthCurrent, memberGrowthPrevious) >= 0 ? "+" : ""}${percentChange(memberGrowthCurrent, memberGrowthPrevious).toFixed(0)}%`,
        trend: percentChange(memberGrowthCurrent, memberGrowthPrevious) >= 0 ? "up" : "down",
        icon: "users",
      },
      {
        label: "Appointments",
        value: String(appointmentsCurrent),
        change: `${percentChange(appointmentsCurrent, appointmentsPrevious) >= 0 ? "+" : ""}${percentChange(appointmentsCurrent, appointmentsPrevious).toFixed(0)}%`,
        trend: percentChange(appointmentsCurrent, appointmentsPrevious) >= 0 ? "up" : "down",
        icon: "calendar",
      },
      {
        label: "Tasks Completed",
        value: String(tasksDone),
        change: `${tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0}%`,
        trend: "up",
        icon: "check",
      },
      {
        label: "Active Volunteers",
        value: String(volunteerActive),
        change: `${volunteerTotal ? Math.round((volunteerActive / volunteerTotal) * 100) : 0}%`,
        trend: "up",
        icon: "heart",
      },
    ],
    engagement: [
      {
        label: "Task Completion",
        percentage: tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0,
      },
      {
        label: "Conversation Resolution",
        percentage: conversationTotal ? Math.round((conversationResolved / conversationTotal) * 100) : 0,
      },
      {
        label: "Prayer Requests Answered",
        percentage: prayerTotal ? Math.round((prayerAnswered / prayerTotal) * 100) : 0,
      },
      {
        label: "Volunteer Active Rate",
        percentage: volunteerTotal ? Math.round((volunteerActive / volunteerTotal) * 100) : 0,
      },
      {
        label: "Broadcasts Sent",
        percentage: broadcastTotal ? Math.round((broadcastSent / broadcastTotal) * 100) : 0,
      },
    ],
    monthlyTrends,
    ministries: shapeReportMinistryRows(ministryRows),
  };
}

export async function getModelHealthDashboard(orgId: string, days = 14) {
  const parsedOrgId = organizationIdSchema.parse(orgId);
  const safeDays = modelHealthDaysSchema.parse(days);
  await requireOrganizationSectionAccess({
    organizationId: parsedOrgId,
    section: "reports",
  });
  const windowStart = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      eventType: graceAuditStream.eventType,
      status: graceAuditStream.status,
      source: graceAuditStream.source,
      model: graceAuditStream.model,
      latencyMs: graceAuditStream.latencyMs,
      totalTokens: graceAuditStream.totalTokens,
      estimatedCostUsd: graceAuditStream.estimatedCostUsd,
      createdAt: graceAuditStream.createdAt,
    })
    .from(graceAuditStream)
    .where(
      and(
        eq(graceAuditStream.organizationId, parsedOrgId),
        gte(graceAuditStream.createdAt, windowStart)
      )
    );

  const aiDecisionRows = rows.filter((row) => row.eventType === "ai_decision");
  const actionRows = rows.filter((row) => row.eventType === "action_execution");
  const workflowRows = rows.filter((row) => row.eventType === "workflow_execution");

  const latencyValues = aiDecisionRows
    .map((row) => Number(row.latencyMs ?? 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const aiSuccessCount = aiDecisionRows.filter((row) => row.status === "success").length;
  const aiErrorCount = aiDecisionRows.filter((row) => row.status === "error").length;
  const actionErrorCount = actionRows.filter((row) => row.status === "error").length;
  const workflowErrorCount = workflowRows.filter((row) => row.status === "error").length;

  const totalTokens = rows.reduce(
    (sum, row) => sum + Number(row.totalTokens ?? 0),
    0
  );
  const estimatedCostUsd = Number(
    rows
      .reduce((sum, row) => sum + Number(row.estimatedCostUsd ?? 0), 0)
      .toFixed(6)
  );

  const modelMap = new Map<
    string,
    {
      total: number;
      success: number;
      error: number;
      latencyValues: number[];
      tokens: number;
      costUsd: number;
    }
  >();
  for (const row of aiDecisionRows) {
    const model = row.model || "unknown-model";
    const bucket = modelMap.get(model) ?? {
      total: 0,
      success: 0,
      error: 0,
      latencyValues: [],
      tokens: 0,
      costUsd: 0,
    };
    bucket.total += 1;
    if (row.status === "success") {
      bucket.success += 1;
    } else if (row.status === "error") {
      bucket.error += 1;
    }
    const latency = Number(row.latencyMs ?? 0);
    if (Number.isFinite(latency) && latency > 0) {
      bucket.latencyValues.push(latency);
    }
    bucket.tokens += Number(row.totalTokens ?? 0);
    bucket.costUsd += Number(row.estimatedCostUsd ?? 0);
    modelMap.set(model, bucket);
  }

  const byModel = Array.from(modelMap.entries())
    .map(([model, bucket]) => ({
      model,
      total: bucket.total,
      success: bucket.success,
      error: bucket.error,
      successRatePercent: bucket.total
        ? Number(((bucket.success / bucket.total) * 100).toFixed(1))
        : 0,
      avgLatencyMs: Math.round(average(bucket.latencyValues)),
      p95LatencyMs: Math.round(percentile(bucket.latencyValues, 95)),
      tokens: bucket.tokens,
      estimatedCostUsd: Number(bucket.costUsd.toFixed(6)),
    }))
    .sort((a, b) => b.total - a.total);

  const dayMap = new Map<
    string,
    {
      aiDecisions: number;
      aiErrors: number;
      totalTokens: number;
      estimatedCostUsd: number;
      avgLatencyMsSeed: number[];
    }
  >();
  for (const row of aiDecisionRows) {
    const dayKey = row.createdAt.toISOString().slice(0, 10);
    const bucket = dayMap.get(dayKey) ?? {
      aiDecisions: 0,
      aiErrors: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      avgLatencyMsSeed: [],
    };

    bucket.aiDecisions += 1;
    if (row.status === "error") {
      bucket.aiErrors += 1;
    }
    bucket.totalTokens += Number(row.totalTokens ?? 0);
    bucket.estimatedCostUsd += Number(row.estimatedCostUsd ?? 0);
    const latency = Number(row.latencyMs ?? 0);
    if (Number.isFinite(latency) && latency > 0) {
      bucket.avgLatencyMsSeed.push(latency);
    }

    dayMap.set(dayKey, bucket);
  }

  const byDay = Array.from(dayMap.entries())
    .map(([date, bucket]) => ({
      date,
      aiDecisions: bucket.aiDecisions,
      aiErrors: bucket.aiErrors,
      errorRatePercent: bucket.aiDecisions
        ? Number(((bucket.aiErrors / bucket.aiDecisions) * 100).toFixed(1))
        : 0,
      avgLatencyMs: Math.round(average(bucket.avgLatencyMsSeed)),
      totalTokens: bucket.totalTokens,
      estimatedCostUsd: Number(bucket.estimatedCostUsd.toFixed(6)),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    generatedAt: new Date(),
    windowDays: safeDays,
    windowStart,
    totals: {
      events: rows.length,
      aiDecisions: aiDecisionRows.length,
      actionExecutions: actionRows.length,
      workflowExecutions: workflowRows.length,
      aiSuccessCount,
      aiErrorCount,
      actionErrorCount,
      workflowErrorCount,
      aiSuccessRatePercent: aiDecisionRows.length
        ? Number(((aiSuccessCount / aiDecisionRows.length) * 100).toFixed(1))
        : 0,
      avgLatencyMs: Math.round(average(latencyValues)),
      p95LatencyMs: Math.round(percentile(latencyValues, 95)),
      totalTokens,
      estimatedCostUsd,
    },
    byModel,
    byDay,
  };
}
