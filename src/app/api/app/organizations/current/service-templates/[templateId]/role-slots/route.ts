import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import {
  createServiceTemplateRoleSlot,
  getServiceTemplateRoleSlots,
} from "@/app/actions/operations";
import {
  isServicePlanningSetupRequiredError,
  SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
} from "../../../service-planning-errors";

const createRoleSlotSchema = z.object({
  roleName: z.string().min(1),
  assignmentType: z.enum(["paid_staff", "volunteer", "either"]).optional(),
  isEnabled: z.boolean().optional(),
  requiredCount: z.coerce.number().int().positive().optional(),
  isRequired: z.boolean().optional(),
  notes: z.string().optional(),
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
    const roleSlots = await getServiceTemplateRoleSlots(templateId);
    return NextResponse.json({ roleSlots, success: true });
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
      error instanceof Error ? error.message : "Failed to load role slots";
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
    const body = createRoleSlotSchema.parse(await req.json());
    const roleSlot = await createServiceTemplateRoleSlot({
      templateId,
      ...body,
    });
    return NextResponse.json({ roleSlot, success: true });
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
      error instanceof Error ? error.message : "Failed to create role slot";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.admin);
