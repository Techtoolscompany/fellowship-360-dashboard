"use server";

import { db } from "@/db";
import {
  churchContacts,
  donations,
  prayerRequests,
  appointments,
  conversations,
  broadcasts,
  tasks,
  pipelineItems,
  pipelineStages,
} from "@/db/schema";
import { eq, sql, desc, count, sum } from "drizzle-orm";

/**
 * Aggregated dashboard data for the Grace AI + Ministry dashboards
 */
export async function getGraceDashboardData(orgId: string) {
  // Run all queries in parallel
  const [
    contactCount,
    donationData,
    prayerData,
    appointmentData,
    conversationData,
    broadcastData,
    taskData,
    pipelineData,
    recentDonations,
  ] = await Promise.all([
    // Total contacts
    db.select({ count: count() }).from(churchContacts).where(eq(churchContacts.organizationId, orgId)),

    // Donation stats
    db.select({
      total: sum(donations.amount),
      count: count(),
    }).from(donations).where(eq(donations.organizationId, orgId)),

    // Prayer request stats (statuses: new, praying, answered, archived)
    db.select({
      total: count(),
      new: count(sql`CASE WHEN ${prayerRequests.status} = 'new' THEN 1 END`),
      praying: count(sql`CASE WHEN ${prayerRequests.status} = 'praying' THEN 1 END`),
      answered: count(sql`CASE WHEN ${prayerRequests.status} = 'answered' THEN 1 END`),
      urgent: count(sql`CASE WHEN ${prayerRequests.urgency} = 'urgent' OR ${prayerRequests.urgency} = 'critical' THEN 1 END`),
    }).from(prayerRequests).where(eq(prayerRequests.organizationId, orgId)),

    // Appointment stats (statuses: scheduled, confirmed, completed, cancelled, no_show)
    db.select({
      total: count(),
      scheduled: count(sql`CASE WHEN ${appointments.status} = 'scheduled' THEN 1 END`),
      confirmed: count(sql`CASE WHEN ${appointments.status} = 'confirmed' THEN 1 END`),
      completed: count(sql`CASE WHEN ${appointments.status} = 'completed' THEN 1 END`),
    }).from(appointments).where(eq(appointments.organizationId, orgId)),

    // Conversation stats (statuses: open, waiting, resolved, archived)
    db.select({
      total: count(),
      open: count(sql`CASE WHEN ${conversations.status} = 'open' THEN 1 END`),
      waiting: count(sql`CASE WHEN ${conversations.status} = 'waiting' THEN 1 END`),
      resolved: count(sql`CASE WHEN ${conversations.status} = 'resolved' THEN 1 END`),
    }).from(conversations).where(eq(conversations.organizationId, orgId)),

    // Broadcast stats (statuses: draft, scheduled, sending, sent, failed)
    db.select({
      total: count(),
      sent: count(sql`CASE WHEN ${broadcasts.status} = 'sent' THEN 1 END`),
      totalRecipients: sum(broadcasts.totalRecipients),
    }).from(broadcasts).where(eq(broadcasts.organizationId, orgId)),

    // Task stats (statuses: todo, in_progress, done, cancelled)
    db.select({
      total: count(),
      done: count(sql`CASE WHEN ${tasks.status} = 'done' THEN 1 END`),
      todo: count(sql`CASE WHEN ${tasks.status} = 'todo' THEN 1 END`),
      inProgress: count(sql`CASE WHEN ${tasks.status} = 'in_progress' THEN 1 END`),
    }).from(tasks).where(eq(tasks.organizationId, orgId)),

    // Pipeline counts via stages (pipelineItems joined with stages for org scoping)
    db.select({
      total: count(),
    }).from(pipelineItems)
      .innerJoin(pipelineStages, eq(pipelineItems.stageId, pipelineStages.id))
      .where(eq(pipelineStages.organizationId, orgId)),

    // Recent donations for transaction history
    db.select({
      id: donations.id,
      amount: donations.amount,
      fund: donations.fund,
      method: donations.method,
      date: donations.date,
      donorName: sql<string>`CONCAT(${churchContacts.firstName}, ' ', ${churchContacts.lastName})`,
    }).from(donations)
      .leftJoin(churchContacts, eq(churchContacts.id, donations.contactId))
      .where(eq(donations.organizationId, orgId))
      .orderBy(desc(donations.date))
      .limit(5),
  ]);

  // Recent broadcasts
  const recentBroadcasts = await db.select({
    id: broadcasts.id,
    title: broadcasts.title,
    channel: broadcasts.channel,
    status: broadcasts.status,
    sentAt: broadcasts.sentAt,
    totalRecipients: broadcasts.totalRecipients,
  }).from(broadcasts)
    .where(eq(broadcasts.organizationId, orgId))
    .orderBy(desc(broadcasts.sentAt))
    .limit(4);

  // Pipeline stages with counts
  const stagesWithCounts = await db.select({
    name: pipelineStages.name,
    count: count(pipelineItems.id),
  }).from(pipelineStages)
    .leftJoin(pipelineItems, eq(pipelineItems.stageId, pipelineStages.id))
    .where(eq(pipelineStages.organizationId, orgId))
    .groupBy(pipelineStages.name, pipelineStages.order)
    .orderBy(pipelineStages.order)
    .limit(4);

  return {
    kpi: {
      totalContacts: contactCount[0]?.count ?? 0,
      totalDonations: Number(donationData[0]?.total ?? 0),
      donationCount: donationData[0]?.count ?? 0,
      broadcastsSent: broadcastData[0]?.sent ?? 0,
      totalRecipients: Number(broadcastData[0]?.totalRecipients ?? 0),
    },
    prayer: {
      total: prayerData[0]?.total ?? 0,
      pending: prayerData[0]?.new ?? 0,
      inProgress: prayerData[0]?.praying ?? 0,
      answered: prayerData[0]?.answered ?? 0,
      urgent: prayerData[0]?.urgent ?? 0,
    },
    appointments: {
      total: appointmentData[0]?.total ?? 0,
      pending: appointmentData[0]?.scheduled ?? 0,
      confirmed: appointmentData[0]?.confirmed ?? 0,
      completed: appointmentData[0]?.completed ?? 0,
    },
    conversations: {
      total: conversationData[0]?.total ?? 0,
      open: conversationData[0]?.open ?? 0,
      waiting: conversationData[0]?.waiting ?? 0,
      resolved: conversationData[0]?.resolved ?? 0,
    },
    tasks: {
      total: taskData[0]?.total ?? 0,
      completed: taskData[0]?.done ?? 0,
      pending: taskData[0]?.todo ?? 0,
      inProgress: taskData[0]?.inProgress ?? 0,
    },
    pipeline: {
      total: pipelineData[0]?.total ?? 0,
      stages: stagesWithCounts,
    },
    recentDonations,
    recentBroadcasts,
  };
}
