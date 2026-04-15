"use server";

import { db } from "@/db";
import {
  graceSessions,
  graceCalls,
  graceMessages,
  graceToolAudit,
  graceAuditStream,
  graceKnowledge,
  graceKnowledgeVersions,
  graceApprovals,
  graceFollowupProposals,
  graceMemory,
  graceGoals,
  graceHandoffs,
  churchContacts,
  conversations,
  tasks,
  providerConfigs,
  gracePolicyConfigs,
} from "@/db/schema";
import { organizationMemberships } from "@/db/schema/organization-membership";
import { and, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { runGraceMessage } from "@/lib/grace/runtime";
import sendMail from "@/lib/email/sendMail";
import {
  resolveEmailProvider,
} from "@/lib/grace/providers/resolver";
import {
  allowsMultipleActiveProvidersForChannel,
  normalizeAndEncryptProviderConfig,
  redactProviderConfigForClient,
} from "@/lib/grace/providers/security";
import { compatibleChurchContactSelect } from "@/lib/contacts/projection";
import {
  getSmsGatewayProviderCandidates,
  isSmsGatewayProvider,
} from "@/lib/sms-gateway/provider";
import { sendOrganizationSms } from "@/lib/sms-gateway/send";
import * as z from "zod";

const organizationIdSchema = z.string().trim().min(1);
const graceIdSchema = z.string().trim().min(1);
const optionalDateSchema = z.union([z.coerce.date(), z.null()]).optional();
const optionalTrimmedStringSchema = z.string().trim().nullable().optional();
const trimmedStringSchema = z.string().trim().min(1);

const updateGraceCallSchema = z.object({
  organizationId: organizationIdSchema,
  callId: graceIdSchema,
  contactId: z.string().trim().nullable().optional(),
  startedAt: optionalDateSchema,
  endedAt: optionalDateSchema,
  durationSec: z.number().finite().nonnegative().nullable().optional(),
  recordingUrl: optionalTrimmedStringSchema,
  transcriptText: optionalTrimmedStringSchema,
  summaryText: optionalTrimmedStringSchema,
  intent: optionalTrimmedStringSchema,
  outcome: optionalTrimmedStringSchema,
});

const escalateGraceCallSchema = z.object({
  organizationId: organizationIdSchema,
  callId: graceIdSchema,
  reason: trimmedStringSchema,
  summaryText: optionalTrimmedStringSchema,
  assignedTeam: optionalTrimmedStringSchema,
  metadataJson: z.record(z.string(), z.unknown()).optional(),
});

const createGraceKnowledgeSchema = z.object({
  organizationId: organizationIdSchema,
  title: trimmedStringSchema,
  content: trimmedStringSchema,
  tags: z.array(z.string().trim()).optional(),
  useForGrace: z.boolean().optional(),
  visibility: z.enum(["public", "internal"]).optional(),
});

const updateGraceKnowledgeSchema = z.object({
  organizationId: organizationIdSchema,
  knowledgeId: graceIdSchema,
  title: z.string().trim().min(1).optional(),
  content: z.string().trim().min(1).optional(),
  tags: z.array(z.string().trim()).optional(),
  useForGrace: z.boolean().optional(),
  visibility: z.enum(["public", "internal"]).optional(),
});

const graceKnowledgeIdSchema = z.object({
  organizationId: organizationIdSchema,
  knowledgeId: graceIdSchema,
});

const getGraceKnowledgeVersionsSchema = z.object({
  organizationId: organizationIdSchema,
  knowledgeId: graceIdSchema,
  limit: z.number().int().positive().max(100).optional(),
});

const updateGraceFollowupProposalStatusSchema = z.object({
  organizationId: organizationIdSchema,
  proposalId: graceIdSchema,
  status: z.enum(["approved", "rejected", "pending", "sent"]),
});

const getGraceMemoriesSchema = z.object({
  organizationId: organizationIdSchema,
  memoryType: z.enum(["contact_memory", "org_pattern", "daily_briefing"]).optional(),
  contactId: z.string().trim().min(1).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

const createGraceMemorySchema = z.object({
  organizationId: organizationIdSchema,
  sessionId: z.string().trim().nullable().optional(),
  contactId: z.string().trim().nullable().optional(),
  memoryType: z.enum(["contact_memory", "org_pattern", "daily_briefing"]),
  summary: trimmedStringSchema,
  details: optionalTrimmedStringSchema,
  tags: z.array(z.string().trim()).optional(),
  metadataJson: z.record(z.string(), z.unknown()).optional(),
});

const updateGraceApprovalSchema = z.object({
  organizationId: organizationIdSchema,
  approvalId: graceIdSchema,
  status: z.enum(["approved", "rejected"]),
  decisionNote: z.string().trim().optional(),
});

const upsertGraceProviderConfigSchema = z.object({
  organizationId: organizationIdSchema,
  channel: trimmedStringSchema,
  provider: trimmedStringSchema,
  mode: z.enum(["agency_managed", "disabled"]),
  isActive: z.boolean().optional(),
  configJson: z.record(z.string(), z.unknown()).optional(),
});

const updateGracePolicyConfigSchema = z.object({
  organizationId: organizationIdSchema,
  approvalsEnabled: z.boolean().optional(),
  autoEscalateOnEmergency: z.boolean().optional(),
  confidenceThreshold: z
    .string()
    .trim()
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1;
    }, "confidenceThreshold must be between 0 and 1")
    .optional(),
  highRiskTools: z.array(z.string().trim().min(1)).optional(),
  allowedPublicTools: z.array(z.string().trim().min(1)).optional(),
});

const sendCopilotMessageSchema = z.object({
  organizationId: organizationIdSchema,
  sessionId: z.string().trim().optional(),
  message: trimmedStringSchema,
});

async function requireOrgMembership(organizationId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const [member] = await db
    .select({ role: organizationMemberships.role })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, session.user.id),
        eq(organizationMemberships.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!member) throw new Error("Forbidden");
  return { userId: session.user.id, role: member.role };
}

async function requireOrgAdmin(organizationId: string) {
  const membership = await requireOrgMembership(organizationId);
  if (membership.role !== "owner" && membership.role !== "admin") {
    throw new Error("Forbidden");
  }
  return membership;
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...(value as Record<string, unknown>) };
}

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeOptionalDate(
  value: Date | string | null | undefined,
  label: string
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} must be a valid date`);
  }
  return date;
}

function renderProposalEmailBody(message: string): string {
  return `<p>${message
    .split("\n")
    .map((line) => line.trim())
    .join("</p><p>")}</p>`;
}

async function sendProposalEmail(params: {
  organizationId: string;
  recipient: string;
  subject: string;
  messageText: string;
}) {
  const emailProvider = await resolveEmailProvider(params.organizationId);
  if (emailProvider.mode === "disabled") {
    throw new Error("Email channel is disabled");
  }

  const html = renderProposalEmailBody(params.messageText);
  if (emailProvider.mode === "sendgrid") {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${emailProvider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: params.recipient }] }],
        from: { email: emailProvider.fromEmail },
        subject: params.subject,
        content: [{ type: "text/html", value: html }],
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SendGrid error (${response.status}): ${text}`);
    }
    return { providerMessageId: null as string | null };
  }

  const result = await sendMail(params.recipient, params.subject, html);
  return { providerMessageId: result.id ?? null };
}

async function createManualFollowupTask(params: {
  organizationId: string;
  contactId: string | null;
  recipient: string | null;
  reason: string | null;
  messageText: string;
  proposalId: string;
  dispatchError: string;
}) {
  let contactLabel = params.recipient || "Unknown recipient";
  if (params.contactId) {
    const [contact] = await db
      .select({
        firstName: churchContacts.firstName,
        lastName: churchContacts.lastName,
      })
      .from(churchContacts)
      .where(eq(churchContacts.id, params.contactId))
      .limit(1);

    if (contact) {
      contactLabel = `${contact.firstName} ${contact.lastName}`.trim();
    }
  }

  const [task] = await db
    .insert(tasks)
    .values({
      organizationId: params.organizationId,
      title: `Manual follow-up required: ${contactLabel}`,
      description: [
        `Grace proposal ${params.proposalId} could not be auto-delivered.`,
        params.reason ? `Reason: ${params.reason}` : null,
        `Delivery issue: ${params.dispatchError}`,
        `Suggested message: ${params.messageText}`,
      ]
        .filter(Boolean)
        .join("\n"),
      priority: "high",
      status: "todo",
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    .returning({ id: tasks.id });

  return task.id;
}

type GraceKnowledgeSnapshot = Pick<
  typeof graceKnowledge.$inferSelect,
  "title" | "content" | "tags" | "useForGrace" | "visibility"
>;

async function getNextKnowledgeVersionNumber(params: {
  organizationId: string;
  knowledgeId: string;
}) {
  const [row] = await db
    .select({
      latestVersionNumber:
        sql<number>`coalesce(max(${graceKnowledgeVersions.versionNumber}), 0)`,
    })
    .from(graceKnowledgeVersions)
    .where(
      and(
        eq(graceKnowledgeVersions.organizationId, params.organizationId),
        eq(graceKnowledgeVersions.knowledgeId, params.knowledgeId)
      )
    );

  return Number(row?.latestVersionNumber ?? 0) + 1;
}

async function writeKnowledgeVersion(params: {
  organizationId: string;
  knowledgeId: string;
  snapshot: GraceKnowledgeSnapshot;
  changeType: "create" | "update" | "delete";
  changedByUserId: string;
  changeSummary?: string | null;
}) {
  const versionNumber = await getNextKnowledgeVersionNumber({
    organizationId: params.organizationId,
    knowledgeId: params.knowledgeId,
  });

  const [version] = await db
    .insert(graceKnowledgeVersions)
    .values({
      organizationId: params.organizationId,
      knowledgeId: params.knowledgeId,
      versionNumber,
      changeType: params.changeType,
      title: params.snapshot.title,
      content: params.snapshot.content,
      tags: params.snapshot.tags ?? [],
      useForGrace: params.snapshot.useForGrace,
      visibility: params.snapshot.visibility,
      changeSummary: params.changeSummary ?? null,
      changedByUserId: params.changedByUserId,
    })
    .returning();

  return version;
}

export async function getGraceSessions(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);
  return db
    .select()
    .from(graceSessions)
    .where(eq(graceSessions.organizationId, parsedOrganizationId))
    .orderBy(desc(graceSessions.createdAt));
}

export async function getGraceCalls(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);
  return db
    .select({
      call: graceCalls,
      session: graceSessions,
      contact: compatibleChurchContactSelect,
      linkedConversationId: sql<string | null>`(
        select c.id
        from conversation c
        where c.organization_id = ${graceCalls.organizationId}
          and c.channel = 'phone'
          and (
            (${graceCalls.contactId} is not null and c.contact_id = ${graceCalls.contactId})
            or (${graceCalls.contactId} is null and ${graceSessions.matchedContactId} is not null and c.contact_id = ${graceSessions.matchedContactId})
          )
        order by c.last_message_at desc nulls last, c.created_at desc
        limit 1
      )`,
      latestHandoffId: sql<string | null>`(
        select gh.id
        from grace_handoff gh
        where gh.organization_id = ${graceCalls.organizationId}
          and gh.session_id = ${graceCalls.sessionId}
        order by gh.created_at desc
        limit 1
      )`,
      latestHandoffStatus: sql<"open" | "acknowledged" | "resolved" | null>`(
        select gh.status
        from grace_handoff gh
        where gh.organization_id = ${graceCalls.organizationId}
          and gh.session_id = ${graceCalls.sessionId}
        order by gh.created_at desc
        limit 1
      )`,
      latestHandoffReason: sql<string | null>`(
        select gh.reason
        from grace_handoff gh
        where gh.organization_id = ${graceCalls.organizationId}
          and gh.session_id = ${graceCalls.sessionId}
        order by gh.created_at desc
        limit 1
      )`,
      latestHandoffCreatedAt: sql<Date | null>`(
        select gh.created_at
        from grace_handoff gh
        where gh.organization_id = ${graceCalls.organizationId}
          and gh.session_id = ${graceCalls.sessionId}
        order by gh.created_at desc
        limit 1
      )`,
    })
    .from(graceCalls)
    .leftJoin(graceSessions, eq(graceCalls.sessionId, graceSessions.id))
    .leftJoin(
      churchContacts,
      sql`${churchContacts.id} = coalesce(${graceCalls.contactId}, ${graceSessions.contactId}, ${graceSessions.matchedContactId})`
    )
    .where(eq(graceCalls.organizationId, parsedOrganizationId))
    .orderBy(desc(graceCalls.createdAt));
}

export async function updateGraceCall(input: {
  organizationId: string;
  callId: string;
  contactId?: string | null;
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
  durationSec?: number | null;
  recordingUrl?: string | null;
  transcriptText?: string | null;
  summaryText?: string | null;
  intent?: string | null;
  outcome?: string | null;
}) {
  const parsed = updateGraceCallSchema.parse(input);
  await requireOrgMembership(parsed.organizationId);
  const [existing] = await db
    .select({
      id: graceCalls.id,
      contactId: graceCalls.contactId,
      startedAt: graceCalls.startedAt,
      endedAt: graceCalls.endedAt,
      durationSec: graceCalls.durationSec,
      recordingUrl: graceCalls.recordingUrl,
      transcriptText: graceCalls.transcriptText,
      summaryText: graceCalls.summaryText,
      intent: graceCalls.intent,
      outcome: graceCalls.outcome,
    })
    .from(graceCalls)
    .where(
      and(
        eq(graceCalls.organizationId, parsed.organizationId),
        eq(graceCalls.id, parsed.callId)
      )
    )
    .limit(1);

  if (!existing) {
    throw new Error("Call record not found");
  }

  const updates: {
    contactId?: string | null;
    startedAt?: Date | null;
    endedAt?: Date | null;
    durationSec?: number | null;
    recordingUrl?: string | null;
    transcriptText?: string | null;
    summaryText?: string | null;
    intent?: string | null;
    outcome?: string | null;
  } = {};

  if (parsed.contactId !== undefined) {
    const nextContactId = parsed.contactId ? String(parsed.contactId).trim() : null;
    if (nextContactId) {
      const [contact] = await db
        .select({ id: churchContacts.id })
        .from(churchContacts)
        .where(
          and(
            eq(churchContacts.organizationId, parsed.organizationId),
            eq(churchContacts.id, nextContactId)
          )
        )
        .limit(1);

      if (!contact) {
        throw new Error("Contact not found for this organization");
      }
      updates.contactId = contact.id;
    } else {
      updates.contactId = null;
    }
  }

  const startedAt = normalizeOptionalDate(parsed.startedAt, "startedAt");
  if (startedAt !== undefined) {
    updates.startedAt = startedAt;
  }

  const endedAt = normalizeOptionalDate(parsed.endedAt, "endedAt");
  if (endedAt !== undefined) {
    updates.endedAt = endedAt;
  }

  const nextStartedAt =
    updates.startedAt !== undefined ? updates.startedAt : existing.startedAt;
  const nextEndedAt = updates.endedAt !== undefined ? updates.endedAt : existing.endedAt;
  if (nextStartedAt && nextEndedAt && nextEndedAt.getTime() < nextStartedAt.getTime()) {
    throw new Error("endedAt cannot be before startedAt");
  }

  if (parsed.durationSec !== undefined) {
    if (parsed.durationSec === null) {
      updates.durationSec = null;
    } else {
      const durationSec = Number(parsed.durationSec);
      if (!Number.isFinite(durationSec) || durationSec < 0) {
        throw new Error("durationSec must be a non-negative number");
      }
      updates.durationSec = Math.round(durationSec);
    }
  } else if (updates.startedAt !== undefined || updates.endedAt !== undefined) {
    if (nextStartedAt && nextEndedAt) {
      updates.durationSec = Math.max(
        0,
        Math.round((nextEndedAt.getTime() - nextStartedAt.getTime()) / 1000)
      );
    }
  }

  const recordingUrl = normalizeOptionalText(parsed.recordingUrl);
  if (recordingUrl !== undefined) updates.recordingUrl = recordingUrl;

  const transcriptText = normalizeOptionalText(parsed.transcriptText);
  if (transcriptText !== undefined) updates.transcriptText = transcriptText;

  const summaryText = normalizeOptionalText(parsed.summaryText);
  if (summaryText !== undefined) updates.summaryText = summaryText;

  const intent = normalizeOptionalText(parsed.intent);
  if (intent !== undefined) updates.intent = intent;

  const outcome = normalizeOptionalText(parsed.outcome);
  if (outcome !== undefined) updates.outcome = outcome;

  if (Object.keys(updates).length === 0) {
    throw new Error("No call fields provided to update");
  }

  const [updated] = await db
    .update(graceCalls)
    .set(updates)
    .where(
      and(
        eq(graceCalls.organizationId, parsed.organizationId),
        eq(graceCalls.id, parsed.callId)
      )
    )
    .returning();

  if (!updated) {
    throw new Error("Call record not found");
  }

  return updated;
}

export async function escalateGraceCall(input: {
  organizationId: string;
  callId: string;
  reason: string;
  summaryText?: string | null;
  assignedTeam?: string | null;
  metadataJson?: Record<string, unknown>;
}) {
  const parsed = escalateGraceCallSchema.parse(input);
  await requireOrgMembership(parsed.organizationId);
  const reason = parsed.reason;

  const [callRow] = await db
    .select({
      id: graceCalls.id,
      sessionId: graceCalls.sessionId,
      callContactId: graceCalls.contactId,
      callSummaryText: graceCalls.summaryText,
      callTranscriptText: graceCalls.transcriptText,
      sessionActorType: graceSessions.actorType,
      sessionContactId: graceSessions.contactId,
      sessionMatchedContactId: graceSessions.matchedContactId,
    })
    .from(graceCalls)
    .innerJoin(
      graceSessions,
      and(
        eq(graceCalls.sessionId, graceSessions.id),
        eq(graceSessions.organizationId, parsed.organizationId)
      )
    )
    .where(
      and(
        eq(graceCalls.organizationId, parsed.organizationId),
        eq(graceCalls.id, parsed.callId)
      )
    )
    .limit(1);

  if (!callRow) {
    throw new Error("Call record not found");
  }

  const summaryText =
    normalizeOptionalText(parsed.summaryText) ??
    normalizeOptionalText(callRow.callSummaryText) ??
    normalizeOptionalText(callRow.callTranscriptText) ??
    `Call ${callRow.id} requires escalation`;
  const assignedTeam = normalizeOptionalText(parsed.assignedTeam) ?? "pastoral_care";
  const resolvedContactId =
    callRow.callContactId ??
    callRow.sessionContactId ??
    callRow.sessionMatchedContactId ??
    null;

  await db
    .update(graceSessions)
    .set({
      status: "escalated",
      handoffReason: reason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(graceSessions.organizationId, parsed.organizationId),
        eq(graceSessions.id, callRow.sessionId)
      )
    );

  await db
    .update(graceCalls)
    .set({
      outcome: "escalated",
      ...(resolvedContactId && { contactId: resolvedContactId }),
    })
    .where(
      and(
        eq(graceCalls.organizationId, parsed.organizationId),
        eq(graceCalls.id, callRow.id)
      )
    );

  const [existingOpenHandoff] = await db
    .select({ id: graceHandoffs.id })
    .from(graceHandoffs)
    .where(
      and(
        eq(graceHandoffs.organizationId, parsed.organizationId),
        eq(graceHandoffs.sessionId, callRow.sessionId),
        eq(graceHandoffs.status, "open")
      )
    )
    .limit(1);

  let handoffId = existingOpenHandoff?.id ?? null;
  let createdHandoff = false;

  if (!handoffId) {
    const [createdHandoffRow] = await db
      .insert(graceHandoffs)
      .values({
        organizationId: parsed.organizationId,
        sessionId: callRow.sessionId,
        contactId: resolvedContactId,
        actorType: callRow.sessionActorType,
        reason,
        summaryText,
        assignedTeam,
        status: "open",
        metadataJson: {
          ...(parsed.metadataJson ?? {}),
          source: "calls.escalate",
          callId: callRow.id,
        },
      })
      .returning({ id: graceHandoffs.id });

    handoffId = createdHandoffRow?.id ?? null;
    createdHandoff = Boolean(handoffId);
  }

  let linkedConversationId: string | null = null;
  if (resolvedContactId) {
    const [conversation] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.organizationId, parsed.organizationId),
          eq(conversations.channel, "phone"),
          eq(conversations.contactId, resolvedContactId)
        )
      )
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt))
      .limit(1);

    if (conversation) {
      linkedConversationId = conversation.id;
      await db
        .update(conversations)
        .set({
          status: "waiting",
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(conversations.organizationId, parsed.organizationId),
            eq(conversations.id, conversation.id)
          )
        );
    } else {
      const [createdConversation] = await db
        .insert(conversations)
        .values({
          organizationId: parsed.organizationId,
          contactId: resolvedContactId,
          channel: "phone",
          status: "waiting",
          subject: `Grace call escalation: ${reason}`,
          lastMessageAt: new Date(),
        })
        .returning({ id: conversations.id });
      linkedConversationId = createdConversation?.id ?? null;
    }
  }

  return {
    callId: callRow.id,
    sessionId: callRow.sessionId,
    handoffId,
    linkedConversationId,
    createdHandoff,
    contactId: resolvedContactId,
  };
}

export async function getGraceMessages(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);
  return db
    .select()
    .from(graceMessages)
    .where(eq(graceMessages.organizationId, parsedOrganizationId))
    .orderBy(desc(graceMessages.createdAt));
}

export async function getGraceToolAudit(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);
  return db
    .select()
    .from(graceToolAudit)
    .where(eq(graceToolAudit.organizationId, parsedOrganizationId))
    .orderBy(desc(graceToolAudit.createdAt));
}

export async function getGraceKnowledge(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);
  return db
    .select()
    .from(graceKnowledge)
    .where(eq(graceKnowledge.organizationId, parsedOrganizationId))
    .orderBy(desc(graceKnowledge.updatedAt));
}

export async function createGraceKnowledge(input: {
  organizationId: string;
  title: string;
  content: string;
  tags?: string[];
  useForGrace?: boolean;
  visibility?: "public" | "internal";
}) {
  const parsed = createGraceKnowledgeSchema.parse(input);
  const { userId } = await requireOrgMembership(parsed.organizationId);
  const title = parsed.title.trim();
  const content = parsed.content.trim();

  const [created] = await db
    .insert(graceKnowledge)
    .values({
      organizationId: parsed.organizationId,
      title,
      content,
      tags: parsed.tags ?? [],
      useForGrace: parsed.useForGrace ?? true,
      visibility: parsed.visibility ?? "internal",
    })
    .returning();

  await writeKnowledgeVersion({
    organizationId: parsed.organizationId,
    knowledgeId: created.id,
    snapshot: created,
    changeType: "create",
    changedByUserId: userId,
    changeSummary: "Initial creation",
  });

  return created;
}

export async function updateGraceKnowledge(input: {
  organizationId: string;
  knowledgeId: string;
  title?: string;
  content?: string;
  tags?: string[];
  useForGrace?: boolean;
  visibility?: "public" | "internal";
}) {
  const parsed = updateGraceKnowledgeSchema.parse(input);
  const { userId } = await requireOrgMembership(parsed.organizationId);
  const [existing] = await db
    .select()
    .from(graceKnowledge)
    .where(
      and(
        eq(graceKnowledge.organizationId, parsed.organizationId),
        eq(graceKnowledge.id, parsed.knowledgeId)
      )
    )
    .limit(1);

  if (!existing) {
    throw new Error("Knowledge entry not found");
  }

  const patch: Partial<typeof graceKnowledge.$inferInsert> = {
    updatedAt: new Date(),
  };
  const changedFields: string[] = [];

  if (parsed.title !== undefined) {
    patch.title = parsed.title.trim();
    changedFields.push("title");
  }

  if (parsed.content !== undefined) {
    patch.content = parsed.content.trim();
    changedFields.push("content");
  }

  if (parsed.tags !== undefined) {
    patch.tags = parsed.tags;
    changedFields.push("tags");
  }

  if (parsed.useForGrace !== undefined) {
    patch.useForGrace = parsed.useForGrace;
    changedFields.push("useForGrace");
  }

  if (parsed.visibility !== undefined) {
    patch.visibility = parsed.visibility;
    changedFields.push("visibility");
  }

  if (changedFields.length === 0) {
    return existing;
  }

  const [updated] = await db
    .update(graceKnowledge)
    .set(patch)
    .where(
      and(
        eq(graceKnowledge.organizationId, parsed.organizationId),
        eq(graceKnowledge.id, parsed.knowledgeId)
      )
    )
    .returning();

  if (!updated) {
    throw new Error("Knowledge entry not found");
  }

  await writeKnowledgeVersion({
    organizationId: parsed.organizationId,
    knowledgeId: updated.id,
    snapshot: updated,
    changeType: "update",
    changedByUserId: userId,
    changeSummary: `Updated ${changedFields.join(", ")}`,
  });

  return updated;
}

export async function deleteGraceKnowledge(input: {
  organizationId: string;
  knowledgeId: string;
}) {
  const parsed = graceKnowledgeIdSchema.parse(input);
  const { userId } = await requireOrgAdmin(parsed.organizationId);
  const [existing] = await db
    .select()
    .from(graceKnowledge)
    .where(
      and(
        eq(graceKnowledge.organizationId, parsed.organizationId),
        eq(graceKnowledge.id, parsed.knowledgeId)
      )
    )
    .limit(1);

  if (!existing) {
    throw new Error("Knowledge entry not found");
  }

  await writeKnowledgeVersion({
    organizationId: parsed.organizationId,
    knowledgeId: existing.id,
    snapshot: existing,
    changeType: "delete",
    changedByUserId: userId,
    changeSummary: "Deleted entry",
  });

  const [deleted] = await db
    .delete(graceKnowledge)
    .where(
      and(
        eq(graceKnowledge.organizationId, parsed.organizationId),
        eq(graceKnowledge.id, parsed.knowledgeId)
      )
    )
    .returning({ id: graceKnowledge.id });

  if (!deleted) {
    throw new Error("Knowledge entry not found");
  }

  return deleted;
}

export async function getGraceKnowledgeVersions(input: {
  organizationId: string;
  knowledgeId: string;
  limit?: number;
}) {
  const parsed = getGraceKnowledgeVersionsSchema.parse(input);
  await requireOrgMembership(parsed.organizationId);
  return db
    .select()
    .from(graceKnowledgeVersions)
    .where(
      and(
        eq(graceKnowledgeVersions.organizationId, parsed.organizationId),
        eq(graceKnowledgeVersions.knowledgeId, parsed.knowledgeId)
      )
    )
    .orderBy(desc(graceKnowledgeVersions.versionNumber), desc(graceKnowledgeVersions.createdAt))
    .limit(parsed.limit ?? 20);
}

export async function getGraceApprovals(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);
  return db
    .select()
    .from(graceApprovals)
    .where(eq(graceApprovals.organizationId, parsedOrganizationId))
    .orderBy(desc(graceApprovals.createdAt));
}

export async function getGraceFollowupProposals(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);
  return db
    .select()
    .from(graceFollowupProposals)
    .where(eq(graceFollowupProposals.organizationId, parsedOrganizationId))
    .orderBy(desc(graceFollowupProposals.createdAt));
}

export async function getGraceActivityFeed(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);
  return db
    .select({
      id: graceAuditStream.id,
      status: graceAuditStream.status,
      source: graceAuditStream.source,
      actorType: graceAuditStream.actorType,
      channel: graceAuditStream.channel,
      toolName: graceAuditStream.toolName,
      actionName: graceAuditStream.actionName,
      errorText: graceAuditStream.errorText,
      metadataJson: graceAuditStream.metadataJson,
      createdAt: graceAuditStream.createdAt,
    })
    .from(graceAuditStream)
    .where(
      and(
        eq(graceAuditStream.organizationId, parsedOrganizationId),
        eq(graceAuditStream.eventType, "action_execution")
      )
    )
    .orderBy(desc(graceAuditStream.createdAt))
    .limit(30);
}

export async function updateGraceFollowupProposalStatus(input: {
  organizationId: string;
  proposalId: string;
  status: "approved" | "rejected" | "pending" | "sent";
}) {
  const parsed = updateGraceFollowupProposalStatusSchema.parse(input);
  const { userId } = await requireOrgMembership(parsed.organizationId);
  const [proposal] = await db
    .select()
    .from(graceFollowupProposals)
    .where(
      and(
        eq(graceFollowupProposals.organizationId, parsed.organizationId),
        eq(graceFollowupProposals.id, parsed.proposalId)
      )
    )
    .limit(1);

  if (!proposal) {
    throw new Error("Proposal not found");
  }

  if (parsed.status !== "approved") {
    const [updated] = await db
      .update(graceFollowupProposals)
      .set({
        status: parsed.status,
        approvedByUserId: null,
        approvedAt: null,
      })
      .where(
        and(
          eq(graceFollowupProposals.organizationId, parsed.organizationId),
          eq(graceFollowupProposals.id, parsed.proposalId)
        )
      )
      .returning();

    if (!updated) {
      throw new Error("Proposal not found");
    }

    return updated;
  }

  if (proposal.status === "sent" || proposal.status === "approved") {
    return proposal;
  }

  const now = new Date();
  const existingMetadata = normalizeMetadata(proposal.metadataJson);
  const dispatchChannel = proposal.proposedChannel || proposal.channel;
  const recipient = proposal.recipient?.trim() || null;
  const dispatchSummary: Record<string, unknown> = {
    reviewedByUserId: userId,
    reviewedAt: now.toISOString(),
    dispatchChannel,
  };
  let nextStatus: "approved" | "sent" = "approved";

  if (!recipient) {
    const taskId = await createManualFollowupTask({
      organizationId: proposal.organizationId,
      contactId: proposal.contactId ?? null,
      recipient: null,
      reason: proposal.reason ?? null,
      messageText: proposal.messageText,
      proposalId: proposal.id,
      dispatchError: "Missing recipient on proposal",
    });
    dispatchSummary.delivery = "manual_task_created";
    dispatchSummary.manualTaskId = taskId;
    dispatchSummary.dispatchError = "missing_recipient";
  } else {
    try {
      if (dispatchChannel === "sms") {
        const sent = await sendOrganizationSms({
          organizationId: proposal.organizationId,
          to: recipient,
          message: proposal.messageText,
          idempotencyKey: `${proposal.id}:approved-send`,
        });

        if (!sent.success) {
          throw new Error(sent.error ?? "SMS send failed");
        }

        await db.insert(graceMessages).values({
          organizationId: proposal.organizationId,
          sessionId: proposal.sessionId,
          contactId: proposal.contactId ?? null,
          direction: "outbound",
          channel: "sms",
          messageText: proposal.messageText,
          providerMessageId: sent.providerMessageId,
          metadataJson: {
            source: "grace_followup_proposal",
            proposalId: proposal.id,
          },
        });

        nextStatus = "sent";
        dispatchSummary.delivery = "sent";
        dispatchSummary.providerMessageId = sent.providerMessageId;
      } else if (dispatchChannel === "email") {
        const emailResult = await sendProposalEmail({
          organizationId: proposal.organizationId,
          recipient,
          subject: proposal.subject || "Message from your church",
          messageText: proposal.messageText,
        });

        await db.insert(graceMessages).values({
          organizationId: proposal.organizationId,
          sessionId: proposal.sessionId,
          contactId: proposal.contactId ?? null,
          direction: "outbound",
          channel: "email",
          messageText: proposal.messageText,
          providerMessageId: emailResult.providerMessageId,
          metadataJson: {
            source: "grace_followup_proposal",
            proposalId: proposal.id,
            subject: proposal.subject || "Message from your church",
          },
        });

        nextStatus = "sent";
        dispatchSummary.delivery = "sent";
        dispatchSummary.providerMessageId = emailResult.providerMessageId;
      } else {
        throw new Error(`Unsupported proposal channel: ${dispatchChannel}`);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Provider dispatch failed";
      const taskId = await createManualFollowupTask({
        organizationId: proposal.organizationId,
        contactId: proposal.contactId ?? null,
        recipient,
        reason: proposal.reason ?? null,
        messageText: proposal.messageText,
        proposalId: proposal.id,
        dispatchError: message,
      });

      dispatchSummary.delivery = "manual_task_created";
      dispatchSummary.manualTaskId = taskId;
      dispatchSummary.dispatchError = message;
    }
  }

  const [updated] = await db
    .update(graceFollowupProposals)
    .set({
      status: nextStatus,
      approvedByUserId: userId,
      approvedAt: now,
      metadataJson: {
        ...existingMetadata,
        dispatch: dispatchSummary,
      },
    })
    .where(
      and(
        eq(graceFollowupProposals.organizationId, parsed.organizationId),
        eq(graceFollowupProposals.id, parsed.proposalId)
      )
    )
    .returning();

  if (!updated) {
    throw new Error("Proposal not found");
  }

  return updated;
}

export async function getGraceMemories(input: {
  organizationId: string;
  memoryType?: "contact_memory" | "org_pattern" | "daily_briefing";
  contactId?: string;
  limit?: number;
}) {
  const parsed = getGraceMemoriesSchema.parse(input);
  await requireOrgMembership(parsed.organizationId);
  const clauses = [eq(graceMemory.organizationId, parsed.organizationId)];
  if (parsed.memoryType) {
    clauses.push(eq(graceMemory.memoryType, parsed.memoryType));
  }
  if (parsed.contactId) {
    clauses.push(eq(graceMemory.contactId, parsed.contactId));
  }

  return db
    .select()
    .from(graceMemory)
    .where(and(...clauses))
    .orderBy(desc(graceMemory.createdAt))
    .limit(parsed.limit ?? 20);
}

export async function getGraceDailyBriefing(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [todayBriefing] = await db
    .select()
    .from(graceMemory)
    .where(
      and(
        eq(graceMemory.organizationId, parsedOrganizationId),
        eq(graceMemory.memoryType, "daily_briefing"),
        gte(graceMemory.createdAt, startOfToday)
      )
    )
    .orderBy(desc(graceMemory.createdAt))
    .limit(1);

  if (todayBriefing) return todayBriefing;

  const [latestBriefing] = await db
    .select()
    .from(graceMemory)
    .where(
      and(
        eq(graceMemory.organizationId, parsedOrganizationId),
        eq(graceMemory.memoryType, "daily_briefing")
      )
    )
    .orderBy(desc(graceMemory.createdAt))
    .limit(1);

  return latestBriefing ?? null;
}

export async function createGraceMemory(input: {
  organizationId: string;
  sessionId?: string | null;
  contactId?: string | null;
  memoryType: "contact_memory" | "org_pattern" | "daily_briefing";
  summary: string;
  details?: string | null;
  tags?: string[];
  metadataJson?: Record<string, unknown>;
}) {
  const parsed = createGraceMemorySchema.parse(input);
  const { userId } = await requireOrgMembership(parsed.organizationId);
  const sessionId = normalizeOptionalText(parsed.sessionId);
  const contactId = normalizeOptionalText(parsed.contactId);

  if (parsed.memoryType === "contact_memory" && !contactId) {
    throw new Error("contactId is required for contact_memory entries");
  }

  const [created] = await db
    .insert(graceMemory)
    .values({
      organizationId: parsed.organizationId,
      sessionId: sessionId ?? null,
      contactId: contactId ?? null,
      memoryType: parsed.memoryType,
      summary: parsed.summary.trim(),
      details: normalizeOptionalText(parsed.details) ?? null,
      tags: parsed.tags ?? [],
      metadataJson: parsed.metadataJson,
      createdByActorType: "staff",
      createdByUserId: userId,
    })
    .returning();

  return created;
}

export async function getGracePendingGoals(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);
  return db
    .select()
    .from(graceGoals)
    .where(
      and(
        eq(graceGoals.organizationId, parsedOrganizationId),
        inArray(graceGoals.status, ["queued", "in_progress", "waiting"])
      )
    )
    .orderBy(desc(graceGoals.createdAt))
    .limit(20);
}

export async function updateGraceApproval(input: {
  organizationId: string;
  approvalId: string;
  status: "approved" | "rejected";
  decidedByUserId?: string;
  decisionNote?: string;
}) {
  const parsed = updateGraceApprovalSchema.parse(input);
  const { userId } = await requireOrgMembership(parsed.organizationId);
  const [updated] = await db
    .update(graceApprovals)
    .set({
      status: parsed.status,
      // Always record the actual authenticated user, not a caller-supplied value
      decidedByUserId: userId,
      decisionNote: parsed.decisionNote ?? null,
      decidedAt: new Date(),
    })
    .where(
      and(
        eq(graceApprovals.organizationId, parsed.organizationId),
        eq(graceApprovals.id, parsed.approvalId)
      )
    )
    .returning();

  return updated;
}

export async function getGraceProviderConfigs(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);
  const rows = await db
    .select()
    .from(providerConfigs)
    .where(eq(providerConfigs.organizationId, parsedOrganizationId))
    .orderBy(desc(providerConfigs.updatedAt));

  return rows.map((row) => {
    const normalizedMode = row.mode === "byo" ? "agency_managed" : row.mode;
    const redacted = redactProviderConfigForClient({
      channel: row.channel,
      provider: row.provider,
      config: row.configJson ?? {},
      mode: normalizedMode,
    });

    return {
      ...row,
      mode: normalizedMode,
      configJson: redacted.configJson,
      secretStatus: redacted.secretStatus,
      validation: redacted.validation,
    };
  });
}

export async function upsertGraceProviderConfig(input: {
  organizationId: string;
  channel: string;
  provider: string;
  mode: "agency_managed" | "disabled";
  isActive?: boolean;
  configJson?: Record<string, unknown>;
}) {
  const parsed = upsertGraceProviderConfigSchema.parse(input);
  await requireOrgAdmin(parsed.organizationId);
  const providerCandidates =
    parsed.channel === "sms" && isSmsGatewayProvider(parsed.provider)
      ? getSmsGatewayProviderCandidates(parsed.provider)
      : [parsed.provider];

  const [existing] = await db
    .select()
    .from(providerConfigs)
    .where(
      and(
        eq(providerConfigs.organizationId, parsed.organizationId),
        eq(providerConfigs.channel, parsed.channel),
        providerCandidates.length === 1
          ? eq(providerConfigs.provider, providerCandidates[0]!)
          : inArray(providerConfigs.provider, providerCandidates)
      )
    )
    .limit(1);

  const normalized = normalizeAndEncryptProviderConfig({
    channel: parsed.channel,
    provider: parsed.provider,
    mode: parsed.mode,
    // Organization admins can only enable/disable platform-managed providers.
    incoming: undefined,
    existing: existing?.configJson ?? {},
  });

  const nextIsActive =
    parsed.mode === "disabled" ? false : (parsed.isActive ?? existing?.isActive ?? true);

  if (existing) {
    const [updated] = await db
      .update(providerConfigs)
      .set({
        provider: parsed.provider,
        mode: parsed.mode,
        isActive: nextIsActive,
        configJson: normalized.configJson,
        updatedAt: new Date(),
      })
      .where(eq(providerConfigs.id, existing.id))
      .returning();

    if (updated.isActive && !allowsMultipleActiveProvidersForChannel(parsed.channel)) {
      await db
        .update(providerConfigs)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(providerConfigs.organizationId, parsed.organizationId),
            eq(providerConfigs.channel, parsed.channel),
            eq(providerConfigs.isActive, true),
            ne(providerConfigs.id, updated.id)
          )
        );
    }

    const redacted = redactProviderConfigForClient({
      channel: updated.channel,
      provider: updated.provider,
      config: updated.configJson ?? {},
      mode: updated.mode,
    });
    return {
      ...updated,
      configJson: redacted.configJson,
      secretStatus: redacted.secretStatus,
      validation: redacted.validation,
    };
  }

  const [created] = await db
    .insert(providerConfigs)
    .values({
      organizationId: parsed.organizationId,
      channel: parsed.channel,
      provider: parsed.provider,
      mode: parsed.mode,
      isActive: nextIsActive,
      configJson: normalized.configJson,
    })
    .returning();

  if (created.isActive && !allowsMultipleActiveProvidersForChannel(parsed.channel)) {
    await db
      .update(providerConfigs)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(providerConfigs.organizationId, parsed.organizationId),
          eq(providerConfigs.channel, parsed.channel),
          eq(providerConfigs.isActive, true),
          ne(providerConfigs.id, created.id)
        )
      );
  }

  const redacted = redactProviderConfigForClient({
    channel: created.channel,
    provider: created.provider,
    config: created.configJson ?? {},
    mode: created.mode,
  });
  return {
    ...created,
    configJson: redacted.configJson,
    secretStatus: redacted.secretStatus,
    validation: redacted.validation,
  };
}

export async function getGracePolicyConfig(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);
  const [policy] = await db
    .select()
    .from(gracePolicyConfigs)
    .where(eq(gracePolicyConfigs.organizationId, parsedOrganizationId))
    .limit(1);

  if (policy) return policy;

  const [created] = await db
    .insert(gracePolicyConfigs)
    .values({
      organizationId: parsedOrganizationId,
      approvalsEnabled: true,
      autoEscalateOnEmergency: true,
      confidenceThreshold: "0.7",
      highRiskTools: [],
      allowedPublicTools: [
        "churchInfo.search",
        "prayerRequests.create",
        "appointments.checkAvailability",
        "handoff.transfer",
      ],
    })
    .returning();

  return created;
}

export async function updateGracePolicyConfig(input: {
  organizationId: string;
  approvalsEnabled?: boolean;
  autoEscalateOnEmergency?: boolean;
  confidenceThreshold?: string;
  highRiskTools?: string[];
  allowedPublicTools?: string[];
}) {
  const parsed = updateGracePolicyConfigSchema.parse(input);
  await requireOrgAdmin(parsed.organizationId);
  const current = await getGracePolicyConfig(parsed.organizationId);

  const [updated] = await db
    .update(gracePolicyConfigs)
    .set({
      approvalsEnabled: parsed.approvalsEnabled ?? current.approvalsEnabled,
      autoEscalateOnEmergency:
        parsed.autoEscalateOnEmergency ?? current.autoEscalateOnEmergency,
      confidenceThreshold: parsed.confidenceThreshold ?? current.confidenceThreshold,
      highRiskTools: parsed.highRiskTools ?? (current.highRiskTools || []),
      allowedPublicTools: parsed.allowedPublicTools ?? (current.allowedPublicTools || []),
      updatedAt: new Date(),
    })
    .where(eq(gracePolicyConfigs.id, current.id))
    .returning();

  return updated;
}

export async function sendCopilotMessage(input: {
  organizationId: string;
  sessionId?: string;
  message: string;
}) {
  const parsed = sendCopilotMessageSchema.parse(input);
  const { userId } = await requireOrgMembership(parsed.organizationId);
  return runGraceMessage({
    organizationId: parsed.organizationId,
    channel: "in_app",
    actorType: "staff",
    message: parsed.message,
    sessionId: parsed.sessionId,
    userId,
  });
}
