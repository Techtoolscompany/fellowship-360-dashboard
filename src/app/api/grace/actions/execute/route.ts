import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { db } from "@/db";
import { graceApprovals, graceSessions } from "@/db/schema";
import { executePlannedActions } from "@/lib/grace/router/executor";
import type { ProposedAction } from "@/lib/grace/types";

const payloadSchema = z.object({
  sessionId: z.string(),
  actionIds: z.array(z.string()).min(1),
});

export const POST = withOrganizationAuthRequired(async (req, context) => {
  try {
    const body = payloadSchema.parse(await req.json());
    const org = await context.session.organization;
    const user = await context.session.user;

    const [session] = await db
      .select()
      .from(graceSessions)
      .where(and(eq(graceSessions.id, body.sessionId), eq(graceSessions.organizationId, org.id)))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const approvals = await db
      .select()
      .from(graceApprovals)
      .where(
        and(
          eq(graceApprovals.organizationId, org.id),
          eq(graceApprovals.sessionId, body.sessionId),
          inArray(graceApprovals.id, body.actionIds),
          eq(graceApprovals.status, "pending")
        )
      );

    const actions = approvals.map((approval) =>
      approval.proposedAction as unknown as ProposedAction
    );

    const execution = await executePlannedActions({
      actions,
      context: {
        organizationId: org.id,
        sessionId: session.id,
        channel: session.channel,
        userId: user.id,
        contactId: session.contactId,
      },
      skipApprovals: true,
    });

    await db
      .update(graceApprovals)
      .set({
        status: "approved",
        decidedByUserId: user.id,
        decidedAt: new Date(),
      })
      .where(inArray(graceApprovals.id, approvals.map((row) => row.id)));

    return NextResponse.json({
      results: execution.results,
      failed: execution.results.filter((item) => !item.success),
      approvalsUpdated: approvals.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}, OrganizationRole.enum.admin);
