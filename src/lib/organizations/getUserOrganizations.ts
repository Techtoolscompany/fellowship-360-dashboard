import { db } from "@/db";
import { organizations } from "@/db/schema/organization";
import { organizationMemberships } from "@/db/schema/organization-membership";
import { eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

type Organization = InferSelectModel<typeof organizations>;
type OrganizationMembership = InferSelectModel<typeof organizationMemberships>;

export type UserOrganization = Pick<Organization, "id" | "name" | "slug" | "image" | "onboardingDone"> & {
  role: OrganizationMembership["role"];
};

export const getUserOrganizations = async (userId: string): Promise<UserOrganization[]> => {
  const userOrgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      image: organizations.image,
      role: organizationMemberships.role,
      onboardingDone: organizations.onboardingDone,
    })
    .from(organizationMemberships)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMemberships.organizationId)
    )
    .where(eq(organizationMemberships.userId, userId));

  return userOrgs.map(org => ({
    ...org,
    onboardingDone: org.onboardingDone ?? false
  }));
};
