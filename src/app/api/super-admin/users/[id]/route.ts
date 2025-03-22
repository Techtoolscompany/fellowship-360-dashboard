import { NextResponse } from "next/server";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import { db } from "@/db";
import { users } from "@/db/schema/user";
import { organizations } from "@/db/schema/organization";
import { organizationMemberships } from "@/db/schema/organization-membership";
import { eq, and, count, ne } from "drizzle-orm";

export const GET = withSuperAdminAuthRequired(async (req, context) => {
  const { id } = await context.params as { id: string };
  
  try {
    // Get user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
      .then(users => users[0]);

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get organizations this user belongs to
    const memberships = await db
      .select({
        id: organizationMemberships.organizationId,
        name: organizations.name,
        slug: organizations.slug,
        role: organizationMemberships.role,
      })
      .from(organizationMemberships)
      .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
      .where(eq(organizationMemberships.userId, id));

    // Count organizations where user is the owner
    const ownedOrgsCount = await db
      .select({ count: count() })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.userId, id),
          eq(organizationMemberships.role, "owner")
        )
      )
      .then(result => result[0]?.count || 0);

    // Return user with related data
    return NextResponse.json({
      ...user,
      organizations: memberships,
      organizationsOwned: ownedOrgsCount,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
});

export const DELETE = withSuperAdminAuthRequired(async (req, context) => {
  const { id } = await context.params as { id: string };
  
  try {
    // Check if user exists
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
      .then(users => users[0]);

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if user is an owner of any organization
    const ownedOrgs = await db
      .select({ count: count() })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.userId, id),
          eq(organizationMemberships.role, "owner")
        )
      )
      .then(result => result[0]?.count || 0);

    if (ownedOrgs > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete user who is an owner of organizations",
          message: "This user is an owner of one or more organizations. Please change ownership before deleting this user."
        },
        { status: 400 }
      );
    }

    // Delete the user - will also delete any memberships due to foreign key constraints
    await db.delete(users).where(eq(users.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}); 