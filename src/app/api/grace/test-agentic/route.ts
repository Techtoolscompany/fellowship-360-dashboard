import { NextResponse } from "next/server";
import { z } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { runGraceMessage } from "@/lib/grace/runtime";
import { resolveAgencyTier } from "@/lib/grace/tools/registry";

// ---------------------------------------------------------------------------
// Grace Agentic Test Harness
// ---------------------------------------------------------------------------
// POST /api/grace/test-agentic
// Tests the full agentic reasoning loop with real Gemini calls.
// Returns detailed output including reasoning steps, tier decisions, and timing.
// ---------------------------------------------------------------------------

const testScenarios = {
  // Multi-step: should search contacts first, then act
  lookup: "Can you look up John Smith and tell me about him?",
  // Autonomous: should create a task directly
  task: "Create a follow-up task for me to call the Johnson family this week",
  // Prayer: should create a prayer request
  prayer: "Sarah Mitchell asked for prayer for her mother's surgery next Tuesday",
  // Visitor follow-up: should search, then send a text
  visitor: "Can you send a welcome text to our new visitor Maria Garcia? Her number is 555-123-4567",
  // Suggest tier: should propose rather than act
  reschedule: "I think we should reschedule Pastor Mike's appointment with the Davis family to next Thursday",
  // Always-ask tier: should queue for approval
  delete: "Delete the contact record for James Wilson",
  // Info request: should respond directly without tools
  info: "What does Grace do?",
  // Complex: multi-step reasoning test
  complex: "We have a service this Sunday. Can you check if we have enough volunteers and reach out to anyone who hasn't confirmed?",
};

const payloadSchema = z.object({
  scenario: z.enum(Object.keys(testScenarios) as [string, ...string[]]).optional(),
  message: z.string().optional(),
}).refine((data) => data.scenario || data.message, {
  message: "Provide either a scenario key or a custom message",
});

export const POST = withOrganizationAuthRequired(async (req, context) => {
  const startTime = Date.now();

  try {
    const body = payloadSchema.parse(await req.json());
    const organization = await context.session.organization;
    const user = await context.session.user;

    const testMessage = body.message ?? testScenarios[body.scenario as keyof typeof testScenarios];

    const result = await runGraceMessage({
      organizationId: organization.id,
      channel: "in_app",
      message: testMessage,
      userId: user.id,
    });

    // Build the detailed test report
    const report = {
      // Test metadata
      _test: {
        scenario: body.scenario ?? "custom",
        message: testMessage,
        totalDurationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },

      // Core response
      response: result.response,
      intent: result.intent,

      // Agentic reasoning (new fields from Sprint 1)
      reasoning: (result as any).reasoning ?? null,
      reasoningSteps: (result as any).reasoningSteps ?? null,
      iterationCount: (result as any).iterationCount ?? null,

      // Tool execution
      proposedActions: result.proposedActions.map((a: any) => ({
        ...a,
        resolvedTier: resolveAgencyTier(a.tool),
      })),
      actionOutcomes: result.actionOutcomes,

      // Workflow decision
      workflowDecision: result.workflowDecision,
      workflowStart: result.workflowStart,

      // Session
      sessionId: result.sessionId,
      threadId: result.threadId,

      // Availability
      availability: result.availabilityStatus
        ? { status: result.availabilityStatus, message: result.availabilityMessage }
        : null,

      // Contact match
      contactMatch: result.contactMatch,
    };

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Test failed",
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}, OrganizationRole.enum.admin);
