import { pgEnum, pgTable, text, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { churchContacts } from "./church-contacts";
import { graceSessions, graceActorTypeEnum } from "./grace-sessions";

export const graceHandoffStatusEnum = pgEnum("grace_handoff_status", [
  "open",
  "acknowledged",
  "resolved",
]);

export const graceHandoffs = pgTable(
  "grace_handoff",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => graceSessions.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => churchContacts.id, { onDelete: "set null" }),
    actorType: graceActorTypeEnum("actor_type").notNull(),
    reason: text("reason").notNull(),
    summaryText: text("summary_text"),
    assignedTeam: text("assigned_team"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
    status: graceHandoffStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
  },
  (table) => ({
    orgStatusIdx: index("grace_handoff_org_status_idx").on(table.organizationId, table.status),
    sessionIdx: index("grace_handoff_session_idx").on(table.sessionId),
  })
);
