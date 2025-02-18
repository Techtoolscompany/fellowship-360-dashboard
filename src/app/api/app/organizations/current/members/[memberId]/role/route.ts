import { OrganizationRole, organizationMemberships } from "@/db/schema";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { db } from "@/db";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const updateRoleSchema = z.object({
  role: z.enum([OrganizationRole.enum.user, OrganizationRole.enum.admin]),
});

export const PATCH = withOrganizationAuthRequired(async (req, context) => {
  const currentOrganization = await context.session.organization;
  const params = await context.params;
  const memberId = params.memberId as string;

  try {
    const { role } = updateRoleSchema.parse(await req.json());

    // Check if the target member exists and is not the owner
    const targetMember = await db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.userId, memberId),
          eq(organizationMemberships.organizationId, currentOrganization.id)
        )
      )
      .limit(1)
      .then((members) => members[0]);

    if (!targetMember) {
      return NextResponse.json(
        { message: "Member not found", success: false },
        { status: 404 }
      );
    }

    if (targetMember.role === OrganizationRole.enum.owner) {
      return NextResponse.json(
        { message: "Cannot change owner's role", success: false },
        { status: 403 }
      );
    }

    // Update the role
    await db
      .update(organizationMemberships)
      .set({ role })
      .where(
        and(
          eq(organizationMemberships.userId, memberId),
          eq(organizationMemberships.organizationId, currentOrganization.id)
        )
      );

    return NextResponse.json({
      message: "Role updated successfully",
      success: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          message: error.message,
          success: false,
        },
        { status: 400 }
      );
    }

    console.error("Failed to update role:", error);
    return NextResponse.json(
      { message: "Failed to update role", success: false },
      { status: 500 }
    );
  }
}, OrganizationRole.enum.owner);
