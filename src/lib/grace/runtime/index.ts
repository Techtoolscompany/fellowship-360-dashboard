import { db } from "@/db";
import { graceMessages } from "@/db/schema/grace-messages";
import { graceSessions } from "@/db/schema/grace-sessions";
import { gracePolicyConfigs } from "@/db/schema/grace-policy-configs";
import { and, eq } from "drizzle-orm";
import { runClawRouter } from "../router";
import { matchOrCreateContact } from "../contact-matcher";
import type { GraceActorType, GraceChannel, OrgPolicyOverride } from "../types";

function shouldPersistGraceTurn(channel: GraceChannel) {
  return channel === "in_app" || channel === "voice" || channel === "voice_internal";
}

export async function getOrCreateGraceSession(params: {
  organizationId: string;
  channel: GraceChannel;
  actorType: GraceActorType;
  sessionId?: string;
  contactId?: string | null;
}) {
  if (params.sessionId) {
    const [existing] = await db
      .select()
      .from(graceSessions)
      .where(
        and(
          eq(graceSessions.id, params.sessionId),
          eq(graceSessions.organizationId, params.organizationId)
        )
      )
      .limit(1);
    if (existing) return existing;
  }

  const [created] = await db
    .insert(graceSessions)
    .values({
      organizationId: params.organizationId,
      channel: params.channel,
      actorType: params.actorType,
      contactId: params.contactId ?? null,
      status: "open",
      stateJson: {},
    })
    .returning();

  return created;
}

export async function loadOrgPolicy(organizationId: string): Promise<OrgPolicyOverride | undefined> {
  const [row] = await db
    .select()
    .from(gracePolicyConfigs)
    .where(eq(gracePolicyConfigs.organizationId, organizationId))
    .limit(1);

  if (!row) return undefined;

  return {
    approvalsEnabled: row.approvalsEnabled,
    highRiskTools: (row.highRiskTools as string[]) ?? [],
    allowedPublicTools: (row.allowedPublicTools as string[]) ?? [],
    autoEscalateOnEmergency: row.autoEscalateOnEmergency,
  };
}

export async function runGraceMessage(params: {
  organizationId: string;
  channel: GraceChannel;
  actorType?: GraceActorType;
  message: string;
  sessionId?: string;
  userId?: string;
  contactId?: string | null;
  originSurface?: "onboarding";
}) {
  // Derive actorType from channel if not explicitly provided
  const actorType: GraceActorType =
    params.actorType ??
    (params.channel === "voice_public" || params.channel === "sms_public" || params.channel === "web_public"
      ? "public"
      : "staff");

  const [session, orgPolicy] = await Promise.all([
    getOrCreateGraceSession({
      organizationId: params.organizationId,
      channel: params.channel,
      actorType,
      sessionId: params.sessionId,
      contactId: params.contactId,
    }),
    loadOrgPolicy(params.organizationId),
  ]);

  if (shouldPersistGraceTurn(params.channel) && params.message.trim().length > 0) {
    try {
      await db.insert(graceMessages).values({
        organizationId: params.organizationId,
        sessionId: session.id,
        contactId: session.contactId ?? null,
        direction: "inbound",
        channel: params.channel,
        messageText: params.message.trim(),
        metadataJson: {
          source: "grace_runtime",
          actorType,
          originSurface: params.originSurface ?? null,
        },
      });
    } catch (error) {
      console.error("[Grace runtime] Failed to persist inbound message:", error);
    }
  }

  const routerResult = await runClawRouter({
    message: params.message,
    state: (session.stateJson as Record<string, unknown>) ?? {},
    context: {
      organizationId: params.organizationId,
      sessionId: session.id,
      channel: params.channel,
      actorType,
      userId: params.userId,
      contactId: session.contactId,
      originSurface: params.originSurface,
      policy: orgPolicy,
    },
  });

  await db
    .update(graceSessions)
    .set({
      stateJson: routerResult.state,
      updatedAt: new Date(),
      finalSummary: routerResult.response,
    })
    .where(eq(graceSessions.id, session.id));

  if (shouldPersistGraceTurn(params.channel) && routerResult.response.trim().length > 0) {
    try {
      await db.insert(graceMessages).values({
        organizationId: params.organizationId,
        sessionId: session.id,
        contactId: session.contactId ?? null,
        direction: "outbound",
        channel: params.channel,
        messageText: routerResult.response.trim(),
        metadataJson: {
          source: "grace_runtime",
          actorType,
          intent: routerResult.intent,
          actionOutcomesCount: routerResult.actionOutcomes.length,
          workflowDecisionType: routerResult.workflowDecision?.decisionType ?? null,
          workflowKey: routerResult.workflowDecision?.workflowKey ?? null,
          workflowStartStatus: routerResult.workflowStart?.status ?? null,
        },
      });
    } catch (error) {
      console.error("[Grace runtime] Failed to persist outbound message:", error);
    }
  }

  // ── Contact matching for public sessions ──
  // When the LLM extracts caller identifiers, attempt to match to an existing
  // church contact. Only runs for public sessions without a pre-existing contact.
  let matchResult: { tier: string; contactId: string; isNewContact: boolean; requiresReview: boolean } | null = null;

  if (actorType === "public" && !session.contactId) {
    const st = routerResult.state;
    const hasIdentifiers = st.phone || st.email || (st.name);
    if (hasIdentifiers) {
      // Parse name into first/last if only a combined "name" is provided
      const firstName = st.name?.split(" ")[0] ?? null;
      const lastName = st.name?.split(" ").slice(1).join(" ") || null;

      try {
        matchResult = await matchOrCreateContact({
          organizationId: params.organizationId,
          sessionId: session.id,
          phone: st.phone ?? null,
          email: st.email ?? null,
          firstName,
          lastName,
        });
      } catch (error) {
        console.error("[Grace contact-matcher] Error during contact matching:", error);
        // Non-fatal — session continues without a match
      }
    }
  }

  return {
    sessionId: session.id,
    threadId: session.id,
    response: routerResult.response,
    intent: routerResult.intent,
    proposedActions: routerResult.proposedActions,
    actionOutcomes: routerResult.actionOutcomes,
    workflowDecision: routerResult.workflowDecision ?? null,
    workflowStart: routerResult.workflowStart ?? null,
    availabilityStatus: routerResult.availabilityStatus,
    availabilityMessage: routerResult.availabilityMessage ?? null,
    contactMatch: matchResult,
    // Agentic reasoning trace
    reasoning: routerResult.reasoning ?? null,
    reasoningSteps: routerResult.reasoningSteps ?? null,
    iterationCount: routerResult.iterationCount ?? null,
  };
}
