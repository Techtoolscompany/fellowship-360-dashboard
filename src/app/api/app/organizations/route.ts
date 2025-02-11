import withAuthRequired from "@/lib/auth/withAuthRequired";
import { organizations, organizationMemberships } from "@/db/schema";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { kebabCase } from "lodash";

const createOrganizationSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
});

export const POST = withAuthRequired(async (req, context) => {
  try {
    const { session } = context;
    const json = await req.json();
    const body = createOrganizationSchema.parse(json);

    // Create a unique slug from the name
    const baseSlug = kebabCase(body.name);
    let slug = baseSlug;
    let counter = 1;

    // Keep checking until we find a unique slug
    while (true) {
      const existing = await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug));
      if (!existing) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Create the organization
    const [organization] = await db
      .insert(organizations)
      .values({
        name: body.name,
        slug,
      })
      .returning();

    // Add the creator as an owner
    await db.insert(organizationMemberships).values({
      organizationId: organization.id,
      userId: session.user.id,
      role: "owner",
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error creating organization:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
});

export const PUT = withAuthRequired(async (req, context) => {
  // Update an organization
  // Name
  // Image
});
export const GET = withAuthRequired(async (req, context) => {
  // List of all organizations for the user
});