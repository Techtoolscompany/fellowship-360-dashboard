import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import {
  deleteServiceTemplateRoleSlot,
  getServiceTemplateRoleSlots,
  updateServiceTemplateRoleSlot,
} from "@/app/actions/operations";
import {
  isServicePlanningSetupRequiredError,
  SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
} from "../../../../service-planning-errors";

const updateRoleSlotSchema = z.object({
  roleName: z.string().min(1).optional(),
  assignmentType: z.enum(["paid_staff", "volunteer", "either"]).optional(),
  isEnabled: z.boolean().optional(),
  requiredCount: z.coerce.number().int().positive().optional(),
  isRequired: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

async function ensureSlotBelongsToTemplate(templateId: string, slotId: string) {
  const roleSlots = await getServiceTemplateRoleSlots(templateId);
  return roleSlots.some((roleSlot) => roleSlot.id === slotId);
}

export const PATCH = withOrganizationAuthRequired(async (req, context) => {
  const params = await context.params;
  const templateId = params.templateId as string | undefined;
  const slotId = params.slotId as string | undefined;

  if (!templateId || !slotId) {
    return NextResponse.json(
      { success: false, message: "Template ID and slot ID are required" },
      { status: 400 }
    );
  }

  try {
    const belongsToTemplate = await ensureSlotBelongsToTemplate(
      templateId,
      slotId
    );
    if (!belongsToTemplate) {
      return NextResponse.json(
        { success: false, message: "Role slot not found" },
        { status: 404 }
      );
    }

    const body = updateRoleSlotSchema.parse(await req.json());
    const roleSlot = await updateServiceTemplateRoleSlot(slotId, body);
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
      error instanceof Error ? error.message : "Failed to update role slot";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.admin);

export const DELETE = withOrganizationAuthRequired(async (_req, context) => {
  const params = await context.params;
  const templateId = params.templateId as string | undefined;
  const slotId = params.slotId as string | undefined;

  if (!templateId || !slotId) {
    return NextResponse.json(
      { success: false, message: "Template ID and slot ID are required" },
      { status: 400 }
    );
  }

  try {
    const belongsToTemplate = await ensureSlotBelongsToTemplate(
      templateId,
      slotId
    );
    if (!belongsToTemplate) {
      return NextResponse.json(
        { success: false, message: "Role slot not found" },
        { status: 404 }
      );
    }

    await deleteServiceTemplateRoleSlot(slotId);
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
      error instanceof Error ? error.message : "Failed to delete role slot";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.admin);
