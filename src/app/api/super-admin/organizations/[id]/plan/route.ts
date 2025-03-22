import { NextResponse } from "next/server";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import { db } from "@/db";
import { organizations } from "@/db/schema/organization";
import { plans } from "@/db/schema/plans";
import { eq } from "drizzle-orm";
import { z } from "zod";
import updatePlan from "@/lib/plans/updatePlan";

const updatePlanSchema = z.object({
  planId: z.string().optional(),
});

export const PATCH = withSuperAdminAuthRequired(async (req, context) => {
  const { id } = await context.params as { id: string };
  
  try {
    const body = await req.json();
    const { planId } = updatePlanSchema.parse(body);

    // Check if organization exists
    const organization = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1)
      .then(orgs => orgs[0]);

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // If planId is empty string or null, we're removing the plan
    if (!planId || planId === '') {
      // Find default plan
      const defaultPlan = await db
        .select()
        .from(plans)
        .where(eq(plans.default, true))
        .limit(1)
        .then(plans => plans[0]);

      if (defaultPlan) {
        // Use default plan if available
        await updatePlan({
          organizationId: id,
          newPlanId: defaultPlan.id,
          sendEmail: false
        });
      } else {
        // Just remove the plan if no default plan
        await db
          .update(organizations)
          .set({ planId: null })
          .where(eq(organizations.id, id));
      }
    } else {
      // Verify the plan exists
      const plan = await db
        .select()
        .from(plans)
        .where(eq(plans.id, planId))
        .limit(1)
        .then(plans => plans[0]);

      if (!plan) {
        return NextResponse.json(
          { error: "Plan not found" },
          { status: 404 }
        );
      }

      // Update the plan using the utility function
      await updatePlan({
        organizationId: id,
        newPlanId: planId,
        sendEmail: false
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid plan data" },
        { status: 400 }
      );
    }
    
    console.error("Error updating organization plan:", error);
    return NextResponse.json(
      { error: "Failed to update organization plan" },
      { status: 500 }
    );
  }
}); 