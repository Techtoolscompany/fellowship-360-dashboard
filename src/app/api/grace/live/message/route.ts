import { NextResponse } from "next/server";
import { z } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { runGraceMessage } from "@/lib/grace/runtime";

const payloadSchema = z.object({
  threadId: z.string().optional(),
  message: z.string().trim().min(1),
});

export const POST = withOrganizationAuthRequired(async (req, context) => {
  try {
    const body = payloadSchema.parse(await req.json());
    const organization = await context.session.organization;
    const user = await context.session.user;

    const result = await runGraceMessage({
      organizationId: organization.id,
      channel: "voice",
      actorType: "staff",
      message: body.message,
      sessionId: body.threadId,
      userId: user.id,
    });

    if (result.availabilityStatus) {
      return NextResponse.json(
        {
          error: result.availabilityMessage ?? result.response,
          response: result.response,
          proposedActions: result.proposedActions,
          actionOutcomes: result.actionOutcomes,
          workflowDecision: result.workflowDecision,
          workflowStart: result.workflowStart,
          threadId: result.threadId,
          sessionId: result.sessionId,
          intent: result.intent,
          availabilityStatus: result.availabilityStatus,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      response: result.response,
      proposedActions: result.proposedActions,
      actionOutcomes: result.actionOutcomes,
      workflowDecision: result.workflowDecision,
      workflowStart: result.workflowStart,
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
