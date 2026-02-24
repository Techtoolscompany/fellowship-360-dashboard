import { getContacts, getContactCount } from "@/app/actions/contacts";
import { getTasks } from "@/app/actions/tasks";
import { getAppointments } from "@/app/actions/operations";
import { getPrayerRequests } from "@/app/actions/prayer";

/**
 * ContextManager fetches relevant church data and formats it
 * as a text block that gets injected into Gemini's system prompt.
 * This gives Grace awareness of the church's current state.
 */
export async function buildChurchContext(orgId: string): Promise<string> {
  const sections: string[] = [];

  try {
    // ── Contacts ──
    const [contacts, contactCount] = await Promise.all([
      getContacts(orgId).catch(() => []),
      getContactCount(orgId).catch(() => 0),
    ]);

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
    const overdueTasks = tasks.filter((t: any) =>
      t.dueDate && new Date(t.dueDate) < now && t.status !== "completed"
    );
    const todayTasks = tasks.filter((t: any) =>
      t.dueDate && new Date(t.dueDate).toDateString() === today
    );
    const pendingTasks = tasks.filter((t: any) => t.status !== "completed");
    const completedTasks = tasks.filter((t: any) => t.status === "completed");

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
    const activeRequests = prayerRequests.filter((p: any) => p.status === "active");
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

  } catch (error) {
    console.error("Error building church context:", error);
    sections.push("*Note: Some data could not be retrieved at this time.*");
  }

  return sections.join("\n\n");
}
