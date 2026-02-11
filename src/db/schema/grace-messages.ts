import { pgEnum, pgTable, text, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { churchContacts } from "./church-contacts";
import { graceSessions } from "./grace-sessions";

export const graceDirectionEnum = pgEnum("grace_message_direction", ["inbound", "outbound"]);

export const graceMessages = pgTable(
  "grace_message",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => graceSessions.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => churchContacts.id, {
      onDelete: "set null",
    }),
    direction: graceDirectionEnum("direction").notNull(),
    channel: text("channel").notNull(),
    messageText: text("message_text").notNull(),
    providerMessageId: text("provider_message_id"),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    sessionIdx: index("grace_message_session_idx").on(table.sessionId),
    orgCreatedIdx: index("grace_message_org_created_idx").on(table.organizationId, table.createdAt),
    providerIdIdx: uniqueIndex("grace_message_provider_id_uq").on(table.providerMessageId),
  })
);
