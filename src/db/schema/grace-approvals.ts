import { pgEnum, pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { users } from "./user";
import { graceSessions } from "./grace-sessions";

export const graceApprovalStatusEnum = pgEnum("grace_approval_status", ["pending", "approved", "rejected"]);

export const graceApprovals = pgTable(
  "grace_approval",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => graceSessions.id, { onDelete: "cascade" }),
    requestedByUserId: text("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
    decidedByUserId: text("decided_by_user_id").references(() => users.id, { onDelete: "set null" }),
    proposedAction: jsonb("proposed_action").$type<Record<string, unknown>>().notNull(),
    status: graceApprovalStatusEnum("status").notNull().default("pending"),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    decidedAt: timestamp("decided_at", { mode: "date" }),
  },
  (table) => ({
    orgStatusIdx: index("grace_approval_org_status_idx").on(table.organizationId, table.status),
  })
);
