"use server";

import { db } from "@/db";
import { prayerRequests } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function getPrayerRequests(
  orgId: string,
  filters?: { status?: string; urgency?: string }
) {
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
    status: string;
    urgency: string;
    assignedTeam: string | null;
    response: string | null;
  }>
) {
  const [request] = await db
    .update(prayerRequests)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(eq(prayerRequests.id, id))
    .returning();
  return request;
}

export async function deletePrayerRequest(id: string) {
  await db.delete(prayerRequests).where(eq(prayerRequests.id, id));
}
