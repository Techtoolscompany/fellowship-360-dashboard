import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { actionAuditLogs, organizations } from "@/db/schema";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import {
  ACCESS_SECTIONS,
  ACCESS_SECTION_METADATA,
  getOrganizationRoleAccessMatrix,
  normalizeRoleAccessMatrix,
  upsertOrganizationRoleAccessMatrix,
} from "@/lib/access/role-access";

const updateAccessSchema = z.object({
  matrix: z.object({
    owner: z.array(z.enum(ACCESS_SECTIONS)).optional(),
    admin: z.array(z.enum(ACCESS_SECTIONS)).optional(),
    user: z.array(z.enum(ACCESS_SECTIONS)).optional(),
  }),
});

async function assertOrganizationExists(organizationId: string) {
  const [organization] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    throw new Error("Organization not found");
  }
}

export const GET = withSuperAdminAuthRequired(async (_req, context) => {
  const { id } = (await context.params) as { id: string };

  try {
    await assertOrganizationExists(id);
    const matrix = await getOrganizationRoleAccessMatrix(id);

    return NextResponse.json({
      success: true,
      organizationId: id,
      matrix,
      sectionMetadata: ACCESS_SECTION_METADATA,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load organization access";
    const status = message === "Organization not found" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
});

export const PATCH = withSuperAdminAuthRequired(async (req, context) => {
  const { id } = (await context.params) as { id: string };

  try {
    await assertOrganizationExists(id);
    const body = updateAccessSchema.parse(await req.json());
    const normalized = normalizeRoleAccessMatrix(body.matrix);
    const matrix = await upsertOrganizationRoleAccessMatrix(id, normalized);
    const actor = await context.session.user;

    await db.insert(actionAuditLogs).values({
      organizationId: id,
      userId: actor.id,
      actionType: "update",
      entityName: "organization_role_access_policy",
      details: {
        actorScope: "super_admin",
        sectionCounts: {
          owner: matrix.owner.length,
          admin: matrix.admin.length,
          user: matrix.user.length,
        },
      },
    });

    return NextResponse.json({
      success: true,
      organizationId: id,
      matrix,
      sectionMetadata: ACCESS_SECTION_METADATA,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to update organization access";
    const status = message === "Organization not found" ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}, "manage_org_access");
