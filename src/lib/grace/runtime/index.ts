import { db } from "@/db";
import { graceSessions } from "@/db/schema/grace-sessions";
import { gracePolicyConfigs } from "@/db/schema/grace-policy-configs";
import { and, eq } from "drizzle-orm";
import { runClawRouter } from "../router";
import { matchOrCreateContact } from "../contact-matcher";
import type { GraceActorType, GraceChannel, OrgPolicyOverride } from "../types";

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
    contactMatch: matchResult,
  };
}
