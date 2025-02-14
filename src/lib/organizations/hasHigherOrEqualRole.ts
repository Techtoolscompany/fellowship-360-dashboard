import { OrganizationMembership } from "@/db/schema/organization-membership";

/**
 * Checks if the current role is higher or equal to the required role
 * @param currentRole - The current role of the user
 * @param requiredRole - The required role of the user
 * @returns true if the current role is higher or equal to the required role, false otherwise
 */
export const hasHigherOrEqualRole = ({
  currentRole,
  requiredRole,
}: {
  currentRole: OrganizationMembership["role"];
  requiredRole: OrganizationMembership["role"];
}) => {
  const roleHierarchy = {
    user: 0,
    admin: 1,
    owner: 2,
  };

  return roleHierarchy[currentRole] >= roleHierarchy[requiredRole];
};
