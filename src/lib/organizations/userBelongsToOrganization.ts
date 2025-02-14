import { db } from "@/db";
import { organizationMemberships } from "@/db/schema/organization-membership";
import { and, eq } from "drizzle-orm";

export const userBelongsToOrganization = async (
  userId: string,
  organizationId: string
): Promise<boolean> => {
  const membership = await db
    .select({ id: organizationMemberships.userId })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, userId),
        eq(organizationMemberships.organizationId, organizationId)
      )
    )
    .limit(1);

  return membership.length > 0;
};
