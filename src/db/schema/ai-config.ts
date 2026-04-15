import { pgTable, text, timestamp, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { organizations } from "./organization";

export const aiConfig = pgTable("ai_config", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  customSystemPrompt: text("custom_system_prompt"),
  churchName: text("church_name").notNull(),
  churchDenomination: text("church_denomination"),
  churchCity: text("church_city"),
  graceEnabled: boolean("grace_enabled").notNull().default(true),
  proactiveMode: text("proactive_mode")
    .$type<"off" | "quiet" | "normal">()
    .notNull()
    .default("normal"),
  internalGraceEnabled: boolean("internal_grace_enabled").notNull().default(true),
  publicGraceEnabled: boolean("public_grace_enabled").notNull().default(false),
  publicWidgetEnabled: boolean("public_widget_enabled").notNull().default(false),
  publicPhoneEnabled: boolean("public_phone_enabled").notNull().default(false),
  isDemoOrganization: boolean("is_demo_organization").notNull().default(false),
  temperatureOverride: doublePrecision("temperature_override"),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
});
