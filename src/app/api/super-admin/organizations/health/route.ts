import { NextResponse } from "next/server";
import { z } from "zod";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import { getAgencyHealthBoardData } from "@/lib/super-admin/agency-health";

const querySchema = z.object({
  status: z.enum(["all", "critical", "degraded", "healthy"]).optional().default("all"),
  search: z.string().optional().default(""),
  plan: z.string().optional().default("all"),
});

export const GET = withSuperAdminAuthRequired(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const parsed = querySchema.parse({
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      plan: searchParams.get("plan") ?? undefined,
    });

    const data = await getAgencyHealthBoardData({
      status: parsed.status,
      search: parsed.search,
      plan: parsed.plan,
    });

    return NextResponse.json({
      success: true,
      rows: data.rows,
      planOptions: data.planOptions,
      summary: data.summary,
      filters: parsed,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid health filter query",
          details: error.flatten(),
        },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to load agency health board";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
