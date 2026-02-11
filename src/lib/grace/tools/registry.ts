import { db } from "@/db";
import {
  appointments,
  churchContacts,
  prayerRequests,
  tasks,
  graceKnowledge,
  graceSessions,
  graceMessages,
  pipelineItems,
  pipelineStages,
} from "@/db/schema";
import { and, eq, gte, ilike, lte, or, SQL } from "drizzle-orm";
import sendMail from "@/lib/email/sendMail";
import { sendTextBeeSMS } from "../channels/sms/textbee";
import type { GraceTool } from "./types";

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

    const entries = await db
      .select()
      .from(graceKnowledge)
      .where(
        and(
          eq(graceKnowledge.organizationId, ctx.organizationId),
          eq(graceKnowledge.useForGrace, true),
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

    const [created] = await db
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

    const sent = await sendTextBeeSMS({
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
  allowedChannels: ["in_app"],
  requiresApproval: true,
  async execute(input) {
    const to = String(input.to || "").trim();
    const subject = String(input.subject || "Church Update");
    const html = String(input.html || input.message || "").trim();

    if (!to || !html) {
      return { success: false, error: "Missing email fields" };
    }

    await sendMail(to, subject, html);
    return { success: true, output: { delivered: true } };
  },
};

const staffAlert: GraceTool = {
  name: "staff.alert",
  allowedChannels: ["voice", "sms", "web", "in_app"],
  async execute(input) {
    console.warn("GRACE staff alert", input);
    return { success: true, output: { alerted: true } };
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
  pipelinesAddToStage,
];

export function findGraceTool(name: string): GraceTool | undefined {
  return graceTools.find((tool) => tool.name === name);
}
