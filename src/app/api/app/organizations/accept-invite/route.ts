// Accept an invite (no need to be authorized by any organization)

import { OrganizationRole, organizationMemberships } from "@/db/schema";
import withAuthRequired from "@/lib/auth/withAuthRequired";
import { db } from "@/db";
import { invitations } from "@/db/schema/invitation";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

export const POST = withAuthRequired(async (req, context) => {
  const currentUser = await context.session.user;
  const { token } = await req.json();

  if (!token) {
    return NextResponse.json(
      { message: "Invitation token is required", success: false },
      { status: 400 }
    );
  }

  try {
    // Find the invitation
    const invite = await db
      .select()
      .from(invitations)
      .where(and(eq(invitations.token, token)))
      .limit(1)
      .then((invites) => invites[0]);

    if (!invite) {
      return NextResponse.json(
        { message: "Invalid invitation", success: false },
        { status: 404 }
      );
    }

    // Check if invitation has expired
    if (new Date() > new Date(invite.expiresAt)) {
      return NextResponse.json(
        { message: "Invitation has expired", success: false },
        { status: 400 }
      );
    }

    // Check if user's email matches the invitation
    if (invite.email.toLowerCase() !== currentUser.email?.toLowerCase()) {
      return NextResponse.json(
        {
          message: "This invitation is for a different email address",
          success: false,
        },
        { status: 403 }
      );
    }

    // Check if user is already a member
    const existingMembership = await db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.userId, currentUser.id),
          eq(organizationMemberships.organizationId, invite.organizationId)
        )
      )
      .limit(1)
      .then((memberships) => memberships[0]);

    if (existingMembership) {
      return NextResponse.json(
        {
          message: "You are already a member of this organization",
          success: false,
        },
        { status: 400 }
      );
    }

    // Create membership and delete invitation
    await db.insert(organizationMemberships).values({
      userId: currentUser.id,
      organizationId: invite.organizationId,
      role: invite.role,
    });

    await db.delete(invitations).where(eq(invitations.id, invite.id));

    return NextResponse.json({
      organizationId: invite.organizationId,
      success: true,
    });
  } catch (error) {
    console.error("Failed to accept invitation:", error);
    return NextResponse.json(
      { message: "Failed to accept invitation", success: false },
      { status: 500 }
    );
  }
});
