import { pgEnum, pgTable, text, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { churchContacts } from "./church-contacts";
import { graceSessions, graceActorTypeEnum } from "./grace-sessions";
import { users } from "./user";

export const graceFollowupProposalStatusEnum = pgEnum("grace_followup_proposal_status", [
  "pending",
  "approved",
  "rejected",
  "sent",
]);

export const graceFollowupProposals = pgTable(
  "grace_followup_proposal",
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
    channel: text("channel").notNull(),
    proposedChannel: text("proposed_channel").notNull().default("sms"),
    recipient: text("recipient"),
    subject: text("subject"),
    messageText: text("message_text").notNull(),
    reason: text("reason"),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
    status: graceFollowupProposalStatusEnum("status").notNull().default("pending"),
    approvedByUserId: text("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    orgStatusIdx: index("grace_followup_proposal_org_status_idx").on(table.organizationId, table.status),
    sessionIdx: index("grace_followup_proposal_session_idx").on(table.sessionId),
  })
);
