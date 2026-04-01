import { db } from "@/db";
import { organizationRoleAccessPolicies } from "@/db/schema/organization-role-access";
import { and, eq, inArray } from "drizzle-orm";
import {
  ORG_ROLES,
  defaultRoleAccessMatrix,
  normalizeAccessSections,
  normalizeRoleAccessMatrix,
  type OrgRole,
  type RoleAccessMatrix,
} from "./role-access.shared";

export * from "./role-access.shared";

export async function getOrganizationRoleAccessMatrix(
  organizationId: string
): Promise<RoleAccessMatrix> {
  const rows = await db
    .select({
      role: organizationRoleAccessPolicies.role,
      allowedSections: organizationRoleAccessPolicies.allowedSections,
    })
    .from(organizationRoleAccessPolicies)
    .where(eq(organizationRoleAccessPolicies.organizationId, organizationId));

  if (rows.length === 0) {
    return defaultRoleAccessMatrix();
  }

  const seeded: Partial<RoleAccessMatrix> = {};
  for (const row of rows) {
    seeded[row.role as OrgRole] = normalizeAccessSections(row.allowedSections ?? []);
  }

  return normalizeRoleAccessMatrix(seeded);
}

export async function upsertOrganizationRoleAccessMatrix(
  organizationId: string,
  matrix: Partial<RoleAccessMatrix>
) {
  const normalized = normalizeRoleAccessMatrix(matrix);

  await db.transaction(async (tx) => {
    await tx
      .delete(organizationRoleAccessPolicies)
      .where(
        and(
          eq(organizationRoleAccessPolicies.organizationId, organizationId),
          inArray(organizationRoleAccessPolicies.role, [...ORG_ROLES])
        )
      );

    await tx.insert(organizationRoleAccessPolicies).values(
      ORG_ROLES.map((role) => ({
        organizationId,
        role,
        allowedSections: normalized[role],
        updatedAt: new Date(),
      }))
    );
  });

  return normalized;
}
