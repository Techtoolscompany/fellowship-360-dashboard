import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { assignServiceAssignmentSeat } from "@/app/actions/operations";
import {
  isServicePlanningSetupRequiredError,
  SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
} from "../../service-planning-errors";

const updateAssignmentSchema = z.object({
  volunteerId: z.string().nullable().optional(),
  staffUserId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const PATCH = withOrganizationAuthRequired(async (req, context) => {
  const params = await context.params;
  const assignmentId = params.assignmentId as string | undefined;

  if (!assignmentId) {
    return NextResponse.json(
      { success: false, message: "Assignment ID is required" },
      { status: 400 }
    );
  }

  try {
    const body = updateAssignmentSchema.parse(await req.json());
    const assignment = await assignServiceAssignmentSeat({
      assignmentId,
      volunteerId: body.volunteerId,
      staffUserId: body.staffUserId,
      notes: body.notes,
    });
    return NextResponse.json({ success: true, assignment });
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
      error instanceof Error ? error.message : "Failed to update assignment";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.admin);
