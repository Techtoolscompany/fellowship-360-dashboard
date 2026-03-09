import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import {
  createServiceTemplateTimelineStep,
  getServiceTemplateTimelineSteps,
} from "@/app/actions/operations";
import {
  isServicePlanningSetupRequiredError,
  SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
} from "../../../service-planning-errors";

const createTimelineStepSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  offsetMinutes: z.coerce.number().int(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  ownerRoleSlotId: z.string().optional(),
  ownerUserId: z.string().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const GET = withOrganizationAuthRequired(async (_req, context) => {
  const params = await context.params;
  const templateId = params.templateId as string | undefined;

  if (!templateId) {
    return NextResponse.json(
      { success: false, message: "Template ID is required" },
      { status: 400 }
    );
  }

  try {
    const timelineSteps = await getServiceTemplateTimelineSteps(templateId);
    return NextResponse.json({ timelineSteps, success: true });
  } catch (error) {
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
        : "Failed to load timeline steps";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.user);

export const POST = withOrganizationAuthRequired(async (req, context) => {
  const params = await context.params;
  const templateId = params.templateId as string | undefined;

  if (!templateId) {
    return NextResponse.json(
      { success: false, message: "Template ID is required" },
      { status: 400 }
    );
  }

  try {
    const body = createTimelineStepSchema.parse(await req.json());
    const timelineStep = await createServiceTemplateTimelineStep({
      templateId,
      ...body,
    });
    return NextResponse.json({ timelineStep, success: true });
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
        : "Failed to create timeline step";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.admin);
