import { db } from "@/db";
import { organizations } from "@/db/schema/organization";
import { organizationMemberships } from "@/db/schema/organization-membership";
import { plans } from "@/db/schema/plans";
import { and, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

type Organization = InferSelectModel<typeof organizations>;
type OrganizationMembership = InferSelectModel<typeof organizationMemberships>;

export type UserOrganization = Pick<
  Organization,
  "id" | "name" | "slug" | "image" | "onboardingDone" | "credits"
> & {
  role: OrganizationMembership["role"];
};

export type UserOrganizationWithPlan = UserOrganization & {
  plan: Pick<
    InferSelectModel<typeof plans>,
    "id" | "name" | "default" | "codename" | "quotas" | "requiredCouponCount"
  > | null;
};

export const getUserOrganizations = async (
  userId: string
): Promise<UserOrganization[]> => {
  const userOrgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      image: organizations.image,
      role: organizationMemberships.role,
      onboardingDone: organizations.onboardingDone,
      credits: organizations.credits,
    })
    .from(organizationMemberships)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMemberships.organizationId)
    )
    .where(eq(organizationMemberships.userId, userId));

  return userOrgs.map((org) => ({
    ...org,
    onboardingDone: org.onboardingDone ?? false,
  }));
};

export const getUserOrganizationById = async (
  userId: string,
  organizationId: string
): Promise<UserOrganizationWithPlan | undefined> => {
  const [organization] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      image: organizations.image,
      role: organizationMemberships.role,
      onboardingDone: organizations.onboardingDone,
      planId: organizations.planId,
      credits: organizations.credits,
    })
    .from(organizationMemberships)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMemberships.organizationId)
    )
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizations.id, organizationId)
      )
    );

  if (!organization) {
    return undefined;
  }

  if (!organization.planId) {
    return {
      ...organization,
      plan: null,
    };
  }

  const plan = await db
    .select({
      id: plans.id,
      name: plans.name,
      default: plans.default,
      codename: plans.codename,
      quotas: plans.quotas,
      requiredCouponCount: plans.requiredCouponCount,
    })
    .from(plans)
    .where(eq(plans.id, organization.planId))
    .limit(1)
    .then((res) => res[0]);

  return {
    ...organization,
    plan: plan,
  };
};
