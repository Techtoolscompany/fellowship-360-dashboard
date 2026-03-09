import { pgEnum, pgTable, text, timestamp, integer, index, jsonb, boolean } from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { churchContacts } from "./church-contacts";
import { graceSessions } from "./grace-sessions";

export const graceContactMatchOutcomeEnum = pgEnum("grace_contact_match_outcome", [
  "matched_existing",
  "created_new",
  "created_review_candidate",
]);

export const graceContactMatchAudit = pgTable(
  "grace_contact_match_audit",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => graceSessions.id, { onDelete: "cascade" }),
    matchedContactId: text("matched_contact_id").references(() => churchContacts.id, {
      onDelete: "set null",
    }),
    createdContactId: text("created_contact_id").references(() => churchContacts.id, {
      onDelete: "set null",
    }),
    confidenceScore: integer("confidence_score").notNull().default(0),
    confidenceTier: text("confidence_tier").notNull(),
    outcome: graceContactMatchOutcomeEnum("outcome").notNull(),
    requiresReview: boolean("requires_review").notNull().default(false),
    inputJson: jsonb("input_json").$type<Record<string, unknown>>(),
    candidateJson: jsonb("candidate_json").$type<Record<string, unknown>[]>(),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    orgCreatedIdx: index("grace_contact_match_audit_org_created_idx").on(table.organizationId, table.createdAt),
    sessionIdx: index("grace_contact_match_audit_session_idx").on(table.sessionId),
  })
);
