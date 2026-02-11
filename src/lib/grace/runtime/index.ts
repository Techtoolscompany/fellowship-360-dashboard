import { db } from "@/db";
import { graceSessions } from "@/db/schema/grace-sessions";
import { eq } from "drizzle-orm";
import { runClawRouter } from "../router";
import type { GraceChannel } from "../types";

export async function getOrCreateGraceSession(params: {
  organizationId: string;
  channel: GraceChannel;
  sessionId?: string;
  contactId?: string | null;
}) {
  if (params.sessionId) {
    const [existing] = await db
      .select()
      .from(graceSessions)
      .where(eq(graceSessions.id, params.sessionId))
      .limit(1);
    if (existing) return existing;
  }

  const [created] = await db
    .insert(graceSessions)
    .values({
      organizationId: params.organizationId,
      channel: params.channel,
      contactId: params.contactId ?? null,
      status: "open",
      stateJson: {},
    })
    .returning();

  return created;
}

export async function runGraceMessage(params: {
  organizationId: string;
  channel: GraceChannel;
  message: string;
  sessionId?: string;
  userId?: string;
  contactId?: string | null;
}) {
  const session = await getOrCreateGraceSession({
    organizationId: params.organizationId,
    channel: params.channel,
    sessionId: params.sessionId,
    contactId: params.contactId,
  });

  const routerResult = await runClawRouter({
    message: params.message,
    state: (session.stateJson as Record<string, unknown>) ?? {},
    context: {
      organizationId: params.organizationId,
      sessionId: session.id,
      channel: params.channel,
      userId: params.userId,
      contactId: session.contactId,
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

  return {
    sessionId: session.id,
    threadId: session.id,
    response: routerResult.response,
    intent: routerResult.intent,
    proposedActions: routerResult.proposedActions,
  };
}
