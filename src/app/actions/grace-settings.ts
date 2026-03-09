"use server";

import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import { aiConfig } from "@/db/schema";
import { organizationMemberships } from "@/db/schema/organization-membership";
import { auth } from "@/auth";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

// Fields settable on update (all optional, never touch id/org/timestamps)
type AiConfigUpdate = Partial<
  Omit<InferSelectModel<typeof aiConfig>, "id" | "organizationId" | "createdAt" | "updatedAt">
>;

// Insert requires churchName; timestamps are handled by $defaultFn
type AiConfigInsert = Omit<InferInsertModel<typeof aiConfig>, "id" | "createdAt" | "updatedAt">;

async function requireOrgMembership(organizationId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const [member] = await db
    .select({ role: organizationMemberships.role })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, session.user.id),
        eq(organizationMemberships.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!member) throw new Error("Forbidden");
  return { userId: session.user.id, role: member.role };
}

export async function getGraceSettings(orgId: string) {
  await requireOrgMembership(orgId);

  const settings = await db.query.aiConfig.findFirst({
    where: eq(aiConfig.organizationId, orgId),
  });

  return settings || null;
}

export async function updateGraceSettings(orgId: string, data: AiConfigUpdate) {
  await requireOrgMembership(orgId);

  const existing = await db.query.aiConfig.findFirst({
    where: eq(aiConfig.organizationId, orgId),
  });

  if (existing) {
    await db
      .update(aiConfig)
      .set(data)
      .where(eq(aiConfig.organizationId, orgId));
  } else {
    if (!data.churchName) throw new Error("churchName is required when creating AI config");
    const insertValues: AiConfigInsert = {
      organizationId: orgId,
      churchName: data.churchName,
      ...data,
    };
    await db.insert(aiConfig).values(insertValues);
  }

  return true;
}
