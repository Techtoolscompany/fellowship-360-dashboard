import { pgEnum, pgTable, text, timestamp, integer, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { graceSessions } from "./grace-sessions";

export const graceToolAuditStatusEnum = pgEnum("grace_tool_audit_status", ["success", "error"]);

export const graceToolAudit = pgTable(
  "grace_tool_audit",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => graceSessions.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    inputJson: jsonb("input_json").$type<Record<string, unknown>>(),
    outputJson: jsonb("output_json").$type<Record<string, unknown>>(),
    status: graceToolAuditStatusEnum("status").notNull(),
    latencyMs: integer("latency_ms"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    orgCreatedIdx: index("grace_tool_audit_org_created_idx").on(table.organizationId, table.createdAt),
    sessionIdx: index("grace_tool_audit_session_idx").on(table.sessionId),
    idempotencyIdx: uniqueIndex("grace_tool_audit_idempotency_uq").on(table.idempotencyKey),
  })
);
