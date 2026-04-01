import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { generateServiceRunRecap, getServiceRunRecaps } from "@/app/actions/operations";
import {
  isServicePlanningSetupRequiredError,
  SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
} from "../../../service-planning-errors";

const generateRecapSchema = z.object({
  force: z.boolean().optional().default(false),
});

export const GET = withOrganizationAuthRequired(async (req, context) => {
  const params = await context.params;
  const serviceRunId = params.serviceRunId as string | undefined;
  if (!serviceRunId) {
    return NextResponse.json(
      { success: false, message: "Service run ID is required" },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(req.url);
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  try {
    const recaps = await getServiceRunRecaps({
      serviceRunId,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    return NextResponse.json({ success: true, recaps });
  } catch (error) {
    if (isServicePlanningSetupRequiredError(error)) {
      return NextResponse.json({
        success: true,
        setupRequired: true,
        message: SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
        recaps: [],
      });
    }

    const message = error instanceof Error ? error.message : "Failed to load service recaps";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.user);

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
    const body = generateRecapSchema.parse(await req.json().catch(() => ({})));
    const result = await generateServiceRunRecap({
      serviceRunId,
      force: body.force,
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
      error instanceof Error ? error.message : "Failed to generate service recap";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.admin);
