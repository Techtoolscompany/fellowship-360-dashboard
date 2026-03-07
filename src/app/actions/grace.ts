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
  providerConfigs,
  gracePolicyConfigs,
} from "@/db/schema";
import { organizationMemberships } from "@/db/schema/organization-membership";
import { and, desc, eq, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { runGraceMessage } from "@/lib/grace/runtime";
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
    .select()
    .from(graceCalls)
    .where(eq(graceCalls.organizationId, organizationId))
    .orderBy(desc(graceCalls.createdAt));
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
