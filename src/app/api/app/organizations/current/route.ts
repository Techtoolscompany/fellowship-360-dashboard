import withAuthRequired from "@/lib/auth/withAuthRequired";
import { getSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { userBelongsToOrganization } from "@/lib/organizations/userBelongsToOrganization";
import {
  getUserOrganizationById,
  getUserOrganizations,
} from "@/lib/organizations/getUserOrganizations";

export const POST = withAuthRequired(async (req, context) => {
  const user = context.session.user;
  const { organizationId } = await req.json();

  const belongsToOrg = await userBelongsToOrganization(
    (await user).id,
    organizationId
  );

  if (!belongsToOrg) {
    return NextResponse.json(
      { error: "User does not belong to this organization" },
      { status: 403 }
    );
  }

  // Switch Organization in session
  const session = await getSession();
  session.currentOrganizationId = organizationId;
  await session.save();

  return NextResponse.json({ message: "Organization switched", success: true });
});

// Get current organization
export const GET = withAuthRequired(async (req, context) => {
  const user = await context.session.user;
  const session = await getSession();
  const organizationId = session.currentOrganizationId;

  // Cases
  // - No organization selected, select first organization
  // - User does not belong to organization, select first organization
  // - No first organization, return error

  const setAndReturnFirstOrganization = async () => {
    const organizations = await getUserOrganizations(user.id);
    if (organizations.length === 0) {
      return NextResponse.json(
        { error: "No organization selected" },
        { status: 400 }
      );
    }

    const selectedOrg = organizations[0];
    // Set first organization as current
    session.currentOrganizationId = selectedOrg.id;
    await session.save();
    const organizationWithPlan = await getUserOrganizationById(
      user.id,
      selectedOrg.id
    );
    return NextResponse.json(organizationWithPlan);
  };

  if (!organizationId) {
    return setAndReturnFirstOrganization();
  }

  // Get organization
  const organization = await getUserOrganizationById(user.id, organizationId);

  if (!organization) {
    return setAndReturnFirstOrganization();
  }

  return NextResponse.json(organization);
});
