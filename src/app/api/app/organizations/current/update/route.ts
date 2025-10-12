import { OrganizationRole, organizations } from "@/db/schema";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import updateOrganizationSchema from "./schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { ZodError } from "zod";

export const PATCH = withOrganizationAuthRequired(async (req, context) => {
  const currentOrganization = await context.session.organization;
  try {
    const { name, image } = updateOrganizationSchema.parse(await req.json());

    await db
      .update(organizations)
      .set({ name, image: image ?? currentOrganization.image })
      .where(eq(organizations.id, currentOrganization.id));

    return NextResponse.json({
      message: "Organization updated",
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

    return NextResponse.json(
      { message: "Failed to update organization", success: false },
      { status: 500 }
    );
  }
}, OrganizationRole.enum.admin);
