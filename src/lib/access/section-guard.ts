import { requireOrgMembership } from "@/app/actions/utils";
import {
  getAllowedSectionsForRole,
  getOrganizationRoleAccessMatrix,
  type AccessSection,
  type OrgRole,
} from "./role-access";

export async function requireOrganizationSectionAccess(input: {
  organizationId: string;
  section: AccessSection;
  requiredRole?: "admin" | "user";
}): Promise<{ userId: string; role: OrgRole; allowedSections: AccessSection[] }> {
  const membership = await requireOrgMembership(input.organizationId, input.requiredRole);
  const matrix = await getOrganizationRoleAccessMatrix(input.organizationId);
  const allowedSections = getAllowedSectionsForRole(matrix, membership.role);

  if (!allowedSections.includes(input.section)) {
    throw new Error(`Insufficient permissions: ${input.section} section access required`);
  }

  return {
    userId: membership.userId,
    role: membership.role as OrgRole,
    allowedSections,
  };
}
