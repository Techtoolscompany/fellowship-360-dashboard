import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { organizations, roleEnum } from "./organization";

export const organizationRoleAccessPolicies = pgTable(
  "organization_role_access_policy",
  {
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    allowedSections: text("allowed_sections").array().notNull().default([]),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.organizationId, table.role],
    }),
    orgIdx: index("organization_role_access_policy_org_idx").on(table.organizationId),
  })
);

