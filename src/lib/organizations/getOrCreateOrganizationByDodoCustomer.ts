import { db } from "@/db";
import { organizations } from "@/db/schema/organization";
import { createOrganization } from "./createOrganization";
import { eq } from "drizzle-orm";
import getOrCreateUser from "@/lib/users/getOrCreateUser";

/**
 * Gets or creates an organization associated with a Dodo customer
 * If an organization with the given Dodo customer ID exists, it returns that organization
 * If not, it creates a new organization for the user and associates it with the Dodo customer ID
 */
export const getOrCreateOrganizationByDodoCustomer = async ({
  dodoCustomerId,
  customerEmail,
  customerName,
}: {
  dodoCustomerId: string;
  customerEmail: string;
  customerName?: string | null;
}) => {
  // Check if an organization with this Dodo customer ID already exists
  const existingOrg = await db
    .select()
    .from(organizations)
    .where(eq(organizations.dodoCustomerId, dodoCustomerId))
    .limit(1)
    .then((res) => res[0]);

  if (existingOrg) {
    return {
      organization: existingOrg,
      created: false,
    };
  }

  // No organization found with this Dodo customer ID, so create one
  // First get or create the user
  const { user, created: userCreated } = await getOrCreateUser({
    emailId: customerEmail,
    name: customerName,
  });

  // Create a new organization for this user
  const orgName = customerName 
    ? `${customerName}'s Organization` 
    : `${customerEmail}'s Organization`;
    
  const organization = await createOrganization({
    name: orgName,
    userId: user.id,
  });

  // Update the organization with the Dodo customer ID
  const updatedOrg = await db
    .update(organizations)
    .set({
      dodoCustomerId: dodoCustomerId,
    })
    .where(eq(organizations.id, organization.id))
    .returning()
    .then((res) => res[0]);

  return {
    organization: updatedOrg,
    created: true,
    userCreated,
  };
};

export default getOrCreateOrganizationByDodoCustomer; 