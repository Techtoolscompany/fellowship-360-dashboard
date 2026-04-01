import { NextResponse } from "next/server";
import { z } from "zod";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import {
  getLaunchReportCsv,
  getLaunchReportForOrganization,
} from "@/lib/super-admin/launch-report";

const launchReportQuerySchema = z.object({
  format: z.enum(["json", "csv"]).default("json"),
});

export const GET = withSuperAdminAuthRequired(async (req, context) => {
  const { id } = (await context.params) as { id: string };

  try {
    const { searchParams } = new URL(req.url);
    const parsed = launchReportQuerySchema.parse({
      format: searchParams.get("format") ?? "json",
    });

    if (parsed.format === "csv") {
      const { csv, filename } = await getLaunchReportCsv(id);

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const report = await getLaunchReportForOrganization(id);
    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "Organization not found") {
      return NextResponse.json(
        { success: false, error: "Organization not found" },
        { status: 404 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to generate launch report";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
