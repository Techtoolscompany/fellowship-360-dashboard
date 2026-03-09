import { NextResponse } from "next/server";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { getGraceGoalWithSteps } from "@/app/actions/operations";

export const GET = withOrganizationAuthRequired(async (_req, context) => {
  const params = await context.params;
  const goalId = params.goalId as string | undefined;

  if (!goalId) {
    return NextResponse.json(
      { success: false, message: "Goal ID is required" },
      { status: 400 }
    );
  }

  try {
    const goal = await getGraceGoalWithSteps(goalId);
    return NextResponse.json({ success: true, ...goal });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load grace goal";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ success: false, message }, { status });
  }
}, OrganizationRole.enum.user);
