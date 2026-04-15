"use server";

import { db } from "@/db";
import {
  churchContacts,
  prayerRequests,
  appointments,
  conversations,
  broadcasts,
  tasks,
  pipelineItems,
  pipelineStages,
  donations,
  attendanceEntries,
  attendanceSessions,
  graceFollowupProposals,
  graceHandoffs,
  serviceAssignments,
  serviceRuns,
} from "@/db/schema";
import { eq, sql, desc, count, sum, or, and, gte, lte, asc } from "drizzle-orm";
import { startOfWeek, endOfWeek } from "date-fns";
import { requireOrgMembership } from "./utils";
import * as z from "zod";

const organizationIdSchema = z.string().trim().min(1);
const SETUP_REQUIRED_CODES = new Set(["42P01", "42703"]);

type WeeklyCountRow = {
  date: Date;
  count: number | string | null;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }

  return "";
}

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code?: unknown }).code ?? "");
  }

  return "";
}

function isSetupRequiredError(error: unknown, identifierPattern: RegExp) {
  const message = getErrorMessage(error);
  if (!message || !identifierPattern.test(message)) {
    return false;
  }

  const code = getErrorCode(error);
  return (
    SETUP_REQUIRED_CODES.has(code) ||
    /relation\s+".+"\s+does not exist/i.test(message) ||
    /column\s+".+"\s+does not exist/i.test(message) ||
    /column\s+.+\s+does not exist/i.test(message)
  );
}

function isAttendanceSetupRequiredError(error: unknown) {
  return isSetupRequiredError(error, /\battendance_(entry|session)\b/i);
}

function isServiceCheckinSetupRequiredError(error: unknown) {
  return isSetupRequiredError(error, /\bservice_(assignment|run)\b/i);
}

async function getWeeklyAttendanceRows(
  organizationId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyCountRow[]> {
  return db
    .select({
      date: attendanceSessions.occurredAt,
      count: count(),
    })
    .from(attendanceEntries)
    .innerJoin(attendanceSessions, eq(attendanceEntries.sessionId, attendanceSessions.id))
    .where(
      and(
        eq(attendanceEntries.organizationId, organizationId),
        gte(attendanceSessions.occurredAt, weekStart),
        lte(attendanceSessions.occurredAt, weekEnd),
        or(eq(attendanceEntries.status, "present"), eq(attendanceEntries.status, "served"))
      )
    )
    .groupBy(attendanceSessions.occurredAt)
    .orderBy(attendanceSessions.occurredAt);
}

async function getWeeklyServiceAttendanceRows(
  organizationId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyCountRow[]> {
  return db
    .select({
      date: serviceRuns.serviceAt,
      count: count(),
    })
    .from(serviceAssignments)
    .innerJoin(serviceRuns, eq(serviceAssignments.serviceRunId, serviceRuns.id))
    .where(
      and(
        eq(serviceAssignments.organizationId, organizationId),
        gte(serviceRuns.serviceAt, weekStart),
        lte(serviceRuns.serviceAt, weekEnd),
        sql`${serviceAssignments.checkedInAt} is not null`
      )
    )
    .groupBy(serviceRuns.serviceAt)
    .orderBy(serviceRuns.serviceAt);
}

/**
 * Aggregated dashboard data for the Grace AI + Ministry dashboards
 */
export async function getGraceDashboardData(orgId: string) {
  const parsedOrgId = organizationIdSchema.parse(orgId);
  await requireOrgMembership(parsedOrgId);
  // Run all queries in parallel
  const [
    contactCount,
    prayerData,
    appointmentData,
    conversationData,
    broadcastData,
    taskData,
    pipelineData,
  ] = await Promise.all([
    // Total contacts
    db.select({ count: count() }).from(churchContacts).where(eq(churchContacts.organizationId, parsedOrgId)),

    // Prayer request stats (statuses: new, praying, answered, archived)
    db.select({
      total: count(),
      new: count(sql`CASE WHEN ${prayerRequests.status} = 'new' THEN 1 END`),
      praying: count(sql`CASE WHEN ${prayerRequests.status} = 'praying' THEN 1 END`),
      answered: count(sql`CASE WHEN ${prayerRequests.status} = 'answered' THEN 1 END`),
      urgent: count(sql`CASE WHEN ${prayerRequests.urgency} = 'urgent' OR ${prayerRequests.urgency} = 'critical' THEN 1 END`),
    }).from(prayerRequests).where(eq(prayerRequests.organizationId, parsedOrgId)),

    // Appointment stats (statuses: scheduled, confirmed, completed, cancelled, no_show)
    db.select({
      total: count(),
      scheduled: count(sql`CASE WHEN ${appointments.status} = 'scheduled' THEN 1 END`),
      confirmed: count(sql`CASE WHEN ${appointments.status} = 'confirmed' THEN 1 END`),
      completed: count(sql`CASE WHEN ${appointments.status} = 'completed' THEN 1 END`),
    }).from(appointments).where(eq(appointments.organizationId, parsedOrgId)),

    // Conversation stats (statuses: open, waiting, resolved, archived)
    db.select({
      total: count(),
      open: count(sql`CASE WHEN ${conversations.status} = 'open' THEN 1 END`),
      waiting: count(sql`CASE WHEN ${conversations.status} = 'waiting' THEN 1 END`),
      resolved: count(sql`CASE WHEN ${conversations.status} = 'resolved' THEN 1 END`),
      archived: count(sql`CASE WHEN ${conversations.status} = 'archived' THEN 1 END`),
    }).from(conversations).where(eq(conversations.organizationId, parsedOrgId)),

    // Broadcast stats (statuses: draft, scheduled, sending, sent, failed)
    db.select({
      total: count(),
      sent: count(sql`CASE WHEN ${broadcasts.status} = 'sent' THEN 1 END`),
      totalRecipients: sum(broadcasts.totalRecipients),
    }).from(broadcasts).where(eq(broadcasts.organizationId, parsedOrgId)),

    // Task stats (statuses: todo, in_progress, done, cancelled)
    db.select({
      total: count(),
      done: count(sql`CASE WHEN ${tasks.status} = 'done' THEN 1 END`),
      todo: count(sql`CASE WHEN ${tasks.status} = 'todo' THEN 1 END`),
      inProgress: count(sql`CASE WHEN ${tasks.status} = 'in_progress' THEN 1 END`),
    }).from(tasks).where(eq(tasks.organizationId, parsedOrgId)),

    // Pipeline counts via stages (pipelineItems joined with stages for org scoping)
    db.select({
      total: count(),
    }).from(pipelineItems)
      .innerJoin(pipelineStages, eq(pipelineItems.stageId, pipelineStages.id))
      .where(eq(pipelineStages.organizationId, parsedOrgId)),
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
    .where(eq(broadcasts.organizationId, parsedOrgId))
    .orderBy(desc(broadcasts.sentAt))
    .limit(4);

  // Pipeline stages with counts
  const stagesWithCounts = await db.select({
    name: pipelineStages.name,
    count: count(pipelineItems.id),
  }).from(pipelineStages)
    .leftJoin(pipelineItems, eq(pipelineItems.stageId, pipelineStages.id))
    .where(eq(pipelineStages.organizationId, parsedOrgId))
    .groupBy(pipelineStages.name, pipelineStages.order)
    .orderBy(pipelineStages.order)
    .limit(4);

  // Weekly attendance from first-class attendance plus service check-ins.
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  const [weeklyAttendance, weeklyServiceAttendance] = await Promise.all([
    getWeeklyAttendanceRows(parsedOrgId, weekStart, weekEnd).catch((error) => {
      if (isAttendanceSetupRequiredError(error)) {
        return [];
      }

      throw error;
    }),
    getWeeklyServiceAttendanceRows(parsedOrgId, weekStart, weekEnd).catch((error) => {
      if (isServiceCheckinSetupRequiredError(error)) {
        return [];
      }

      throw error;
    }),
  ]);

  // Format attendance by day of week
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const attendanceByDay = daysOfWeek.map((day, index) => {
    const combinedCount =
      weeklyAttendance
        .filter((entry) => new Date(entry.date).getDay() === index)
        .reduce((sum, entry) => sum + Number(entry.count ?? 0), 0) +
      weeklyServiceAttendance
        .filter((entry) => new Date(entry.date).getDay() === index)
        .reduce((sum, entry) => sum + Number(entry.count ?? 0), 0);
    return {
      day,
      count: combinedCount,
    };
  });

  // Recent donations for activity feed
  const recentDonations = await db.select({
    id: donations.id,
    amount: donations.amount,
    date: donations.date,
    fund: donations.fund,
  }).from(donations)
    .where(eq(donations.organizationId, parsedOrgId))
    .orderBy(desc(donations.date))
    .limit(3);

  // Total giving for the year
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearlyGiving = await db.select({
    total: sum(donations.amount),
  }).from(donations)
    .where(
      and(
        eq(donations.organizationId, parsedOrgId),
        gte(donations.date, yearStart)
      )
    );

  // Build activity feed from various sources
  const activities: Array<{
    id: string;
    type: 'contact' | 'donation' | 'task' | 'appointment' | 'prayer';
    title: string;
    detail: string;
    date: Date;
    icon: string;
    color: string;
  }> = [];

  // Add recent contacts
  const recentContacts = await db.select({
    id: churchContacts.id,
    firstName: churchContacts.firstName,
    lastName: churchContacts.lastName,
    createdAt: churchContacts.createdAt,
  }).from(churchContacts)
    .where(eq(churchContacts.organizationId, parsedOrgId))
    .orderBy(desc(churchContacts.createdAt))
    .limit(2);

  recentContacts.forEach(c => {
    activities.push({
      id: c.id,
      type: 'contact',
      title: 'New contact added',
      detail: `${c.firstName} ${c.lastName}`,
      date: new Date(c.createdAt),
      icon: 'users',
      color: '#6366f1',
    });
  });

  // Add recent donations
  recentDonations.forEach(d => {
    activities.push({
      id: d.id,
      type: 'donation',
      title: 'Donation received',
      detail: `$${Number(d.amount).toFixed(2)} to ${d.fund || 'General Fund'}`,
      date: new Date(d.date),
      icon: 'dollar-sign',
      color: '#059669',
    });
  });

  // Add recent tasks completed
  const recentTasks = await db.select({
    id: tasks.id,
    title: tasks.title,
    status: tasks.status,
    updatedAt: tasks.updatedAt,
  }).from(tasks)
    .where(eq(tasks.organizationId, parsedOrgId))
    .orderBy(desc(tasks.updatedAt))
    .limit(2);

  recentTasks.forEach(t => {
    activities.push({
      id: t.id,
      type: 'task',
      title: t.status === 'done' ? 'Task completed' : 'Task updated',
      detail: t.title,
      date: new Date(t.updatedAt),
      icon: 'check-circle',
      color: '#059669',
    });
  });

  // Sort activities by date (most recent first)
  activities.sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    kpi: {
      totalContacts: contactCount[0]?.count ?? 0,
      broadcastsSent: broadcastData[0]?.sent ?? 0,
      totalRecipients: Number(broadcastData[0]?.totalRecipients ?? 0),
      yearlyGiving: Number(yearlyGiving[0]?.total ?? 0),
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
      weeklyAttendance: attendanceByDay,
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
    recentBroadcasts,
    activities: activities.slice(0, 6),
  };
}

type StaffCareQueueItem = {
  id: string;
  source:
    | "prayer_request"
    | "conversation"
    | "task"
    | "appointment"
    | "grace_followup"
    | "grace_handoff";
  title: string;
  detail: string;
  status: string;
  priority: "low" | "medium" | "high" | "urgent";
  dueAt: Date | null;
  contactId: string | null;
  contactName: string | null;
  href: string;
  createdAt: Date;
  ownerId: string | null;
  overdue: boolean;
};

const PRIORITY_RANK: Record<StaffCareQueueItem["priority"], number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function formatContactName(contact: { firstName: string | null; lastName: string | null } | null) {
  if (!contact) return null;
  const fullName = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim();
  return fullName || null;
}

export async function getStaffCareQueue(orgId: string) {
  const parsedOrgId = organizationIdSchema.parse(orgId);
  await requireOrgMembership(parsedOrgId);
  const now = new Date();
  const soonWindow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const [
    prayerRows,
    conversationRows,
    taskRows,
    appointmentRows,
    followupRows,
    handoffRows,
  ] = await Promise.all([
    db
      .select({
        request: prayerRequests,
        contact: {
          id: churchContacts.id,
          firstName: churchContacts.firstName,
          lastName: churchContacts.lastName,
        },
      })
      .from(prayerRequests)
      .leftJoin(churchContacts, eq(prayerRequests.contactId, churchContacts.id))
      .where(
        and(
          eq(prayerRequests.organizationId, parsedOrgId),
          or(eq(prayerRequests.status, "new"), eq(prayerRequests.status, "praying"))
        )
      )
      .orderBy(desc(prayerRequests.updatedAt))
      .limit(20),
    db
      .select({
        conversation: conversations,
        contact: {
          id: churchContacts.id,
          firstName: churchContacts.firstName,
          lastName: churchContacts.lastName,
        },
      })
      .from(conversations)
      .leftJoin(churchContacts, eq(conversations.contactId, churchContacts.id))
      .where(
        and(
          eq(conversations.organizationId, parsedOrgId),
          or(eq(conversations.status, "open"), eq(conversations.status, "waiting"))
        )
      )
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.updatedAt))
      .limit(20),
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, parsedOrgId),
          or(eq(tasks.status, "todo"), eq(tasks.status, "in_progress")),
          lte(tasks.dueDate, now)
        )
      )
      .orderBy(desc(tasks.priority), asc(tasks.dueDate))
      .limit(20),
    db
      .select({
        appointment: appointments,
        contact: {
          id: churchContacts.id,
          firstName: churchContacts.firstName,
          lastName: churchContacts.lastName,
        },
      })
      .from(appointments)
      .leftJoin(churchContacts, eq(appointments.contactId, churchContacts.id))
      .where(
        and(
          eq(appointments.organizationId, parsedOrgId),
          or(eq(appointments.status, "scheduled"), eq(appointments.status, "confirmed")),
          lte(appointments.dateTime, soonWindow)
        )
      )
      .orderBy(appointments.dateTime)
      .limit(20),
    db
      .select({
        proposal: graceFollowupProposals,
        contact: {
          id: churchContacts.id,
          firstName: churchContacts.firstName,
          lastName: churchContacts.lastName,
        },
      })
      .from(graceFollowupProposals)
      .leftJoin(churchContacts, eq(graceFollowupProposals.contactId, churchContacts.id))
      .where(
        and(
          eq(graceFollowupProposals.organizationId, parsedOrgId),
          eq(graceFollowupProposals.status, "pending")
        )
      )
      .orderBy(desc(graceFollowupProposals.createdAt))
      .limit(20),
    db
      .select({
        handoff: graceHandoffs,
        contact: {
          id: churchContacts.id,
          firstName: churchContacts.firstName,
          lastName: churchContacts.lastName,
        },
      })
      .from(graceHandoffs)
      .leftJoin(churchContacts, eq(graceHandoffs.contactId, churchContacts.id))
      .where(
        and(
          eq(graceHandoffs.organizationId, parsedOrgId),
          or(eq(graceHandoffs.status, "open"), eq(graceHandoffs.status, "acknowledged"))
        )
      )
      .orderBy(desc(graceHandoffs.createdAt))
      .limit(20),
  ]);

  const items: StaffCareQueueItem[] = [
    ...prayerRows.map(({ request, contact }): StaffCareQueueItem => ({
      id: `prayer:${request.id}`,
      source: "prayer_request" as const,
      title: request.contactName || formatContactName(contact) || "Prayer request",
      detail: request.content,
      status: request.status,
      priority:
        request.urgency === "critical"
          ? "urgent"
          : request.urgency === "urgent"
            ? "high"
            : "medium",
      dueAt: null,
      contactId: request.contactId ?? contact?.id ?? null,
      contactName: request.contactName || formatContactName(contact),
      href: "/app/grace?tab=home",
      createdAt: request.updatedAt ?? request.createdAt,
      ownerId: null,
      overdue: request.urgency === "critical",
    })),
    ...conversationRows.map(({ conversation, contact }): StaffCareQueueItem => ({
      id: `conversation:${conversation.id}`,
      source: "conversation" as const,
      title: formatContactName(contact) || conversation.subject || "Conversation follow-up",
      detail: conversation.subject || `${conversation.channel} conversation requires response`,
      status: conversation.status,
      priority: conversation.status === "waiting" ? "high" : "medium",
      dueAt: conversation.lastMessageAt ?? conversation.updatedAt ?? conversation.createdAt,
      contactId: conversation.contactId ?? contact?.id ?? null,
      contactName: formatContactName(contact),
      href: `/app/grace?tab=care&conversationId=${conversation.id}`,
      createdAt: conversation.updatedAt ?? conversation.createdAt,
      ownerId: conversation.assigneeId ?? null,
      overdue:
        new Date(
          conversation.lastMessageAt ?? conversation.updatedAt ?? conversation.createdAt
        ).getTime() <=
        now.getTime() - 24 * 60 * 60 * 1000,
    })),
    ...taskRows.map((task): StaffCareQueueItem => ({
      id: `task:${task.id}`,
      source: "task" as const,
      title: task.title,
      detail: task.description ?? "Manual follow-up task",
      status: task.status,
      priority: task.priority,
      dueAt: task.dueDate ?? null,
      contactId: null,
      contactName: null,
      href: "/app/tasks",
      createdAt: task.updatedAt ?? task.createdAt,
      ownerId: task.assigneeId ?? null,
      overdue: Boolean(task.dueDate && new Date(task.dueDate).getTime() < now.getTime()),
    })),
    ...appointmentRows.map(({ appointment, contact }): StaffCareQueueItem => ({
      id: `appointment:${appointment.id}`,
      source: "appointment" as const,
      title: appointment.title,
      detail: formatContactName(contact) || appointment.type || "Pending appointment",
      status: appointment.status,
      priority: new Date(appointment.dateTime).getTime() < now.getTime() ? "high" : "medium",
      dueAt: appointment.dateTime,
      contactId: appointment.contactId ?? contact?.id ?? null,
      contactName: formatContactName(contact),
      href: "/app/calendar",
      createdAt: appointment.createdAt,
      ownerId: appointment.staffId ?? null,
      overdue: new Date(appointment.dateTime).getTime() < now.getTime(),
    })),
    ...followupRows.map(({ proposal, contact }): StaffCareQueueItem => ({
      id: `proposal:${proposal.id}`,
      source: "grace_followup" as const,
      title: formatContactName(contact) || proposal.subject || "Grace follow-up proposal",
      detail: proposal.reason || proposal.messageText,
      status: proposal.status,
      priority:
        proposal.reason?.includes("urgent") || proposal.reason?.includes("critical")
          ? "high"
          : "medium",
      dueAt: proposal.createdAt,
      contactId: proposal.contactId ?? contact?.id ?? null,
      contactName: formatContactName(contact),
      href: "/app/grace?tab=workflow",
      createdAt: proposal.createdAt,
      ownerId: proposal.approvedByUserId ?? null,
      overdue: new Date(proposal.createdAt).getTime() <= now.getTime() - 24 * 60 * 60 * 1000,
    })),
    ...handoffRows.map(({ handoff, contact }): StaffCareQueueItem => ({
      id: `handoff:${handoff.id}`,
      source: "grace_handoff" as const,
      title: formatContactName(contact) || handoff.reason.replaceAll("_", " "),
      detail: handoff.summaryText ?? handoff.assignedTeam ?? "Human follow-up required",
      status: handoff.status,
      priority: handoff.status === "open" ? "high" : "medium",
      dueAt: handoff.createdAt,
      contactId: handoff.contactId ?? contact?.id ?? null,
      contactName: formatContactName(contact),
      href: "/app/grace?tab=workflow",
      createdAt: handoff.createdAt,
      ownerId: null,
      overdue: new Date(handoff.createdAt).getTime() <= now.getTime() - 24 * 60 * 60 * 1000,
    })),
  ]
    .sort((a, b) => {
      const priorityDelta = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, 40);

  return {
    generatedAt: now,
    counts: {
      total: items.length,
      overdue: items.filter((item) => item.overdue).length,
      urgent: items.filter((item) => item.priority === "urgent").length,
      high: items.filter((item) => item.priority === "high").length,
    },
    items,
  };
}
