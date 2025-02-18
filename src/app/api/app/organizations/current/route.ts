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

  if (!organizationId) {
    // Get first organization
    const organizations = await getUserOrganizations(user.id);
    if (organizations.length === 0) {
      return NextResponse.json(
        { error: "No organization selected" },
        { status: 400 }
      );
    }
    // Set first organization as current
    session.currentOrganizationId = organizations[0].id;
    await session.save();
    const organizationWithPlan = await getUserOrganizationById(
      user.id,
      organizations[0].id
    );
    return NextResponse.json(organizationWithPlan);
  }

  // Get organization
  const organization = await getUserOrganizationById(user.id, organizationId);

  if (!organization) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 }
    );
  }

  return NextResponse.json(organization);
});
