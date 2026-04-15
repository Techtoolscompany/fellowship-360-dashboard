import { NextResponse } from "next/server";
import { z } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { runGraceMessage } from "@/lib/grace/runtime";
import { graceFlags } from "@/lib/grace/flags";

const payloadSchema = z.object({
  threadId: z.string().optional(),
  message: z.string().min(1),
  originSurface: z.enum(["onboarding"]).optional(),
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
      originSurface: body.originSurface,
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
      // Agentic reasoning trace
      reasoning: (result as any).reasoning ?? null,
      reasoningSteps: (result as any).reasoningSteps ?? null,
      iterationCount: (result as any).iterationCount ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 }
    );
  }
}, OrganizationRole.enum.user);
