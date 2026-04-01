import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { graceSessions, graceActorTypeEnum, graceChannelEnum } from "./grace-sessions";
import { automationWorkflows, automationWorkflowRuns } from "./automations";

export const graceAuditEventTypeEnum = pgEnum("grace_audit_event_type", [
  "ai_decision",
  "action_execution",
  "workflow_execution",
]);

export const graceAuditSourceEnum = pgEnum("grace_audit_source", [
  "grace_router",
  "grace_executor",
  "automation_runtime",
]);

export const graceAuditStatusEnum = pgEnum("grace_audit_status", [
  "success",
  "error",
  "queued",
  "blocked",
  "skipped",
]);

export const graceAuditStream = pgTable(
  "grace_audit_stream",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => graceSessions.id, {
      onDelete: "set null",
    }),
    workflowId: text("workflow_id").references(() => automationWorkflows.id, {
      onDelete: "set null",
    }),
    workflowRunId: text("workflow_run_id").references(() => automationWorkflowRuns.id, {
      onDelete: "set null",
    }),
    eventType: graceAuditEventTypeEnum("event_type").notNull(),
    source: graceAuditSourceEnum("source").notNull(),
    status: graceAuditStatusEnum("status").notNull(),
    actorType: graceActorTypeEnum("actor_type").notNull().default("system"),
    channel: graceChannelEnum("channel"),
    intent: text("intent"),
    toolName: text("tool_name"),
    actionName: text("action_name"),
    model: text("model"),
    latencyMs: integer("latency_ms"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    estimatedCostUsd: doublePrecision("estimated_cost_usd"),
    errorText: text("error_text"),
    metadataJson: jsonb("metadata_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    orgCreatedIdx: index("grace_audit_stream_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
    orgEventCreatedIdx: index("grace_audit_stream_org_event_created_idx").on(
      table.organizationId,
      table.eventType,
      table.createdAt
    ),
    orgStatusCreatedIdx: index("grace_audit_stream_org_status_created_idx").on(
      table.organizationId,
      table.status,
      table.createdAt
    ),
    orgModelCreatedIdx: index("grace_audit_stream_org_model_created_idx").on(
      table.organizationId,
      table.model,
      table.createdAt
    ),
  })
);
