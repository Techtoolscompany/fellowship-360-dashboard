export const SUPER_ADMIN_ROLES = ["owner", "operator", "support", "finance"] as const;
export type SuperAdminRole = (typeof SUPER_ADMIN_ROLES)[number];

export const SUPER_ADMIN_MEMBERSHIP_STATUSES = [
  "active",
  "suspended",
  "revoked",
] as const;
export type SuperAdminMembershipStatus =
  (typeof SUPER_ADMIN_MEMBERSHIP_STATUSES)[number];

export const SUPER_ADMIN_INVITATION_STATUSES = [
  "pending",
  "accepted",
  "revoked",
  "expired",
] as const;
export type SuperAdminInvitationStatus =
  (typeof SUPER_ADMIN_INVITATION_STATUSES)[number];

export const SUPER_ADMIN_PERMISSIONS = [
  "manage_super_admin_team",
  "impersonate_users",
  "manage_organizations",
  "manage_org_access",
  "manage_integrations",
  "manage_devices",
  "manage_plans",
  "manage_billing",
  "manage_coupons",
  "manage_messages",
  "manage_waitlist",
  "deploy_automations",
  "manage_users",
] as const;
export type SuperAdminPermission = (typeof SUPER_ADMIN_PERMISSIONS)[number];

export const SUPER_ADMIN_ROLE_LABELS: Record<SuperAdminRole, string> = {
  owner: "Owner",
  operator: "Operator",
  support: "Support",
  finance: "Finance",
};

export const SUPER_ADMIN_ROLE_DESCRIPTIONS: Record<SuperAdminRole, string> = {
  owner: "Full platform control including staff management and destructive actions.",
  operator: "Runs church operations, deployments, integrations, and device assignment.",
  support: "Handles inbox, waitlist, and read-only oversight without platform control.",
  finance: "Owns plans, billing, coupons, and commercial controls.",
};

export const SUPER_ADMIN_STATUS_LABELS: Record<SuperAdminMembershipStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  revoked: "Revoked",
};

export const SUPER_ADMIN_INVITE_STATUS_LABELS: Record<SuperAdminInvitationStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  revoked: "Revoked",
  expired: "Expired",
};

export const SUPER_ADMIN_ROLE_PERMISSIONS: Record<
  SuperAdminRole,
  readonly SuperAdminPermission[]
> = {
  owner: SUPER_ADMIN_PERMISSIONS,
  operator: [
    "impersonate_users",
    "manage_organizations",
    "manage_org_access",
    "manage_integrations",
    "manage_devices",
    "manage_messages",
    "manage_waitlist",
    "deploy_automations",
    "manage_users",
  ],
  support: ["manage_messages", "manage_waitlist"],
  finance: ["manage_plans", "manage_billing", "manage_coupons"],
};

export function getSuperAdminPermissionsForRole(
  role: SuperAdminRole
): SuperAdminPermission[] {
  return [...SUPER_ADMIN_ROLE_PERMISSIONS[role]];
}

export function hasSuperAdminPermission(
  permissions: readonly SuperAdminPermission[],
  required: SuperAdminPermission | readonly SuperAdminPermission[]
) {
  const requiredPermissions = Array.isArray(required) ? required : [required];
  return requiredPermissions.every((permission) => permissions.includes(permission));
}
