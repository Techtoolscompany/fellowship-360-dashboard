import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organization";

// ── Enums ──
export const memberStatusEnum = pgEnum("member_status", [
  "visitor",
  "prospect",
  "regular_attendee",
  "member",
  "leader",
  "inactive",
]);

export const contactSourceEnum = pgEnum("contact_source", [
  "walk_in",
  "website",
  "referral",
  "event",
  "social_media",
  "other",
]);

// ── Families ──
export const families = pgTable("family", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
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

// ── Contacts (church members, visitors, etc.) ──
export const churchContacts = pgTable("church_contact", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  memberStatus: memberStatusEnum("member_status").default("visitor").notNull(),
  source: contactSourceEnum("source").default("walk_in"),
  familyId: text("family_id").references(() => families.id, {
    onDelete: "set null",
  }),
  avatarUrl: text("avatar_url"),
  dateOfBirth: timestamp("date_of_birth", { mode: "date" }),
  firstVisitDate: timestamp("first_visit_date", { mode: "date" }),
  notes: text("notes"),
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

// ── Tags ──
export const contactTags = pgTable("contact_tag", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: text("contact_id")
    .notNull()
    .references(() => churchContacts.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
});
