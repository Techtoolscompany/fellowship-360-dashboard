import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import {
  createServiceRun,
  generateServiceRunAssignmentsFromTemplate,
  getServiceRuns,
} from "@/app/actions/operations";
import {
  isServicePlanningSetupRequiredError,
  SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
} from "../service-planning-errors";

const createServiceRunSchema = z.object({
  templateId: z.string().optional(),
  name: z.string().optional(),
  serviceAt: z.string(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  notes: z.string().optional(),
  generateAssignments: z.boolean().optional().default(false),
  overwriteAssignments: z.boolean().optional().default(false),
});

export const GET = withOrganizationAuthRequired(async (_req, context) => {
  const organization = await context.session.organization;
  try {
    const serviceRuns = await getServiceRuns(organization.id);
    return NextResponse.json({ success: true, serviceRuns });
  } catch (error) {
    if (isServicePlanningSetupRequiredError(error)) {
      return NextResponse.json({
        success: true,
        setupRequired: true,
        message: SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
        serviceRuns: [],
      });
    }

    const message =
      error instanceof Error ? error.message : "Failed to load service runs";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}, OrganizationRole.enum.user);

export const POST = withOrganizationAuthRequired(async (req, context) => {
  const organization = await context.session.organization;
  try {
    const body = createServiceRunSchema.parse(await req.json());
    const serviceRun = await createServiceRun({
      organizationId: organization.id,
      templateId: body.templateId,
      name: body.name,
      serviceAt: new Date(body.serviceAt),
      durationMinutes: body.durationMinutes,
      notes: body.notes,
    });

    let assignments: unknown[] = [];
    if (body.generateAssignments) {
      assignments = await generateServiceRunAssignmentsFromTemplate({
        serviceRunId: serviceRun.id,
        overwriteExisting: body.overwriteAssignments,
      });
    }

    return NextResponse.json({
      success: true,
      serviceRun,
      assignmentsGenerated: assignments.length,
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
      error instanceof Error ? error.message : "Failed to create service run";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}, OrganizationRole.enum.admin);
