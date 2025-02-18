import { OrganizationRole } from "@/db/schema";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { createInviteSchema } from "./schema";
import { db } from "@/db";
import { invitations } from "@/db/schema/invitation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

// Get all invites for the current organization
export const GET = withOrganizationAuthRequired(async (req, context) => {
  const currentOrganization = await context.session.organization;

  try {
    const invites = await db
      .select()
      .from(invitations)
      .where(eq(invitations.organizationId, currentOrganization.id));

    return NextResponse.json({
      invites,
      success: true,
    });
  } catch (error) {
    console.error("Failed to fetch invites:", error);
    return NextResponse.json(
      { message: "Failed to fetch invites", success: false },
      { status: 500 }
    );
  }
}, OrganizationRole.enum.admin);

// Create a new invite
export const POST = withOrganizationAuthRequired(async (req, context) => {
  const currentOrganization = await context.session.organization;
  const currentUser = await context.session.user;

  try {
    const { email, role } = createInviteSchema.parse(await req.json());

    const token = nanoid(32); // Generate a secure token for the invitation

    const invite = await db
      .insert(invitations)
      .values({
        email,
        role,
        organizationId: currentOrganization.id,
        invitedById: currentUser.id,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .returning();

    // TODO: Send invitation email with the token

    return NextResponse.json({
      invite: invite[0],
      success: true,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: error.message,
          success: false,
        },
        { status: 400 }
      );
    }

    console.error("Failed to create invite:", error);
    return NextResponse.json(
      { message: "Failed to create invite", success: false },
      { status: 500 }
    );
  }
}, OrganizationRole.enum.admin);