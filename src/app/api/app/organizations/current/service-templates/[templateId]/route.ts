import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import {
  deleteServiceTemplate,
  getServiceTemplate,
  updateServiceTemplate,
} from "@/app/actions/operations";
import {
  isServicePlanningSetupRequiredError,
  SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
} from "../../service-planning-errors";

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  serviceType: z
    .enum(["sunday_am", "midweek", "special_event", "custom"])
    .optional(),
  isActive: z.boolean().optional(),
  serviceStartTime: z.string().nullable().optional(),
  ownerUserId: z.string().nullable().optional(),
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
    const serviceTemplate = await getServiceTemplate(templateId);
    return NextResponse.json({ serviceTemplate, success: true });
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
        : "Failed to load service template";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.user);

export const PATCH = withOrganizationAuthRequired(async (req, context) => {
  const params = await context.params;
  const templateId = params.templateId as string | undefined;

  if (!templateId) {
    return NextResponse.json(
      { success: false, message: "Template ID is required" },
      { status: 400 }
    );
  }

  try {
    const body = updateTemplateSchema.parse(await req.json());
    const template = await updateServiceTemplate(templateId, body);
    return NextResponse.json({ template, success: true });
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
        : "Failed to update service template";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.admin);

export const DELETE = withOrganizationAuthRequired(async (_req, context) => {
  const params = await context.params;
  const templateId = params.templateId as string | undefined;

  if (!templateId) {
    return NextResponse.json(
      { success: false, message: "Template ID is required" },
      { status: 400 }
    );
  }

  try {
    await deleteServiceTemplate(templateId);
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
        : "Failed to delete service template";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.admin);
