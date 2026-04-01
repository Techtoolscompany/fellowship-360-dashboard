import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { superAdminInvitations } from "@/db/schema";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import {
  logSuperAdminAudit,
  normalizeInviteStatus,
} from "@/lib/super-admin/auth";

export const DELETE = withSuperAdminAuthRequired(async (_req, context) => {
  const { inviteId } = (await context.params) as { inviteId: string };
  const actor = await context.session.user;

  const [invite] = await db
    .select()
    .from(superAdminInvitations)
    .where(eq(superAdminInvitations.id, inviteId))
    .limit(1);

  if (!invite) {
    return NextResponse.json(
      { success: false, error: "Invitation not found" },
      { status: 404 }
    );
  }

  const normalizedStatus = normalizeInviteStatus({
    status: invite.status,
    expiresAt: invite.expiresAt,
  });

  if (normalizedStatus !== "pending") {
    return NextResponse.json(
      { success: false, error: "Only pending invitations can be revoked" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(superAdminInvitations)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(superAdminInvitations.id, invite.id))
    .returning();

  await logSuperAdminAudit({
    actorUserId: actor.id,
    actionType: "revoke_super_admin_invitation",
    entityName: "super_admin_invitation",
    entityId: updated.id,
    details: {
      email: updated.email,
      role: updated.role,
    },
  });

  return NextResponse.json({ success: true, invitation: updated });
}, "manage_super_admin_team");
