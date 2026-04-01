import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  pgEnum,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { users } from "./user";

export const graceKnowledgeVisibilityEnum = pgEnum("grace_knowledge_visibility", [
  "public",
  "internal",
]);

export const graceKnowledge = pgTable(
  "grace_knowledge",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    tags: jsonb("tags").$type<string[]>().default([]),
    useForGrace: boolean("use_for_grace").notNull().default(true),
    visibility: graceKnowledgeVisibilityEnum("visibility").notNull().default("internal"),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    orgCreatedIdx: index("grace_knowledge_org_created_idx").on(table.organizationId, table.createdAt),
  })
);

export const graceKnowledgeVersionChangeTypeEnum = pgEnum(
  "grace_knowledge_version_change_type",
  ["create", "update", "delete"]
);

export const graceKnowledgeVersions = pgTable(
  "grace_knowledge_version",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    knowledgeId: text("knowledge_id").references(() => graceKnowledge.id, {
      onDelete: "set null",
    }),
    versionNumber: integer("version_number").notNull(),
    changeType: graceKnowledgeVersionChangeTypeEnum("change_type").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    useForGrace: boolean("use_for_grace").notNull().default(true),
    visibility: graceKnowledgeVisibilityEnum("visibility").notNull().default("internal"),
    changeSummary: text("change_summary"),
    changedByUserId: text("changed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    orgKnowledgeVersionIdx: index("grace_knowledge_version_org_knowledge_version_idx").on(
      table.organizationId,
      table.knowledgeId,
      table.versionNumber
    ),
    orgCreatedIdx: index("grace_knowledge_version_org_created_idx").on(
      table.organizationId,
      table.createdAt
    ),
    knowledgeVersionUnique: uniqueIndex("grace_knowledge_version_knowledge_version_uidx").on(
      table.knowledgeId,
      table.versionNumber
    ),
  })
);
