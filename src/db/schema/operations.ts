import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  real,
  index,
  uniqueIndex,
  jsonb,
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

export const serviceSchedulingPersonTypeEnum = pgEnum(
  "service_scheduling_person_type",
  ["contact", "staff"]
);

export const serviceTemplateTypeEnum = pgEnum("service_template_type", [
  "sunday_am",
  "midweek",
  "special_event",
  "custom",
]);

export const serviceTemplateRoleAssignmentEnum = pgEnum(
  "service_template_role_assignment",
  ["paid_staff", "volunteer", "either"]
);

export const serviceRunStatusEnum = pgEnum("service_run_status", [
  "planned",
  "in_progress",
  "completed",
  "cancelled",
]);

export const serviceAssignmentStatusEnum = pgEnum("service_assignment_status", [
  "proposed",
  "offered",
  "confirmed",
  "declined",
  "needs_replacement",
  "checked_in",
  "checked_out",
  "no_show",
  "cancelled",
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

export type ServiceAvailabilitySlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export const serviceSchedulingProfiles = pgTable(
  "service_scheduling_profile",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    personType: serviceSchedulingPersonTypeEnum("person_type").notNull(),
    contactId: text("contact_id").references(() => churchContacts.id, {
      onDelete: "cascade",
    }),
    staffUserId: text("staff_user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    isSchedulable: boolean("is_schedulable").notNull().default(true),
    preferredRoles: jsonb("preferred_roles").$type<string[]>().notNull().default([]),
    availabilitySlots: jsonb("availability_slots")
      .$type<ServiceAvailabilitySlot[]>()
      .notNull()
      .default([]),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    orgPersonTypeIdx: index("service_scheduling_profile_org_person_type_idx").on(
      table.organizationId,
      table.personType
    ),
    orgSchedulableIdx: index("service_scheduling_profile_org_schedulable_idx").on(
      table.organizationId,
      table.isSchedulable
    ),
    orgContactUnique: uniqueIndex("service_scheduling_profile_org_contact_uidx").on(
      table.organizationId,
      table.contactId
    ),
    orgStaffUnique: uniqueIndex("service_scheduling_profile_org_staff_uidx").on(
      table.organizationId,
      table.staffUserId
    ),
  })
);

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

// ── Service Templates ──
export const serviceTemplates = pgTable(
  "service_template",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    serviceType: serviceTemplateTypeEnum("service_type")
      .notNull()
      .default("custom"),
    isActive: boolean("is_active").notNull().default(true),
    serviceStartTime: text("service_start_time"),
    ownerUserId: text("owner_user_id").references(() => users.id, {
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
    orgTypeIdx: index("service_template_org_type_idx").on(
      table.organizationId,
      table.serviceType
    ),
    orgActiveIdx: index("service_template_org_active_idx").on(
      table.organizationId,
      table.isActive
    ),
  })
);

export const serviceTemplateRoleSlots = pgTable(
  "service_template_role_slot",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    templateId: text("template_id")
      .notNull()
      .references(() => serviceTemplates.id, { onDelete: "cascade" }),
    roleName: text("role_name").notNull(),
    assignmentType: serviceTemplateRoleAssignmentEnum("assignment_type")
      .notNull()
      .default("volunteer"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    requiredCount: integer("required_count").notNull().default(1),
    isRequired: boolean("is_required").notNull().default(true),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    templateSortIdx: index("service_template_role_slot_template_sort_idx").on(
      table.templateId,
      table.sortOrder
    ),
  })
);

export const serviceTemplateTimelineSteps = pgTable(
  "service_template_timeline_step",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    templateId: text("template_id")
      .notNull()
      .references(() => serviceTemplates.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    offsetMinutes: integer("offset_minutes").notNull(),
    durationMinutes: integer("duration_minutes"),
    ownerRoleSlotId: text("owner_role_slot_id").references(
      () => serviceTemplateRoleSlots.id,
      { onDelete: "set null" }
    ),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    templateOffsetIdx: index("service_template_timeline_step_template_offset_idx").on(
      table.templateId,
      table.offsetMinutes
    ),
    templateSortIdx: index("service_template_timeline_step_template_sort_idx").on(
      table.templateId,
      table.sortOrder
    ),
  })
);

// ── Service Runs ──
export const serviceRuns = pgTable(
  "service_run",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    templateId: text("template_id").references(() => serviceTemplates.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    serviceAt: timestamp("service_at", { mode: "date" }).notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(90),
    status: serviceRunStatusEnum("status").notNull().default("planned"),
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
    orgServiceAtIdx: index("service_run_org_service_at_idx").on(
      table.organizationId,
      table.serviceAt
    ),
    orgStatusIdx: index("service_run_org_status_idx").on(
      table.organizationId,
      table.status
    ),
  })
);

export const serviceAssignments = pgTable(
  "service_assignment",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    serviceRunId: text("service_run_id")
      .notNull()
      .references(() => serviceRuns.id, { onDelete: "cascade" }),
    templateId: text("template_id").references(() => serviceTemplates.id, {
      onDelete: "set null",
    }),
    roleSlotId: text("role_slot_id").references(() => serviceTemplateRoleSlots.id, {
      onDelete: "set null",
    }),
    roleName: text("role_name").notNull(),
    assignmentType: serviceTemplateRoleAssignmentEnum("assignment_type")
      .notNull()
      .default("volunteer"),
    volunteerId: text("volunteer_id").references(() => volunteers.id, {
      onDelete: "set null",
    }),
    staffUserId: text("staff_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: serviceAssignmentStatusEnum("status").notNull().default("proposed"),
    offeredAt: timestamp("offered_at", { mode: "date" }),
    respondedAt: timestamp("responded_at", { mode: "date" }),
    responseChannel: text("response_channel"),
    responseText: text("response_text"),
    checkedInAt: timestamp("checked_in_at", { mode: "date" }),
    checkedOutAt: timestamp("checked_out_at", { mode: "date" }),
    payrollExportedAt: timestamp("payroll_exported_at", { mode: "date" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    runStatusIdx: index("service_assignment_run_status_idx").on(
      table.serviceRunId,
      table.status
    ),
    orgStatusIdx: index("service_assignment_org_status_idx").on(
      table.organizationId,
      table.status
    ),
    roleTypeIdx: index("service_assignment_role_type_idx").on(
      table.roleName,
      table.assignmentType
    ),
  })
);
