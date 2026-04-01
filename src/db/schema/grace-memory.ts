import { index, jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { graceSessions, graceActorTypeEnum } from "./grace-sessions";
import { churchContacts } from "./church-contacts";
import { users } from "./user";

export const graceMemoryTypeEnum = pgEnum("grace_memory_type", [
  "contact_memory",
  "org_pattern",
  "daily_briefing",
  "service_recap",
]);

export const graceMemory = pgTable(
  "grace_memory",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => graceSessions.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => churchContacts.id, {
      onDelete: "set null",
    }),
    memoryType: graceMemoryTypeEnum("memory_type").notNull(),
    summary: text("summary").notNull(),
    details: text("details"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
    createdByActorType: graceActorTypeEnum("created_by_actor_type")
      .notNull()
      .default("system"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    orgTypeCreatedIdx: index("grace_memory_org_type_created_idx").on(
      table.organizationId,
      table.memoryType,
      table.createdAt
    ),
    orgContactCreatedIdx: index("grace_memory_org_contact_created_idx").on(
      table.organizationId,
      table.contactId,
      table.createdAt
    ),
    sessionIdx: index("grace_memory_session_idx").on(table.sessionId),
  })
);
