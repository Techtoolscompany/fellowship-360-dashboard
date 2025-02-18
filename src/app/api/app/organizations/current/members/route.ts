import { OrganizationRole, organizationMemberships } from "@/db/schema";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { db } from "@/db";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema/user";

// List organization members with their details
export const GET = withOrganizationAuthRequired(async (req, context) => {
  const currentOrganization = await context.session.organization;

  try {
    const members = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        role: organizationMemberships.role,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(users.id, organizationMemberships.userId))
      .where(
        eq(organizationMemberships.organizationId, currentOrganization.id)
      );

    return NextResponse.json({
      members,
      success: true,
    });
  } catch (error) {
    console.error("Failed to fetch members:", error);
    return NextResponse.json(
      { message: "Failed to fetch members", success: false },
      { status: 500 }
    );
  }
}, OrganizationRole.enum.user); // Allow all members to view the list
