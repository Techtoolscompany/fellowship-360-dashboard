import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import {
  createServiceTemplate,
  getServiceTemplates,
} from "@/app/actions/operations";
import {
  isServicePlanningSetupRequiredError,
  SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
} from "../service-planning-errors";

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  serviceType: z
    .enum(["sunday_am", "midweek", "special_event", "custom"])
    .optional(),
  isActive: z.boolean().optional(),
  serviceStartTime: z.string().optional(),
  ownerUserId: z.string().optional(),
});

export const GET = withOrganizationAuthRequired(async (_req, context) => {
  const organization = await context.session.organization;

  try {
    const serviceTemplates = await getServiceTemplates(organization.id);
    return NextResponse.json({ serviceTemplates, success: true });
  } catch (error) {
    if (isServicePlanningSetupRequiredError(error)) {
      return NextResponse.json({
        success: true,
        setupRequired: true,
        message: SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
        serviceTemplates: [],
      });
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to load service templates";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}, OrganizationRole.enum.user);

export const POST = withOrganizationAuthRequired(async (req, context) => {
  const organization = await context.session.organization;

  try {
    const body = createTemplateSchema.parse(await req.json());
    const template = await createServiceTemplate({
      organizationId: organization.id,
      ...body,
    });
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
        : "Failed to create service template";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}, OrganizationRole.enum.admin);
