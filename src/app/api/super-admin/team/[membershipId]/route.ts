import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { superAdminMemberships } from "@/db/schema";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import {
  countActiveSuperAdminOwners,
  logSuperAdminAudit,
} from "@/lib/super-admin/auth";
import {
  SUPER_ADMIN_MEMBERSHIP_STATUSES,
  SUPER_ADMIN_ROLES,
} from "@/lib/super-admin/permissions";

const updateMembershipSchema = z
  .object({
    role: z.enum(SUPER_ADMIN_ROLES).optional(),
    status: z.enum(SUPER_ADMIN_MEMBERSHIP_STATUSES).optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: "At least one field must be updated",
  });

export const PATCH = withSuperAdminAuthRequired(async (req, context) => {
  const { membershipId } = (await context.params) as { membershipId: string };

  try {
    const body = updateMembershipSchema.parse(await req.json());
    const actor = await context.session.user;

    const [membership] = await db
      .select()
      .from(superAdminMemberships)
      .where(eq(superAdminMemberships.id, membershipId))
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { success: false, error: "Super-admin member not found" },
        { status: 404 }
      );
    }

    const nextRole = body.role ?? membership.role;
    const nextStatus = body.status ?? membership.status;

    const isRemovingOwnerAccess =
      membership.role === "owner" &&
      membership.status === "active" &&
      (nextRole !== "owner" || nextStatus !== "active");

    if (isRemovingOwnerAccess) {
      const remainingOwners = await countActiveSuperAdminOwners(membership.id);
      if (remainingOwners < 1) {
        return NextResponse.json(
          {
            success: false,
            error: "You must keep at least one active owner on the super-admin team",
          },
          { status: 400 }
        );
      }
    }

    const [updated] = await db
      .update(superAdminMemberships)
      .set({
        role: nextRole,
        status: nextStatus,
        updatedById: actor.id,
        updatedAt: new Date(),
      })
      .where(eq(superAdminMemberships.id, membership.id))
      .returning();

    await logSuperAdminAudit({
      actorUserId: actor.id,
      actionType: "update_super_admin_membership",
      entityName: "super_admin_membership",
      entityId: updated.id,
      details: {
        targetUserId: updated.userId,
        previous: {
          role: membership.role,
          status: membership.status,
        },
        next: {
          role: updated.role,
          status: updated.status,
        },
      },
    });

    return NextResponse.json({ success: true, membership: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to update super-admin member";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}, "manage_super_admin_team");
