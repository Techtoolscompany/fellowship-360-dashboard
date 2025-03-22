import { NextResponse } from "next/server";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import { db } from "@/db";
import { organizationMemberships } from "@/db/schema/organization-membership";
import { and, eq } from "drizzle-orm";

export const DELETE = withSuperAdminAuthRequired(async (req, context) => {
  const { id, userId } = await context.params as { id: string; userId: string };
  
  try {
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

    // Delete membership
    await db
      .delete(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, id),
          eq(organizationMemberships.userId, userId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}); 