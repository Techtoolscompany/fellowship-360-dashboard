import { NextResponse } from "next/server";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import { db } from "@/db";
import { organizationMemberships } from "@/db/schema/organization-membership";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const updateRoleSchema = z.object({
  role: z.enum(["owner", "admin", "user"]),
});

export const PATCH = withSuperAdminAuthRequired(async (req, context) => {
  const { id, userId } = await context.params as { id: string; userId: string };
  
  try {
    const body = await req.json();
    const { role } = updateRoleSchema.parse(body);

    // Check if membership exists
    const membership = await db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, id),
          eq(organizationMemberships.userId, userId)
        )
      )
      .limit(1)
      .then(memberships => memberships[0]);

    if (!membership) {
      return NextResponse.json(
        { error: "Membership not found" },
        { status: 404 }
      );
    }

    // Update role
    await db
      .update(organizationMemberships)
      .set({ role })
      .where(
        and(
          eq(organizationMemberships.organizationId, id),
          eq(organizationMemberships.userId, userId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid role specified" },
        { status: 400 }
      );
    }
    
    console.error("Error updating member role:", error);
    return NextResponse.json(
      { error: "Failed to update member role" },
      { status: 500 }
    );
  }
}); 