"use server";

import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import { aiConfig } from "@/db/schema";
import { organizationMemberships } from "@/db/schema/organization-membership";
import { auth } from "@/auth";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import * as z from "zod";

// Fields settable on update (all optional, never touch id/org/timestamps)
type AiConfigUpdate = Partial<
  Omit<InferSelectModel<typeof aiConfig>, "id" | "organizationId" | "createdAt" | "updatedAt">
>;

// Insert requires churchName; timestamps are handled by $defaultFn
type AiConfigInsert = Omit<InferInsertModel<typeof aiConfig>, "id" | "createdAt" | "updatedAt">;

const organizationIdSchema = z.string().trim().min(1);
const aiConfigUpdateSchema = z.object({
  customSystemPrompt: z.string().trim().nullable().optional(),
  churchName: z.string().trim().min(1).optional(),
  churchDenomination: z.string().trim().nullable().optional(),
  churchCity: z.string().trim().nullable().optional(),
  graceEnabled: z.boolean().optional(),
  proactiveMode: z.enum(["off", "quiet", "normal"]).optional(),
  internalGraceEnabled: z.boolean().optional(),
  publicGraceEnabled: z.boolean().optional(),
  publicWidgetEnabled: z.boolean().optional(),
  publicPhoneEnabled: z.boolean().optional(),
  isDemoOrganization: z.boolean().optional(),
  temperatureOverride: z.number().finite().nullable().optional(),
});

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
  const parsedOrgId = organizationIdSchema.parse(orgId);
  await requireOrgMembership(parsedOrgId);

  const settings = await db.query.aiConfig.findFirst({
    where: eq(aiConfig.organizationId, parsedOrgId),
  });

  return settings || null;
}

export async function updateGraceSettings(orgId: string, data: AiConfigUpdate) {
  const parsedOrgId = organizationIdSchema.parse(orgId);
  const parsedData = aiConfigUpdateSchema.parse(data);
  await requireOrgMembership(parsedOrgId);

  const existing = await db.query.aiConfig.findFirst({
    where: eq(aiConfig.organizationId, parsedOrgId),
  });

  if (existing) {
    await db
      .update(aiConfig)
      .set(parsedData)
      .where(eq(aiConfig.organizationId, parsedOrgId));
  } else {
    if (!parsedData.churchName) throw new Error("churchName is required when creating AI config");
    const insertValues: AiConfigInsert = {
      organizationId: parsedOrgId,
      churchName: parsedData.churchName,
      ...parsedData,
    };
    await db.insert(aiConfig).values(insertValues);
  }

  return true;
}
