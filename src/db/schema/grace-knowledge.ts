import { pgTable, text, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { organizations } from "./organization";

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
