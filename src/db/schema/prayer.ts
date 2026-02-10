import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { churchContacts } from "./church-contacts";

// ── Enums ──
export const prayerUrgencyEnum = pgEnum("prayer_urgency", [
  "normal",
  "urgent",
  "critical",
]);

export const prayerStatusEnum = pgEnum("prayer_status", [
  "new",
  "praying",
  "answered",
  "archived",
]);

// ── Prayer Requests ──
export const prayerRequests = pgTable("prayer_request", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: text("contact_id").references(() => churchContacts.id, {
    onDelete: "set null",
  }),
  contactName: text("contact_name"),
  content: text("content").notNull(),
  urgency: prayerUrgencyEnum("urgency").default("normal").notNull(),
  status: prayerStatusEnum("status").default("new").notNull(),
  assignedTeam: text("assigned_team"),
  isAnonymous: text("is_anonymous").default("false"),
  response: text("response"),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});
