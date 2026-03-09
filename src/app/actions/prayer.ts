"use server";

import { db } from "@/db";
import { prayerRequests } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireOrgMembership } from "./utils";

export async function getPrayerRequests(
  orgId: string,
  filters?: { status?: string; urgency?: string }
) {
  await requireOrgMembership(orgId);
  if (filters?.status) {
    return await db
      .select()
      .from(prayerRequests)
      .where(
        and(
          eq(prayerRequests.organizationId, orgId),
          eq(prayerRequests.status, filters.status as any)
        )
      )
      .orderBy(desc(prayerRequests.createdAt));
  }
  return await db
    .select()
    .from(prayerRequests)
    .where(eq(prayerRequests.organizationId, orgId))
    .orderBy(desc(prayerRequests.createdAt));
}

export async function createPrayerRequest(data: {
  contactId?: string;
  contactName?: string;
  content: string;
  urgency?: string;
  isAnonymous?: boolean;
  organizationId: string;
}) {
  await requireOrgMembership(data.organizationId);
  const [request] = await db
    .insert(prayerRequests)
    .values({
      contactId: data.contactId ?? null,
      contactName: data.contactName ?? null,
      content: data.content,
      urgency: (data.urgency as any) ?? "normal",
      isAnonymous: data.isAnonymous ? "true" : "false",
      organizationId: data.organizationId,
    })
    .returning();
  return request;
}

export async function updatePrayerRequest(
  id: string,
  data: Partial<{
    contactId: string | null;
    contactName: string | null;
    content: string;
    isAnonymous: boolean | string;
    status: string;
    urgency: string;
    assignedTeam: string | null;
    response: string | null;
  }>
) {
  const [existing] = await db
    .select({ organizationId: prayerRequests.organizationId })
    .from(prayerRequests)
    .where(eq(prayerRequests.id, id))
    .limit(1);
  if (!existing) throw new Error("Prayer request not found");
  await requireOrgMembership(existing.organizationId);

  const normalized = { ...data } as Record<string, unknown>;
  if (typeof normalized.isAnonymous === "boolean") {
    normalized.isAnonymous = normalized.isAnonymous ? "true" : "false";
  }

  const [request] = await db
    .update(prayerRequests)
    .set({ ...normalized, updatedAt: new Date() } as any)
    .where(and(eq(prayerRequests.id, id), eq(prayerRequests.organizationId, existing.organizationId)))
    .returning();
  return request;
}

export async function deletePrayerRequest(id: string) {
  const [existing] = await db
    .select({ organizationId: prayerRequests.organizationId })
    .from(prayerRequests)
    .where(eq(prayerRequests.id, id))
    .limit(1);
  if (!existing) return;
  await requireOrgMembership(existing.organizationId);
  await db
    .delete(prayerRequests)
    .where(and(eq(prayerRequests.id, id), eq(prayerRequests.organizationId, existing.organizationId)));
}
