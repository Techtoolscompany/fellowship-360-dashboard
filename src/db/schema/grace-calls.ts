import { pgTable, text, timestamp, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { churchContacts } from "./church-contacts";
import { graceSessions } from "./grace-sessions";

export const graceCalls = pgTable(
  "grace_call",
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
    externalCallId: text("external_call_id"),
    fromNumber: text("from_number"),
    toNumber: text("to_number"),
    startedAt: timestamp("started_at", { mode: "date" }),
    endedAt: timestamp("ended_at", { mode: "date" }),
    durationSec: integer("duration_sec"),
    recordingUrl: text("recording_url"),
    transcriptText: text("transcript_text"),
    summaryText: text("summary_text"),
    intent: text("intent"),
    outcome: text("outcome"),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    sessionIdx: index("grace_call_session_idx").on(table.sessionId),
    orgCreatedIdx: index("grace_call_org_created_idx").on(table.organizationId, table.createdAt),
    externalIdIdx: uniqueIndex("grace_call_external_id_uq").on(table.externalCallId),
  })
);
