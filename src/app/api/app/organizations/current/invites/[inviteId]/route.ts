// Update Invite
// Delete Invite
// Get Invite

import { OrganizationRole } from "@/db/schema";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { db } from "@/db";
import { invitations } from "@/db/schema/invitation";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

// Delete/Revoke an invite
export const DELETE = withOrganizationAuthRequired(async (req, context) => {
  const currentOrganization = await context.session.organization;
  const params = await context.params;
  const inviteId = params.inviteId as string;

  if (!inviteId) {
    return NextResponse.json(
      { message: "Invite ID is required", success: false },
      { status: 400 }
    );
  }

  try {
    await db
      .delete(invitations)
      .where(
        and(
          eq(invitations.id, inviteId),
          eq(invitations.organizationId, currentOrganization.id)
        )
      );

    return NextResponse.json({
      message: "Invite revoked successfully",
      success: true,
    });
  } catch (error) {
    console.error("Failed to revoke invite:", error);
    return NextResponse.json(
      { message: "Failed to revoke invite", success: false },
      { status: 500 }
    );
  }
}, OrganizationRole.enum.admin);
