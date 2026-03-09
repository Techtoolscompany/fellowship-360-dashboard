import { timestamp, pgTable, text, integer } from "drizzle-orm/pg-core";
import { organizations } from "./organization";

export const aiUsageLogs = pgTable("ai_usage_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  tokensUsed: integer("tokens_used"),
  messagesCount: integer("messages_count").notNull().default(1),
  createdAt: timestamp("created_at", { mode: "date" })
    .defaultNow()
    .notNull(),
});

export type AIUsageLog = typeof aiUsageLogs.$inferSelect;
export type NewAIUsageLog = typeof aiUsageLogs.$inferInsert;
