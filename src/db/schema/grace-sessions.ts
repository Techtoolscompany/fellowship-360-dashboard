import { pgEnum, pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { churchContacts } from "./church-contacts";

export const graceChannelEnum = pgEnum("grace_channel", ["voice", "sms", "web", "in_app"]);
export const graceSessionStatusEnum = pgEnum("grace_session_status", ["open", "closed", "escalated"]);

export const graceSessions = pgTable(
  "grace_session",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    channel: graceChannelEnum("channel").notNull(),
    contactId: text("contact_id").references(() => churchContacts.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    endedAt: timestamp("ended_at", { mode: "date" }),
    stateJson: jsonb("state_json").$type<Record<string, unknown>>(),
    finalSummary: text("final_summary"),
    handoffReason: text("handoff_reason"),
    status: graceSessionStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    orgCreatedIdx: index("grace_session_org_created_idx").on(table.organizationId, table.createdAt),
    orgStatusIdx: index("grace_session_org_status_idx").on(table.organizationId, table.status),
  })
);
