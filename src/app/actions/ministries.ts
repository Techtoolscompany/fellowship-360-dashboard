"use server";

import { db } from "@/db";
import { ministries, ministryMembers, churchContacts } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export async function getMinistries(orgId: string) {
  const result = await db
    .select({
      ministry: ministries,
      memberCount: sql<number>`count(${ministryMembers.id})`,
    })
    .from(ministries)
    .leftJoin(ministryMembers, eq(ministries.id, ministryMembers.ministryId))
    .where(eq(ministries.organizationId, orgId))
    .groupBy(ministries.id)
    .orderBy(ministries.name);
  return result;
}

export async function getMinistryMembers(ministryId: string) {
  return await db
    .select({ member: ministryMembers, contact: churchContacts })
    .from(ministryMembers)
    .leftJoin(churchContacts, eq(ministryMembers.contactId, churchContacts.id))
    .where(eq(ministryMembers.ministryId, ministryId));
}

export async function createMinistry(data: {
  name: string;
  description?: string;
  meetingDay?: string;
  meetingTime?: string;
  meetingLocation?: string;
  leaderId?: string;
  organizationId: string;
}) {
  const [ministry] = await db
    .insert(ministries)
    .values({
      name: data.name,
      description: data.description ?? null,
      meetingDay: data.meetingDay ?? null,
      meetingTime: data.meetingTime ?? null,
      meetingLocation: data.meetingLocation ?? null,
      leaderId: data.leaderId ?? null,
      organizationId: data.organizationId,
    })
    .returning();
  return ministry;
}

export async function addMinistryMember(
  ministryId: string,
  contactId: string,
  role?: string
) {
  const [member] = await db
    .insert(ministryMembers)
    .values({
      ministryId,
      contactId,
      role: (role as any) ?? "member",
    })
    .returning();
  return member;
}

export async function removeMinistryMember(id: string) {
  await db.delete(ministryMembers).where(eq(ministryMembers.id, id));
}

export async function deleteMinistry(id: string) {
  await db.delete(ministries).where(eq(ministries.id, id));
}
