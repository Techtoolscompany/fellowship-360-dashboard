import {
  pgTable,
  text,
  timestamp,
  real,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { churchContacts } from "./church-contacts";

// ── Enums ──
export const donationMethodEnum = pgEnum("donation_method", [
  "cash",
  "check",
  "card",
  "online",
  "bank_transfer",
  "other",
]);

export const pledgeFrequencyEnum = pgEnum("pledge_frequency", [
  "one_time",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "annually",
]);

// ── Donations ──
export const donations = pgTable("donation", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: text("contact_id").references(() => churchContacts.id, {
    onDelete: "set null",
  }),
  amount: real("amount").notNull(),
  date: timestamp("date", { mode: "date" }).notNull(),
  method: donationMethodEnum("method").default("cash"),
  fund: text("fund").default("General"),
  memo: text("memo"),
  receiptSent: boolean("receipt_sent").default(false),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Pledges ──
export const pledges = pgTable("pledge", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: text("contact_id").references(() => churchContacts.id, {
    onDelete: "set null",
  }),
  totalAmount: real("total_amount").notNull(),
  amountPaid: real("amount_paid").default(0).notNull(),
  frequency: pledgeFrequencyEnum("frequency").default("monthly").notNull(),
  fund: text("fund").default("General"),
  startDate: timestamp("start_date", { mode: "date" }).notNull(),
  endDate: timestamp("end_date", { mode: "date" }),
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
