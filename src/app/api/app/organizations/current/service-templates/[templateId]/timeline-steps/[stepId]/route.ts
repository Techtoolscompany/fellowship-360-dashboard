import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import {
  deleteServiceTemplateTimelineStep,
  getServiceTemplateTimelineSteps,
  updateServiceTemplateTimelineStep,
} from "@/app/actions/operations";
import {
  isServicePlanningSetupRequiredError,
  SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
} from "../../../../service-planning-errors";

const updateTimelineStepSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  offsetMinutes: z.coerce.number().int().optional(),
  durationMinutes: z.coerce.number().int().positive().nullable().optional(),
  ownerRoleSlotId: z.string().nullable().optional(),
  ownerUserId: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

async function ensureStepBelongsToTemplate(templateId: string, stepId: string) {
  const timelineSteps = await getServiceTemplateTimelineSteps(templateId);
  return timelineSteps.some((timelineStep) => timelineStep.id === stepId);
}

export const PATCH = withOrganizationAuthRequired(async (req, context) => {
  const params = await context.params;
  const templateId = params.templateId as string | undefined;
  const stepId = params.stepId as string | undefined;

  if (!templateId || !stepId) {
    return NextResponse.json(
      { success: false, message: "Template ID and step ID are required" },
      { status: 400 }
    );
  }

  try {
    const belongsToTemplate = await ensureStepBelongsToTemplate(
      templateId,
      stepId
    );
    if (!belongsToTemplate) {
      return NextResponse.json(
        { success: false, message: "Timeline step not found" },
        { status: 404 }
      );
    }

    const body = updateTimelineStepSchema.parse(await req.json());
    const timelineStep = await updateServiceTemplateTimelineStep(stepId, body);
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
        : "Failed to update timeline step";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.admin);

export const DELETE = withOrganizationAuthRequired(async (_req, context) => {
  const params = await context.params;
  const templateId = params.templateId as string | undefined;
  const stepId = params.stepId as string | undefined;

  if (!templateId || !stepId) {
    return NextResponse.json(
      { success: false, message: "Template ID and step ID are required" },
      { status: 400 }
    );
  }

  try {
    const belongsToTemplate = await ensureStepBelongsToTemplate(
      templateId,
      stepId
    );
    if (!belongsToTemplate) {
      return NextResponse.json(
        { success: false, message: "Timeline step not found" },
        { status: 404 }
      );
    }

    await deleteServiceTemplateTimelineStep(stepId);
    return NextResponse.json({ success: true });
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
        : "Failed to delete timeline step";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.admin);
