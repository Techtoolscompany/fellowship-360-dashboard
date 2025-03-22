import { NextResponse } from "next/server";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import { db } from "@/db";
import { organizations } from "@/db/schema/organization";
import { plans } from "@/db/schema/plans";
import { organizationMemberships } from "@/db/schema/organization-membership";
import { users } from "@/db/schema/user";
import { invitations } from "@/db/schema/invitation";
import { eq } from "drizzle-orm";

export const GET = withSuperAdminAuthRequired(async (req, context) => {
  const { id } = await context.params as { id: string };
  
  try {
    // Get organization
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

    // Get plan if exists
    let plan = null;
    if (organization.planId) {
      plan = await db
        .select({
          id: plans.id,
          name: plans.name,
          codename: plans.codename,
        })
        .from(plans)
        .where(eq(plans.id, organization.planId))
        .limit(1)
        .then(plans => plans[0]);
    }

    // Get members with user details
    const members = await db
      .select({
        organizationId: organizationMemberships.organizationId,
        userId: organizationMemberships.userId,
        role: organizationMemberships.role,
        user: users,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(eq(organizationMemberships.organizationId, id));

    // Get invitations
    const invites = await db
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        expiresAt: invitations.expiresAt,
      })
      .from(invitations)
      .where(eq(invitations.organizationId, id));

    // Return organization with related data
    return NextResponse.json({
      ...organization,
      plan,
      members,
      invites,
    });
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization" },
      { status: 500 }
    );
  }
});

export const DELETE = withSuperAdminAuthRequired(async (req, context) => {
  const { id } = await context.params as { id: string };
  
  try {
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

    // Delete organization (cascade will handle the rest due to database constraints)
    await db.delete(organizations).where(eq(organizations.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting organization:", error);
    return NextResponse.json(
      { error: "Failed to delete organization" },
      { status: 500 }
    );
  }
}); 