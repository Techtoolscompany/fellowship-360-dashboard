"use server";

import { db } from "@/db";
import { churchContacts, families, contactTags } from "@/db/schema";
import { eq, and, ilike, or, desc, sql } from "drizzle-orm";

export async function getContacts(
  orgId: string,
  filters?: { search?: string; status?: string }
) {
  let query = db
    .select()
    .from(churchContacts)
    .where(eq(churchContacts.organizationId, orgId))
    .orderBy(desc(churchContacts.createdAt));

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    query = db
      .select()
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.organizationId, orgId),
          or(
            ilike(churchContacts.firstName, searchTerm),
            ilike(churchContacts.lastName, searchTerm),
            ilike(churchContacts.email, searchTerm),
            ilike(churchContacts.phone, searchTerm)
          )
        )
      )
      .orderBy(desc(churchContacts.createdAt));
  }

  if (filters?.status) {
    query = db
      .select()
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.organizationId, orgId),
          eq(churchContacts.memberStatus, filters.status as any)
        )
      )
      .orderBy(desc(churchContacts.createdAt));
  }

  return await query;
}

export async function getContact(id: string) {
  const [contact] = await db
    .select()
    .from(churchContacts)
    .where(eq(churchContacts.id, id));
  return contact ?? null;
}

export async function createContact(data: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  memberStatus?: string;
  source?: string;
  familyId?: string;
  notes?: string;
  organizationId: string;
}) {
  const [contact] = await db
    .insert(churchContacts)
    .values({
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      memberStatus: (data.memberStatus as any) ?? "visitor",
      source: (data.source as any) ?? "walk_in",
      familyId: data.familyId ?? null,
      notes: data.notes ?? null,
      organizationId: data.organizationId,
    })
    .returning();
  return contact;
}

export async function updateContact(
  id: string,
  data: Partial<{
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    memberStatus: string;
    source: string;
    familyId: string | null;
    notes: string | null;
  }>
) {
  const [contact] = await db
    .update(churchContacts)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(eq(churchContacts.id, id))
    .returning();
  return contact;
}

export async function deleteContact(id: string) {
  await db.delete(churchContacts).where(eq(churchContacts.id, id));
}

export async function getContactCount(orgId: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(churchContacts)
    .where(eq(churchContacts.organizationId, orgId));
  return result?.count ?? 0;
}
