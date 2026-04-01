"use server";

import { z } from "zod";
import { auditAction, requireOrgMembership } from "./utils";
import {
  ACCESS_SECTIONS,
  ACCESS_SECTION_METADATA,
  getAllowedSectionsForRole,
  getOrganizationRoleAccessMatrix,
  normalizeRoleAccessMatrix,
  upsertOrganizationRoleAccessMatrix,
} from "@/lib/access/role-access";

const roleAccessUpdateSchema = z.object({
  organizationId: z.string().min(1),
  matrix: z.object({
    owner: z.array(z.enum(ACCESS_SECTIONS)).optional(),
    admin: z.array(z.enum(ACCESS_SECTIONS)).optional(),
    user: z.array(z.enum(ACCESS_SECTIONS)).optional(),
  }),
});

export async function getOrganizationRoleAccess(organizationId: string) {
  const membership = await requireOrgMembership(organizationId);
  const matrix = await getOrganizationRoleAccessMatrix(organizationId);

  return {
    organizationId,
    role: membership.role,
    matrix,
    allowedSections: getAllowedSectionsForRole(matrix, membership.role),
    sectionMetadata: ACCESS_SECTION_METADATA,
  };
}

export async function updateOrganizationRoleAccess(input: {
  organizationId: string;
  matrix: {
    owner?: (typeof ACCESS_SECTIONS)[number][];
    admin?: (typeof ACCESS_SECTIONS)[number][];
    user?: (typeof ACCESS_SECTIONS)[number][];
  };
}) {
  const parsed = roleAccessUpdateSchema.parse(input);
  const session = await requireOrgMembership(parsed.organizationId, "admin");

  const nextMatrix = normalizeRoleAccessMatrix(parsed.matrix);
  const persisted = await upsertOrganizationRoleAccessMatrix(
    parsed.organizationId,
    nextMatrix
  );

  await auditAction({
    organizationId: parsed.organizationId,
    userId: session.userId,
    actionType: "update",
    entityName: "organization_role_access_policy",
    details: {
      rolesUpdated: ["owner", "admin", "user"],
      sectionCounts: {
        owner: persisted.owner.length,
        admin: persisted.admin.length,
        user: persisted.user.length,
      },
    },
  });

  return {
    organizationId: parsed.organizationId,
    matrix: persisted,
  };
}

