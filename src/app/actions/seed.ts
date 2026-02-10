"use server";

import { db } from "@/db";
import {
  churchContacts,
  pipelineStages,
  pipelineItems,
  tasks,
  events,
  prayerRequests,
  donations,
  pledges,
  ministries,
  ministryMembers,
  appointments,
  volunteers,
  conversations,
  messages,
  broadcasts,
  messageTemplates,
} from "@/db/schema";
import { sql } from "drizzle-orm";

export async function seedDemoData(orgId: string) {
  // ── 1. Contacts ──
  const contactData = [
    { firstName: "Jennifer", lastName: "Martinez", email: "jennifer.m@email.com", phone: "555-101-2001", memberStatus: "visitor" as const, source: "walk_in" as const },
    { firstName: "Carlos", lastName: "Rodriguez", email: "carlos.r@email.com", phone: "555-102-2002", memberStatus: "visitor" as const, source: "referral" as const },
    { firstName: "Amanda", lastName: "Chen", email: "amanda.c@email.com", phone: "555-103-2003", memberStatus: "prospect" as const, source: "website" as const },
    { firstName: "David", lastName: "Kim", email: "david.k@email.com", phone: "555-104-2004", memberStatus: "member" as const, source: "walk_in" as const },
    { firstName: "Sarah", lastName: "Johnson", email: "sarah.j@email.com", phone: "555-105-2005", memberStatus: "leader" as const, source: "walk_in" as const },
    { firstName: "Michael", lastName: "Davis", email: "michael.d@email.com", phone: "555-106-2006", memberStatus: "member" as const, source: "event" as const },
    { firstName: "Emily", lastName: "White", email: "emily.w@email.com", phone: "555-107-2007", memberStatus: "member" as const, source: "referral" as const },
    { firstName: "Robert", lastName: "Brown", email: "robert.b@email.com", phone: "555-108-2008", memberStatus: "regular_attendee" as const, source: "walk_in" as const },
    { firstName: "Lisa", lastName: "Thompson", email: "lisa.t@email.com", phone: "555-109-2009", memberStatus: "member" as const, source: "social_media" as const },
    { firstName: "James", lastName: "Williams", email: "james.w@email.com", phone: "555-110-2010", memberStatus: "leader" as const, source: "walk_in" as const },
    { firstName: "Maria", lastName: "Garcia", email: "maria.g@email.com", phone: "555-111-2011", memberStatus: "visitor" as const, source: "event" as const },
    { firstName: "Kevin", lastName: "Lee", email: "kevin.l@email.com", phone: "555-112-2012", memberStatus: "regular_attendee" as const, source: "referral" as const },
  ];

  const insertedContacts = await db
    .insert(churchContacts)
    .values(contactData.map((c) => ({ ...c, organizationId: orgId })))
    .returning();

  // ── 2. Pipeline stages + items ──
  const stageData = [
    { name: "First-Time Visitors", color: "#6366f1", order: 0 },
    { name: "Attempted Contact", color: "#f59e0b", order: 1 },
    { name: "Connected", color: "#10b981", order: 2 },
    { name: "Membership Class", color: "#3b82f6", order: 3 },
    { name: "New Members", color: "#8b5cf6", order: 4 },
    { name: "Inactive / Lost", color: "#6b7280", order: 5 },
  ];
  const insertedStages = await db
    .insert(pipelineStages)
    .values(stageData.map((s) => ({ ...s, organizationId: orgId })))
    .returning();

  // Place contacts in pipeline
  await db.insert(pipelineItems).values([
    { contactId: insertedContacts[0].id, stageId: insertedStages[0].id, order: 0, priority: "high" as const, organizationId: orgId },
    { contactId: insertedContacts[1].id, stageId: insertedStages[0].id, order: 1, priority: "medium" as const, organizationId: orgId },
    { contactId: insertedContacts[10].id, stageId: insertedStages[0].id, order: 2, priority: "medium" as const, organizationId: orgId },
    { contactId: insertedContacts[2].id, stageId: insertedStages[1].id, order: 0, priority: "high" as const, organizationId: orgId },
    { contactId: insertedContacts[11].id, stageId: insertedStages[1].id, order: 1, priority: "low" as const, organizationId: orgId },
    { contactId: insertedContacts[3].id, stageId: insertedStages[2].id, order: 0, priority: "medium" as const, organizationId: orgId },
    { contactId: insertedContacts[7].id, stageId: insertedStages[2].id, order: 1, priority: "low" as const, organizationId: orgId },
    { contactId: insertedContacts[5].id, stageId: insertedStages[3].id, order: 0, priority: "medium" as const, organizationId: orgId },
    { contactId: insertedContacts[8].id, stageId: insertedStages[3].id, order: 1, priority: "high" as const, organizationId: orgId },
  ]);

  // ── 3. Tasks ──
  await db.insert(tasks).values([
    { title: "Follow up with Jennifer Martinez", description: "Call to invite to next Sunday service", priority: "high" as const, status: "todo" as const, dueDate: new Date(Date.now() + 86400000), organizationId: orgId },
    { title: "Prepare new member orientation", description: "Set up materials and schedule for Saturday class", priority: "medium" as const, status: "in_progress" as const, dueDate: new Date(Date.now() + 3 * 86400000), organizationId: orgId },
    { title: "Update church directory", description: "Add all new contacts from last month", priority: "low" as const, status: "todo" as const, organizationId: orgId },
    { title: "Plan volunteer appreciation event", description: "Coordinate with kitchen team for lunch reception", priority: "medium" as const, status: "todo" as const, dueDate: new Date(Date.now() + 14 * 86400000), organizationId: orgId },
    { title: "Send weekly newsletter", description: "Include upcoming events and prayer list", priority: "high" as const, status: "done" as const, organizationId: orgId },
  ]);

  // ── 4. Events ──
  const now = new Date();
  await db.insert(events).values([
    { title: "Sunday Worship Service", description: "Main worship service", startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + (7 - now.getDay()), 10, 0), location: "Main Sanctuary", isRecurring: true, organizationId: orgId },
    { title: "Wednesday Bible Study", description: "Midweek study group", startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + (3 - now.getDay() + 7) % 7, 19, 0), location: "Fellowship Hall", isRecurring: true, organizationId: orgId },
    { title: "Youth Group Meeting", startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + (5 - now.getDay() + 7) % 7, 18, 0), location: "Youth Center", organizationId: orgId },
    { title: "Community Outreach", description: "Food pantry and clothing drive", startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14, 9, 0), location: "Fellowship Hall", organizationId: orgId },
    { title: "Easter Planning Meeting", startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 14, 0), location: "Conference Room", organizationId: orgId },
  ]);

  // ── 5. Prayer Requests ──
  await db.insert(prayerRequests).values([
    { contactId: insertedContacts[4].id, contactName: "Sarah Johnson", content: "Praying for healing from surgery recovery", urgency: "urgent" as const, status: "praying" as const, assignedTeam: "Prayer Team", organizationId: orgId },
    { contactId: insertedContacts[6].id, contactName: "Emily White", content: "Job search guidance and patience", urgency: "normal" as const, status: "new" as const, organizationId: orgId },
    { contactName: "Anonymous", content: "Family restoration and reconciliation", urgency: "critical" as const, status: "praying" as const, isAnonymous: "true", assignedTeam: "Pastoral Team", organizationId: orgId },
    { contactId: insertedContacts[7].id, contactName: "Robert Brown", content: "Safe travels for upcoming mission trip", urgency: "normal" as const, status: "new" as const, organizationId: orgId },
    { contactId: insertedContacts[3].id, contactName: "David Kim", content: "Thanksgiving for new baby — healthy delivery!", urgency: "normal" as const, status: "answered" as const, response: "Baby born healthy, 7lbs 3oz!", organizationId: orgId },
  ]);

  // ── 6. Donations ──
  const months = [0, 1, 2, 3, 4].map((m) => {
    const d = new Date();
    d.setMonth(d.getMonth() - m);
    return d;
  });
  const donationValues = [];
  for (const month of months) {
    for (let i = 0; i < 6; i++) {
      const contact = insertedContacts[Math.floor(Math.random() * insertedContacts.length)];
      donationValues.push({
        contactId: contact.id,
        amount: Math.round((Math.random() * 500 + 25) * 100) / 100,
        date: new Date(month.getFullYear(), month.getMonth(), Math.floor(Math.random() * 28) + 1),
        method: (["cash", "check", "card", "online"] as const)[Math.floor(Math.random() * 4)],
        fund: ["General", "Building Fund", "Missions", "Youth"][Math.floor(Math.random() * 4)],
        organizationId: orgId,
      });
    }
  }
  await db.insert(donations).values(donationValues);

  // ── 7. Pledges ──
  await db.insert(pledges).values([
    { contactId: insertedContacts[4].id, totalAmount: 5000, amountPaid: 2500, frequency: "monthly" as const, fund: "Building Fund", startDate: new Date(2024, 0, 1), endDate: new Date(2024, 11, 31), organizationId: orgId },
    { contactId: insertedContacts[9].id, totalAmount: 12000, amountPaid: 8000, frequency: "monthly" as const, fund: "General", startDate: new Date(2024, 0, 1), organizationId: orgId },
    { contactId: insertedContacts[3].id, totalAmount: 1200, amountPaid: 300, frequency: "quarterly" as const, fund: "Missions", startDate: new Date(2024, 3, 1), organizationId: orgId },
  ]);

  // ── 8. Ministries ──
  const insertedMinistries = await db.insert(ministries).values([
    { name: "Worship Team", description: "Music and worship leading", meetingDay: "Wednesday", meetingTime: "7:00 PM", meetingLocation: "Sanctuary", leaderId: insertedContacts[4].id, organizationId: orgId },
    { name: "Children's Ministry", description: "Sunday school and kids programs", meetingDay: "Sunday", meetingTime: "9:30 AM", meetingLocation: "Kids Wing", leaderId: insertedContacts[9].id, organizationId: orgId },
    { name: "Youth Ministry", description: "Teen programs and mentoring", meetingDay: "Friday", meetingTime: "6:00 PM", meetingLocation: "Youth Center", organizationId: orgId },
    { name: "Outreach & Missions", description: "Community service and global missions", meetingDay: "Saturday", meetingTime: "10:00 AM", organizationId: orgId },
  ]).returning();

  // Add ministry members
  await db.insert(ministryMembers).values([
    { ministryId: insertedMinistries[0].id, contactId: insertedContacts[4].id, role: "leader" as const },
    { ministryId: insertedMinistries[0].id, contactId: insertedContacts[6].id, role: "member" as const },
    { ministryId: insertedMinistries[0].id, contactId: insertedContacts[8].id, role: "member" as const },
    { ministryId: insertedMinistries[1].id, contactId: insertedContacts[9].id, role: "leader" as const },
    { ministryId: insertedMinistries[1].id, contactId: insertedContacts[5].id, role: "volunteer" as const },
    { ministryId: insertedMinistries[2].id, contactId: insertedContacts[3].id, role: "member" as const },
    { ministryId: insertedMinistries[3].id, contactId: insertedContacts[7].id, role: "member" as const },
  ]);

  // ── 9. Appointments ──
  await db.insert(appointments).values([
    { contactId: insertedContacts[0].id, title: "New Visitor Welcome Meeting", dateTime: new Date(Date.now() + 2 * 86400000), duration: 30, status: "scheduled" as const, type: "Welcome", organizationId: orgId },
    { contactId: insertedContacts[5].id, title: "Membership Interview", dateTime: new Date(Date.now() + 5 * 86400000), duration: 45, status: "confirmed" as const, type: "Membership", organizationId: orgId },
    { contactId: insertedContacts[4].id, title: "Counseling Session", dateTime: new Date(Date.now() - 86400000), duration: 60, status: "completed" as const, type: "Pastoral Care", organizationId: orgId },
    { contactId: insertedContacts[2].id, title: "Follow-up Call", dateTime: new Date(Date.now() + 86400000), duration: 15, status: "scheduled" as const, type: "Follow Up", organizationId: orgId },
  ]);

  // ── 10. Volunteers ──
  await db.insert(volunteers).values([
    { contactId: insertedContacts[4].id, role: "Worship Leader", status: "active" as const, totalHours: 120, organizationId: orgId },
    { contactId: insertedContacts[6].id, role: "Greeter", status: "active" as const, totalHours: 45, organizationId: orgId },
    { contactId: insertedContacts[7].id, role: "Kitchen Team", status: "active" as const, totalHours: 80, organizationId: orgId },
    { contactId: insertedContacts[9].id, role: "Sunday School Teacher", status: "active" as const, totalHours: 200, organizationId: orgId },
    { contactId: insertedContacts[5].id, role: "Parking Lot", status: "inactive" as const, totalHours: 30, organizationId: orgId },
  ]);

  // ── 11. Conversations ──
  const insertedConvos = await db.insert(conversations).values([
    { contactId: insertedContacts[4].id, channel: "phone" as const, status: "resolved" as const, subject: "Thank you call", lastMessageAt: new Date(Date.now() - 600000), organizationId: orgId },
    { contactId: insertedContacts[5].id, channel: "sms" as const, status: "open" as const, subject: "Small group inquiry", lastMessageAt: new Date(Date.now() - 1500000), organizationId: orgId },
    { contactId: insertedContacts[6].id, channel: "email" as const, status: "resolved" as const, subject: "Newsletter received", lastMessageAt: new Date(Date.now() - 3600000), organizationId: orgId },
    { contactId: insertedContacts[7].id, channel: "sms" as const, status: "waiting" as const, subject: "Volunteer training", lastMessageAt: new Date(Date.now() - 7200000), organizationId: orgId },
  ]).returning();

  // Add messages to conversations
  await db.insert(messages).values([
    { conversationId: insertedConvos[0].id, content: "Hi Sarah, just calling to thank you for visiting!", direction: "outbound" as const, senderType: "ai" as const },
    { conversationId: insertedConvos[0].id, content: "Thank you for calling! I'll see you Sunday.", direction: "inbound" as const, senderType: "human" as const },
    { conversationId: insertedConvos[1].id, content: "Yes, I'd like to join the small group. Can you send me the details?", direction: "inbound" as const, senderType: "human" as const },
    { conversationId: insertedConvos[2].id, content: "I received the newsletter, thank you!", direction: "inbound" as const, senderType: "human" as const },
    { conversationId: insertedConvos[3].id, content: "Is there volunteer training this weekend?", direction: "inbound" as const, senderType: "human" as const },
  ]);

  // ── 12. Broadcasts ──
  await db.insert(broadcasts).values([
    { title: "Weekly Update: Sunday Service", content: "Join us this Sunday for a special message from Pastor James.", channel: "email" as const, status: "sent" as const, sentAt: new Date(Date.now() - 86400000), totalRecipients: 150, totalDelivered: 142, totalOpened: 89, organizationId: orgId },
    { title: "Prayer Night Reminder", content: "Don't forget — special prayer night this Wednesday at 7 PM.", channel: "sms" as const, status: "sent" as const, sentAt: new Date(Date.now() - 3 * 86400000), totalRecipients: 85, totalDelivered: 82, organizationId: orgId },
    { title: "Easter Event Invite", content: "You're invited to our Easter celebration!", channel: "email" as const, status: "draft" as const, organizationId: orgId },
  ]);

  // ── 13. Templates ──
  await db.insert(messageTemplates).values([
    { name: "Welcome Visitor", content: "Hi {firstName}, thank you for visiting {churchName}! We'd love to connect with you.", category: "Welcome", channel: "sms" as const, variables: ["firstName", "churchName"], organizationId: orgId },
    { name: "Event Reminder", content: "Don't forget: {eventName} is happening on {eventDate} at {eventLocation}.", category: "Events", channel: "sms" as const, variables: ["eventName", "eventDate", "eventLocation"], organizationId: orgId },
    { name: "Weekly Newsletter", content: "This week at {churchName}: {weeklyHighlights}", category: "Newsletter", channel: "email" as const, variables: ["churchName", "weeklyHighlights"], organizationId: orgId },
    { name: "Prayer Follow-up", content: "Hi {firstName}, we've been praying for you. How can we continue to support you?", category: "Pastoral", channel: "sms" as const, variables: ["firstName"], organizationId: orgId },
  ]);

  return { success: true, contactCount: insertedContacts.length };
}
