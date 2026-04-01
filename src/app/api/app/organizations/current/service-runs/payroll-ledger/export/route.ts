import { NextResponse } from "next/server";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { exportPaidStaffShiftLedgerCsv } from "@/app/actions/operations";
import {
  isServicePlanningSetupRequiredError,
  SERVICE_PLANNING_SETUP_REQUIRED_MESSAGE,
} from "../../../service-planning-errors";

function toBoolean(value: string | null | undefined, defaultValue: boolean) {
  if (!value) return defaultValue;
  return value === "1" || value.toLowerCase() === "true";
}

export const GET = withOrganizationAuthRequired(async (req, context) => {
  const organization = await context.session.organization;
  const { searchParams } = new URL(req.url);

  const fromDate = searchParams.get("fromDate") ?? undefined;
  const toDate = searchParams.get("toDate") ?? undefined;
  const serviceRunId = searchParams.get("serviceRunId") ?? undefined;
  const includeOpen = toBoolean(searchParams.get("includeOpen"), false);
  const markExported = toBoolean(searchParams.get("markExported"), true);

  try {
    const result = await exportPaidStaffShiftLedgerCsv({
      organizationId: organization.id,
      fromDate,
      toDate,
      serviceRunId,
      includeOpen,
      markExported,
    });

    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
        "Cache-Control": "no-store",
        "X-Exported-Count": String(result.exportedCount),
      },
    });
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
      error instanceof Error ? error.message : "Failed to export payroll ledger";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}, OrganizationRole.enum.admin);
