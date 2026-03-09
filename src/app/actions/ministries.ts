"use server";

import { db } from "@/db";
import { ministries, ministryMembers, churchContacts } from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { requireOrgMembership, auditAction } from "./utils";
import * as z from "zod";

export async function getMinistries(orgId: string) {
  await requireOrgMembership(orgId);
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
  const [min] = await db.select().from(ministries).where(eq(ministries.id, ministryId));
  if (!min) throw new Error("Ministry not found");
  await requireOrgMembership(min.organizationId);

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
  const parsed = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    meetingDay: z.string().optional(),
    meetingTime: z.string().optional(),
    meetingLocation: z.string().optional(),
    leaderId: z.string().optional(),
    organizationId: z.string().min(1),
  }).parse(data);

  const session = await requireOrgMembership(parsed.organizationId);
  const [ministry] = await db
    .insert(ministries)
    .values({
      name: parsed.name,
      description: parsed.description ?? null,
      meetingDay: parsed.meetingDay ?? null,
      meetingTime: parsed.meetingTime ?? null,
      meetingLocation: parsed.meetingLocation ?? null,
      leaderId: parsed.leaderId ?? null,
      organizationId: parsed.organizationId,
    })
    .returning();

  await auditAction({
    organizationId: parsed.organizationId,
    userId: session.userId,
    actionType: "create",
    entityName: "ministry",
    entityId: ministry.id,
    details: { leaderId: parsed.leaderId }
  });

  return ministry;
}

export async function updateMinistry(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    meetingDay: string | null;
    meetingTime: string | null;
    meetingLocation: string | null;
    leaderId: string | null;
  }>
) {
  const parsed = z.object({
    name: z.string().optional(),
    description: z.string().nullable().optional(),
    meetingDay: z.string().nullable().optional(),
    meetingTime: z.string().nullable().optional(),
    meetingLocation: z.string().nullable().optional(),
    leaderId: z.string().nullable().optional(),
  }).parse(data);

  const [existing] = await db.select().from(ministries).where(eq(ministries.id, id));
  if (!existing) throw new Error("Ministry not found");
  const session = await requireOrgMembership(existing.organizationId);

  const [ministry] = await db
    .update(ministries)
    .set({ ...parsed, updatedAt: new Date() } as any)
    .where(eq(ministries.id, id))
    .returning();

  await auditAction({
    organizationId: existing.organizationId,
    userId: session.userId,
    actionType: "update",
    entityName: "ministry",
    entityId: ministry.id,
    details: { updatedFields: Object.keys(data) }
  });

  return ministry;
}

export async function addMinistryMember(
  ministryId: string,
  contactId: string,
  role?: string
) {
  const parsed = z.object({
    ministryId: z.string().min(1),
    contactId: z.string().min(1),
    role: z.string().optional(),
  }).parse({ ministryId, contactId, role });

  const [min] = await db.select().from(ministries).where(eq(ministries.id, parsed.ministryId));
  if (!min) throw new Error("Ministry not found");
  const session = await requireOrgMembership(min.organizationId);

  const [member] = await db
    .insert(ministryMembers)
    .values({
      ministryId: parsed.ministryId,
      contactId: parsed.contactId,
      role: (parsed.role as any) ?? "member",
    })
    .returning();

  await auditAction({
    organizationId: min.organizationId,
    userId: session.userId,
    actionType: "create",
    entityName: "ministry_member",
    entityId: member.id,
    details: { contactId: parsed.contactId, role: parsed.role }
  });

  return member;
}

export async function removeMinistryMember(id: string) {
  const [mem] = await db.select().from(ministryMembers).where(eq(ministryMembers.id, id));
  if (!mem) throw new Error("Member not found");
  const [min] = await db.select().from(ministries).where(eq(ministries.id, mem.ministryId));
  if (min) {
    const session = await requireOrgMembership(min.organizationId);
    await db.delete(ministryMembers).where(eq(ministryMembers.id, id));

    await auditAction({
      organizationId: min.organizationId,
      userId: session.userId,
      actionType: "delete",
      entityName: "ministry_member",
      entityId: id,
      details: { contactId: mem.contactId, ministryId: min.id }
    });
  } else {
    await db.delete(ministryMembers).where(eq(ministryMembers.id, id));
  }
}

export async function deleteMinistry(id: string) {
  const [existing] = await db.select().from(ministries).where(eq(ministries.id, id));
  if (existing) {
    const session = await requireOrgMembership(existing.organizationId);
    await db.delete(ministries).where(eq(ministries.id, id));

    await auditAction({
      organizationId: existing.organizationId,
      userId: session.userId,
      actionType: "delete",
      entityName: "ministry",
      entityId: id
    });
  }
}
