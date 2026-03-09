"use server";

import { db } from "@/db";
import {
  churchContacts,
  families,
  contactTags,
  donations,
  pledges,
  appointments,
  prayerRequests,
  pipelineItems,
  pipelineStages,
  volunteers,
  volunteerShifts,
  ministryMembers,
  ministries,
} from "@/db/schema";
import { eq, and, ilike, or, desc, sql, sum, count } from "drizzle-orm";
import { requireOrgMembership } from "./utils";

// ── Contact Profile (full parallel fetch) ───────────────────────────────────

export async function getContactProfile(contactId: string, organizationId: string) {
  await requireOrgMembership(organizationId);
  const [contact] = await db
    .select()
    .from(churchContacts)
    .where(and(eq(churchContacts.id, contactId), eq(churchContacts.organizationId, organizationId)))
    .limit(1);

  if (!contact) {
    return {
      contact: null,
      tags: [],
      donations: [],
      pledges: [],
      appointments: [],
      prayer: [],
      pipeline: [],
      volunteer: null,
      shifts: [],
    };
  }

  const [
    tags,
    contactDonations,
    contactPledges,
    contactAppointments,
    contactPrayer,
    pipelineData,
    volunteerRecord,
    contactMinistries,
  ] = await Promise.all([
    db.select().from(contactTags).where(eq(contactTags.contactId, contactId)),
    db.select().from(donations)
      .where(and(eq(donations.contactId, contactId), eq(donations.organizationId, organizationId)))
      .orderBy(desc(donations.date)),
    db.select().from(pledges)
      .where(and(eq(pledges.contactId, contactId), eq(pledges.organizationId, organizationId)))
      .orderBy(desc(pledges.createdAt)),
    db.select().from(appointments)
      .where(and(eq(appointments.contactId, contactId), eq(appointments.organizationId, organizationId)))
      .orderBy(desc(appointments.dateTime)),
    db.select().from(prayerRequests)
      .where(and(eq(prayerRequests.contactId, contactId), eq(prayerRequests.organizationId, organizationId)))
      .orderBy(desc(prayerRequests.createdAt)),
    db.select({ item: pipelineItems, stage: pipelineStages })
      .from(pipelineItems)
      .leftJoin(pipelineStages, eq(pipelineItems.stageId, pipelineStages.id))
      .where(and(eq(pipelineItems.contactId, contactId), eq(pipelineItems.organizationId, organizationId)))
      .orderBy(desc(pipelineItems.updatedAt)),
    db.select().from(volunteers)
      .where(and(eq(volunteers.contactId, contactId), eq(volunteers.organizationId, organizationId)))
      .limit(1)
      .then(r => r[0] ?? null),
    db.select({ membership: ministryMembers, ministry: ministries })
      .from(ministryMembers)
      .innerJoin(ministries, eq(ministryMembers.ministryId, ministries.id))
      .where(eq(ministryMembers.contactId, contactId)),
  ]);

  // Volunteer shifts if a volunteer record exists
  const shifts = volunteerRecord
    ? await db.select().from(volunteerShifts)
        .where(eq(volunteerShifts.volunteerId, volunteerRecord.id))
        .orderBy(desc(volunteerShifts.date))
    : [];

  return {
    contact,
    tags,
    donations: contactDonations,
    pledges: contactPledges,
    appointments: contactAppointments,
    prayer: contactPrayer,
    pipeline: pipelineData,
    volunteer: volunteerRecord,
    shifts,
    ministries: contactMinistries,
  };
}

// ── CSV Import ──────────────────────────────────────────────────────────────

export type ImportContactRow = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  memberStatus?: string;
  source?: string;
  notes?: string;
};

export type ImportContactsResult = {
  inserted: number;
  updated: number;
  failed: number;
  errors: { row: number; message: string }[];
};

const VALID_STATUSES = new Set([
  "visitor", "prospect", "regular_attendee", "member", "leader", "inactive",
]);
const VALID_SOURCES = new Set([
  "walk_in", "website", "referral", "event", "social_media", "other",
]);

export async function importContacts(
  organizationId: string,
  rows: ImportContactRow[]
): Promise<ImportContactsResult> {
  await requireOrgMembership(organizationId);
  const result: ImportContactsResult = { inserted: 0, updated: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const firstName = row.firstName.trim();
      const lastName = row.lastName.trim();
      if (!firstName || !lastName) throw new Error("firstName and lastName are required");

      const email = row.email?.trim().toLowerCase() || null;
      const phone = row.phone?.replace(/\D/g, "") || null;
      const memberStatus = VALID_STATUSES.has(row.memberStatus ?? "")
        ? (row.memberStatus as any)
        : "visitor";
      const source = VALID_SOURCES.has(row.source ?? "")
        ? (row.source as any)
        : "other";
      const notes = row.notes?.trim() || null;

      // Upsert: match existing contact by email or phone within this org
      const matchClauses = [];
      if (email) matchClauses.push(eq(churchContacts.email, email));
      if (phone) matchClauses.push(eq(churchContacts.phone, phone));

      const existing =
        matchClauses.length > 0
          ? await db
              .select({ id: churchContacts.id })
              .from(churchContacts)
              .where(and(eq(churchContacts.organizationId, organizationId), or(...matchClauses)))
              .limit(1)
          : [];

      if (existing[0]) {
        await db
          .update(churchContacts)
          .set({ firstName, lastName, email, phone, memberStatus, source, notes, updatedAt: new Date() })
          .where(eq(churchContacts.id, existing[0].id));
        result.updated++;
      } else {
        await db.insert(churchContacts).values({
          firstName, lastName, email, phone, memberStatus, source, notes, organizationId,
        });
        result.inserted++;
      }
    } catch (err) {
      result.failed++;
      result.errors.push({
        row: i + 2, // +1 for header, +1 for 1-based row number
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return result;
}

const CONTACTS_PAGE_SIZE = 50;

export async function getContacts(
  orgId: string,
  filters?: { search?: string; status?: string },
  page = 1
) {
  await requireOrgMembership(orgId);
  const conditions: any[] = [eq(churchContacts.organizationId, orgId)];

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(churchContacts.firstName, searchTerm),
        ilike(churchContacts.lastName, searchTerm),
        ilike(churchContacts.email, searchTerm),
        ilike(churchContacts.phone, searchTerm)
      )
    );
  }

  if (filters?.status) {
    conditions.push(eq(churchContacts.memberStatus, filters.status as any));
  }

  const where = and(...conditions);
  const offset = (page - 1) * CONTACTS_PAGE_SIZE;

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(churchContacts).where(where).orderBy(desc(churchContacts.createdAt)).limit(CONTACTS_PAGE_SIZE).offset(offset),
    db.select({ total: count() }).from(churchContacts).where(where),
  ]);

  return {
    contacts: rows,
    total,
    page,
    pageSize: CONTACTS_PAGE_SIZE,
    pageCount: Math.ceil(total / CONTACTS_PAGE_SIZE),
  };
}

export async function getContact(id: string) {
  const [existing] = await db
    .select({ organizationId: churchContacts.organizationId })
    .from(churchContacts)
    .where(eq(churchContacts.id, id))
    .limit(1);

  if (!existing) {
    return null;
  }

  await requireOrgMembership(existing.organizationId);
  const [contact] = await db
    .select()
    .from(churchContacts)
    .where(and(eq(churchContacts.id, id), eq(churchContacts.organizationId, existing.organizationId)));
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
  await requireOrgMembership(data.organizationId);
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

  try {
    const { inngest } = await import("@/lib/inngest/client");
    const {
      INNGEST_EVENTS,
      buildContactCreatedIdempotencyKey,
    } = await import("@/lib/inngest/events");

    const idempotencyKey = buildContactCreatedIdempotencyKey({
      organizationId: data.organizationId,
      contactId: contact.id,
    });

    await inngest.send({
      id: idempotencyKey,
      name: INNGEST_EVENTS.CONTACT_CREATED,
      data: {
        organizationId: data.organizationId,
        contactId: contact.id,
        idempotencyKey,
      },
    });
  } catch (error) {
    console.error("[Contacts] Contact created but failed to enqueue post-create workflow", {
      contactId: contact.id,
      organizationId: data.organizationId,
      error,
    });
  }

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
  const [existing] = await db
    .select({ organizationId: churchContacts.organizationId })
    .from(churchContacts)
    .where(eq(churchContacts.id, id))
    .limit(1);
  if (!existing) throw new Error("Contact not found");
  await requireOrgMembership(existing.organizationId);

  const [contact] = await db
    .update(churchContacts)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(and(eq(churchContacts.id, id), eq(churchContacts.organizationId, existing.organizationId)))
    .returning();
  return contact;
}

export async function deleteContact(id: string) {
  const [existing] = await db
    .select({ organizationId: churchContacts.organizationId })
    .from(churchContacts)
    .where(eq(churchContacts.id, id))
    .limit(1);
  if (!existing) return;
  await requireOrgMembership(existing.organizationId);
  await db
    .delete(churchContacts)
    .where(and(eq(churchContacts.id, id), eq(churchContacts.organizationId, existing.organizationId)));
}

export async function getContactCount(orgId: string) {
  await requireOrgMembership(orgId);
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(churchContacts)
    .where(eq(churchContacts.organizationId, orgId));
  return result?.count ?? 0;
}
