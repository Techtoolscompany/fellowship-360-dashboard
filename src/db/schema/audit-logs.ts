import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { users } from "./user";

export const actionAuditLogs = pgTable("action_audit_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(),
  entityName: text("entity_name").notNull(),
  entityId: text("entity_id"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});
