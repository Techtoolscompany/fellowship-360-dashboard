import { OrganizationRole, organizationMemberships } from "@/db/schema";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { db } from "@/db";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { render } from "@react-email/components";
import AccessRevokedEmail from "@/emails/AccessRevokedEmail";
import sendMail from "@/lib/email/sendMail";
import { organizations } from "@/db/schema/organization";
import { users } from "@/db/schema/user";

// Remove a member from the organization
export const DELETE = withOrganizationAuthRequired(async (req, context) => {
  const currentOrganization = await context.session.organization;
  const currentUser = await context.session.user;
  const params = await context.params;
  const memberId = params.memberId as string;

  try {
    // Check if the target member exists and is not the owner
    const targetMember = await db
      .select({
        userId: organizationMemberships.userId,
        role: organizationMemberships.role,
        email: users.email,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(users.id, organizationMemberships.userId))
      .where(
        and(
          eq(organizationMemberships.userId, memberId),
          eq(organizationMemberships.organizationId, currentOrganization.id)
        )
      )
      .limit(1)
      .then((members) => members[0]);

    if (!targetMember) {
      return NextResponse.json(
        { message: "Member not found", success: false },
        { status: 404 }
      );
    }

    if (targetMember.role === OrganizationRole.enum.owner) {
      return NextResponse.json(
        { message: "Cannot remove the owner", success: false },
        { status: 403 }
      );
    }

    // Get organization details
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, currentOrganization.id))
      .limit(1)
      .then((orgs) => orgs[0]);

    if (!org) {
      throw new Error("Organization not found");
    }

    // Remove the member
    await db
      .delete(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.userId, memberId),
          eq(organizationMemberships.organizationId, currentOrganization.id)
        )
      );

    // Send access revoked email
    const html = await render(
      AccessRevokedEmail({
        workspaceName: org.name,
        revokedByName: currentUser.name || "A team member",
      })
    );

    await sendMail(
      targetMember.email,
      `Your access to ${org.name} has been revoked`,
      html
    );

    return NextResponse.json({
      message: "Member removed successfully",
      success: true,
    });
  } catch (error) {
    console.error("Failed to remove member:", error);
    return NextResponse.json(
      { message: "Failed to remove member", success: false },
      { status: 500 }
    );
  }
}, OrganizationRole.enum.owner); 