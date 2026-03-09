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
  graceMessages,
  pipelineItems,
  pipelineStages,
  users,
} from "@/db/schema";
import { and, eq, gte, ilike, inArray, lte, or, SQL } from "drizzle-orm";
import sendMail from "@/lib/email/sendMail";
import { sendTextBeeSMS } from "../channels/sms/textbee";
import { resolveEmailProvider, resolveSmsProvider } from "../providers/resolver";
import type { GraceTool } from "./types";

function isAppointmentConflictError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    return (error as { code?: string }).code === "23P01";
  }
  return false;
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

const contactsUpsert: GraceTool = {
  name: "contacts.upsert",
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

    return { success: true, output: { contactId: created.id, mode: "created" } };
  },
};

const churchInfoSearch: GraceTool = {
  name: "churchInfo.search",
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
  allowedChannels: ["voice", "sms", "web", "in_app"],
  async execute(input, ctx) {
    const content = String(input.content || "").trim();
    if (!content) return { success: false, error: "Missing prayer request content" };

    const [created] = await db
      .insert(prayerRequests)
      .values({
        organizationId: ctx.organizationId,
        contactId: (input.contactId as string) ?? null,
        contactName: input.contactName ? String(input.contactName) : null,
        content,
        urgency: (input.urgency as "normal" | "urgent" | "critical") ?? "normal",
        status: "new",
        isAnonymous: input.isAnonymous ? "true" : "false",
      })
      .returning();

    return { success: true, output: { prayerRequestId: created.id } };
  },
};

const appointmentCheckAvailability: GraceTool = {
  name: "appointments.checkAvailability",
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
  allowedChannels: ["sms", "in_app"],
  requiresApproval: true,
  async execute(input, ctx) {
    const to = String(input.to || "").trim();
    const message = String(input.message || "").trim();

    if (!to || !message) {
      return { success: false, error: "Missing SMS destination or message" };
    }

    const smsConfig = await resolveSmsProvider(ctx.organizationId);
    if (!smsConfig) {
      return { success: false, error: "SMS provider not configured for this organization" };
    }

    const sent = await sendTextBeeSMS({
      to,
      message,
      idempotencyKey: String(input.idempotencyKey || `${ctx.sessionId}:${to}:${Date.now()}`),
      config: smsConfig,
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
  allowedChannels: ["in_app"],
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
  allowedChannels: ["voice", "sms", "web", "in_app"],
  async execute(input, ctx) {
    await db
      .update(graceSessions)
      .set({
        status: "escalated",
        handoffReason: input.reason ? String(input.reason) : "policy_handoff",
        updatedAt: new Date(),
      })
      .where(eq(graceSessions.id, ctx.sessionId));

    return { success: true, output: { transferred: true } };
  },
};

const tasksCreate: GraceTool = {
  name: "tasks.create",
  allowedChannels: ["in_app"],
  async execute(input, ctx) {
    const title = String(input.title || "Follow up").trim();
    if (!title) return { success: false, error: "Missing task title" };

    const [created] = await db
      .insert(tasks)
      .values({
        organizationId: ctx.organizationId,
        title,
        description: input.description ? String(input.description) : null,
        dueDate: input.dueDate ? new Date(String(input.dueDate)) : null,
        status: "todo",
        priority: "medium",
      })
      .returning();

    return { success: true, output: { taskId: created.id } };
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

    const [stage] = await db
      .select()
      .from(pipelineStages)
      .where(and(eq(pipelineStages.id, stageId), eq(pipelineStages.organizationId, ctx.organizationId)))
      .limit(1);

    if (!stage) return { success: false, error: "Stage not found" };

    const [created] = await db
      .insert(pipelineItems)
      .values({
        organizationId: ctx.organizationId,
        contactId,
        stageId,
        notes: input.notes ? String(input.notes) : null,
      })
      .returning();

    return { success: true, output: { pipelineItemId: created.id } };
  },
};

// ---------------------------------------------------------------------------
// Executive assistant — CRUD tools for full data management
// ---------------------------------------------------------------------------

const contactsSearch: GraceTool = {
  name: "contacts.search",
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

const tasksUpdate: GraceTool = {
  name: "tasks.update",
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
      ...(input.dueDate !== undefined && {
        dueDate: input.dueDate ? new Date(String(input.dueDate)) : null,
      }),
    });
    return { success: true, output: { taskId: updated.id, status: updated.status } };
  },
};

const tasksComplete: GraceTool = {
  name: "tasks.complete",
  allowedChannels: ["voice", "voice_internal", "in_app"],
  async execute(input, ctx) {
    const taskId = String(input.taskId || "").trim();
    if (!taskId) return { success: false, error: "taskId is required" };

    const { updateTask } = await import("@/app/actions/tasks");
    await updateTask(taskId, { organizationId: ctx.organizationId, status: "done" });
    return { success: true, output: { completed: true, taskId } };
  },
};

const prayerRequestsUpdate: GraceTool = {
  name: "prayerRequests.update",
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

const appointmentsCancel: GraceTool = {
  name: "appointments.cancel",
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

const conversationsResolve: GraceTool = {
  name: "conversations.resolve",
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
  serviceRunsCreateFromTemplate,
  serviceRunsAutoStaff,
  serviceAssignmentsSendOfferSMS,
  pipelinesAddToStage,
  // Executive assistant CRUD tools
  contactsSearch,
  contactsUpdate,
  tasksUpdate,
  tasksComplete,
  prayerRequestsUpdate,
  appointmentsCancel,
  pipelineMoveStage,
  ministriesAddMember,
  conversationsResolve,
];

export function findGraceTool(name: string): GraceTool | undefined {
  return graceTools.find((tool) => tool.name === name);
}
