import { timestamp, pgTable, text, primaryKey } from "drizzle-orm/pg-core";
import { organizations } from "./organization";
import { users } from "./user";
import { roleEnum } from "./organization";
import type { InferSelectModel } from "drizzle-orm";

export type OrganizationMembership = InferSelectModel<
  typeof organizationMemberships
>;

export const organizationMemberships = pgTable(
  "organization_membership",
  {
    organizationId: text("organizationId")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("user"),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.organizationId, t.userId] }),
  })
);
