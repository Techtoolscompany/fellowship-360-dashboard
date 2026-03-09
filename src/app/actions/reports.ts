"use server";

import { db } from "@/db";
import {
  appointments,
  broadcasts,
  churchContacts,
  conversations,
  ministries,
  ministryMembers,
  prayerRequests,
  tasks,
  volunteers,
} from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { requireOrgMembership } from "./utils";

type Timeframe = "week" | "month" | "quarter" | "year";

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

export async function getReportsData(orgId: string, timeframe: Timeframe = "month") {
  await requireOrgMembership(orgId);
  const windowStart = getWindowStart(timeframe);
  const previousWindowStart = new Date(windowStart);

  if (timeframe === "week") previousWindowStart.setDate(windowStart.getDate() - 7);
  else if (timeframe === "quarter") previousWindowStart.setMonth(windowStart.getMonth() - 3);
  else if (timeframe === "year") previousWindowStart.setFullYear(windowStart.getFullYear() - 1);
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
      .where(eq(churchContacts.organizationId, orgId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.organizationId, orgId),
          gte(churchContacts.createdAt, windowStart)
        )
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.organizationId, orgId),
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
      .where(eq(volunteers.organizationId, orgId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, orgId),
          gte(appointments.dateTime, windowStart)
        )
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, orgId),
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
      .where(eq(tasks.organizationId, orgId)),
    db
      .select({
        total: sql<number>`count(*)`,
        resolved: sql<number>`count(*) filter (where ${conversations.status} = 'resolved')`,
      })
      .from(conversations)
      .where(eq(conversations.organizationId, orgId)),
    db
      .select({
        total: sql<number>`count(*)`,
        answered: sql<number>`count(*) filter (where ${prayerRequests.status} = 'answered')`,
      })
      .from(prayerRequests)
      .where(eq(prayerRequests.organizationId, orgId)),
    db
      .select({
        total: sql<number>`count(*)`,
        sent: sql<number>`count(*) filter (where ${broadcasts.status} = 'sent')`,
      })
      .from(broadcasts)
      .where(eq(broadcasts.organizationId, orgId)),
    db
      .select({
        id: ministries.id,
        name: ministries.name,
        members: sql<number>`count(${ministryMembers.id})`,
        growth: sql<number>`count(${ministryMembers.id}) filter (where ${ministryMembers.joinedAt} >= ${windowStart})`,
      })
      .from(ministries)
      .leftJoin(ministryMembers, eq(ministryMembers.ministryId, ministries.id))
      .where(eq(ministries.organizationId, orgId))
      .groupBy(ministries.id, ministries.name)
      .orderBy(sql`count(${ministryMembers.id}) desc`),
    db
      .select({
        createdAt: churchContacts.createdAt,
        memberStatus: churchContacts.memberStatus,
      })
      .from(churchContacts)
      .where(eq(churchContacts.organizationId, orgId)),
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

  const maxMinistryMembers = ministryRows.reduce(
    (max, row) => Math.max(max, Number(row.members ?? 0)),
    0
  );

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
    ministries: ministryRows.map((row) => ({
      name: row.name,
      members: Number(row.members ?? 0),
      growth: Number(row.growth ?? 0),
      participation: maxMinistryMembers
        ? Math.min(Math.round((Number(row.members ?? 0) / maxMinistryMembers) * 100), 100)
        : 0,
    })),
  };
}
