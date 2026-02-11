import { NextResponse } from "next/server";
import { z } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { runGraceMessage } from "@/lib/grace/runtime";
import { graceFlags } from "@/lib/grace/flags";

const payloadSchema = z.object({
  threadId: z.string().optional(),
  message: z.string().min(1),
});

export const POST = withOrganizationAuthRequired(async (req, context) => {
  if (!graceFlags.enabled || !graceFlags.copilotEnabled) {
    return NextResponse.json({ error: "GRACE copilot is disabled" }, { status: 503 });
  }

  try {
    const body = payloadSchema.parse(await req.json());
    const organization = await context.session.organization;
    const user = await context.session.user;

    const result = await runGraceMessage({
      organizationId: organization.id,
      channel: "in_app",
      message: body.message,
      sessionId: body.threadId,
      userId: user.id,
    });

    return NextResponse.json({
      response: result.response,
      proposedActions: result.proposedActions,
      threadId: result.threadId,
      sessionId: result.sessionId,
      intent: result.intent,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}, OrganizationRole.enum.user);
