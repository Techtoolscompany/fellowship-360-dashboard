import { describe, expect, it } from "vitest";
import {
  SUPER_ADMIN_ROLE_PERMISSIONS,
  getSuperAdminPermissionsForRole,
  hasSuperAdminPermission,
} from "@/lib/super-admin/permissions";

describe("super-admin permissions", () => {
  it("gives owners full platform permissions", () => {
    const ownerPermissions = getSuperAdminPermissionsForRole("owner");

    expect(ownerPermissions).toEqual([...SUPER_ADMIN_ROLE_PERMISSIONS.owner]);
    expect(ownerPermissions).toContain("manage_super_admin_team");
    expect(ownerPermissions).toContain("manage_devices");
    expect(ownerPermissions).toContain("manage_billing");
  });

  it("keeps finance scoped away from operations controls", () => {
    const financePermissions = getSuperAdminPermissionsForRole("finance");

    expect(financePermissions).toContain("manage_billing");
    expect(financePermissions).toContain("manage_coupons");
    expect(financePermissions).not.toContain("manage_devices");
    expect(financePermissions).not.toContain("deploy_automations");
  });

  it("checks single and multiple permission requirements", () => {
    const operatorPermissions = getSuperAdminPermissionsForRole("operator");

    expect(hasSuperAdminPermission(operatorPermissions, "manage_devices")).toBe(true);
    expect(
      hasSuperAdminPermission(operatorPermissions, [
        "manage_devices",
        "deploy_automations",
      ])
    ).toBe(true);
    expect(
      hasSuperAdminPermission(operatorPermissions, [
        "manage_devices",
        "manage_super_admin_team",
      ])
    ).toBe(false);
  });
});
