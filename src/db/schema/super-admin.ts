import type { InferSelectModel } from "drizzle-orm";
import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  SUPER_ADMIN_INVITATION_STATUSES,
  SUPER_ADMIN_MEMBERSHIP_STATUSES,
  SUPER_ADMIN_ROLES,
} from "@/lib/super-admin/permissions";
import { users } from "./user";

export const superAdminRoleEnum = pgEnum("super_admin_role", SUPER_ADMIN_ROLES);
export const superAdminMembershipStatusEnum = pgEnum(
  "super_admin_membership_status",
  SUPER_ADMIN_MEMBERSHIP_STATUSES
);
export const superAdminInvitationStatusEnum = pgEnum(
  "super_admin_invitation_status",
  SUPER_ADMIN_INVITATION_STATUSES
);

export const superAdminMemberships = pgTable(
  "super_admin_membership",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: superAdminRoleEnum("role").notNull().default("operator"),
    status: superAdminMembershipStatusEnum("status").notNull().default("active"),
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedById: text("updated_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (table) => ({
    userIdUidx: uniqueIndex("super_admin_membership_user_uidx").on(table.userId),
  })
);

export const superAdminInvitations = pgTable(
  "super_admin_invitation",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    role: superAdminRoleEnum("role").notNull(),
    status: superAdminInvitationStatusEnum("status").notNull().default("pending"),
    token: text("token").notNull(),
    invitedById: text("invited_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedById: text("accepted_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { mode: "date" }),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (table) => ({
    tokenUidx: uniqueIndex("super_admin_invitation_token_uidx").on(table.token),
  })
);

export const superAdminAuditLogs = pgTable("super_admin_audit_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  actorUserId: text("actor_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  actionType: text("action_type").notNull(),
  entityName: text("entity_name").notNull(),
  entityId: text("entity_id"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type SuperAdminMembership = InferSelectModel<typeof superAdminMemberships>;
export type SuperAdminInvitation = InferSelectModel<typeof superAdminInvitations>;
export type SuperAdminAuditLog = InferSelectModel<typeof superAdminAuditLogs>;
