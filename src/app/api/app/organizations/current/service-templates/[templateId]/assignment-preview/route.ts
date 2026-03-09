import { NextResponse } from "next/server";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { getServiceTemplateAssignmentPreview } from "@/app/actions/operations";
import {
  isServicePlanningSetupRequiredError,
  SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
} from "../../../service-planning-errors";

export const GET = withOrganizationAuthRequired(async (req, context) => {
  const params = await context.params;
  const templateId = params.templateId as string | undefined;

  if (!templateId) {
    return NextResponse.json(
      { success: false, message: "Template ID is required" },
      { status: 400 }
    );
  }

  const serviceAtRaw = req.nextUrl.searchParams.get("serviceAt");
  if (!serviceAtRaw) {
    return NextResponse.json(
      { success: false, message: "serviceAt query param is required" },
      { status: 400 }
    );
  }

  const serviceAt = new Date(serviceAtRaw);
  if (Number.isNaN(serviceAt.getTime())) {
    return NextResponse.json(
      { success: false, message: "Invalid serviceAt datetime" },
      { status: 400 }
    );
  }

  const durationRaw = req.nextUrl.searchParams.get("serviceDurationMinutes");
  const includeUnavailableRaw = req.nextUrl.searchParams.get("includeUnavailable");
  const serviceDurationMinutes = durationRaw
    ? Number.parseInt(durationRaw, 10)
    : undefined;
  const includeUnavailable = includeUnavailableRaw === "1" || includeUnavailableRaw === "true";

  try {
    const assignmentPreview = await getServiceTemplateAssignmentPreview({
      templateId,
      serviceAt,
      serviceDurationMinutes,
      includeUnavailable,
    });
    return NextResponse.json({ assignmentPreview, success: true });
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
      error instanceof Error ? error.message : "Failed to generate assignment preview";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.user);
