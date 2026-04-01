import { nanoid } from "nanoid";
import { and, count, eq, sql } from "drizzle-orm";
import { render } from "@react-email/components";
import { db } from "@/db";
import {
  superAdminAuditLogs,
  superAdminInvitations,
  superAdminMemberships,
  users,
} from "@/db/schema";
import InvitationEmail from "@/emails/InvitationEmail";
import sendMail from "@/lib/email/sendMail";
import { appConfig } from "@/lib/config";
import {
  type SuperAdminInvitationStatus,
  type SuperAdminMembershipStatus,
  type SuperAdminPermission,
  type SuperAdminRole,
  getSuperAdminPermissionsForRole,
  hasSuperAdminPermission,
} from "./permissions";

export interface ResolvedSuperAdminAccess {
  membershipId: string;
  role: SuperAdminRole;
  status: SuperAdminMembershipStatus;
  permissions: SuperAdminPermission[];
  isActive: boolean;
}

export function getBootstrapSuperAdminEmails() {
  return new Set(
    (process.env.SUPER_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function ensureBootstrapSuperAdminMembership(input: {
  userId: string;
  email: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  if (!getBootstrapSuperAdminEmails().has(normalizedEmail)) {
    return null;
  }

  const [existing] = await db
    .select()
    .from(superAdminMemberships)
    .where(eq(superAdminMemberships.userId, input.userId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(superAdminMemberships)
    .values({
      userId: input.userId,
      role: "owner",
      status: "active",
      createdById: input.userId,
      updatedById: input.userId,
    })
    .returning();

  await logSuperAdminAudit({
    actorUserId: input.userId,
    actionType: "bootstrap_membership",
    entityName: "super_admin_membership",
    entityId: created.id,
    details: {
      email: normalizedEmail,
      role: created.role,
      source: "SUPER_ADMIN_EMAILS",
    },
  });

  return created;
}

export async function resolveSuperAdminAccess(input: {
  userId?: string | null;
  email?: string | null;
}): Promise<ResolvedSuperAdminAccess | null> {
  if (!input.userId || !input.email) {
    return null;
  }

  await ensureBootstrapSuperAdminMembership({
    userId: input.userId,
    email: input.email,
  });

  const [membership] = await db
    .select({
      id: superAdminMemberships.id,
      role: superAdminMemberships.role,
      status: superAdminMemberships.status,
    })
    .from(superAdminMemberships)
    .where(eq(superAdminMemberships.userId, input.userId))
    .limit(1);

  if (!membership) {
    return null;
  }

  const isActive = membership.status === "active";

  return {
    membershipId: membership.id,
    role: membership.role,
    status: membership.status,
    permissions: isActive ? getSuperAdminPermissionsForRole(membership.role) : [],
    isActive,
  };
}

export function superAdminHasPermission(
  access: Pick<ResolvedSuperAdminAccess, "permissions"> | null | undefined,
  required: SuperAdminPermission | readonly SuperAdminPermission[]
) {
  if (!access) return false;
  return hasSuperAdminPermission(access.permissions, required);
}

export async function countActiveSuperAdminOwners(excludeMembershipId?: string) {
  const conditions = [
    eq(superAdminMemberships.role, "owner"),
    eq(superAdminMemberships.status, "active"),
  ];

  const rows = await db
    .select({ count: count() })
    .from(superAdminMemberships)
    .where(
      excludeMembershipId
        ? and(
            ...conditions,
            sql`${superAdminMemberships.id} <> ${excludeMembershipId}`
          )
        : and(...conditions)
    );

  return rows[0]?.count ?? 0;
}

export async function logSuperAdminAudit(input: {
  actorUserId?: string | null;
  actionType: string;
  entityName: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}) {
  await db.insert(superAdminAuditLogs).values({
    actorUserId: input.actorUserId ?? null,
    actionType: input.actionType,
    entityName: input.entityName,
    entityId: input.entityId ?? null,
    details: input.details,
  });
}

export function normalizeInviteStatus(input: {
  status: SuperAdminInvitationStatus;
  expiresAt: Date;
}): SuperAdminInvitationStatus {
  if (input.status === "pending" && input.expiresAt.getTime() < Date.now()) {
    return "expired";
  }

  return input.status;
}

export async function sendSuperAdminInvitationEmail(input: {
  email: string;
  role: SuperAdminRole;
  inviterName: string;
  token: string;
  expiresAt: Date;
}) {
  const callbackUrl = `/accept-super-admin-invite?token=${input.token}`;
  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL}/sign-in?callbackUrl=${encodeURIComponent(
    callbackUrl
  )}`;

  const html = await render(
    InvitationEmail({
      workspaceName: `${appConfig.projectName} Super Admin`,
      inviterName: input.inviterName,
      role: input.role,
      acceptUrl,
      expiresAt: input.expiresAt,
    })
  );

  await sendMail(
    input.email,
    `Join ${appConfig.projectName} super admin`,
    html
  );
}

export async function createSuperAdminInvitation(input: {
  email: string;
  role: SuperAdminRole;
  invitedById: string;
  inviterName: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalizedEmail}`)
    .limit(1);

  if (existingUser) {
    const [existingMembership] = await db
      .select({ id: superAdminMemberships.id, status: superAdminMemberships.status })
      .from(superAdminMemberships)
      .where(eq(superAdminMemberships.userId, existingUser.id))
      .limit(1);

    if (existingMembership && existingMembership.status !== "revoked") {
      throw new Error("This user already has super-admin access");
    }
  }

  const [existingInvite] = await db
    .select({
      id: superAdminInvitations.id,
      expiresAt: superAdminInvitations.expiresAt,
      status: superAdminInvitations.status,
    })
    .from(superAdminInvitations)
    .where(
      and(
        sql`lower(${superAdminInvitations.email}) = ${normalizedEmail}`,
        eq(superAdminInvitations.status, "pending")
      )
    )
    .limit(1);

  if (
    existingInvite &&
    normalizeInviteStatus({
      status: existingInvite.status,
      expiresAt: existingInvite.expiresAt,
    }) === "pending"
  ) {
    throw new Error("This email already has a pending invitation");
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const token = nanoid(32);

  const [invite] = await db
    .insert(superAdminInvitations)
    .values({
      email: normalizedEmail,
      role: input.role,
      token,
      invitedById: input.invitedById,
      expiresAt,
    })
    .returning();

  await sendSuperAdminInvitationEmail({
    email: normalizedEmail,
    role: input.role,
    inviterName: input.inviterName,
    token,
    expiresAt,
  });

  await logSuperAdminAudit({
    actorUserId: input.invitedById,
    actionType: "invite_super_admin",
    entityName: "super_admin_invitation",
    entityId: invite.id,
    details: {
      email: normalizedEmail,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
    },
  });

  return invite;
}
