import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { sendServiceAssignmentOffers } from "@/app/actions/operations";
import {
  isServicePlanningSetupRequiredError,
  SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
} from "../../../service-planning-errors";

const sendOffersSchema = z.object({
  assignmentIds: z.array(z.string()).optional(),
  messageTemplate: z.string().optional(),
});

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
    const body = sendOffersSchema.parse(await req.json());
    const result = await sendServiceAssignmentOffers({
      serviceRunId,
      assignmentIds: body.assignmentIds,
      messageTemplate: body.messageTemplate,
    });
    return NextResponse.json({ success: true, result });
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
      error instanceof Error ? error.message : "Failed to send assignment offers";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.admin);
