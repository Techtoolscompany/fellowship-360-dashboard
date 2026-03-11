import { getContacts, getContactCount } from "@/app/actions/contacts";
import { getTasks } from "@/app/actions/tasks";
import { getAppointments } from "@/app/actions/operations";
import { getPrayerRequests } from "@/app/actions/prayer";
import { db } from "@/db";
import { graceFollowupProposals, graceGoals, graceMemory } from "@/db/schema";
import { and, desc, eq, gte, inArray } from "drizzle-orm";

/**
 * ContextManager fetches relevant church data and formats it
 * as a text block that gets injected into Gemini's system prompt.
 * This gives Grace awareness of the church's current state.
 */
export async function buildChurchContext(
  orgId: string,
  options?: { contactId?: string | null }
): Promise<string> {
  const sections: string[] = [];

  try {
    // ── Contacts ──
    const [contactsResult, contactCount] = await Promise.all([
      getContacts(orgId).catch(() => ({ contacts: [], total: 0, page: 1, pageSize: 50, pageCount: 0 })),
      getContactCount(orgId).catch(() => 0),
    ]);
    const contacts = contactsResult.contacts;

    const memberCount = contacts.filter((c: any) => c.memberStatus === "member").length;
    const visitorCount = contacts.filter((c: any) => c.memberStatus === "visitor").length;
    const volunteerCount = contacts.filter((c: any) => c.memberStatus === "volunteer").length;
    const leaderCount = contacts.filter((c: any) => c.memberStatus === "leader").length;

    sections.push(`### Contacts (${contactCount} total)
- Members: ${memberCount}
- Visitors: ${visitorCount}
- Volunteers: ${volunteerCount}
- Leaders: ${leaderCount}
${contacts.length > 0 ? `\nRecent contacts:\n${contacts.slice(0, 10).map((c: any) =>
  `- ${c.firstName} ${c.lastName} (${c.memberStatus})${c.email ? ` — ${c.email}` : ""}${c.phone ? ` — ${c.phone}` : ""}`
).join("\n")}` : ""}`);

    // ── Tasks ──
    const tasks = await getTasks(orgId).catch(() => []);
    const now = new Date();
    const today = now.toDateString();
    const pendingTasks = tasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled");
    const overdueTasks = pendingTasks.filter(
      (t: any) => t.dueDate && new Date(t.dueDate) < now
    );
    const todayTasks = pendingTasks.filter(
      (t: any) => t.dueDate && new Date(t.dueDate).toDateString() === today
    );
    const completedTasks = tasks.filter((t: any) => t.status === "done");

    sections.push(`### Tasks (${tasks.length} total)
- Pending: ${pendingTasks.length}
- Completed: ${completedTasks.length}
- Due today: ${todayTasks.length}
- Overdue: ${overdueTasks.length}
${overdueTasks.length > 0 ? `\nOverdue tasks:\n${overdueTasks.slice(0, 5).map((t: any) =>
  `- "${t.title}" (${t.priority} priority, due ${new Date(t.dueDate).toLocaleDateString()})`
).join("\n")}` : ""}
${todayTasks.length > 0 ? `\nDue today:\n${todayTasks.slice(0, 5).map((t: any) =>
  `- "${t.title}" (${t.priority} priority)`
).join("\n")}` : ""}`);

    // ── Appointments ──
    const appointmentsData = await getAppointments(orgId).catch(() => []);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);
    const upcomingAppts = appointmentsData.filter((a: any) => {
      const d = new Date(a.appointment.dateTime);
      return d >= now && d <= weekEnd;
    });

    sections.push(`### Appointments (${appointmentsData.length} total)
- This week: ${upcomingAppts.length}
${upcomingAppts.length > 0 ? `\nUpcoming this week:\n${upcomingAppts.slice(0, 5).map((a: any) =>
  `- "${a.appointment.title}" on ${new Date(a.appointment.dateTime).toLocaleDateString()} at ${new Date(a.appointment.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${a.contact ? ` with ${a.contact.firstName} ${a.contact.lastName}` : ""}`
).join("\n")}` : ""}`);

    // ── Prayer Requests ──
    const prayerRequests = await getPrayerRequests(orgId).catch(() => []);
    const activeRequests = prayerRequests.filter(
      (p: any) => p.status === "new" || p.status === "praying"
    );
    const urgentRequests = prayerRequests.filter((p: any) =>
      p.urgency === "urgent" || p.urgency === "critical"
    );
    const answeredRequests = prayerRequests.filter((p: any) => p.status === "answered");

    sections.push(`### Prayer Requests (${prayerRequests.length} total)
- Active: ${activeRequests.length}
- Urgent: ${urgentRequests.length}
- Answered: ${answeredRequests.length}
${urgentRequests.length > 0 ? `\nUrgent requests:\n${urgentRequests.slice(0, 5).map((p: any) =>
  `- ${p.isAnonymous === "true" ? "Anonymous" : (p.contactName || "Member")}: "${p.content?.slice(0, 80)}..."`
).join("\n")}` : ""}`);

    // ── Grace Assistant Context ──
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const [latestBriefing, pendingProposals, pendingGoals, orgPatterns, contactMemories] =
      await Promise.all([
        db
          .select({
            summary: graceMemory.summary,
            details: graceMemory.details,
            createdAt: graceMemory.createdAt,
          })
          .from(graceMemory)
          .where(
            and(
              eq(graceMemory.organizationId, orgId),
              eq(graceMemory.memoryType, "daily_briefing")
            )
          )
          .orderBy(desc(graceMemory.createdAt))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select({
            channel: graceFollowupProposals.proposedChannel,
            reason: graceFollowupProposals.reason,
            messageText: graceFollowupProposals.messageText,
            createdAt: graceFollowupProposals.createdAt,
          })
          .from(graceFollowupProposals)
          .where(
            and(
              eq(graceFollowupProposals.organizationId, orgId),
              eq(graceFollowupProposals.status, "pending"),
              gte(graceFollowupProposals.createdAt, threeDaysAgo)
            )
          )
          .orderBy(desc(graceFollowupProposals.createdAt))
          .limit(12),
        db
          .select({
            goalType: graceGoals.goalType,
            status: graceGoals.status,
            objectiveText: graceGoals.objectiveText,
            createdAt: graceGoals.createdAt,
          })
          .from(graceGoals)
          .where(
            and(
              eq(graceGoals.organizationId, orgId),
              inArray(graceGoals.status, ["queued", "in_progress", "waiting"])
            )
          )
          .orderBy(desc(graceGoals.createdAt))
          .limit(10),
        db
          .select({
            summary: graceMemory.summary,
            createdAt: graceMemory.createdAt,
          })
          .from(graceMemory)
          .where(
            and(
              eq(graceMemory.organizationId, orgId),
              eq(graceMemory.memoryType, "org_pattern")
            )
          )
          .orderBy(desc(graceMemory.createdAt))
          .limit(5),
        options?.contactId
          ? db
              .select({
                summary: graceMemory.summary,
                details: graceMemory.details,
                createdAt: graceMemory.createdAt,
              })
              .from(graceMemory)
              .where(
                and(
                  eq(graceMemory.organizationId, orgId),
                  eq(graceMemory.memoryType, "contact_memory"),
                  eq(graceMemory.contactId, options.contactId)
                )
              )
              .orderBy(desc(graceMemory.createdAt))
              .limit(8)
          : Promise.resolve([]),
      ]);

    const briefingText = latestBriefing
      ? (latestBriefing.details || latestBriefing.summary).slice(0, 600)
      : "No briefing generated yet.";

    sections.push(`### Grace Briefing & Queue
- Latest briefing: ${latestBriefing ? new Date(latestBriefing.createdAt).toLocaleDateString() : "none"}
- Pending follow-up proposals (3 days): ${pendingProposals.length}
- Pending goals: ${pendingGoals.length}
${briefingText ? `\nBriefing summary:\n- ${briefingText}` : ""}
${pendingProposals.length > 0 ? `\nPending proposals:\n${pendingProposals.slice(0, 6).map((proposal) =>
  `- ${proposal.channel || "unknown"} | ${proposal.reason || "no reason"} | ${proposal.messageText.slice(0, 100)}`
).join("\n")}` : ""}
${pendingGoals.length > 0 ? `\nPending goals:\n${pendingGoals.slice(0, 5).map((goal) =>
  `- [${goal.status}] ${goal.goalType}: ${goal.objectiveText.slice(0, 110)}`
).join("\n")}` : ""}
${orgPatterns.length > 0 ? `\nOrg patterns:\n${orgPatterns.slice(0, 4).map((pattern) =>
  `- ${pattern.summary.slice(0, 120)}`
).join("\n")}` : ""}
${contactMemories.length > 0 ? `\nContact memory:\n${contactMemories.slice(0, 5).map((memory) =>
  `- ${memory.summary}${memory.details ? ` (${memory.details.slice(0, 90)})` : ""}`
).join("\n")}` : ""}`);

  } catch (error) {
    console.error("Error building church context:", error);
    sections.push("*Note: Some data could not be retrieved at this time.*");
  }

  return sections.join("\n\n");
}
