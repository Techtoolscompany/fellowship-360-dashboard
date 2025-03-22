import { NextResponse } from "next/server";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import { db } from "@/db";
import { invitations } from "@/db/schema/invitation";
import { and, eq } from "drizzle-orm";

export const DELETE = withSuperAdminAuthRequired(async (req, context) => {
  const { id, inviteId } = await context.params as { id: string; inviteId: string };
  
  try {
    // Check if invitation exists
    const invitation = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.organizationId, id),
          eq(invitations.id, inviteId)
        )
      )
      .limit(1)
      .then(invites => invites[0]);

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Delete invitation
    await db
      .delete(invitations)
      .where(
        and(
          eq(invitations.organizationId, id),
          eq(invitations.id, inviteId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking invitation:", error);
    return NextResponse.json(
      { error: "Failed to revoke invitation" },
      { status: 500 }
    );
  }
}); 