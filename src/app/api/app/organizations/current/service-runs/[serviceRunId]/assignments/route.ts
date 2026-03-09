import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import {
  generateServiceRunAssignmentsFromTemplate,
  getServiceRunAssignments,
} from "@/app/actions/operations";
import {
  isServicePlanningSetupRequiredError,
  SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
} from "../../../service-planning-errors";

const generateAssignmentsSchema = z.object({
  overwriteExisting: z.boolean().optional().default(false),
});

export const GET = withOrganizationAuthRequired(async (_req, context) => {
  const params = await context.params;
  const serviceRunId = params.serviceRunId as string | undefined;

  if (!serviceRunId) {
    return NextResponse.json(
      { success: false, message: "Service run ID is required" },
      { status: 400 }
    );
  }

  try {
    const assignments = await getServiceRunAssignments(serviceRunId);
    return NextResponse.json({ success: true, assignments });
  } catch (error) {
    if (isServicePlanningSetupRequiredError(error)) {
      return NextResponse.json({
        success: true,
        setupRequired: true,
        message: SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
        assignments: [],
      });
    }

    const message =
      error instanceof Error ? error.message : "Failed to load assignments";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.user);

export const POST = withOrganizationAuthRequired(async (req, context) => {
  const params = await context.params;
  const serviceRunId = params.serviceRunId as string | undefined;

  if (!serviceRunId) {
    return NextResponse.json(
      { success: false, message: "Service run ID is required" },
      { status: 400 }
    );
  }

  try {
    const body = generateAssignmentsSchema.parse(await req.json());
    const assignments = await generateServiceRunAssignmentsFromTemplate({
      serviceRunId,
      overwriteExisting: body.overwriteExisting,
    });
    return NextResponse.json({
      success: true,
      assignmentsGenerated: assignments.length,
      assignments,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    if (isServicePlanningSetupRequiredError(error)) {
      return NextResponse.json(
        {
          success: false,
          setupRequired: true,
          message: SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
        },
        { status: 503 }
      );
    }
    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate assignments";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.admin);
