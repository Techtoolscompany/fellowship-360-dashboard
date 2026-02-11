"use server";

import { db } from "@/db";
import {
  graceSessions,
  graceCalls,
  graceMessages,
  graceToolAudit,
  graceKnowledge,
  graceApprovals,
  providerConfigs,
  gracePolicyConfigs,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { runGraceMessage } from "@/lib/grace/runtime";
import {
  isByoAllowedForChannel,
  normalizeAndEncryptProviderConfig,
  redactProviderConfigForClient,
} from "@/lib/grace/providers/security";

export async function getGraceSessions(organizationId: string) {
  return db
    .select()
    .from(graceSessions)
    .where(eq(graceSessions.organizationId, organizationId))
    .orderBy(desc(graceSessions.createdAt));
}

export async function getGraceCalls(organizationId: string) {
  return db
    .select()
    .from(graceCalls)
    .where(eq(graceCalls.organizationId, organizationId))
    .orderBy(desc(graceCalls.createdAt));
}

export async function getGraceMessages(organizationId: string) {
  return db
    .select()
    .from(graceMessages)
    .where(eq(graceMessages.organizationId, organizationId))
    .orderBy(desc(graceMessages.createdAt));
}

export async function getGraceToolAudit(organizationId: string) {
  return db
    .select()
    .from(graceToolAudit)
    .where(eq(graceToolAudit.organizationId, organizationId))
    .orderBy(desc(graceToolAudit.createdAt));
}

export async function getGraceKnowledge(organizationId: string) {
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
  return db
    .select()
    .from(graceApprovals)
    .where(eq(graceApprovals.organizationId, organizationId))
    .orderBy(desc(graceApprovals.createdAt));
}

export async function updateGraceApproval(input: {
  organizationId: string;
  approvalId: string;
  status: "approved" | "rejected";
  decidedByUserId?: string;
  decisionNote?: string;
}) {
  const [updated] = await db
    .update(graceApprovals)
    .set({
      status: input.status,
      decidedByUserId: input.decidedByUserId ?? null,
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
        eq(providerConfigs.channel, input.channel)
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

  if (existing) {
    const [updated] = await db
      .update(providerConfigs)
      .set({
        provider: input.provider,
        mode: input.mode,
        isActive: input.isActive ?? existing.isActive,
        configJson: normalized.configJson,
        updatedAt: new Date(),
      })
      .where(eq(providerConfigs.id, existing.id))
      .returning();
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
      isActive: input.isActive ?? true,
      configJson: normalized.configJson,
    })
    .returning();
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
  userId?: string;
  sessionId?: string;
  message: string;
}) {
  return runGraceMessage({
    organizationId: input.organizationId,
    channel: "in_app",
    message: input.message,
    sessionId: input.sessionId,
    userId: input.userId,
  });
}
