import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { churchContacts } from "./church-contacts";

// ── Enums ──
export const ministryRoleEnum = pgEnum("ministry_role", [
  "leader",
  "co_leader",
  "member",
  "volunteer",
]);

// ── Ministries ──
export const ministries = pgTable("ministry", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  meetingDay: text("meeting_day"),
  meetingTime: text("meeting_time"),
  meetingLocation: text("meeting_location"),
  leaderId: text("leader_id").references(() => churchContacts.id, {
    onDelete: "set null",
  }),
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

// ── Ministry Members ──
export const ministryMembers = pgTable("ministry_member", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  ministryId: text("ministry_id")
    .notNull()
    .references(() => ministries.id, { onDelete: "cascade" }),
  contactId: text("contact_id")
    .notNull()
    .references(() => churchContacts.id, { onDelete: "cascade" }),
  role: ministryRoleEnum("role").default("member").notNull(),
  joinedAt: timestamp("joined_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});
