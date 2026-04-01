import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  superAdminInvitations,
  superAdminMemberships,
} from "@/db/schema";
import withAuthRequired from "@/lib/auth/withAuthRequired";
import {
  logSuperAdminAudit,
  normalizeInviteStatus,
} from "@/lib/super-admin/auth";
import { z } from "zod";

const acceptInviteSchema = z.object({
  token: z.string().min(1),
});

export const POST = withAuthRequired(async (req, context) => {
  try {
    const { token } = acceptInviteSchema.parse(await req.json());
    const actor = await context.session.user;

    const [invite] = await db
      .select()
      .from(superAdminInvitations)
      .where(eq(superAdminInvitations.token, token))
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
      if (normalizedStatus === "expired" && invite.status !== "expired") {
        await db
          .update(superAdminInvitations)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(superAdminInvitations.id, invite.id));
      }

      return NextResponse.json(
        { success: false, error: `Invitation is ${normalizedStatus}` },
        { status: 400 }
      );
    }

    if (invite.email.toLowerCase() !== actor.email.toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          error: "This invitation was issued to a different email address",
        },
        { status: 403 }
      );
    }

    const [existingMembership] = await db
      .select()
      .from(superAdminMemberships)
      .where(eq(superAdminMemberships.userId, actor.id))
      .limit(1);

    let membershipId = existingMembership?.id ?? null;

    if (existingMembership) {
      if (existingMembership.status !== "revoked") {
        return NextResponse.json(
          {
            success: false,
            error: "This account already has super-admin access",
          },
          { status: 400 }
        );
      }

      const [reactivated] = await db
        .update(superAdminMemberships)
        .set({
          role: invite.role,
          status: "active",
          updatedById: actor.id,
          updatedAt: new Date(),
        })
        .where(eq(superAdminMemberships.id, existingMembership.id))
        .returning();

      membershipId = reactivated.id;
    } else {
      const [createdMembership] = await db
        .insert(superAdminMemberships)
        .values({
          userId: actor.id,
          role: invite.role,
          status: "active",
          createdById: invite.invitedById ?? actor.id,
          updatedById: actor.id,
        })
        .returning();

      membershipId = createdMembership.id;
    }

    await db
      .update(superAdminInvitations)
      .set({
        status: "accepted",
        acceptedById: actor.id,
        acceptedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(superAdminInvitations.id, invite.id),
          sql`lower(${superAdminInvitations.email}) = ${actor.email.toLowerCase()}`
        )
      );

    await logSuperAdminAudit({
      actorUserId: actor.id,
      actionType: "accept_super_admin_invitation",
      entityName: "super_admin_invitation",
      entityId: invite.id,
      details: {
        membershipId,
        email: actor.email,
        role: invite.role,
      },
    });

    return NextResponse.json({
      success: true,
      membershipId,
      role: invite.role,
      redirectTo: "/super-admin/team?inviteAccepted=1",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to accept invitation";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});
