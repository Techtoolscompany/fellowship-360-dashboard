import { db } from "@/db";
import {
  appointments,
  churchContacts,
  organizationMemberships,
  prayerRequests,
  tasks,
  graceMemory,
  graceKnowledge,
  graceSessions,
  graceHandoffs,
  graceMessages,
  users,
} from "@/db/schema";
import { and, eq, gte, ilike, inArray, lte, or, SQL } from "drizzle-orm";
import sendMail from "@/lib/email/sendMail";
import { resolveEmailProvider } from "../providers/resolver";
import type { GraceTool } from "./types";
import {
  buildPrayerEscalationTaskMarker,
  buildPrayerEscalationTaskTitle,
  resolvePrayerRouting,
  type PrayerUrgency,
} from "@/lib/prayer/routing";
import { sendOrganizationSms } from "@/lib/sms-gateway/send";
import {
  syncContactCreatedToDittofeed,
  syncContactToDittofeedBestEffort,
} from "@/lib/dittofeed/contacts";
import { z } from "zod";

function isAppointmentConflictError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    return (error as { code?: string }).code === "23P01";
  }
  return false;
}

function parseOptionalInputDate(value: unknown, label: string): Date | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date`);
  }
  return parsed;
}

function normalizeOptionalTextInput(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return String(value).trim();
}

function parseOptionalNonNegativeInt(value: unknown, label: string): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

async function ensurePrayerEscalationTask(params: {
  organizationId: string;
  requestId: string;
  requesterName: string;
  urgency: "urgent" | "critical";
  content: string;
  assignedTeam: string;
}) {
  const marker = buildPrayerEscalationTaskMarker(params.requestId);

  const [existingOpenTask] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.organizationId, params.organizationId),
        inArray(tasks.status, ["todo", "in_progress"]),
        ilike(tasks.description, `%${marker}%`)
      )
    )
    .limit(1);

  if (existingOpenTask) {
    return existingOpenTask.id;
  }

  const [createdTask] = await db
    .insert(tasks)
    .values({
      organizationId: params.organizationId,
      title: buildPrayerEscalationTaskTitle({
        requesterName: params.requesterName,
        urgency: params.urgency,
      }),
      description: [
        marker,
        `Assigned Team: ${params.assignedTeam}`,
        `Request: ${params.content}`,
      ].join("\n"),
      priority: params.urgency === "critical" ? "urgent" : "high",
      status: "todo",
      dueDate:
        params.urgency === "critical"
          ? new Date(Date.now() + 60 * 60 * 1000)
          : new Date(Date.now() + 6 * 60 * 60 * 1000),
    })
    .returning({ id: tasks.id });

  return createdTask?.id ?? null;
}

async function enqueuePrayerFollowupSequence(params: {
  organizationId: string;
  requestId: string;
  trigger: "created" | "updated";
  status: "new" | "praying" | "answered" | "archived";
  urgency: PrayerUrgency;
  occurredAt: Date;
}) {
  try {
    const {
      buildPrayerRequestFollowupIdempotencyKey,
      INNGEST_EVENTS,
    } = await import("@/lib/inngest/events");
    const { inngest } = await import("@/lib/inngest/client");

    const occurredAt = params.occurredAt.toISOString();
    const idempotencyKey = buildPrayerRequestFollowupIdempotencyKey({
      organizationId: params.organizationId,
      requestId: params.requestId,
      trigger: params.trigger,
      status: params.status,
      urgency: params.urgency,
      occurredAt,
    });

    await inngest.send({
      id: idempotencyKey,
      name: INNGEST_EVENTS.GRACE_PRAYER_REQUEST_FOLLOWUP_REQUESTED,
      data: {
        organizationId: params.organizationId,
        requestId: params.requestId,
        trigger: params.trigger,
        status: params.status,
        urgency: params.urgency,
        occurredAt,
        idempotencyKey,
      },
    });
  } catch (error) {
    console.error("[Grace tool] Failed to enqueue prayer follow-up sequence", {
      requestId: params.requestId,
      organizationId: params.organizationId,
      error,
    });
  }
}

async function sendEmailViaProvider(
  organizationId: string,
  to: string,
  subject: string,
  html: string
) {
  const emailConfig = await resolveEmailProvider(organizationId);
  if (emailConfig.mode === "disabled") {
    throw new Error("Email channel is disabled for this organization.");
  }
  if (emailConfig.mode === "sendgrid") {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${emailConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: emailConfig.fromEmail },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SendGrid error (${response.status}): ${text}`);
    }
    return;
  }
  // agency_managed — use platform mailer
  await sendMail(to, subject, html);
}

const idSchema = z.string().min(1).describe("Existing database id");
const optionalIdSchema = z.string().min(1).optional().describe("Existing database id");
const isoDateTimeSchema = z.string().min(1).describe("ISO 8601 date or datetime string");
const optionalIsoDateTimeSchema = isoDateTimeSchema.optional();
const optionalLimit25Schema = z.number().int().min(1).max(25).optional();
const optionalLimit50Schema = z.number().int().min(1).max(50).optional();
const optionalLimit200Schema = z.number().int().min(1).max(200).optional();

const contactsUpsertInputSchema = z.object({
  name: z.string().optional().describe("Full name when known"),
  email: z.string().optional().describe("Email address when known"),
  phone: z.string().optional().describe("Phone number when known"),
  notes: z.string().optional().describe("Relevant contact notes"),
});

const churchInfoSearchInputSchema = z.object({
  query: z.string().min(1).describe("Question or search terms for church knowledge"),
});

const prayerCreateInputSchema = z.object({
  content: z.string().min(1).describe("The prayer request text"),
  contactId: optionalIdSchema,
  contactName: z.string().optional(),
  urgency: z.enum(["normal", "urgent", "critical"]).optional(),
  assignedTeam: z.string().optional(),
  isAnonymous: z.boolean().optional(),
});

const appointmentCheckAvailabilityInputSchema = z.object({
  rangeStart: optionalIsoDateTimeSchema.describe("Start of the availability window"),
  rangeEnd: optionalIsoDateTimeSchema.describe("End of the availability window"),
});

const appointmentBookInputSchema = z.object({
  dateTime: isoDateTimeSchema.describe("Appointment start time"),
  duration: z.number().int().min(5).max(480).optional(),
  contactId: optionalIdSchema,
  title: z.string().optional(),
  type: z.string().optional(),
  notes: z.string().optional(),
});

const messageSendSmsInputSchema = z.object({
  to: z.string().min(1).describe("Destination phone number"),
  message: z.string().min(1).describe("SMS body to send"),
  contactId: optionalIdSchema,
  idempotencyKey: z.string().optional(),
});

const messageSendEmailInputSchema = z.object({
  to: z.string().min(1).describe("Destination email address"),
  subject: z.string().optional(),
  html: z.string().optional().describe("HTML email body"),
  message: z.string().optional().describe("Plain message fallback used as HTML"),
});

const staffAlertInputSchema = z.object({
  reason: z.string().min(1).describe("Short reason staff should be alerted"),
  details: z.string().optional().describe("Supporting context for the alert"),
});

const handoffTransferInputSchema = z.object({
  reason: z.string().optional().describe("Reason for human handoff"),
  details: z.string().optional().describe("Summary to give the staff member"),
});

const tasksCreateInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeId: optionalIdSchema,
  dueDate: optionalIsoDateTimeSchema,
  priority: z.string().optional(),
});

const contactsSearchInputSchema = z.object({
  query: z.string().min(1),
  status: z.string().optional(),
  limit: optionalLimit25Schema,
});

const contactsUpdateInputSchema = z.object({
  contactId: idSchema,
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  memberStatus: z.string().optional(),
  notes: z.string().nullable().optional(),
  source: z.string().optional(),
});

const singleContactInputSchema = z.object({
  contactId: idSchema,
});

const contactsRestoreInputSchema = z.object({
  contactId: idSchema,
  status: z.string().optional(),
});

const contactsFindDuplicatesInputSchema = z.object({
  reason: z.string().optional(),
  minGroupSize: z.number().int().min(2).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const contactsMergeInputSchema = z.object({
  primaryContactId: idSchema,
  duplicateContactId: idSchema,
});

const tasksSearchInputSchema = z.object({
  query: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: optionalIdSchema,
  sla: z.string().optional(),
  limit: optionalLimit50Schema,
});

const financeWeeklyReportInputSchema = z.object({
  startDate: optionalIsoDateTimeSchema,
  endDate: optionalIsoDateTimeSchema,
});

const tasksUpdateInputSchema = z.object({
  taskId: idSchema,
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

const singleTaskInputSchema = z.object({
  taskId: idSchema,
});

const prayerRequestsUpdateInputSchema = z.object({
  requestId: idSchema,
  status: z.string().optional(),
  urgency: z.enum(["normal", "urgent", "critical"]).optional(),
  response: z.string().optional(),
  assignedTeam: z.string().nullable().optional(),
});

const appointmentsSearchInputSchema = z.object({
  query: z.string().optional(),
  status: z.string().optional(),
  fromDate: optionalIsoDateTimeSchema,
  toDate: optionalIsoDateTimeSchema,
  upcomingOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const appointmentIdInputSchema = z.object({
  appointmentId: idSchema,
});

const appointmentsSetStatusInputSchema = z.object({
  appointmentId: idSchema,
  status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]),
});

const appointmentsRescheduleInputSchema = z.object({
  appointmentId: idSchema,
  dateTime: isoDateTimeSchema,
  duration: z.number().int().min(5).max(480).optional(),
  notes: z.string().nullable().optional(),
  resetStatus: z.boolean().optional(),
});

const conversationsSearchInputSchema = z.object({
  query: z.string().optional(),
  status: z.string().optional(),
  includeArchived: z.boolean().optional(),
  limit: optionalLimit200Schema,
});

const conversationIdInputSchema = z.object({
  conversationId: idSchema,
});

const conversationsSetStatusInputSchema = z.object({
  conversationId: idSchema,
  status: z.enum(["open", "waiting", "resolved", "archived"]),
});

const contactsUpsert: GraceTool = {
  name: "contacts.upsert",
  description: "Create or update a contact from a name, email, phone, or notes.",
  inputSchema: contactsUpsertInputSchema,
  allowedChannels: ["voice", "sms", "web", "in_app"],
  requiresApproval: true,
  async execute(input, ctx) {
    const name = String(input.name || "").trim();
    const email = input.email ? String(input.email).trim().toLowerCase() : null;
    const phone = input.phone ? String(input.phone).replace(/\D/g, "") : null;

    if (!name && !email && !phone) {
      return { success: false, error: "Missing contact identifiers" };
    }

    const [firstName, ...rest] = name.split(" ");
    const lastName = rest.join(" ") || "Guest";

    const matchClauses: SQL[] = [];
    if (email) matchClauses.push(eq(churchContacts.email, email));
    if (phone) matchClauses.push(eq(churchContacts.phone, phone));

    const existing = matchClauses.length
      ? await db
          .select()
          .from(churchContacts)
          .where(and(eq(churchContacts.organizationId, ctx.organizationId), or(...matchClauses)))
          .limit(1)
      : [];

    if (existing[0]) {
      const [updated] = await db
        .update(churchContacts)
        .set({
          firstName: firstName || existing[0].firstName,
          lastName: lastName || existing[0].lastName,
          email: email ?? existing[0].email,
          phone: phone ?? existing[0].phone,
          notes: input.notes ? String(input.notes) : existing[0].notes,
          updatedAt: new Date(),
        })
        .where(eq(churchContacts.id, existing[0].id))
        .returning();

      return { success: true, output: { contactId: updated.id, mode: "updated" } };
    }

    const [created] = await db
      .insert(churchContacts)
      .values({
        firstName: firstName || "Guest",
        lastName,
        email,
        phone,
        notes: input.notes ? String(input.notes) : null,
        organizationId: ctx.organizationId,
      })
      .returning();

    await syncContactToDittofeedBestEffort("grace.tools.contacts.upsert.create", () =>
      syncContactCreatedToDittofeed({
        organizationId: ctx.organizationId,
        contact: created,
        extraProperties: {
          intakeSource: "grace_tool",
        },
      })
    );

    return { success: true, output: { contactId: created.id, mode: "created" } };
  },
};

const churchInfoSearch: GraceTool = {
  name: "churchInfo.search",
  description: "Search public or internal church knowledge for facts Grace can cite in the response.",
  inputSchema: churchInfoSearchInputSchema,
  allowedChannels: ["voice", "sms", "web", "in_app"],
  async execute(input, ctx) {
    const query = String(input.query || "").trim();
    if (!query) return { success: false, error: "Missing query" };

    // Public actors may only retrieve public-visibility knowledge
    const visibilityFilter =
      ctx.actorType === "public"
        ? eq(graceKnowledge.visibility, "public")
        : or(eq(graceKnowledge.visibility, "public"), eq(graceKnowledge.visibility, "internal"));

    const entries = await db
      .select()
      .from(graceKnowledge)
      .where(
        and(
          eq(graceKnowledge.organizationId, ctx.organizationId),
          eq(graceKnowledge.useForGrace, true),
          visibilityFilter,
          or(ilike(graceKnowledge.title, `%${query}%`), ilike(graceKnowledge.content, `%${query}%`))
        )
      )
      .limit(5);

    return {
      success: true,
      output: {
        results: entries.map((entry) => ({ id: entry.id, title: entry.title, content: entry.content })),
      },
    };
  },
};

const prayerCreate: GraceTool = {
  name: "prayerRequests.create",
  description: "Create a prayer request and route urgent requests for staff follow-up.",
  inputSchema: prayerCreateInputSchema,
  allowedChannels: ["voice", "sms", "web", "in_app"],
  async execute(input, ctx) {
    const content = String(input.content || "").trim();
    if (!content) return { success: false, error: "Missing prayer request content" };

    const contactId = input.contactId ? String(input.contactId) : null;
    const isAnonymous = input.isAnonymous === true || input.isAnonymous === "true";
    const routing = resolvePrayerRouting({
      content,
      urgency: input.urgency,
      assignedTeam: input.assignedTeam ? String(input.assignedTeam) : undefined,
    });

    let contactName = input.contactName ? String(input.contactName).trim() : "";
    if (!contactName && contactId) {
      const [contact] = await db
        .select({
          firstName: churchContacts.firstName,
          lastName: churchContacts.lastName,
        })
        .from(churchContacts)
        .where(and(eq(churchContacts.organizationId, ctx.organizationId), eq(churchContacts.id, contactId)))
        .limit(1);

      if (contact) {
        contactName = `${contact.firstName} ${contact.lastName}`.trim();
      }
    }

    const requesterName = isAnonymous ? "Anonymous" : contactName || "Community Member";

    const [created] = await db
      .insert(prayerRequests)
      .values({
        organizationId: ctx.organizationId,
        contactId,
        contactName: requesterName,
        content,
        urgency: routing.urgency,
        status: "new",
        assignedTeam: routing.assignedTeam,
        isAnonymous: isAnonymous ? "true" : "false",
      })
      .returning();

    let escalationTaskId: string | null = null;
    if (routing.escalationPriority === "high" || routing.escalationPriority === "urgent") {
      const escalationUrgency = routing.urgency === "critical" ? "critical" : "urgent";
      escalationTaskId = await ensurePrayerEscalationTask({
        organizationId: ctx.organizationId,
        requestId: created.id,
        requesterName,
        urgency: escalationUrgency,
        content,
        assignedTeam: routing.assignedTeam,
      });
    }

    await enqueuePrayerFollowupSequence({
      organizationId: ctx.organizationId,
      requestId: created.id,
      trigger: "created",
      status: "new",
      urgency: routing.urgency,
      occurredAt: created.createdAt ?? new Date(),
    });

    return {
      success: true,
      output: {
        prayerRequestId: created.id,
        urgency: routing.urgency,
        assignedTeam: routing.assignedTeam,
        escalationTaskId,
      },
    };
  },
};

const appointmentCheckAvailability: GraceTool = {
  name: "appointments.checkAvailability",
  description: "List busy appointment slots inside a date window before offering appointment times.",
  inputSchema: appointmentCheckAvailabilityInputSchema,
  allowedChannels: ["voice", "sms", "web", "in_app"],
  async execute(input, ctx) {
    const rangeStart = input.rangeStart ? new Date(String(input.rangeStart)) : new Date();
    const rangeEnd = input.rangeEnd
      ? new Date(String(input.rangeEnd))
      : new Date(rangeStart.getTime() + 1000 * 60 * 60 * 24 * 14);

    const rows = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, ctx.organizationId),
          gte(appointments.dateTime, rangeStart),
          lte(appointments.dateTime, rangeEnd)
        )
      );

    return {
      success: true,
      output: {
        busy: rows.map((row) => ({
          id: row.id,
          dateTime: row.dateTime,
          duration: row.duration,
          status: row.status,
        })),
      },
    };
  },
};

const appointmentBook: GraceTool = {
  name: "appointments.book",
  description: "Book a pastoral or staff appointment for a contact.",
  inputSchema: appointmentBookInputSchema,
  allowedChannels: ["voice", "sms", "web", "in_app"],
  requiresApproval: true,
  async execute(input, ctx) {
    const dateTime = new Date(String(input.dateTime || ""));
    const duration = Number(input.duration ?? 30);

    if (Number.isNaN(dateTime.getTime())) {
      return { success: false, error: "Invalid dateTime" };
    }

    const startWindow = new Date(dateTime.getTime() - 1000 * 60 * 30);
    const endWindow = new Date(dateTime.getTime() + 1000 * 60 * 30);

    const conflict = await db
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, ctx.organizationId),
          gte(appointments.dateTime, startWindow),
          lte(appointments.dateTime, endWindow)
        )
      )
      .limit(1);

    if (conflict[0]) {
      return { success: false, error: "Appointment slot conflict" };
    }

    let created;
    try {
      [created] = await db
        .insert(appointments)
        .values({
          organizationId: ctx.organizationId,
          contactId: (input.contactId as string) ?? null,
          title: String(input.title || "Pastoral Appointment"),
          dateTime,
          duration,
          type: input.type ? String(input.type) : null,
          notes: input.notes ? String(input.notes) : null,
          status: "scheduled",
        })
        .returning();
    } catch (error) {
      if (isAppointmentConflictError(error)) {
        return { success: false, error: "Appointment slot conflict" };
      }
      throw error;
    }

    return { success: true, output: { appointmentId: created.id } };
  },
};

const messageSendSMS: GraceTool = {
  name: "messages.sendSMS",
  description: "Send a one-to-one SMS message through the organization's SMS provider.",
  inputSchema: messageSendSmsInputSchema,
  allowedChannels: ["sms", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, ctx) {
    const to = String(input.to || "").trim();
    const message = String(input.message || "").trim();

    if (!to || !message) {
      return { success: false, error: "Missing SMS destination or message" };
    }

    const sent = await sendOrganizationSms({
      organizationId: ctx.organizationId,
      to,
      message,
      idempotencyKey: String(input.idempotencyKey || `${ctx.sessionId}:${to}:${Date.now()}`),
    });

    await db.insert(graceMessages).values({
      organizationId: ctx.organizationId,
      sessionId: ctx.sessionId,
      contactId: (input.contactId as string) ?? null,
      direction: "outbound",
      channel: "sms",
      messageText: message,
      providerMessageId: sent.providerMessageId,
    });

    if (!sent.success) {
      return { success: false, error: sent.error ?? "SMS send failed" };
    }

    return { success: true, output: { providerMessageId: sent.providerMessageId } };
  },
};

const messageSendEmail: GraceTool = {
  name: "messages.sendEmail",
  description: "Send a one-to-one email message through the organization's email provider.",
  inputSchema: messageSendEmailInputSchema,
  allowedChannels: ["voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, ctx) {
    const to = String(input.to || "").trim();
    const subject = String(input.subject || "Church Update");
    const html = String(input.html || input.message || "").trim();

    if (!to || !html) {
      return { success: false, error: "Missing email fields" };
    }

    await sendEmailViaProvider(ctx.organizationId, to, subject, html);
    return { success: true, output: { delivered: true } };
  },
};

const staffAlert: GraceTool = {
  name: "staff.alert",
  description: "Alert organization admins when Grace needs human staff attention.",
  inputSchema: staffAlertInputSchema,
  allowedChannels: ["voice", "sms", "web", "in_app"],
  async execute(input, ctx) {
    const reason = String(input.reason || "Grace AI flagged an item requiring attention");
    const details = input.details ? String(input.details) : "";

    // Look up org admin/owner emails to notify
    const adminMemberships = await db
      .select({ userId: organizationMemberships.userId })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, ctx.organizationId),
          inArray(organizationMemberships.role, ["admin", "owner"])
        )
      );

    if (adminMemberships.length === 0) {
      return { success: true, output: { alerted: false, reason: "No admin recipients found" } };
    }

    const adminUsers = await db
      .select({ email: users.email })
      .from(users)
      .where(
        inArray(
          users.id,
          adminMemberships.map((m) => m.userId)
        )
      );

    const subject = `[Grace Alert] ${reason}`;
    const html = `<p><strong>Grace AI Alert</strong></p>
<p><strong>Reason:</strong> ${reason}</p>
${details ? `<p><strong>Details:</strong> ${details}</p>` : ""}
<p><strong>Session:</strong> ${ctx.sessionId}</p>`;

    await Promise.allSettled(
      adminUsers.map(({ email }) =>
        sendEmailViaProvider(ctx.organizationId, email, subject, html)
      )
    );

    return { success: true, output: { alerted: true, recipientCount: adminUsers.length } };
  },
};

const handoffTransfer: GraceTool = {
  name: "handoff.transfer",
  description: "Escalate the current Grace session to a human staff handoff queue.",
  inputSchema: handoffTransferInputSchema,
  allowedChannels: ["voice", "sms", "web", "in_app"],
  async execute(input, ctx) {
    const reason = input.reason ? String(input.reason) : "policy_handoff";
    const details = input.details ? String(input.details) : null;

    await db
      .update(graceSessions)
      .set({
        status: "escalated",
        handoffReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(graceSessions.id, ctx.sessionId));

    const [existingOpenHandoff] = await db
      .select({ id: graceHandoffs.id })
      .from(graceHandoffs)
      .where(
        and(
          eq(graceHandoffs.organizationId, ctx.organizationId),
          eq(graceHandoffs.sessionId, ctx.sessionId),
          eq(graceHandoffs.status, "open")
        )
      )
      .limit(1);

    const handoffId = existingOpenHandoff?.id
      ? existingOpenHandoff.id
      : (
          await db
            .insert(graceHandoffs)
            .values({
              organizationId: ctx.organizationId,
              sessionId: ctx.sessionId,
              contactId: ctx.contactId ?? null,
              actorType: ctx.actorType,
              reason,
              summaryText: details,
              assignedTeam: "pastoral_care",
              status: "open",
              metadataJson: {
                source: "handoff.transfer",
              },
            })
            .returning({ id: graceHandoffs.id })
        )[0]?.id;

    return { success: true, output: { transferred: true, handoffId } };
  },
};

const tasksCreate: GraceTool = {
  name: "tasks.create",
  description: "Create a staff follow-up task.",
  inputSchema: tasksCreateInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, ctx) {
    const title = String(input.title || "Follow up").trim();
    if (!title) return { success: false, error: "Missing task title" };

    const { createTask } = await import("@/app/actions/tasks");
    const created = await createTask({
      organizationId: ctx.organizationId,
      title,
      ...(input.description !== undefined && {
        description: input.description ? String(input.description) : undefined,
      }),
      ...(input.assigneeId !== undefined && {
        assigneeId: input.assigneeId ? String(input.assigneeId) : undefined,
      }),
      ...(input.dueDate !== undefined && {
        dueDate: input.dueDate ? new Date(String(input.dueDate)) : null,
      }),
      ...(input.priority !== undefined && { priority: String(input.priority) }),
    });

    return {
      success: true,
      output: {
        taskId: created.id,
        status: created.status,
        priority: created.priority,
        assigneeId: created.assigneeId,
        slaStatus: created.slaStatus,
      },
    };
  },
};

const memoryWrite: GraceTool = {
  name: "memory.write",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, ctx) {
    const summary = String(input.summary || "").trim();
    if (!summary) {
      return { success: false, error: "summary is required" };
    }

    const requestedType = String(input.memoryType || "").trim();
    const memoryType =
      requestedType === "contact_memory" ||
      requestedType === "org_pattern" ||
      requestedType === "daily_briefing"
        ? requestedType
        : "contact_memory";

    const contactId = input.contactId ? String(input.contactId) : ctx.contactId ?? null;
    if (memoryType === "contact_memory" && !contactId) {
      return { success: false, error: "contact_memory entries require contactId" };
    }

    const tags = Array.isArray(input.tags)
      ? input.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [];
    const metadataJson =
      input.metadataJson && typeof input.metadataJson === "object"
        ? (input.metadataJson as Record<string, unknown>)
        : undefined;

    const [created] = await db
      .insert(graceMemory)
      .values({
        organizationId: ctx.organizationId,
        sessionId: ctx.sessionId,
        contactId,
        memoryType,
        summary,
        details: input.details ? String(input.details).trim() : null,
        tags,
        metadataJson,
        createdByActorType: ctx.actorType === "staff" ? "staff" : "system",
        createdByUserId: ctx.userId ?? null,
      })
      .returning();

    return {
      success: true,
      output: {
        memoryId: created.id,
        memoryType: created.memoryType,
        contactId: created.contactId,
      },
    };
  },
};

const onboardingProfileUpdate: GraceTool = {
  name: "onboarding.profile.update",
  allowedChannels: ["in_app"],
  async execute(input, ctx) {
    const churchName = normalizeOptionalTextInput(input.churchName ?? input.orgName);
    const denomination = normalizeOptionalTextInput(
      input.denomination ?? input.churchDenomination
    );
    const city = normalizeOptionalTextInput(input.city ?? input.churchCity);
    const website = normalizeOptionalTextInput(input.website ?? input.orgWebsite);
    const industry = normalizeOptionalTextInput(input.industry);
    const howDidYouHearAboutUs = normalizeOptionalTextInput(input.howDidYouHearAboutUs);
    const primaryContactName = normalizeOptionalTextInput(input.primaryContactName);
    const primaryContactEmail = normalizeOptionalTextInput(input.primaryContactEmail);
    const primaryContactPhone = normalizeOptionalTextInput(input.primaryContactPhone);
    const primaryGoal = normalizeOptionalTextInput(input.primaryGoal ?? input.goal);
    const notes = normalizeOptionalTextInput(input.notes);
    const orgTypeRaw =
      input.orgType !== undefined && input.orgType !== null ? String(input.orgType) : undefined;
    const orgType:
      | "startup"
      | "enterprise"
      | "agency"
      | "individual"
      | undefined =
      orgTypeRaw === "startup" ||
      orgTypeRaw === "enterprise" ||
      orgTypeRaw === "agency" ||
      orgTypeRaw === "individual"
        ? orgTypeRaw
        : undefined;
    const teamSize = parseOptionalNonNegativeInt(input.teamSize, "teamSize");
    const averageWeeklyAttendance = parseOptionalNonNegativeInt(
      input.averageWeeklyAttendance ?? input.attendance,
      "averageWeeklyAttendance"
    );
    const onboardingDone = parseOptionalBoolean(input.onboardingDone);

    const payload = {
      organizationId: ctx.organizationId,
      ...(churchName !== undefined ? { churchName } : {}),
      ...(denomination !== undefined ? { denomination } : {}),
      ...(city !== undefined ? { city } : {}),
      ...(website !== undefined ? { website } : {}),
      ...(orgType !== undefined ? { orgType } : {}),
      ...(teamSize !== undefined ? { teamSize } : {}),
      ...(averageWeeklyAttendance !== undefined ? { averageWeeklyAttendance } : {}),
      ...(industry !== undefined ? { industry } : {}),
      ...(howDidYouHearAboutUs !== undefined ? { howDidYouHearAboutUs } : {}),
      ...(primaryContactName !== undefined ? { primaryContactName } : {}),
      ...(primaryContactEmail !== undefined ? { primaryContactEmail } : {}),
      ...(primaryContactPhone !== undefined ? { primaryContactPhone } : {}),
      ...(primaryGoal !== undefined ? { primaryGoal } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(onboardingDone !== undefined ? { onboardingDone } : {}),
    };

    if (Object.keys(payload).length === 1) {
      return { success: false, error: "At least one onboarding field is required" };
    }

    const { updateOrganizationOnboardingProfile } = await import("@/app/actions/onboarding");
    const updated = await updateOrganizationOnboardingProfile(payload);

    return {
      success: true,
      output: {
        churchName: updated.churchName,
        onboardingDone: updated.onboardingDone,
        updatedFields: updated.updatedFields,
      },
    };
  },
};

const onboardingInstallStarterTemplates: GraceTool = {
  name: "onboarding.installStarterTemplates",
  allowedChannels: ["in_app"],
  async execute(_input, ctx) {
    const { installStarterTemplates } = await import("@/app/actions/onboarding");
    const result = await installStarterTemplates(ctx.organizationId);
    return { success: true, output: result };
  },
};

const onboardingBootstrapSampleData: GraceTool = {
  name: "onboarding.bootstrapSampleData",
  allowedChannels: ["in_app"],
  async execute(_input, ctx) {
    const { bootstrapSampleData } = await import("@/app/actions/onboarding");
    const result = await bootstrapSampleData(ctx.organizationId);
    return { success: true, output: result };
  },
};

const onboardingStartGuidedSequence: GraceTool = {
  name: "onboarding.startGuidedSequence",
  allowedChannels: ["in_app"],
  async execute(input, ctx) {
    const blueprintId = normalizeOptionalTextInput(input.blueprintId ?? input.sequenceId);
    if (!blueprintId) {
      return { success: false, error: "blueprintId is required" };
    }

    const installTemplate =
      parseOptionalBoolean(input.installTemplate) === undefined
        ? true
        : Boolean(parseOptionalBoolean(input.installTemplate));

    const { startGuidedSequenceOnboarding } = await import("@/app/actions/onboarding");
    const result = await startGuidedSequenceOnboarding({
      organizationId: ctx.organizationId,
      blueprintId,
      installTemplate,
    });

    return {
      success: true,
      output: {
        blueprintId: result.blueprintId,
        blueprintTitle: result.blueprintTitle,
        builderWorkflowId: result.builderWorkflowId,
        templateWorkflowId: result.templateWorkflowId,
        templateInstalled: result.templateInstalled,
        templateAlreadyInstalled: result.templateAlreadyInstalled,
      },
    };
  },
};

const serviceRunsCreateFromTemplate: GraceTool = {
  name: "serviceRuns.createFromTemplate",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, ctx) {
    const templateId = input.templateId ? String(input.templateId) : "";
    const serviceAtRaw = input.serviceAt ? String(input.serviceAt) : "";
    const serviceAt = new Date(serviceAtRaw);
    const durationMinutes = Number(input.durationMinutes ?? 90);
    const name = input.name ? String(input.name) : undefined;
    const notes = input.notes ? String(input.notes) : undefined;

    if (!templateId) {
      return { success: false, error: "templateId is required" };
    }
    if (Number.isNaN(serviceAt.getTime())) {
      return { success: false, error: "serviceAt must be a valid datetime" };
    }

    const { createServiceRun, generateServiceRunAssignmentsFromTemplate } =
      await import("@/app/actions/operations");

    const serviceRun = await createServiceRun({
      organizationId: ctx.organizationId,
      templateId,
      name,
      serviceAt,
      durationMinutes,
      notes,
    });

    const assignments = await generateServiceRunAssignmentsFromTemplate({
      serviceRunId: serviceRun.id,
      overwriteExisting: false,
    });

    return {
      success: true,
      output: {
        serviceRunId: serviceRun.id,
        assignmentCount: assignments.length,
      },
    };
  },
};

const serviceRunsAutoStaff: GraceTool = {
  name: "serviceRuns.autoStaff",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const serviceRunId = input.serviceRunId ? String(input.serviceRunId) : "";
    if (!serviceRunId) {
      return { success: false, error: "serviceRunId is required" };
    }

    const waitHoursRaw =
      input.waitHours === undefined || input.waitHours === null
        ? undefined
        : Number(input.waitHours);
    const waitHours =
      waitHoursRaw === undefined || Number.isNaN(waitHoursRaw)
        ? undefined
        : Math.max(1, Math.floor(waitHoursRaw));

    const objectiveText = input.objectiveText
      ? String(input.objectiveText)
      : undefined;

    const { startServiceRunAutostaffGoal } = await import("@/app/actions/operations");
    const result = await startServiceRunAutostaffGoal({
      serviceRunId,
      sourceChannel: "voice_internal",
      objectiveText,
      waitHours,
    });

    return {
      success: true,
      output: {
        goalId: result.goal.id,
        status: result.goal.status,
        created: result.created,
        dispatched: result.dispatched,
        waitHours: result.waitHours,
      },
    };
  },
};

const serviceAssignmentsSendOfferSMS: GraceTool = {
  name: "serviceAssignments.sendOfferSMS",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const serviceRunId = input.serviceRunId ? String(input.serviceRunId) : "";
    if (!serviceRunId) {
      return { success: false, error: "serviceRunId is required" };
    }

    const assignmentIds = Array.isArray(input.assignmentIds)
      ? input.assignmentIds.map((id) => String(id))
      : undefined;
    const messageTemplate = input.messageTemplate
      ? String(input.messageTemplate)
      : undefined;

    const { sendServiceAssignmentOffers } = await import("@/app/actions/operations");
    const offerResult = await sendServiceAssignmentOffers({
      serviceRunId,
      assignmentIds,
      messageTemplate,
    });

    return {
      success: true,
      output: {
        attempted: offerResult.attempted,
        sent: offerResult.sent,
        skipped: offerResult.skipped,
        failed: offerResult.failed,
      },
    };
  },
};

const pipelinesAddToStage: GraceTool = {
  name: "pipelines.addToStage",
  allowedChannels: ["in_app"],
  async execute(input, ctx) {
    const contactId = input.contactId ? String(input.contactId) : "";
    const stageId = input.stageId ? String(input.stageId) : "";

    if (!contactId || !stageId) {
      return { success: false, error: "contactId and stageId are required" };
    }

    const { createPipelineItem } = await import("@/app/actions/pipeline");
    const created = await createPipelineItem({
      organizationId: ctx.organizationId,
      contactId,
      stageId,
      notes: input.notes ? String(input.notes) : undefined,
    });

    return { success: true, output: { pipelineItemId: created.id } };
  },
};

// ---------------------------------------------------------------------------
// Executive assistant — CRUD tools for full data management
// ---------------------------------------------------------------------------

const contactsSearch: GraceTool = {
  name: "contacts.search",
  description: "Search CRM contacts by name, email, phone, or member status.",
  inputSchema: contactsSearchInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, ctx) {
    const query = String(input.query || "").trim();
    if (!query) return { success: false, error: "query is required" };

    const limit = Math.min(Number(input.limit ?? 10), 25);
    const statusFilter = input.status ? String(input.status) : null;
    const term = `%${query}%`;

    const nameOrContactMatch = or(
      ilike(churchContacts.firstName, term),
      ilike(churchContacts.lastName, term),
      ilike(churchContacts.email, term),
      ilike(churchContacts.phone, term)
    );

    const where = statusFilter
      ? and(
          eq(churchContacts.organizationId, ctx.organizationId),
          nameOrContactMatch,
          eq(churchContacts.memberStatus, statusFilter as any)
        )
      : and(eq(churchContacts.organizationId, ctx.organizationId), nameOrContactMatch);

    const rows = await db
      .select({
        id: churchContacts.id,
        firstName: churchContacts.firstName,
        lastName: churchContacts.lastName,
        email: churchContacts.email,
        phone: churchContacts.phone,
        memberStatus: churchContacts.memberStatus,
      })
      .from(churchContacts)
      .where(where)
      .limit(limit);

    return { success: true, output: { contacts: rows, count: rows.length } };
  },
};

const contactsUpdate: GraceTool = {
  name: "contacts.update",
  description: "Update profile fields on an existing CRM contact.",
  inputSchema: contactsUpdateInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, _ctx) {
    const contactId = String(input.contactId || "").trim();
    if (!contactId) return { success: false, error: "contactId is required" };

    const data: Record<string, unknown> = {};
    if (input.firstName !== undefined) data.firstName = String(input.firstName);
    if (input.lastName !== undefined) data.lastName = String(input.lastName);
    if (input.email !== undefined) data.email = input.email ? String(input.email) : null;
    if (input.phone !== undefined) data.phone = input.phone ? String(input.phone) : null;
    if (input.memberStatus !== undefined) data.memberStatus = String(input.memberStatus);
    if (input.notes !== undefined) data.notes = input.notes ? String(input.notes) : null;
    if (input.source !== undefined) data.source = String(input.source);

    if (Object.keys(data).length === 0) {
      return { success: false, error: "No fields provided to update" };
    }

    const { updateContact } = await import("@/app/actions/contacts");
    const updated = await updateContact(contactId, data as any);
    return { success: true, output: { contactId: updated.id, updated: data } };
  },
};

const contactsArchive: GraceTool = {
  name: "contacts.archive",
  description: "Archive an existing CRM contact.",
  inputSchema: singleContactInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const contactId = String(input.contactId || "").trim();
    if (!contactId) return { success: false, error: "contactId is required" };

    const { archiveContact } = await import("@/app/actions/contacts");
    const updated = await archiveContact(contactId);
    return {
      success: true,
      output: {
        contactId: updated.id,
        memberStatus: updated.memberStatus,
      },
    };
  },
};

const contactsRestore: GraceTool = {
  name: "contacts.restore",
  description: "Restore an archived CRM contact to an active member status.",
  inputSchema: contactsRestoreInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const contactId = String(input.contactId || "").trim();
    if (!contactId) return { success: false, error: "contactId is required" };

    const status = input.status ? String(input.status) : "visitor";
    const { restoreContact } = await import("@/app/actions/contacts");
    const updated = await restoreContact(contactId, status);
    return {
      success: true,
      output: {
        contactId: updated.id,
        memberStatus: updated.memberStatus,
      },
    };
  },
};

const contactsDelete: GraceTool = {
  name: "contacts.delete",
  description: "Permanently delete an existing CRM contact.",
  inputSchema: singleContactInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const contactId = String(input.contactId || "").trim();
    if (!contactId) return { success: false, error: "contactId is required" };

    const { deleteContact } = await import("@/app/actions/contacts");
    await deleteContact(contactId);
    return { success: true, output: { deleted: true, contactId } };
  },
};

const contactsFindDuplicates: GraceTool = {
  name: "contacts.findDuplicates",
  description: "Find possible duplicate contacts for review or merge planning.",
  inputSchema: contactsFindDuplicatesInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, ctx) {
    const reasonFilter = input.reason ? String(input.reason) : null;
    const minGroupSize = Math.max(2, Number(input.minGroupSize ?? 2));
    const limit = Math.min(Number(input.limit ?? 20), 100);

    const { findPotentialDuplicateContacts } = await import("@/app/actions/contacts");
    const groups = await findPotentialDuplicateContacts(ctx.organizationId);
    const filtered = groups.filter((group) => {
      if (reasonFilter && group.reason !== reasonFilter) return false;
      return group.contacts.length >= minGroupSize;
    });
    const results = filtered.slice(0, limit).map((group) => ({
      key: group.key,
      reason: group.reason,
      count: group.contacts.length,
      contacts: group.contacts.map((contact) => ({
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        memberStatus: contact.memberStatus,
      })),
    }));

    return {
      success: true,
      output: {
        groups: results,
        count: results.length,
      },
    };
  },
};

const contactsMerge: GraceTool = {
  name: "contacts.merge",
  description: "Merge a duplicate contact into a primary contact.",
  inputSchema: contactsMergeInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const primaryContactId = String(input.primaryContactId || "").trim();
    const duplicateContactId = String(input.duplicateContactId || "").trim();
    if (!primaryContactId || !duplicateContactId) {
      return {
        success: false,
        error: "primaryContactId and duplicateContactId are required",
      };
    }

    const { mergeContacts } = await import("@/app/actions/contacts");
    const merged = await mergeContacts({
      primaryContactId,
      duplicateContactId,
    });
    return {
      success: true,
      output: {
        primaryContactId: merged.contact.id,
        mergedFromContactId: merged.mergedFromContactId,
      },
    };
  },
};

const tasksSearch: GraceTool = {
  name: "tasks.search",
  description: "Search staff tasks by text, status, priority, assignee, or SLA status.",
  inputSchema: tasksSearchInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, ctx) {
    const query = input.query ? String(input.query).trim().toLowerCase() : "";
    const limit = Math.min(Number(input.limit ?? 15), 50);

    const { getTasks } = await import("@/app/actions/tasks");
    const rows = await getTasks(ctx.organizationId, {
      ...(input.status !== undefined && { status: String(input.status) }),
      ...(input.priority !== undefined && { priority: String(input.priority) }),
      ...(input.assigneeId !== undefined && { assigneeId: String(input.assigneeId) }),
      ...(input.sla !== undefined && { sla: String(input.sla) }),
    });

    const filtered = query
      ? rows.filter((task) => {
          const haystack = `${task.title} ${task.description ?? ""}`.toLowerCase();
          return haystack.includes(query);
        })
      : rows;

    const results = filtered.slice(0, limit).map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId,
      assigneeName: task.assigneeName,
      dueDate: task.dueDate,
      slaStatus: task.slaStatus,
    }));

    return { success: true, output: { tasks: results, count: results.length } };
  },
};

const financeWeeklyReport: GraceTool = {
  name: "finance.weeklyReport",
  description: "Return a weekly giving report for the organization.",
  inputSchema: financeWeeklyReportInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, ctx) {
    const startDate = parseOptionalInputDate(input.startDate, "startDate");
    const endDate = parseOptionalInputDate(input.endDate, "endDate");

    const { getWeeklyGivingReport } = await import("@/app/actions/finances");
    const report = await getWeeklyGivingReport({
      organizationId: ctx.organizationId,
      startDate,
      endDate,
    });

    return { success: true, output: report };
  },
};

const tasksUpdate: GraceTool = {
  name: "tasks.update",
  description: "Update fields on an existing staff task.",
  inputSchema: tasksUpdateInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, ctx) {
    const taskId = String(input.taskId || "").trim();
    if (!taskId) return { success: false, error: "taskId is required" };

    const { updateTask } = await import("@/app/actions/tasks");
    const updated = await updateTask(taskId, {
      organizationId: ctx.organizationId,
      ...(input.title !== undefined && { title: String(input.title) }),
      ...(input.description !== undefined && {
        description: input.description ? String(input.description) : null,
      }),
      ...(input.status !== undefined && { status: String(input.status) }),
      ...(input.priority !== undefined && { priority: String(input.priority) }),
      ...(input.assigneeId !== undefined && {
        assigneeId: input.assigneeId ? String(input.assigneeId) : null,
      }),
      ...(input.dueDate !== undefined && {
        dueDate: input.dueDate ? new Date(String(input.dueDate)) : null,
      }),
    });
    return {
      success: true,
      output: {
        taskId: updated.id,
        status: updated.status,
        priority: updated.priority,
        assigneeId: updated.assigneeId,
        slaStatus: updated.slaStatus,
      },
    };
  },
};

const tasksComplete: GraceTool = {
  name: "tasks.complete",
  description: "Mark a staff task as done.",
  inputSchema: singleTaskInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, ctx) {
    const taskId = String(input.taskId || "").trim();
    if (!taskId) return { success: false, error: "taskId is required" };

    const { updateTask } = await import("@/app/actions/tasks");
    await updateTask(taskId, { organizationId: ctx.organizationId, status: "done" });
    return { success: true, output: { completed: true, taskId } };
  },
};

const volunteersCreate: GraceTool = {
  name: "volunteers.create",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, ctx) {
    const contactId = String(input.contactId || "").trim();
    if (!contactId) return { success: false, error: "contactId is required" };

    const { createVolunteer } = await import("@/app/actions/operations");
    const volunteer = await createVolunteer({
      organizationId: ctx.organizationId,
      contactId,
      ...(input.role !== undefined && { role: String(input.role) }),
      ...(input.status !== undefined && { status: String(input.status) }),
    });

    return {
      success: true,
      output: {
        volunteerId: volunteer.id,
        status: volunteer.status,
        role: volunteer.role,
      },
    };
  },
};

const volunteersUpdate: GraceTool = {
  name: "volunteers.update",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const volunteerId = String(input.volunteerId || "").trim();
    if (!volunteerId) return { success: false, error: "volunteerId is required" };

    const data: Record<string, unknown> = {};
    if (input.role !== undefined) data.role = input.role ? String(input.role) : null;
    if (input.status !== undefined) data.status = String(input.status);
    if (input.contactId !== undefined) data.contactId = String(input.contactId);
    if (Object.keys(data).length === 0) {
      return { success: false, error: "No volunteer fields provided to update" };
    }

    const { updateVolunteer } = await import("@/app/actions/operations");
    const volunteer = await updateVolunteer(volunteerId, data as any);
    return {
      success: true,
      output: {
        volunteerId: volunteer.id,
        status: volunteer.status,
        role: volunteer.role,
      },
    };
  },
};

const volunteersDelete: GraceTool = {
  name: "volunteers.delete",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const volunteerId = String(input.volunteerId || "").trim();
    if (!volunteerId) return { success: false, error: "volunteerId is required" };

    const { deleteVolunteer } = await import("@/app/actions/operations");
    const deleted = await deleteVolunteer(volunteerId);
    return {
      success: true,
      output: {
        volunteerId: deleted.id,
        deletedShiftCount: deleted.deletedShiftCount,
      },
    };
  },
};

const volunteerShiftsCreate: GraceTool = {
  name: "volunteerShifts.create",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const volunteerId = String(input.volunteerId || "").trim();
    if (!volunteerId) return { success: false, error: "volunteerId is required" };
    if (!input.date) return { success: false, error: "date is required" };

    const hours = Number(input.hours);
    if (Number.isNaN(hours) || hours <= 0) {
      return { success: false, error: "hours must be a positive number" };
    }

    const { logVolunteerShift } = await import("@/app/actions/operations");
    const shift = await logVolunteerShift({
      volunteerId,
      date: new Date(String(input.date)),
      hours,
      ...(input.eventId !== undefined && {
        eventId: input.eventId ? String(input.eventId) : undefined,
      }),
      ...(input.notes !== undefined && {
        notes: input.notes ? String(input.notes) : undefined,
      }),
    });

    return { success: true, output: { shiftId: shift.id, volunteerId: shift.volunteerId } };
  },
};

const volunteerShiftsUpdate: GraceTool = {
  name: "volunteerShifts.update",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const shiftId = String(input.shiftId || "").trim();
    if (!shiftId) return { success: false, error: "shiftId is required" };

    const data: Record<string, unknown> = {};
    if (input.date !== undefined) data.date = new Date(String(input.date));
    if (input.hours !== undefined) data.hours = Number(input.hours);
    if (input.eventId !== undefined) {
      data.eventId = input.eventId ? String(input.eventId) : null;
    }
    if (input.notes !== undefined) {
      data.notes = input.notes ? String(input.notes) : null;
    }
    if (Object.keys(data).length === 0) {
      return { success: false, error: "No shift fields provided to update" };
    }

    const { updateVolunteerShift } = await import("@/app/actions/operations");
    const shift = await updateVolunteerShift(shiftId, data as any);
    return {
      success: true,
      output: {
        shiftId: shift.id,
        volunteerId: shift.volunteerId,
        hours: shift.hours,
      },
    };
  },
};

const volunteerShiftsDelete: GraceTool = {
  name: "volunteerShifts.delete",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const shiftId = String(input.shiftId || "").trim();
    if (!shiftId) return { success: false, error: "shiftId is required" };

    const { deleteVolunteerShift } = await import("@/app/actions/operations");
    const deleted = await deleteVolunteerShift(shiftId);
    return { success: true, output: { shiftId: deleted.id, deleted: true } };
  },
};

const prayerRequestsUpdate: GraceTool = {
  name: "prayerRequests.update",
  description: "Update status, urgency, response, or assigned team on a prayer request.",
  inputSchema: prayerRequestsUpdateInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, _ctx) {
    const requestId = String(input.requestId || "").trim();
    if (!requestId) return { success: false, error: "requestId is required" };

    const { updatePrayerRequest } = await import("@/app/actions/prayer");
    const updated = await updatePrayerRequest(requestId, {
      ...(input.status !== undefined && { status: String(input.status) }),
      ...(input.urgency !== undefined && { urgency: String(input.urgency) }),
      ...(input.response !== undefined && { response: String(input.response) }),
      ...(input.assignedTeam !== undefined && {
        assignedTeam: input.assignedTeam ? String(input.assignedTeam) : null,
      }),
    });
    return { success: true, output: { requestId: updated.id, status: updated.status } };
  },
};

const appointmentsSearch: GraceTool = {
  name: "appointments.search",
  description: "Search appointments by text, status, date window, or upcoming-only filter.",
  inputSchema: appointmentsSearchInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, ctx) {
    const query = input.query ? String(input.query).trim().toLowerCase() : "";
    const status = input.status ? String(input.status) : undefined;
    const limit = Math.min(Number(input.limit ?? 20), 100);
    const fromDate = input.fromDate ? new Date(String(input.fromDate)) : null;
    const toDate = input.toDate ? new Date(String(input.toDate)) : null;
    const upcomingOnly = input.upcomingOnly === true || input.upcomingOnly === "true";

    const { getAppointments } = await import("@/app/actions/operations");
    const rows = await getAppointments(
      ctx.organizationId,
      status ? { status } : undefined
    );

    const filtered = rows.filter((row) => {
      const appointmentAt = new Date(row.appointment.dateTime);
      if (fromDate && appointmentAt < fromDate) return false;
      if (toDate && appointmentAt > toDate) return false;
      if (upcomingOnly && appointmentAt.getTime() < Date.now()) return false;

      if (!query) return true;
      const contactName = `${row.contact?.firstName ?? ""} ${row.contact?.lastName ?? ""}`.trim();
      const haystack = [
        row.appointment.title,
        row.appointment.type ?? "",
        row.appointment.notes ?? "",
        contactName,
        row.contact?.email ?? "",
        row.contact?.phone ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    const results = filtered.slice(0, limit).map((row) => ({
      id: row.appointment.id,
      title: row.appointment.title,
      status: row.appointment.status,
      dateTime: row.appointment.dateTime,
      duration: row.appointment.duration,
      type: row.appointment.type,
      contactId: row.appointment.contactId,
      staffId: row.appointment.staffId,
      contactName: row.contact
        ? `${row.contact.firstName} ${row.contact.lastName}`.trim()
        : null,
      contactEmail: row.contact?.email ?? null,
      contactPhone: row.contact?.phone ?? null,
    }));

    return {
      success: true,
      output: {
        appointments: results,
        count: results.length,
      },
    };
  },
};

const appointmentsSetStatus: GraceTool = {
  name: "appointments.setStatus",
  description: "Set an appointment status.",
  inputSchema: appointmentsSetStatusInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const appointmentId = String(input.appointmentId || "").trim();
    const status = String(input.status || "").trim();
    if (!appointmentId) return { success: false, error: "appointmentId is required" };
    if (!["scheduled", "confirmed", "completed", "cancelled", "no_show"].includes(status)) {
      return {
        success: false,
        error:
          'status must be one of "scheduled", "confirmed", "completed", "cancelled", "no_show"',
      };
    }

    const { updateAppointment } = await import("@/app/actions/operations");
    const updated = await updateAppointment(appointmentId, { status: status as any });
    return {
      success: true,
      output: {
        appointmentId: updated.id,
        status: updated.status,
      },
    };
  },
};

const appointmentsReschedule: GraceTool = {
  name: "appointments.reschedule",
  description: "Move an appointment to a new date/time and optionally update duration or notes.",
  inputSchema: appointmentsRescheduleInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const appointmentId = String(input.appointmentId || "").trim();
    const dateTimeRaw = input.dateTime ? String(input.dateTime) : "";
    if (!appointmentId) return { success: false, error: "appointmentId is required" };
    if (!dateTimeRaw) return { success: false, error: "dateTime is required" };

    const dateTime = new Date(dateTimeRaw);
    if (Number.isNaN(dateTime.getTime())) {
      return { success: false, error: "dateTime must be a valid datetime" };
    }

    const durationRaw = input.duration ?? undefined;
    const duration =
      durationRaw === undefined || durationRaw === null
        ? undefined
        : Number(durationRaw);
    if (duration !== undefined && (Number.isNaN(duration) || duration <= 0)) {
      return { success: false, error: "duration must be a positive number" };
    }

    const { rescheduleAppointment } = await import("@/app/actions/operations");
    const updated = await rescheduleAppointment({
      appointmentId,
      dateTime,
      ...(duration !== undefined && { duration }),
      ...(input.notes !== undefined && {
        notes: input.notes ? String(input.notes) : null,
      }),
      ...(input.resetStatus !== undefined && {
        resetStatus: input.resetStatus === true || input.resetStatus === "true",
      }),
    });

    return {
      success: true,
      output: {
        appointmentId: updated.id,
        status: updated.status,
        dateTime: updated.dateTime,
      },
    };
  },
};

const appointmentsDelete: GraceTool = {
  name: "appointments.delete",
  description: "Permanently delete an appointment.",
  inputSchema: appointmentIdInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const appointmentId = String(input.appointmentId || "").trim();
    if (!appointmentId) return { success: false, error: "appointmentId is required" };

    const { deleteAppointment } = await import("@/app/actions/operations");
    const deleted = await deleteAppointment(appointmentId);
    return { success: true, output: { appointmentId: deleted.id, deleted: true } };
  },
};

const appointmentsCancel: GraceTool = {
  name: "appointments.cancel",
  description: "Cancel an appointment without deleting it.",
  inputSchema: appointmentIdInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const appointmentId = String(input.appointmentId || "").trim();
    if (!appointmentId) return { success: false, error: "appointmentId is required" };

    const { updateAppointment } = await import("@/app/actions/operations");
    await updateAppointment(appointmentId, { status: "cancelled" });
    return { success: true, output: { cancelled: true, appointmentId } };
  },
};

const callsSearch: GraceTool = {
  name: "calls.search",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, ctx) {
    const query = input.query ? String(input.query).trim().toLowerCase() : "";
    const outcome = input.outcome ? String(input.outcome).trim().toLowerCase() : null;
    const escalatedOnly = input.escalatedOnly === true || input.escalatedOnly === "true";
    const limit = Math.min(Number(input.limit ?? 25), 100);
    const fromDate = input.fromDate ? new Date(String(input.fromDate)) : null;
    const toDate = input.toDate ? new Date(String(input.toDate)) : null;

    if (fromDate && Number.isNaN(fromDate.getTime())) {
      return { success: false, error: "fromDate must be a valid datetime" };
    }
    if (toDate && Number.isNaN(toDate.getTime())) {
      return { success: false, error: "toDate must be a valid datetime" };
    }

    const { getGraceCalls } = await import("@/app/actions/grace");
    const rows = await getGraceCalls(ctx.organizationId);

    const filtered = rows.filter((row) => {
      const callAt = row.call.startedAt ?? row.call.createdAt;
      if (fromDate && callAt < fromDate) return false;
      if (toDate && callAt > toDate) return false;

      const isEscalated =
        row.latestHandoffStatus === "open" ||
        row.session?.status === "escalated" ||
        row.call.outcome?.toLowerCase() === "escalated";
      if (escalatedOnly && !isEscalated) return false;

      if (outcome && (row.call.outcome ?? "").toLowerCase() !== outcome) return false;

      if (!query) return true;
      const contactName = row.contact
        ? `${row.contact.firstName} ${row.contact.lastName}`.trim()
        : "";
      const haystack = [
        row.call.fromNumber ?? "",
        row.call.toNumber ?? "",
        row.call.transcriptText ?? "",
        row.call.summaryText ?? "",
        row.call.intent ?? "",
        row.call.outcome ?? "",
        row.latestHandoffReason ?? "",
        contactName,
        row.contact?.email ?? "",
        row.contact?.phone ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    const results = filtered.slice(0, limit).map((row) => {
      const contactName = row.contact
        ? `${row.contact.firstName} ${row.contact.lastName}`.trim()
        : null;
      return {
        callId: row.call.id,
        sessionId: row.call.sessionId,
        contactId: row.call.contactId ?? row.contact?.id ?? null,
        contactName,
        fromNumber: row.call.fromNumber,
        toNumber: row.call.toNumber,
        startedAt: row.call.startedAt,
        endedAt: row.call.endedAt,
        durationSec: row.call.durationSec,
        summaryText: row.call.summaryText,
        transcriptText: row.call.transcriptText,
        intent: row.call.intent,
        outcome: row.call.outcome,
        linkedConversationId: row.linkedConversationId,
        latestHandoffId: row.latestHandoffId,
        latestHandoffStatus: row.latestHandoffStatus,
        latestHandoffReason: row.latestHandoffReason,
      };
    });

    return { success: true, output: { calls: results, count: results.length } };
  },
};

const callsUpdate: GraceTool = {
  name: "calls.update",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, ctx) {
    const callId = String(input.callId || "").trim();
    if (!callId) return { success: false, error: "callId is required" };

    const updateInput: {
      organizationId: string;
      callId: string;
      contactId?: string | null;
      startedAt?: Date | null;
      endedAt?: Date | null;
      durationSec?: number | null;
      recordingUrl?: string | null;
      transcriptText?: string | null;
      summaryText?: string | null;
      intent?: string | null;
      outcome?: string | null;
    } = {
      organizationId: ctx.organizationId,
      callId,
    };

    if (input.contactId !== undefined) {
      updateInput.contactId = input.contactId ? String(input.contactId) : null;
    }
    if (input.startedAt !== undefined) {
      if (input.startedAt === null) {
        updateInput.startedAt = null;
      } else {
        const startedAt = new Date(String(input.startedAt));
        if (Number.isNaN(startedAt.getTime())) {
          return { success: false, error: "startedAt must be a valid datetime" };
        }
        updateInput.startedAt = startedAt;
      }
    }
    if (input.endedAt !== undefined) {
      if (input.endedAt === null) {
        updateInput.endedAt = null;
      } else {
        const endedAt = new Date(String(input.endedAt));
        if (Number.isNaN(endedAt.getTime())) {
          return { success: false, error: "endedAt must be a valid datetime" };
        }
        updateInput.endedAt = endedAt;
      }
    }
    if (input.durationSec !== undefined) {
      if (input.durationSec === null) {
        updateInput.durationSec = null;
      } else {
        const durationSec = Number(input.durationSec);
        if (!Number.isFinite(durationSec) || durationSec < 0) {
          return { success: false, error: "durationSec must be a non-negative number" };
        }
        updateInput.durationSec = Math.round(durationSec);
      }
    }
    if (input.recordingUrl !== undefined) {
      updateInput.recordingUrl = input.recordingUrl ? String(input.recordingUrl) : null;
    }
    if (input.transcriptText !== undefined) {
      updateInput.transcriptText = input.transcriptText
        ? String(input.transcriptText)
        : null;
    }
    if (input.summaryText !== undefined) {
      updateInput.summaryText = input.summaryText ? String(input.summaryText) : null;
    }
    if (input.intent !== undefined) {
      updateInput.intent = input.intent ? String(input.intent) : null;
    }
    if (input.outcome !== undefined) {
      updateInput.outcome = input.outcome ? String(input.outcome) : null;
    }

    const updateKeys = Object.keys(updateInput).filter(
      (key) => key !== "organizationId" && key !== "callId"
    );
    if (updateKeys.length === 0) {
      return { success: false, error: "No call fields provided to update" };
    }

    const { updateGraceCall } = await import("@/app/actions/grace");
    const updated = await updateGraceCall(updateInput);
    return {
      success: true,
      output: {
        callId: updated.id,
        sessionId: updated.sessionId,
        outcome: updated.outcome,
        intent: updated.intent,
        hasTranscript: Boolean(updated.transcriptText),
        hasSummary: Boolean(updated.summaryText),
      },
    };
  },
};

const callsEscalate: GraceTool = {
  name: "calls.escalate",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, ctx) {
    const callId = String(input.callId || "").trim();
    const reason = String(input.reason || "").trim();
    if (!callId) return { success: false, error: "callId is required" };
    if (!reason) return { success: false, error: "reason is required" };

    const { escalateGraceCall } = await import("@/app/actions/grace");
    const escalated = await escalateGraceCall({
      organizationId: ctx.organizationId,
      callId,
      reason,
      ...(input.summaryText !== undefined && {
        summaryText: input.summaryText ? String(input.summaryText) : null,
      }),
      ...(input.assignedTeam !== undefined && {
        assignedTeam: input.assignedTeam ? String(input.assignedTeam) : null,
      }),
    });

    return {
      success: true,
      output: {
        callId: escalated.callId,
        sessionId: escalated.sessionId,
        handoffId: escalated.handoffId,
        linkedConversationId: escalated.linkedConversationId,
        createdHandoff: escalated.createdHandoff,
      },
    };
  },
};

const pipelineSearch: GraceTool = {
  name: "pipeline.search",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, ctx) {
    const query = input.query ? String(input.query).trim().toLowerCase() : "";
    const stageId = input.stageId ? String(input.stageId) : null;
    const priority = input.priority ? String(input.priority) : null;
    const assigneeId = input.assigneeId ? String(input.assigneeId) : null;
    const limit = Math.min(Number(input.limit ?? 100), 300);

    const { getPipelineData } = await import("@/app/actions/pipeline");
    const { stages, items } = await getPipelineData(ctx.organizationId);
    const stageById = new Map(stages.map((stage) => [stage.id, stage]));

    const filtered = items.filter((row) => {
      if (stageId && row.item.stageId !== stageId) return false;
      if (priority && row.item.priority !== priority) return false;
      if (assigneeId && row.item.assigneeId !== assigneeId) return false;
      if (!query) return true;

      const stage = stageById.get(row.item.stageId);
      const contactName = row.contact
        ? `${row.contact.firstName} ${row.contact.lastName}`.trim()
        : "";
      const haystack = [
        contactName,
        row.contact?.email ?? "",
        row.contact?.phone ?? "",
        row.item.notes ?? "",
        stage?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });

    const results = filtered.slice(0, limit).map((row) => {
      const stage = stageById.get(row.item.stageId);
      return {
        itemId: row.item.id,
        stageId: row.item.stageId,
        stageName: stage?.name ?? null,
        stageOrder: stage?.order ?? null,
        contactId: row.item.contactId,
        contactName: row.contact
          ? `${row.contact.firstName} ${row.contact.lastName}`.trim()
          : null,
        priority: row.item.priority,
        assigneeId: row.item.assigneeId,
        order: row.item.order,
        notes: row.item.notes,
        lastContactDate: row.item.lastContactDate,
        nextActionDate: row.item.nextActionDate,
        updatedAt: row.item.updatedAt,
      };
    });

    return {
      success: true,
      output: {
        items: results,
        count: results.length,
      },
    };
  },
};

const pipelineUpdateItem: GraceTool = {
  name: "pipeline.updateItem",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, _ctx) {
    const itemId = String(input.itemId || "").trim();
    if (!itemId) return { success: false, error: "itemId is required" };

    const patch: {
      stageId?: string;
      order?: number;
      priority?: "low" | "medium" | "high";
      assigneeId?: string | null;
      notes?: string | null;
      lastContactDate?: Date | null;
      nextActionDate?: Date | null;
    } = {};

    if (input.stageId !== undefined || input.order !== undefined) {
      const stageId = input.stageId ? String(input.stageId).trim() : "";
      const order = Number(input.order);
      if (!stageId || Number.isNaN(order)) {
        return {
          success: false,
          error: "stageId and numeric order are required when moving a pipeline item",
        };
      }
      patch.stageId = stageId;
      patch.order = Math.max(0, Math.floor(order));
    }

    if (input.priority !== undefined) {
      const priority = String(input.priority);
      if (!["low", "medium", "high"].includes(priority)) {
        return { success: false, error: 'priority must be one of "low", "medium", "high"' };
      }
      patch.priority = priority as "low" | "medium" | "high";
    }

    if (input.assigneeId !== undefined) {
      patch.assigneeId = input.assigneeId ? String(input.assigneeId) : null;
    }

    if (input.notes !== undefined) {
      patch.notes = input.notes ? String(input.notes) : null;
    }

    if (input.lastContactDate !== undefined) {
      if (input.lastContactDate === null) {
        patch.lastContactDate = null;
      } else {
        const lastContactDate = new Date(String(input.lastContactDate));
        if (Number.isNaN(lastContactDate.getTime())) {
          return { success: false, error: "lastContactDate must be a valid datetime" };
        }
        patch.lastContactDate = lastContactDate;
      }
    }

    if (input.nextActionDate !== undefined) {
      if (input.nextActionDate === null) {
        patch.nextActionDate = null;
      } else {
        const nextActionDate = new Date(String(input.nextActionDate));
        if (Number.isNaN(nextActionDate.getTime())) {
          return { success: false, error: "nextActionDate must be a valid datetime" };
        }
        patch.nextActionDate = nextActionDate;
      }
    }

    if (Object.keys(patch).length === 0) {
      return { success: false, error: "No pipeline fields provided to update" };
    }

    const { updatePipelineItem } = await import("@/app/actions/pipeline");
    const updated = await updatePipelineItem(itemId, patch);
    return {
      success: true,
      output: {
        itemId: updated.id,
        stageId: updated.stageId,
        priority: updated.priority,
        assigneeId: updated.assigneeId,
      },
    };
  },
};

const pipelineDeleteItem: GraceTool = {
  name: "pipeline.deleteItem",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  requiresApproval: true,
  async execute(input, _ctx) {
    const itemId = String(input.itemId || "").trim();
    if (!itemId) return { success: false, error: "itemId is required" };

    const { deletePipelineItem } = await import("@/app/actions/pipeline");
    await deletePipelineItem(itemId);
    return { success: true, output: { itemId, deleted: true } };
  },
};

const pipelineAudit: GraceTool = {
  name: "pipeline.audit",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, ctx) {
    const limit = Math.min(Number(input.limit ?? 50), 200);
    const itemId = input.itemId ? String(input.itemId) : undefined;

    const { getPipelineMovementAudit } = await import("@/app/actions/pipeline");
    const rows = await getPipelineMovementAudit({
      organizationId: ctx.organizationId,
      itemId,
      limit,
    });

    return {
      success: true,
      output: {
        logs: rows.map((row) => ({
          id: row.id,
          actionType: row.actionType,
          entityId: row.entityId,
          details: row.details,
          userId: row.userId,
          createdAt: row.createdAt,
        })),
        count: rows.length,
      },
    };
  },
};

const pipelineMoveStage: GraceTool = {
  name: "pipeline.moveStage",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, _ctx) {
    const itemId = String(input.itemId || "").trim();
    const stageId = String(input.stageId || "").trim();
    if (!itemId || !stageId) return { success: false, error: "itemId and stageId are required" };

    const { updateItemStage } = await import("@/app/actions/pipeline");
    await updateItemStage(itemId, stageId, 0);
    return { success: true, output: { moved: true, itemId, stageId } };
  },
};

const ministriesAddMember: GraceTool = {
  name: "ministries.addMember",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, _ctx) {
    const ministryId = String(input.ministryId || "").trim();
    const contactId = String(input.contactId || "").trim();
    if (!ministryId || !contactId) {
      return { success: false, error: "ministryId and contactId are required" };
    }

    const role = input.role ? String(input.role) : undefined;
    const { addMinistryMember } = await import("@/app/actions/ministries");
    await addMinistryMember(ministryId, contactId, role);
    return { success: true, output: { added: true, ministryId, contactId } };
  },
};

const conversationsSearch: GraceTool = {
  name: "conversations.search",
  description: "Search communication conversations by text, status, or archived state.",
  inputSchema: conversationsSearchInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, ctx) {
    const query = input.query ? String(input.query).trim().toLowerCase() : "";
    const status = input.status ? String(input.status) : undefined;
    const includeArchived = input.includeArchived === true || input.includeArchived === "true";
    const limit = Math.min(Number(input.limit ?? 50), 200);

    const { getConversations } = await import("@/app/actions/communications");
    const rows = await getConversations(ctx.organizationId, {
      ...(status !== undefined && { status }),
      includeArchived,
    });

    const filtered = query
      ? rows.filter((row) => {
          const contactName = `${row.contact?.firstName ?? ""} ${row.contact?.lastName ?? ""}`.trim();
          const haystack = [
            row.conversation.subject ?? "",
            row.conversation.channel,
            row.conversation.status,
            contactName,
            row.contact?.email ?? "",
            row.contact?.phone ?? "",
          ]
            .join(" ")
            .toLowerCase();
          return haystack.includes(query);
        })
      : rows;

    const results = filtered.slice(0, limit).map((row) => ({
      id: row.conversation.id,
      status: row.conversation.status,
      channel: row.conversation.channel,
      subject: row.conversation.subject,
      contactId: row.conversation.contactId,
      contactName: row.contact
        ? `${row.contact.firstName} ${row.contact.lastName}`.trim()
        : null,
      contactEmail: row.contact?.email ?? null,
      contactPhone: row.contact?.phone ?? null,
      lastMessageAt: row.conversation.lastMessageAt,
      updatedAt: row.conversation.updatedAt,
    }));

    return { success: true, output: { conversations: results, count: results.length } };
  },
};

const conversationsSetStatus: GraceTool = {
  name: "conversations.setStatus",
  description: "Set a communication conversation status.",
  inputSchema: conversationsSetStatusInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, _ctx) {
    const conversationId = String(input.conversationId || "").trim();
    const status = String(input.status || "").trim();
    if (!conversationId) return { success: false, error: "conversationId is required" };
    if (!["open", "waiting", "resolved", "archived"].includes(status)) {
      return {
        success: false,
        error: 'status must be one of "open", "waiting", "resolved", "archived"',
      };
    }

    const { updateConversationStatus } = await import("@/app/actions/communications");
    const updated = await updateConversationStatus(conversationId, status);
    return {
      success: true,
      output: {
        conversationId: updated.id,
        status: updated.status,
      },
    };
  },
};

const conversationsMarkWaiting: GraceTool = {
  name: "conversations.waiting",
  description: "Mark a communication conversation as waiting.",
  inputSchema: conversationIdInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, _ctx) {
    const conversationId = String(input.conversationId || "").trim();
    if (!conversationId) return { success: false, error: "conversationId is required" };

    const { markConversationWaiting } = await import("@/app/actions/communications");
    const updated = await markConversationWaiting(conversationId);
    return { success: true, output: { conversationId: updated.id, status: updated.status } };
  },
};

const conversationsArchive: GraceTool = {
  name: "conversations.archive",
  description: "Archive a communication conversation.",
  inputSchema: conversationIdInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, _ctx) {
    const conversationId = String(input.conversationId || "").trim();
    if (!conversationId) return { success: false, error: "conversationId is required" };

    const { archiveConversation } = await import("@/app/actions/communications");
    const updated = await archiveConversation(conversationId);
    return { success: true, output: { conversationId: updated.id, status: updated.status } };
  },
};

const conversationsReopen: GraceTool = {
  name: "conversations.reopen",
  description: "Reopen a communication conversation.",
  inputSchema: conversationIdInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, _ctx) {
    const conversationId = String(input.conversationId || "").trim();
    if (!conversationId) return { success: false, error: "conversationId is required" };

    const { reopenConversation } = await import("@/app/actions/communications");
    const updated = await reopenConversation(conversationId);
    return { success: true, output: { conversationId: updated.id, status: updated.status } };
  },
};

const conversationsResolve: GraceTool = {
  name: "conversations.resolve",
  description: "Resolve a communication conversation.",
  inputSchema: conversationIdInputSchema,
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, _ctx) {
    const conversationId = String(input.conversationId || "").trim();
    if (!conversationId) return { success: false, error: "conversationId is required" };

    const { updateConversationStatus } = await import("@/app/actions/communications");
    await updateConversationStatus(conversationId, "resolved");
    return { success: true, output: { resolved: true, conversationId } };
  },
};

export const graceTools: GraceTool[] = [
  contactsUpsert,
  churchInfoSearch,
  prayerCreate,
  appointmentCheckAvailability,
  appointmentBook,
  messageSendSMS,
  messageSendEmail,
  staffAlert,
  handoffTransfer,
  tasksCreate,
  memoryWrite,
  onboardingProfileUpdate,
  onboardingInstallStarterTemplates,
  onboardingBootstrapSampleData,
  onboardingStartGuidedSequence,
  serviceRunsCreateFromTemplate,
  serviceRunsAutoStaff,
  serviceAssignmentsSendOfferSMS,
  pipelinesAddToStage,
  // Executive assistant CRUD tools
  contactsSearch,
  contactsUpdate,
  contactsArchive,
  contactsRestore,
  contactsDelete,
  contactsFindDuplicates,
  contactsMerge,
  tasksSearch,
  financeWeeklyReport,
  tasksUpdate,
  tasksComplete,
  volunteersCreate,
  volunteersUpdate,
  volunteersDelete,
  volunteerShiftsCreate,
  volunteerShiftsUpdate,
  volunteerShiftsDelete,
  prayerRequestsUpdate,
  appointmentsSearch,
  appointmentsSetStatus,
  appointmentsReschedule,
  appointmentsDelete,
  appointmentsCancel,
  callsSearch,
  callsUpdate,
  callsEscalate,
  pipelineSearch,
  pipelineUpdateItem,
  pipelineDeleteItem,
  pipelineAudit,
  pipelineMoveStage,
  ministriesAddMember,
  conversationsSearch,
  conversationsSetStatus,
  conversationsMarkWaiting,
  conversationsArchive,
  conversationsReopen,
  conversationsResolve,
];

export function findGraceTool(name: string): GraceTool | undefined {
  return graceTools.find((tool) => tool.name === name);
}

// ---------------------------------------------------------------------------
// Agency Tier Classification
// ---------------------------------------------------------------------------
// 🟢 autonomous: Grace executes immediately (routine church operations)
// 🟡 suggest:    Grace proposes and waits for staff confirmation
// 🔴 always_ask: Hard-blocked until explicit approval
// ---------------------------------------------------------------------------

import type { AgencyTier } from "../types";

const AGENCY_TIER_MAP: Record<string, AgencyTier> = {
  // 🟢 AUTONOMOUS — routine operations Grace handles on her own
  // Read/search tools (no side effects)
  "contacts.search": "autonomous",
  "contacts.findDuplicates": "autonomous",
  "tasks.search": "autonomous",
  "appointments.search": "autonomous",
  "appointments.checkAvailability": "autonomous",
  "calls.search": "autonomous",
  "pipeline.search": "autonomous",
  "pipeline.audit": "autonomous",
  "conversations.search": "autonomous",
  "finance.weeklyReport": "autonomous",
  "churchInfo.search": "autonomous",

  // Internal CRM housekeeping
  "tasks.create": "autonomous",
  "tasks.update": "autonomous",
  "tasks.complete": "autonomous",
  "memory.write": "autonomous",
  "contacts.upsert": "autonomous",
  "contacts.update": "autonomous",
  "prayerRequests.create": "autonomous",
  "prayerRequests.update": "autonomous",
  "staff.alert": "autonomous",
  "handoff.transfer": "autonomous",
  "pipelines.addToStage": "autonomous",
  "pipeline.moveStage": "autonomous",
  "pipeline.updateItem": "autonomous",
  "conversations.setStatus": "autonomous",
  "conversations.waiting": "autonomous",
  "conversations.resolve": "autonomous",
  "conversations.archive": "autonomous",
  "conversations.reopen": "autonomous",
  "calls.update": "autonomous",
  "calls.escalate": "autonomous",

  // Routine outreach (visitor follow-ups, thank-you texts, volunteer staffing)
  "messages.sendSMS": "autonomous",
  "messages.sendEmail": "autonomous",
  "appointments.book": "autonomous",
  "serviceRuns.createFromTemplate": "autonomous",
  "serviceRuns.autoStaff": "autonomous",
  "serviceAssignments.sendOfferSMS": "autonomous",
  "volunteers.create": "autonomous",
  "volunteerShifts.create": "autonomous",

  // Onboarding tools
  "onboarding.profile.update": "autonomous",
  "onboarding.installStarterTemplates": "autonomous",
  "onboarding.bootstrapSampleData": "autonomous",
  "onboarding.startGuidedSequence": "autonomous",

  // 🟡 SUGGEST — Grace proposes, staff confirms
  "volunteers.update": "suggest",
  "volunteerShifts.update": "suggest",
  "appointments.setStatus": "suggest",
  "appointments.reschedule": "suggest",
  "ministries.addMember": "suggest",
  "contacts.restore": "suggest",

  // 🔴 ALWAYS ASK — high-impact, blocked until explicit approval
  "contacts.archive": "always_ask",
  "contacts.delete": "always_ask",
  "contacts.merge": "always_ask",
  "appointments.delete": "always_ask",
  "appointments.cancel": "always_ask",
  "pipeline.deleteItem": "always_ask",
  "volunteers.delete": "always_ask",
  "volunteerShifts.delete": "always_ask",
};

export function resolveAgencyTier(toolName: string): AgencyTier {
  // Check tool-level override first
  const tool = findGraceTool(toolName);
  if (tool?.agencyTier) return tool.agencyTier;
  // Fall back to centralized map
  return AGENCY_TIER_MAP[toolName] ?? "suggest";
}
