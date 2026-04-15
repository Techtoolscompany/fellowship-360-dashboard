import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { getGraceGoals, startServiceRunAutostaffGoal } from "@/app/actions/operations";
import { buildGraceWorkflowCardView } from "@/lib/grace/workflow-summary";

const querySchema = z.object({
  status: z
    .enum([
      "queued",
      "in_progress",
      "waiting",
      "completed",
      "failed",
      "cancelled",
      "escalated",
    ])
    .optional(),
  goalType: z
    .enum(["service_staffing", "communications_followup", "operations", "custom"])
    .optional(),
  workflowKey: z
    .enum(["volunteer_staffing", "guest_followup", "prayer_care", "legacy_goal"])
    .optional(),
  serviceRunId: z.string().optional(),
});

const createSchema = z.object({
  serviceRunId: z.string().min(1),
  sourceChannel: z.string().optional(),
  objectiveText: z.string().optional(),
  waitHours: z.coerce.number().int().positive().optional(),
});

export const GET = withOrganizationAuthRequired(async (req, context) => {
  const organization = await context.session.organization;
  try {
    const url = new URL(req.url);
    const parsed = querySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      goalType: url.searchParams.get("goalType") ?? undefined,
      workflowKey: url.searchParams.get("workflowKey") ?? undefined,
      serviceRunId: url.searchParams.get("serviceRunId") ?? undefined,
    });

    const goals = await getGraceGoals(organization.id, parsed);
    return NextResponse.json({
      success: true,
      goals: goals.map(({ goal, serviceRun }) => ({
        goal,
        serviceRun,
        workflow: buildGraceWorkflowCardView(goal),
      })),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to load grace goals";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}, OrganizationRole.enum.user);

export const POST = withOrganizationAuthRequired(async (req) => {
  try {
    const body = createSchema.parse(await req.json());
    const result = await startServiceRunAutostaffGoal(body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to start grace goal";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}, OrganizationRole.enum.admin);
