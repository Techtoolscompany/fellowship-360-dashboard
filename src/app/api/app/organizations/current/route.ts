import { db } from "@/db";
import { organizationMemberships, organizations } from "@/db/schema";
import withAuthRequired from "@/lib/auth/withAuthRequired";
import { getSession } from "@/lib/session";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const POST = withAuthRequired(async (req, context) => {
  const user = context.session.user;

  const { organizationId } = await req.json();

  const organization = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, user.id),
        eq(organizationMemberships.organizationId, organizationId)
      )
    );

  if (organization.length === 0) {
    return NextResponse.json(
      { error: "User does not belong to this organization" },
      { status: 403 }
    );
  }

  //   Switch Organization in session
  const session = await getSession();
  session.currentOrganizationId = organizationId;
  await session.save();

  return NextResponse.json({ message: "Organization switched" });
});

// Get current organization
export const GET = withAuthRequired(async (req, context) => {
  const user = context.session.user;
  const session = await getSession();
  const organizationId = session.currentOrganizationId;

  if (!organizationId) {
    return NextResponse.json(
      { error: "No organization selected" },
      { status: 400 }
    );
  }

  const organization = await db
    .select()
    .from(organizations)
    .leftJoin(
      organizationMemberships,
      eq(organizations.id, organizationMemberships.organizationId)
    )
    .where(
      and(
        eq(organizationMemberships.userId, user.id),
        eq(organizationMemberships.organizationId, organizationId)
      )
    );

  return NextResponse.json(organization);
});
