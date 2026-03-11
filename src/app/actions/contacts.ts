"use server";

import { db } from "@/db";
import {
  churchContacts,
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
  conversations,
  graceSessions,
  graceMessages,
  graceCalls,
  graceMemory,
  graceHandoffs,
  graceFollowupProposals,
  graceContactMatchAudit,
  serviceSchedulingProfiles,
} from "@/db/schema";
import { eq, and, ilike, or, desc, sql, count, inArray, ne } from "drizzle-orm";
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
const VALID_ACTIVE_STATUSES = new Set([
  "visitor",
  "prospect",
  "regular_attendee",
  "member",
  "leader",
]);

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function normalizePhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits || null;
}

async function findContactDuplicateByIdentifiers(params: {
  organizationId: string;
  email?: string | null;
  phone?: string | null;
  excludeContactId?: string;
}) {
  const normalizedEmail = normalizeEmail(params.email);
  const normalizedPhone = normalizePhone(params.phone);

  const matchClauses = [];
  if (normalizedEmail) {
    matchClauses.push(eq(churchContacts.email, normalizedEmail));
  }
  if (normalizedPhone) {
    matchClauses.push(eq(churchContacts.phone, normalizedPhone));
  }
  if (matchClauses.length === 0) {
    return null;
  }

  const where = params.excludeContactId
    ? and(
        eq(churchContacts.organizationId, params.organizationId),
        ne(churchContacts.id, params.excludeContactId),
        or(...matchClauses)
      )
    : and(eq(churchContacts.organizationId, params.organizationId), or(...matchClauses));

  const [duplicate] = await db
    .select({
      id: churchContacts.id,
      email: churchContacts.email,
      phone: churchContacts.phone,
    })
    .from(churchContacts)
    .where(where)
    .limit(1);

  if (!duplicate) {
    return null;
  }

  const matchReasons: Array<"email" | "phone"> = [];
  if (normalizedEmail && normalizeEmail(duplicate.email) === normalizedEmail) {
    matchReasons.push("email");
  }
  if (normalizedPhone && normalizePhone(duplicate.phone) === normalizedPhone) {
    matchReasons.push("phone");
  }

  return {
    duplicate,
    matchReasons,
  };
}

function mergeNotes(primary: string | null, duplicate: string | null) {
  if (!primary && !duplicate) return null;
  if (!primary) return duplicate;
  if (!duplicate) return primary;
  if (primary.trim() === duplicate.trim()) return primary;
  return `${primary}\n\nMerged note:\n${duplicate}`;
}

async function requireContactAccess(contactId: string) {
  const [contact] = await db
    .select({
      id: churchContacts.id,
      organizationId: churchContacts.organizationId,
    })
    .from(churchContacts)
    .where(eq(churchContacts.id, contactId))
    .limit(1);
  if (!contact) throw new Error("Contact not found");
  await requireOrgMembership(contact.organizationId);
  return contact;
}

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

  const normalizedEmail = normalizeEmail(data.email);
  const normalizedPhone = normalizePhone(data.phone);
  const duplicate = await findContactDuplicateByIdentifiers({
    organizationId: data.organizationId,
    email: normalizedEmail,
    phone: normalizedPhone,
  });
  if (duplicate) {
    throw new Error(
      `Potential duplicate detected (${duplicate.matchReasons.join(" + ")}). Merge with contact ${duplicate.duplicate.id} or update identifiers.`
    );
  }

  const [contact] = await db
    .insert(churchContacts)
    .values({
      firstName: data.firstName,
      lastName: data.lastName,
      email: normalizedEmail,
      phone: normalizedPhone,
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
  const existing = await requireContactAccess(id);

  const normalizedEmail =
    data.email !== undefined ? normalizeEmail(data.email) : undefined;
  const normalizedPhone =
    data.phone !== undefined ? normalizePhone(data.phone) : undefined;

  const duplicate = await findContactDuplicateByIdentifiers({
    organizationId: existing.organizationId,
    email: normalizedEmail,
    phone: normalizedPhone,
    excludeContactId: id,
  });
  if (duplicate) {
    throw new Error(
      `Potential duplicate detected (${duplicate.matchReasons.join(" + ")}). Merge with contact ${duplicate.duplicate.id} or adjust identifiers.`
    );
  }

  const [contact] = await db
    .update(churchContacts)
    .set({
      ...data,
      ...(normalizedEmail !== undefined && { email: normalizedEmail }),
      ...(normalizedPhone !== undefined && { phone: normalizedPhone }),
      updatedAt: new Date(),
    } as any)
    .where(and(eq(churchContacts.id, id), eq(churchContacts.organizationId, existing.organizationId)))
    .returning();
  return contact;
}

export async function archiveContact(id: string) {
  const existing = await requireContactAccess(id);
  const [contact] = await db
    .update(churchContacts)
    .set({
      memberStatus: "inactive",
      updatedAt: new Date(),
    } as any)
    .where(and(eq(churchContacts.id, id), eq(churchContacts.organizationId, existing.organizationId)))
    .returning();
  return contact;
}

export async function restoreContact(id: string, status: string = "visitor") {
  if (!VALID_ACTIVE_STATUSES.has(status)) {
    throw new Error("Invalid restore status");
  }
  const existing = await requireContactAccess(id);
  const [contact] = await db
    .update(churchContacts)
    .set({
      memberStatus: status as any,
      updatedAt: new Date(),
    } as any)
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

export type ContactDuplicateCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  memberStatus: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ContactDuplicateGroup = {
  key: string;
  reason: "email" | "phone" | "name";
  contacts: ContactDuplicateCandidate[];
};

export async function findPotentialDuplicateContacts(orgId: string): Promise<ContactDuplicateGroup[]> {
  await requireOrgMembership(orgId);

  const rows = await db
    .select({
      id: churchContacts.id,
      firstName: churchContacts.firstName,
      lastName: churchContacts.lastName,
      email: churchContacts.email,
      phone: churchContacts.phone,
      memberStatus: churchContacts.memberStatus,
      createdAt: churchContacts.createdAt,
      updatedAt: churchContacts.updatedAt,
    })
    .from(churchContacts)
    .where(eq(churchContacts.organizationId, orgId))
    .orderBy(desc(churchContacts.updatedAt));

  const emailMap = new Map<string, ContactDuplicateCandidate[]>();
  const phoneMap = new Map<string, ContactDuplicateCandidate[]>();
  const nameMap = new Map<string, ContactDuplicateCandidate[]>();

  for (const row of rows) {
    const entry: ContactDuplicateCandidate = {
      ...row,
      memberStatus: row.memberStatus,
    };
    const email = normalizeEmail(row.email);
    const phone = normalizePhone(row.phone);
    const nameKey = `${row.firstName.trim().toLowerCase()}|${row.lastName.trim().toLowerCase()}`;

    if (email) {
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email)!.push(entry);
    }

    if (phone) {
      if (!phoneMap.has(phone)) phoneMap.set(phone, []);
      phoneMap.get(phone)!.push(entry);
    }

    if (nameKey !== "|") {
      if (!nameMap.has(nameKey)) nameMap.set(nameKey, []);
      nameMap.get(nameKey)!.push(entry);
    }
  }

  const groups: ContactDuplicateGroup[] = [];
  const seen = new Set<string>();
  const addGroups = (
    source: Map<string, ContactDuplicateCandidate[]>,
    reason: ContactDuplicateGroup["reason"]
  ) => {
    for (const [key, matches] of source.entries()) {
      if (matches.length < 2) continue;
      const dedupeKey = `${reason}:${key}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      groups.push({
        key,
        reason,
        contacts: matches,
      });
    }
  };

  addGroups(emailMap, "email");
  addGroups(phoneMap, "phone");
  addGroups(nameMap, "name");

  return groups.sort((a, b) => b.contacts.length - a.contacts.length);
}

type MergeContactsInput = {
  primaryContactId: string;
  duplicateContactId: string;
};

export async function mergeContacts(input: MergeContactsInput) {
  const primaryAccess = await requireContactAccess(input.primaryContactId);
  const duplicateAccess = await requireContactAccess(input.duplicateContactId);

  if (input.primaryContactId === input.duplicateContactId) {
    throw new Error("Primary and duplicate contact must be different");
  }
  if (primaryAccess.organizationId !== duplicateAccess.organizationId) {
    throw new Error("Contacts must belong to the same organization");
  }

  const organizationId = primaryAccess.organizationId;

  return await db.transaction(async (tx) => {
    const [primary] = await tx
      .select()
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.id, input.primaryContactId),
          eq(churchContacts.organizationId, organizationId)
        )
      )
      .limit(1);
    const [duplicate] = await tx
      .select()
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.id, input.duplicateContactId),
          eq(churchContacts.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!primary || !duplicate) {
      throw new Error("Contact not found");
    }

    const mergedPreferredStatus =
      primary.memberStatus === "inactive" && duplicate.memberStatus !== "inactive"
        ? duplicate.memberStatus
        : primary.memberStatus;

    const [updatedPrimary] = await tx
      .update(churchContacts)
      .set({
        firstName: primary.firstName || duplicate.firstName,
        lastName: primary.lastName || duplicate.lastName,
        email: normalizeEmail(primary.email) ?? normalizeEmail(duplicate.email),
        phone: normalizePhone(primary.phone) ?? normalizePhone(duplicate.phone),
        memberStatus: mergedPreferredStatus as any,
        source: primary.source ?? duplicate.source,
        familyId: primary.familyId ?? duplicate.familyId,
        avatarUrl: primary.avatarUrl ?? duplicate.avatarUrl,
        dateOfBirth: primary.dateOfBirth ?? duplicate.dateOfBirth,
        firstVisitDate: primary.firstVisitDate ?? duplicate.firstVisitDate,
        notes: mergeNotes(primary.notes, duplicate.notes),
        updatedAt: new Date(),
      } as any)
      .where(eq(churchContacts.id, input.primaryContactId))
      .returning();

    const primaryTags = await tx
      .select({ tag: contactTags.tag })
      .from(contactTags)
      .where(eq(contactTags.contactId, input.primaryContactId));
    const primaryTagValues = Array.from(new Set(primaryTags.map((row) => row.tag)));

    if (primaryTagValues.length > 0) {
      await tx
        .delete(contactTags)
        .where(
          and(
            eq(contactTags.contactId, input.duplicateContactId),
            inArray(contactTags.tag, primaryTagValues)
          )
        );
    }
    await tx
      .update(contactTags)
      .set({ contactId: input.primaryContactId })
      .where(eq(contactTags.contactId, input.duplicateContactId));

    const primaryMinistryMemberships = await tx
      .select({ ministryId: ministryMembers.ministryId })
      .from(ministryMembers)
      .where(eq(ministryMembers.contactId, input.primaryContactId));
    const primaryMinistryIds = Array.from(
      new Set(primaryMinistryMemberships.map((row) => row.ministryId))
    );

    if (primaryMinistryIds.length > 0) {
      await tx
        .delete(ministryMembers)
        .where(
          and(
            eq(ministryMembers.contactId, input.duplicateContactId),
            inArray(ministryMembers.ministryId, primaryMinistryIds)
          )
        );
    }

    await tx
      .update(ministryMembers)
      .set({ contactId: input.primaryContactId })
      .where(eq(ministryMembers.contactId, input.duplicateContactId));

    const [primarySchedulingProfile] = await tx
      .select()
      .from(serviceSchedulingProfiles)
      .where(
        and(
          eq(serviceSchedulingProfiles.organizationId, organizationId),
          eq(serviceSchedulingProfiles.contactId, input.primaryContactId)
        )
      )
      .limit(1);
    const [duplicateSchedulingProfile] = await tx
      .select()
      .from(serviceSchedulingProfiles)
      .where(
        and(
          eq(serviceSchedulingProfiles.organizationId, organizationId),
          eq(serviceSchedulingProfiles.contactId, input.duplicateContactId)
        )
      )
      .limit(1);

    if (duplicateSchedulingProfile) {
      if (!primarySchedulingProfile) {
        await tx
          .update(serviceSchedulingProfiles)
          .set({
            contactId: input.primaryContactId,
            updatedAt: new Date(),
          })
          .where(eq(serviceSchedulingProfiles.id, duplicateSchedulingProfile.id));
      } else {
        const mergedPreferredRoles = Array.from(
          new Set([
            ...(primarySchedulingProfile.preferredRoles ?? []),
            ...(duplicateSchedulingProfile.preferredRoles ?? []),
          ])
        );
        const mergedAvailability = Array.from(
          new Map(
            [...(primarySchedulingProfile.availabilitySlots ?? []), ...(duplicateSchedulingProfile.availabilitySlots ?? [])].map(
              (slot) => [JSON.stringify(slot), slot]
            )
          ).values()
        );
        await tx
          .update(serviceSchedulingProfiles)
          .set({
            isSchedulable:
              primarySchedulingProfile.isSchedulable || duplicateSchedulingProfile.isSchedulable,
            preferredRoles: mergedPreferredRoles,
            availabilitySlots: mergedAvailability,
            notes: mergeNotes(primarySchedulingProfile.notes, duplicateSchedulingProfile.notes),
            updatedAt: new Date(),
          })
          .where(eq(serviceSchedulingProfiles.id, primarySchedulingProfile.id));
        await tx
          .delete(serviceSchedulingProfiles)
          .where(eq(serviceSchedulingProfiles.id, duplicateSchedulingProfile.id));
      }
    }

    const primaryVolunteerRows = await tx
      .select()
      .from(volunteers)
      .where(
        and(
          eq(volunteers.organizationId, organizationId),
          eq(volunteers.contactId, input.primaryContactId)
        )
      )
      .orderBy(volunteers.joinedAt);
    const duplicateVolunteerRows = await tx
      .select()
      .from(volunteers)
      .where(
        and(
          eq(volunteers.organizationId, organizationId),
          eq(volunteers.contactId, input.duplicateContactId)
        )
      )
      .orderBy(volunteers.joinedAt);

    const allVolunteerRows = [...primaryVolunteerRows, ...duplicateVolunteerRows];
    if (allVolunteerRows.length > 0) {
      let anchorVolunteer = primaryVolunteerRows[0] ?? duplicateVolunteerRows[0];
      if (!anchorVolunteer) {
        throw new Error("Volunteer merge anchor missing");
      }

      let totalHours = Number(anchorVolunteer.totalHours ?? 0);
      const mergeCandidates = allVolunteerRows.filter((row) => row.id !== anchorVolunteer.id);

      for (const candidate of mergeCandidates) {
        totalHours += Number(candidate.totalHours ?? 0);
        await tx
          .update(volunteerShifts)
          .set({ volunteerId: anchorVolunteer.id })
          .where(eq(volunteerShifts.volunteerId, candidate.id));
        await tx.delete(volunteers).where(eq(volunteers.id, candidate.id));
      }

      const [refreshedAnchor] = await tx
        .update(volunteers)
        .set({
          contactId: input.primaryContactId,
          totalHours,
        })
        .where(eq(volunteers.id, anchorVolunteer.id))
        .returning();

      if (refreshedAnchor) {
        anchorVolunteer = refreshedAnchor;
      }
    }

    await tx
      .update(donations)
      .set({ contactId: input.primaryContactId })
      .where(
        and(eq(donations.organizationId, organizationId), eq(donations.contactId, input.duplicateContactId))
      );
    await tx
      .update(pledges)
      .set({ contactId: input.primaryContactId })
      .where(
        and(eq(pledges.organizationId, organizationId), eq(pledges.contactId, input.duplicateContactId))
      );
    await tx
      .update(appointments)
      .set({ contactId: input.primaryContactId })
      .where(
        and(
          eq(appointments.organizationId, organizationId),
          eq(appointments.contactId, input.duplicateContactId)
        )
      );
    await tx
      .update(prayerRequests)
      .set({ contactId: input.primaryContactId })
      .where(
        and(
          eq(prayerRequests.organizationId, organizationId),
          eq(prayerRequests.contactId, input.duplicateContactId)
        )
      );
    await tx
      .update(pipelineItems)
      .set({ contactId: input.primaryContactId, updatedAt: new Date() })
      .where(
        and(
          eq(pipelineItems.organizationId, organizationId),
          eq(pipelineItems.contactId, input.duplicateContactId)
        )
      );
    await tx
      .update(conversations)
      .set({ contactId: input.primaryContactId, updatedAt: new Date() })
      .where(
        and(
          eq(conversations.organizationId, organizationId),
          eq(conversations.contactId, input.duplicateContactId)
        )
      );
    await tx
      .update(ministries)
      .set({ leaderId: input.primaryContactId, updatedAt: new Date() })
      .where(
        and(eq(ministries.organizationId, organizationId), eq(ministries.leaderId, input.duplicateContactId))
      );
    await tx
      .update(graceSessions)
      .set({ contactId: input.primaryContactId, updatedAt: new Date() })
      .where(
        and(
          eq(graceSessions.organizationId, organizationId),
          eq(graceSessions.contactId, input.duplicateContactId)
        )
      );
    await tx
      .update(graceSessions)
      .set({ matchedContactId: input.primaryContactId, updatedAt: new Date() })
      .where(
        and(
          eq(graceSessions.organizationId, organizationId),
          eq(graceSessions.matchedContactId, input.duplicateContactId)
        )
      );
    await tx
      .update(graceMessages)
      .set({ contactId: input.primaryContactId })
      .where(
        and(
          eq(graceMessages.organizationId, organizationId),
          eq(graceMessages.contactId, input.duplicateContactId)
        )
      );
    await tx
      .update(graceCalls)
      .set({ contactId: input.primaryContactId })
      .where(and(eq(graceCalls.organizationId, organizationId), eq(graceCalls.contactId, input.duplicateContactId)));
    await tx
      .update(graceMemory)
      .set({ contactId: input.primaryContactId })
      .where(
        and(eq(graceMemory.organizationId, organizationId), eq(graceMemory.contactId, input.duplicateContactId))
      );
    await tx
      .update(graceHandoffs)
      .set({ contactId: input.primaryContactId })
      .where(
        and(eq(graceHandoffs.organizationId, organizationId), eq(graceHandoffs.contactId, input.duplicateContactId))
      );
    await tx
      .update(graceFollowupProposals)
      .set({ contactId: input.primaryContactId })
      .where(
        and(
          eq(graceFollowupProposals.organizationId, organizationId),
          eq(graceFollowupProposals.contactId, input.duplicateContactId)
        )
      );
    await tx
      .update(graceContactMatchAudit)
      .set({ matchedContactId: input.primaryContactId })
      .where(
        and(
          eq(graceContactMatchAudit.organizationId, organizationId),
          eq(graceContactMatchAudit.matchedContactId, input.duplicateContactId)
        )
      );
    await tx
      .update(graceContactMatchAudit)
      .set({ createdContactId: input.primaryContactId })
      .where(
        and(
          eq(graceContactMatchAudit.organizationId, organizationId),
          eq(graceContactMatchAudit.createdContactId, input.duplicateContactId)
        )
      );

    await tx
      .delete(churchContacts)
      .where(
        and(
          eq(churchContacts.id, input.duplicateContactId),
          eq(churchContacts.organizationId, organizationId)
        )
      );

    return {
      contact: updatedPrimary,
      mergedFromContactId: input.duplicateContactId,
    };
  });
}

export async function getContactCount(orgId: string) {
  await requireOrgMembership(orgId);
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(churchContacts)
    .where(eq(churchContacts.organizationId, orgId));
  return result?.count ?? 0;
}
