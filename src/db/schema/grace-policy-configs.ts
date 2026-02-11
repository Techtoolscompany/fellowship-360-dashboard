import { pgTable, text, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { organizations } from "./organization";

export const gracePolicyConfigs = pgTable(
  "grace_policy_config",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    approvalsEnabled: boolean("approvals_enabled").notNull().default(true),
    autoEscalateOnEmergency: boolean("auto_escalate_on_emergency").notNull().default(true),
    confidenceThreshold: text("confidence_threshold").notNull().default("0.7"),
    highRiskTools: jsonb("high_risk_tools").$type<string[]>().default([]),
    allowedPublicTools: jsonb("allowed_public_tools").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    orgIdx: index("grace_policy_org_idx").on(table.organizationId),
  })
);
