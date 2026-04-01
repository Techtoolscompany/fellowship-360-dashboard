import { NextResponse } from "next/server";
import { inArray, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  superAdminInvitations,
  superAdminMemberships,
  users,
} from "@/db/schema";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import {
  createSuperAdminInvitation,
  normalizeInviteStatus,
} from "@/lib/super-admin/auth";
import { SUPER_ADMIN_ROLES } from "@/lib/super-admin/permissions";

const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(SUPER_ADMIN_ROLES),
});

export const GET = withSuperAdminAuthRequired(async () => {
  const [membershipRows, invitationRows] = await Promise.all([
    db
      .select({
        id: superAdminMemberships.id,
        userId: superAdminMemberships.userId,
        role: superAdminMemberships.role,
        status: superAdminMemberships.status,
        createdAt: superAdminMemberships.createdAt,
        updatedAt: superAdminMemberships.updatedAt,
        createdById: superAdminMemberships.createdById,
        updatedById: superAdminMemberships.updatedById,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
          createdAt: users.createdAt,
        },
      })
      .from(superAdminMemberships)
      .innerJoin(users, eq(superAdminMemberships.userId, users.id)),
    db.select().from(superAdminInvitations),
  ]);

  const invitationUserIds = Array.from(
    new Set(
      invitationRows
        .flatMap((invite) => [invite.invitedById, invite.acceptedById])
        .filter((value): value is string => Boolean(value))
    )
  );

  const invitationUsers = invitationUserIds.length
    ? await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(inArray(users.id, invitationUserIds))
    : [];

  const invitationUserMap = new Map(
    invitationUsers.map((user) => [user.id, user])
  );

  const invitations = invitationRows
    .map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: normalizeInviteStatus({
        status: invite.status,
        expiresAt: invite.expiresAt,
      }),
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      acceptedAt: invite.acceptedAt,
      invitedBy: invite.invitedById
        ? invitationUserMap.get(invite.invitedById) ?? null
        : null,
      acceptedBy: invite.acceptedById
        ? invitationUserMap.get(invite.acceptedById) ?? null
        : null,
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const members = membershipRows.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status.localeCompare(b.status);
    }
    if (a.role !== b.role) {
      return a.role.localeCompare(b.role);
    }
    return a.user.email.localeCompare(b.user.email);
  });

  return NextResponse.json({
    success: true,
    members,
    invitations,
    summary: {
      activeMembers: members.filter((member) => member.status === "active").length,
      owners: members.filter(
        (member) => member.status === "active" && member.role === "owner"
      ).length,
      pendingInvites: invitations.filter((invite) => invite.status === "pending").length,
    },
  });
}, "manage_super_admin_team");

export const POST = withSuperAdminAuthRequired(async (req, context) => {
  try {
    const body = createInviteSchema.parse(await req.json());
    const actor = await context.session.user;

    const invite = await createSuperAdminInvitation({
      email: body.email,
      role: body.role,
      invitedById: actor.id,
      inviterName: actor.name ?? actor.email,
    });

    return NextResponse.json({
      success: true,
      invitation: {
        ...invite,
        status: normalizeInviteStatus({
          status: invite.status,
          expiresAt: invite.expiresAt,
        }),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to invite super-admin team member";
    const status = message.includes("already") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}, "manage_super_admin_team");
