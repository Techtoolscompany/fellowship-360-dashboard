import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { churchContacts } from "./church-contacts";
import { users } from "./user";

// ── Enums ──
export const pipelinePriorityEnum = pgEnum("pipeline_priority", [
  "low",
  "medium",
  "high",
]);

// ── Pipeline Stages ──
export const pipelineStages = pgTable("pipeline_stage", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  order: integer("order").notNull().default(0),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ── Pipeline Items (visitors/prospects in the pipeline) ──
export const pipelineItems = pgTable("pipeline_item", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactId: text("contact_id")
    .notNull()
    .references(() => churchContacts.id, { onDelete: "cascade" }),
  stageId: text("stage_id")
    .notNull()
    .references(() => pipelineStages.id, { onDelete: "cascade" }),
  order: integer("order").notNull().default(0),
  priority: pipelinePriorityEnum("priority").default("medium"),
  assigneeId: text("assignee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  notes: text("notes"),
  lastContactDate: timestamp("last_contact_date", { mode: "date" }),
  nextActionDate: timestamp("next_action_date", { mode: "date" }),
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
