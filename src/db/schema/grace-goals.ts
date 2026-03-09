import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { users } from "./user";
import { serviceRuns } from "./operations";

export const graceGoalTypeEnum = pgEnum("grace_goal_type", [
  "service_staffing",
  "communications_followup",
  "operations",
  "custom",
]);

export const graceGoalStatusEnum = pgEnum("grace_goal_status", [
  "queued",
  "in_progress",
  "waiting",
  "completed",
  "failed",
  "cancelled",
  "escalated",
]);

export const graceGoalStepStatusEnum = pgEnum("grace_goal_step_status", [
  "pending",
  "in_progress",
  "waiting",
  "completed",
  "failed",
  "skipped",
]);

export const graceGoals = pgTable(
  "grace_goal",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    goalType: graceGoalTypeEnum("goal_type").notNull().default("custom"),
    status: graceGoalStatusEnum("status").notNull().default("queued"),
    sourceChannel: text("source_channel").notNull().default("in_app"),
    objectiveText: text("objective_text").notNull(),
    serviceRunId: text("service_run_id").references(() => serviceRuns.id, {
      onDelete: "set null",
    }),
    requestedByUserId: text("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    contextJson: jsonb("context_json").$type<Record<string, unknown>>(),
    resultJson: jsonb("result_json").$type<Record<string, unknown>>(),
    errorText: text("error_text"),
    startedAt: timestamp("started_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
    nextRunAt: timestamp("next_run_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    orgStatusIdx: index("grace_goal_org_status_idx").on(
      table.organizationId,
      table.status
    ),
    orgTypeIdx: index("grace_goal_org_type_idx").on(
      table.organizationId,
      table.goalType
    ),
    runStatusIdx: index("grace_goal_run_status_idx").on(
      table.serviceRunId,
      table.status
    ),
  })
);

export const graceGoalSteps = pgTable(
  "grace_goal_step",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    goalId: text("goal_id")
      .notNull()
      .references(() => graceGoals.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    stepKey: text("step_key").notNull(),
    title: text("title").notNull(),
    status: graceGoalStepStatusEnum("status").notNull().default("pending"),
    runOrder: integer("run_order").notNull().default(0),
    attemptCount: integer("attempt_count").notNull().default(0),
    inputJson: jsonb("input_json").$type<Record<string, unknown>>(),
    outputJson: jsonb("output_json").$type<Record<string, unknown>>(),
    errorText: text("error_text"),
    startedAt: timestamp("started_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    goalOrderIdx: index("grace_goal_step_goal_order_idx").on(
      table.goalId,
      table.runOrder
    ),
    orgStatusIdx: index("grace_goal_step_org_status_idx").on(
      table.organizationId,
      table.status
    ),
    stepKeyIdx: index("grace_goal_step_goal_key_idx").on(table.goalId, table.stepKey),
  })
);
