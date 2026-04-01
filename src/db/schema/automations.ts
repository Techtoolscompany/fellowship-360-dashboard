import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  index,
  uniqueIndex,
  pgEnum,
  jsonb,
} from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { churchContacts } from "./church-contacts";
import { users } from "./user";

export const automationModeEnum = pgEnum("automation_mode", ["template", "builder"]);

export const automationStatusEnum = pgEnum("automation_status", [
  "draft",
  "published",
  "paused",
  "archived",
]);

export const automationRunStatusEnum = pgEnum("automation_run_status", [
  "entered",
  "running",
  "failed",
  "completed",
  "exited",
]);

export const automationDeadLetterStatusEnum = pgEnum(
  "automation_dead_letter_status",
  ["pending", "replayed", "discarded"]
);

export const automationEnrollmentModeEnum = pgEnum("automation_enrollment_mode", [
  "every_trigger",
  "once_per_contact",
  "cooldown",
]);

export type AutomationNodePayload = {
  id: string;
  type: "trigger" | "delay" | "condition" | "action" | "stop";
  label: string;
  description?: string | null;
  config?: Record<string, unknown> | null;
  nextIds?: string[];
};

export type AutomationDefinitionPayload = {
  version: number;
  startNodeId?: string | null;
  nodes: AutomationNodePayload[];
};

export type AutomationCompliancePolicySnapshotPayload = {
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  dailySendCap: number;
  respectOptOut: boolean;
  enrollmentMode: "every_trigger" | "once_per_contact" | "cooldown";
  reentryCooldownMinutes: number;
};

export const automationWorkflows = pgTable(
  "automation_workflow",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    mode: automationModeEnum("mode").notNull().default("template"),
    status: automationStatusEnum("status").notNull().default("draft"),
    templateKey: text("template_key"),
    triggerEvent: text("trigger_event"),
    definitionJson: jsonb("definition_json")
      .$type<AutomationDefinitionPayload>()
      .notNull()
      .default({ version: 1, nodes: [] }),
    validationErrors: jsonb("validation_errors").$type<string[]>().notNull().default([]),
    quietHoursEnabled: boolean("quiet_hours_enabled").notNull().default(true),
    quietHoursStart: text("quiet_hours_start").notNull().default("21:00"),
    quietHoursEnd: text("quiet_hours_end").notNull().default("08:00"),
    dailySendCap: integer("daily_send_cap").notNull().default(250),
    respectOptOut: boolean("respect_opt_out").notNull().default(true),
    enrollmentMode: automationEnrollmentModeEnum("enrollment_mode")
      .notNull()
      .default("once_per_contact"),
    reentryCooldownMinutes: integer("reentry_cooldown_minutes")
      .notNull()
      .default(10080),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    publishedAt: timestamp("published_at", { mode: "date" }),
    lastValidatedAt: timestamp("last_validated_at", { mode: "date" }),
  },
  (table) => ({
    orgStatusIdx: index("automation_workflow_org_status_idx").on(
      table.organizationId,
      table.status
    ),
    orgModeIdx: index("automation_workflow_org_mode_idx").on(
      table.organizationId,
      table.mode
    ),
    orgCreatedIdx: index("automation_workflow_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
    orgTemplateModeUnique: uniqueIndex("automation_workflow_org_template_mode_uidx").on(
      table.organizationId,
      table.templateKey,
      table.mode
    ),
  })
);

export const automationWorkflowVersions = pgTable(
  "automation_workflow_version",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => automationWorkflows.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    triggerEvent: text("trigger_event"),
    definitionJson: jsonb("definition_json")
      .$type<AutomationDefinitionPayload>()
      .notNull(),
    policyJson: jsonb("policy_json")
      .$type<AutomationCompliancePolicySnapshotPayload>()
      .notNull(),
    publishedByUserId: text("published_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    workflowVersionUnique: uniqueIndex(
      "automation_workflow_version_workflow_version_uidx"
    ).on(table.workflowId, table.versionNumber),
    workflowCreatedIdx: index("automation_workflow_version_workflow_created_idx").on(
      table.workflowId,
      table.createdAt
    ),
    orgCreatedIdx: index("automation_workflow_version_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
    orgWorkflowIdx: index("automation_workflow_version_org_workflow_idx").on(
      table.organizationId,
      table.workflowId
    ),
  })
);

export const automationWorkflowRuns = pgTable(
  "automation_workflow_run",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => automationWorkflows.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => churchContacts.id, {
      onDelete: "set null",
    }),
    status: automationRunStatusEnum("status").notNull().default("entered"),
    currentNodeId: text("current_node_id"),
    currentNodeType: text("current_node_type"),
    lastError: text("last_error"),
    metadataJson: jsonb("metadata_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    enteredAt: timestamp("entered_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    completedAt: timestamp("completed_at", { mode: "date" }),
    exitedAt: timestamp("exited_at", { mode: "date" }),
  },
  (table) => ({
    workflowStatusIdx: index("automation_workflow_run_workflow_status_idx").on(
      table.workflowId,
      table.status
    ),
    orgContactIdx: index("automation_workflow_run_org_contact_idx").on(
      table.organizationId,
      table.contactId
    ),
    orgEnteredIdx: index("automation_workflow_run_org_entered_idx").on(
      table.organizationId,
      table.enteredAt
    ),
  })
);

export const automationDeadLetters = pgTable(
  "automation_dead_letter",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => automationWorkflows.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => automationWorkflowRuns.id, {
      onDelete: "set null",
    }),
    contactId: text("contact_id").references(() => churchContacts.id, {
      onDelete: "set null",
    }),
    triggerEvent: text("trigger_event"),
    source: text("source").notNull().default("event_trigger"),
    status: automationDeadLetterStatusEnum("status")
      .notNull()
      .default("pending"),
    attemptCount: integer("attempt_count").notNull().default(1),
    lastError: text("last_error").notNull(),
    payloadJson: jsonb("payload_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    firstFailedAt: timestamp("first_failed_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    lastFailedAt: timestamp("last_failed_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    nextRetryAt: timestamp("next_retry_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    workflowStatusIdx: index("automation_dead_letter_workflow_status_idx").on(
      table.workflowId,
      table.status
    ),
    orgStatusRetryIdx: index("automation_dead_letter_org_status_retry_idx").on(
      table.organizationId,
      table.status,
      table.nextRetryAt
    ),
    runUniqueIdx: uniqueIndex("automation_dead_letter_run_uidx").on(table.runId),
  })
);
