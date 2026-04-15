import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { churchContacts } from "./church-contacts";
import { ministries } from "./ministries";
import { serviceRuns } from "./operations";
import { users } from "./user";

export const attendanceSessionTypeEnum = pgEnum("attendance_session_type", [
  "worship",
  "ministry",
  "service",
]);

export const attendanceEntryStatusEnum = pgEnum("attendance_entry_status", [
  "present",
  "absent",
  "served",
]);

export const attendanceEntrySourceEnum = pgEnum("attendance_entry_source", [
  "manual",
  "import",
  "service_run",
  "ministry",
  "worship",
]);

export const attendanceSessions = pgTable(
  "attendance_session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: attendanceSessionTypeEnum("type").notNull(),
    name: text("name").notNull(),
    occurredAt: timestamp("occurred_at", { mode: "date" }).notNull(),
    ministryId: text("ministry_id").references(() => ministries.id, {
      onDelete: "set null",
    }),
    serviceRunId: text("service_run_id").references(() => serviceRuns.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    orgOccurredAtIdx: index("attendance_session_org_occurred_at_idx").on(
      table.organizationId,
      table.occurredAt
    ),
    orgTypeOccurredAtIdx: index("attendance_session_org_type_occurred_at_idx").on(
      table.organizationId,
      table.type,
      table.occurredAt
    ),
    ministryOccurredAtIdx: index("attendance_session_ministry_occurred_at_idx").on(
      table.ministryId,
      table.occurredAt
    ),
    serviceRunUnique: uniqueIndex("attendance_session_service_run_uidx").on(
      table.serviceRunId
    ),
  })
);

export const attendanceEntries = pgTable(
  "attendance_entry",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => churchContacts.id, { onDelete: "cascade" }),
    status: attendanceEntryStatusEnum("status").notNull().default("present"),
    source: attendanceEntrySourceEnum("source").notNull().default("manual"),
    notes: text("notes"),
    recordedByUserId: text("recorded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    recordedAt: timestamp("recorded_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    sessionContactUnique: uniqueIndex("attendance_entry_session_contact_uidx").on(
      table.sessionId,
      table.contactId
    ),
    orgContactRecordedAtIdx: index("attendance_entry_org_contact_recorded_at_idx").on(
      table.organizationId,
      table.contactId,
      table.recordedAt
    ),
    sessionStatusIdx: index("attendance_entry_session_status_idx").on(
      table.sessionId,
      table.status
    ),
  })
);
