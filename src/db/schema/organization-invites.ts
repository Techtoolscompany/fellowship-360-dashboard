import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organization";

export const organizationInvites = pgTable("organization_invites", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  organizationId: text("organization_id")
    .references(() => organizations.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role", { enum: ["admin", "user", "owner"] }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}); 