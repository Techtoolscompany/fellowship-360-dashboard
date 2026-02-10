import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  real,
} from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { churchContacts } from "./church-contacts";
import { users } from "./user";

// ── Enums ──
export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "done",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);

export const volunteerStatusEnum = pgEnum("volunteer_status", [
  "active",
  "inactive",
  "pending",
]);

// ── Events ──
export const events = pgTable("event", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date", { mode: "date" }).notNull(),
  endDate: timestamp("end_date", { mode: "date" }),
  location: text("location"),
  isRecurring: boolean("is_recurring").default(false),
  recurrenceRule: text("recurrence_rule"),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Appointments ──
export const appointments = pgTable("appointment", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: text("contact_id").references(() => churchContacts.id, {
    onDelete: "set null",
  }),
  staffId: text("staff_id").references(() => users.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  dateTime: timestamp("date_time", { mode: "date" }).notNull(),
  duration: integer("duration_minutes").default(30),
  status: appointmentStatusEnum("status").default("scheduled").notNull(),
  type: text("type"),
  notes: text("notes"),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Tasks ──
export const tasks = pgTable("task", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: text("assignee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  dueDate: timestamp("due_date", { mode: "date" }),
  status: taskStatusEnum("status").default("todo").notNull(),
  priority: taskPriorityEnum("priority").default("medium").notNull(),
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

// ── Volunteers ──
export const volunteers = pgTable("volunteer", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: text("contact_id")
    .notNull()
    .references(() => churchContacts.id, { onDelete: "cascade" }),
  role: text("role"),
  status: volunteerStatusEnum("status").default("active").notNull(),
  totalHours: real("total_hours").default(0),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Volunteer Shifts ──
export const volunteerShifts = pgTable("volunteer_shift", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  volunteerId: text("volunteer_id")
    .notNull()
    .references(() => volunteers.id, { onDelete: "cascade" }),
  eventId: text("event_id").references(() => events.id, {
    onDelete: "set null",
  }),
  date: timestamp("date", { mode: "date" }).notNull(),
  hours: real("hours").notNull(),
  notes: text("notes"),
});
