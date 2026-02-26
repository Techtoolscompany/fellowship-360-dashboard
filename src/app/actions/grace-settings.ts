"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import { aiConfig } from "@/db/schema";
import { auth } from "@/auth";

export async function getGraceSettings(orgId: string) {
  const session = await auth();
  if (!session?.user || !orgId) throw new Error("Unauthorized");

  const settings = await db.query.aiConfig.findFirst({
    where: eq(aiConfig.organizationId, orgId),
  });

  return settings || null;
}

export async function updateGraceSettings(orgId: string, data: any) {
  const session = await auth();
  if (!session?.user || !orgId) throw new Error("Unauthorized");

  const existing = await db.query.aiConfig.findFirst({
    where: eq(aiConfig.organizationId, orgId),
  });

  if (existing) {
    await db.update(aiConfig).set({
        ...data,
        updatedAt: new Date(),
    }).where(eq(aiConfig.organizationId, orgId));
  } else {
    await db.insert(aiConfig).values({
      organizationId: orgId,
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return true;
}
