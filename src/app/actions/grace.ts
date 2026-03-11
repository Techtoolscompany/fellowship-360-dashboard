"use server";

import { db } from "@/db";
import {
  graceSessions,
  graceCalls,
  graceMessages,
  graceToolAudit,
  graceKnowledge,
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
import { sendTextBeeSMS } from "@/lib/grace/channels/sms/textbee";
import sendMail from "@/lib/email/sendMail";
import {
  resolveEmailProvider,
  resolveSmsProvider,
} from "@/lib/grace/providers/resolver";
import {
  isByoAllowedForChannel,
  normalizeAndEncryptProviderConfig,
  redactProviderConfigForClient,
} from "@/lib/grace/providers/security";

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

export async function getGraceSessions(organizationId: string) {
  await requireOrgMembership(organizationId);
  return db
    .select()
    .from(graceSessions)
    .where(eq(graceSessions.organizationId, organizationId))
    .orderBy(desc(graceSessions.createdAt));
}

export async function getGraceCalls(organizationId: string) {
  await requireOrgMembership(organizationId);
  return db
    .select({
      call: graceCalls,
      session: graceSessions,
      contact: churchContacts,
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
    .where(eq(graceCalls.organizationId, organizationId))
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
  await requireOrgMembership(input.organizationId);
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
        eq(graceCalls.organizationId, input.organizationId),
        eq(graceCalls.id, input.callId)
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

  if (input.contactId !== undefined) {
    const nextContactId = input.contactId ? String(input.contactId).trim() : null;
    if (nextContactId) {
      const [contact] = await db
        .select({ id: churchContacts.id })
        .from(churchContacts)
        .where(
          and(
            eq(churchContacts.organizationId, input.organizationId),
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

  const startedAt = normalizeOptionalDate(input.startedAt, "startedAt");
  if (startedAt !== undefined) {
    updates.startedAt = startedAt;
  }

  const endedAt = normalizeOptionalDate(input.endedAt, "endedAt");
  if (endedAt !== undefined) {
    updates.endedAt = endedAt;
  }

  const nextStartedAt =
    updates.startedAt !== undefined ? updates.startedAt : existing.startedAt;
  const nextEndedAt = updates.endedAt !== undefined ? updates.endedAt : existing.endedAt;
  if (nextStartedAt && nextEndedAt && nextEndedAt.getTime() < nextStartedAt.getTime()) {
    throw new Error("endedAt cannot be before startedAt");
  }

  if (input.durationSec !== undefined) {
    if (input.durationSec === null) {
      updates.durationSec = null;
    } else {
      const parsed = Number(input.durationSec);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("durationSec must be a non-negative number");
      }
      updates.durationSec = Math.round(parsed);
    }
  } else if (updates.startedAt !== undefined || updates.endedAt !== undefined) {
    if (nextStartedAt && nextEndedAt) {
      updates.durationSec = Math.max(
        0,
        Math.round((nextEndedAt.getTime() - nextStartedAt.getTime()) / 1000)
      );
    }
  }

  const recordingUrl = normalizeOptionalText(input.recordingUrl);
  if (recordingUrl !== undefined) updates.recordingUrl = recordingUrl;

  const transcriptText = normalizeOptionalText(input.transcriptText);
  if (transcriptText !== undefined) updates.transcriptText = transcriptText;

  const summaryText = normalizeOptionalText(input.summaryText);
  if (summaryText !== undefined) updates.summaryText = summaryText;

  const intent = normalizeOptionalText(input.intent);
  if (intent !== undefined) updates.intent = intent;

  const outcome = normalizeOptionalText(input.outcome);
  if (outcome !== undefined) updates.outcome = outcome;

  if (Object.keys(updates).length === 0) {
    throw new Error("No call fields provided to update");
  }

  const [updated] = await db
    .update(graceCalls)
    .set(updates)
    .where(
      and(
        eq(graceCalls.organizationId, input.organizationId),
        eq(graceCalls.id, input.callId)
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
  await requireOrgMembership(input.organizationId);
  const reason = String(input.reason || "").trim();
  if (!reason) {
    throw new Error("reason is required");
  }

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
        eq(graceSessions.organizationId, input.organizationId)
      )
    )
    .where(
      and(
        eq(graceCalls.organizationId, input.organizationId),
        eq(graceCalls.id, input.callId)
      )
    )
    .limit(1);

  if (!callRow) {
    throw new Error("Call record not found");
  }

  const summaryText =
    normalizeOptionalText(input.summaryText) ??
    normalizeOptionalText(callRow.callSummaryText) ??
    normalizeOptionalText(callRow.callTranscriptText) ??
    `Call ${callRow.id} requires escalation`;
  const assignedTeam = normalizeOptionalText(input.assignedTeam) ?? "pastoral_care";
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
        eq(graceSessions.organizationId, input.organizationId),
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
        eq(graceCalls.organizationId, input.organizationId),
        eq(graceCalls.id, callRow.id)
      )
    );

  const [existingOpenHandoff] = await db
    .select({ id: graceHandoffs.id })
    .from(graceHandoffs)
    .where(
      and(
        eq(graceHandoffs.organizationId, input.organizationId),
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
        organizationId: input.organizationId,
        sessionId: callRow.sessionId,
        contactId: resolvedContactId,
        actorType: callRow.sessionActorType,
        reason,
        summaryText,
        assignedTeam,
        status: "open",
        metadataJson: {
          ...(input.metadataJson ?? {}),
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
          eq(conversations.organizationId, input.organizationId),
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
            eq(conversations.organizationId, input.organizationId),
            eq(conversations.id, conversation.id)
          )
        );
    } else {
      const [createdConversation] = await db
        .insert(conversations)
        .values({
          organizationId: input.organizationId,
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
  await requireOrgMembership(organizationId);
  return db
    .select()
    .from(graceMessages)
    .where(eq(graceMessages.organizationId, organizationId))
    .orderBy(desc(graceMessages.createdAt));
}

export async function getGraceToolAudit(organizationId: string) {
  await requireOrgMembership(organizationId);
  return db
    .select()
    .from(graceToolAudit)
    .where(eq(graceToolAudit.organizationId, organizationId))
    .orderBy(desc(graceToolAudit.createdAt));
}

export async function getGraceKnowledge(organizationId: string) {
  await requireOrgMembership(organizationId);
  return db
    .select()
    .from(graceKnowledge)
    .where(eq(graceKnowledge.organizationId, organizationId))
    .orderBy(desc(graceKnowledge.updatedAt));
}

export async function createGraceKnowledge(input: {
  organizationId: string;
  title: string;
  content: string;
  tags?: string[];
  useForGrace?: boolean;
}) {
  await requireOrgMembership(input.organizationId);
  const [created] = await db
    .insert(graceKnowledge)
    .values({
      organizationId: input.organizationId,
      title: input.title,
      content: input.content,
      tags: input.tags ?? [],
      useForGrace: input.useForGrace ?? true,
    })
    .returning();

  return created;
}

export async function getGraceApprovals(organizationId: string) {
  await requireOrgMembership(organizationId);
  return db
    .select()
    .from(graceApprovals)
    .where(eq(graceApprovals.organizationId, organizationId))
    .orderBy(desc(graceApprovals.createdAt));
}

export async function getGraceFollowupProposals(organizationId: string) {
  await requireOrgMembership(organizationId);
  return db
    .select()
    .from(graceFollowupProposals)
    .where(eq(graceFollowupProposals.organizationId, organizationId))
    .orderBy(desc(graceFollowupProposals.createdAt));
}

export async function updateGraceFollowupProposalStatus(input: {
  organizationId: string;
  proposalId: string;
  status: "approved" | "rejected" | "pending" | "sent";
}) {
  const { userId } = await requireOrgMembership(input.organizationId);
  const [proposal] = await db
    .select()
    .from(graceFollowupProposals)
    .where(
      and(
        eq(graceFollowupProposals.organizationId, input.organizationId),
        eq(graceFollowupProposals.id, input.proposalId)
      )
    )
    .limit(1);

  if (!proposal) {
    throw new Error("Proposal not found");
  }

  if (input.status !== "approved") {
    const [updated] = await db
      .update(graceFollowupProposals)
      .set({
        status: input.status,
        approvedByUserId: null,
        approvedAt: null,
      })
      .where(
        and(
          eq(graceFollowupProposals.organizationId, input.organizationId),
          eq(graceFollowupProposals.id, input.proposalId)
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
        const smsConfig = await resolveSmsProvider(proposal.organizationId);
        if (!smsConfig) {
          throw new Error("SMS provider is not configured");
        }

        const sent = await sendTextBeeSMS({
          to: recipient,
          message: proposal.messageText,
          idempotencyKey: `${proposal.id}:approved-send`,
          config: smsConfig,
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
        eq(graceFollowupProposals.organizationId, input.organizationId),
        eq(graceFollowupProposals.id, input.proposalId)
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
  await requireOrgMembership(input.organizationId);
  const clauses = [eq(graceMemory.organizationId, input.organizationId)];
  if (input.memoryType) {
    clauses.push(eq(graceMemory.memoryType, input.memoryType));
  }
  if (input.contactId) {
    clauses.push(eq(graceMemory.contactId, input.contactId));
  }

  return db
    .select()
    .from(graceMemory)
    .where(and(...clauses))
    .orderBy(desc(graceMemory.createdAt))
    .limit(input.limit ?? 20);
}

export async function getGraceDailyBriefing(organizationId: string) {
  await requireOrgMembership(organizationId);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [todayBriefing] = await db
    .select()
    .from(graceMemory)
    .where(
      and(
        eq(graceMemory.organizationId, organizationId),
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
        eq(graceMemory.organizationId, organizationId),
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
  const { userId } = await requireOrgMembership(input.organizationId);

  if (input.memoryType === "contact_memory" && !input.contactId) {
    throw new Error("contactId is required for contact_memory entries");
  }

  const [created] = await db
    .insert(graceMemory)
    .values({
      organizationId: input.organizationId,
      sessionId: input.sessionId ?? null,
      contactId: input.contactId ?? null,
      memoryType: input.memoryType,
      summary: input.summary.trim(),
      details: input.details?.trim() || null,
      tags: input.tags ?? [],
      metadataJson: input.metadataJson,
      createdByActorType: "staff",
      createdByUserId: userId,
    })
    .returning();

  return created;
}

export async function getGracePendingGoals(organizationId: string) {
  await requireOrgMembership(organizationId);
  return db
    .select()
    .from(graceGoals)
    .where(
      and(
        eq(graceGoals.organizationId, organizationId),
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
  const { userId } = await requireOrgMembership(input.organizationId);
  const [updated] = await db
    .update(graceApprovals)
    .set({
      status: input.status,
      // Always record the actual authenticated user, not a caller-supplied value
      decidedByUserId: userId,
      decisionNote: input.decisionNote ?? null,
      decidedAt: new Date(),
    })
    .where(
      and(
        eq(graceApprovals.organizationId, input.organizationId),
        eq(graceApprovals.id, input.approvalId)
      )
    )
    .returning();

  return updated;
}

export async function getGraceProviderConfigs(organizationId: string) {
  await requireOrgMembership(organizationId);
  const rows = await db
    .select()
    .from(providerConfigs)
    .where(eq(providerConfigs.organizationId, organizationId))
    .orderBy(desc(providerConfigs.updatedAt));

  return rows.map((row) => {
    const redacted = redactProviderConfigForClient({
      channel: row.channel,
      provider: row.provider,
      config: row.configJson ?? {},
      mode: row.mode,
    });

    return {
      ...row,
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
  mode: "agency_managed" | "byo" | "disabled";
  isActive?: boolean;
  configJson?: Record<string, unknown>;
}) {
  await requireOrgAdmin(input.organizationId);
  if (input.mode === "byo" && !isByoAllowedForChannel(input.channel)) {
    throw new Error(
      `BYO is not allowed for ${input.channel}. This channel is agency-managed in your current plan.`
    );
  }

  const [existing] = await db
    .select()
    .from(providerConfigs)
    .where(
      and(
        eq(providerConfigs.organizationId, input.organizationId),
        eq(providerConfigs.channel, input.channel),
        eq(providerConfigs.provider, input.provider)
      )
    )
    .limit(1);

  const normalized = normalizeAndEncryptProviderConfig({
    channel: input.channel,
    provider: input.provider,
    mode: input.mode,
    incoming: input.configJson,
    existing: existing?.configJson ?? {},
  });

  if (input.mode === "byo" && !normalized.validation.isValid) {
    throw new Error(
      `Missing required provider credentials for ${input.channel}/${input.provider}: ${normalized.validation.missing.join(", ")}`
    );
  }

  const nextIsActive =
    input.mode === "disabled" ? false : (input.isActive ?? existing?.isActive ?? true);

  if (existing) {
    const [updated] = await db
      .update(providerConfigs)
      .set({
        provider: input.provider,
        mode: input.mode,
        isActive: nextIsActive,
        configJson: normalized.configJson,
        updatedAt: new Date(),
      })
      .where(eq(providerConfigs.id, existing.id))
      .returning();

    if (updated.isActive) {
      await db
        .update(providerConfigs)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(providerConfigs.organizationId, input.organizationId),
            eq(providerConfigs.channel, input.channel),
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
      organizationId: input.organizationId,
      channel: input.channel,
      provider: input.provider,
      mode: input.mode,
      isActive: nextIsActive,
      configJson: normalized.configJson,
    })
    .returning();

  if (created.isActive) {
    await db
      .update(providerConfigs)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(providerConfigs.organizationId, input.organizationId),
          eq(providerConfigs.channel, input.channel),
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
  await requireOrgMembership(organizationId);
  const [policy] = await db
    .select()
    .from(gracePolicyConfigs)
    .where(eq(gracePolicyConfigs.organizationId, organizationId))
    .limit(1);

  if (policy) return policy;

  const [created] = await db
    .insert(gracePolicyConfigs)
    .values({
      organizationId,
      approvalsEnabled: true,
      autoEscalateOnEmergency: true,
      confidenceThreshold: "0.7",
      highRiskTools: ["messages.sendSMS", "messages.sendEmail", "appointments.book", "contacts.upsert"],
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
  await requireOrgAdmin(input.organizationId);
  const current = await getGracePolicyConfig(input.organizationId);

  const [updated] = await db
    .update(gracePolicyConfigs)
    .set({
      approvalsEnabled: input.approvalsEnabled ?? current.approvalsEnabled,
      autoEscalateOnEmergency:
        input.autoEscalateOnEmergency ?? current.autoEscalateOnEmergency,
      confidenceThreshold: input.confidenceThreshold ?? current.confidenceThreshold,
      highRiskTools: input.highRiskTools ?? (current.highRiskTools || []),
      allowedPublicTools: input.allowedPublicTools ?? (current.allowedPublicTools || []),
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
  const { userId } = await requireOrgMembership(input.organizationId);
  return runGraceMessage({
    organizationId: input.organizationId,
    channel: "in_app",
    actorType: "staff",
    message: input.message,
    sessionId: input.sessionId,
    userId,
  });
}
