import { pgEnum, pgTable, text, timestamp, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { organizations } from "./organization";

export const providerModeEnum = pgEnum("provider_mode", ["agency_managed", "byo", "disabled"]);

export const providerConfigs = pgTable(
  "provider_config",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    provider: text("provider").notNull(),
    mode: providerModeEnum("mode").notNull().default("agency_managed"),
    isActive: boolean("is_active").notNull().default(true),
    configJson: jsonb("config_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    orgChannelIdx: index("provider_config_org_channel_idx").on(table.organizationId, table.channel),
  })
);
