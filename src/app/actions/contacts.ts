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
import { eq, and, ilike, or, desc, sql, count, inArray, ne, type SQL } from "drizzle-orm";
import { requireOrgMembership } from "./utils";
import {
  mergeContactNotes,
  normalizeContactEmail,
  normalizeContactPhone,
  resolveMergedMemberStatus,
} from "@/lib/operations/contacts-lifecycle";
import {
  MEMBER_STATUS_VALUES,
  normalizeImportedMemberStatus,
  normalizeMemberStatusValue,
} from "@/lib/contacts/member-status";
import {
  syncContactArchivedToDittofeed,
  syncContactCreatedToDittofeed,
  syncContactRestoredToDittofeed,
  syncContactToDittofeedBestEffort,
  syncContactUpdatedToDittofeed,
} from "@/lib/dittofeed/contacts";
import * as z from "zod";
import type { MemberStatusValue } from "@/lib/contacts/member-status";

// ── Contact Profile (full parallel fetch) ───────────────────────────────────

export async function getContactProfile(contactId: string, organizationId: string) {
  const parsedContactId = contactIdSchema.parse(contactId);
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);
  const [contact] = await db
    .select()
    .from(churchContacts)
    .where(
      and(
        eq(churchContacts.id, parsedContactId),
        eq(churchContacts.organizationId, parsedOrganizationId)
      )
    )
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
    db.select().from(contactTags).where(eq(contactTags.contactId, parsedContactId)),
    db.select().from(donations)
      .where(
        and(
          eq(donations.contactId, parsedContactId),
          eq(donations.organizationId, parsedOrganizationId)
        )
      )
      .orderBy(desc(donations.date)),
    db.select().from(pledges)
      .where(
        and(
          eq(pledges.contactId, parsedContactId),
          eq(pledges.organizationId, parsedOrganizationId)
        )
      )
      .orderBy(desc(pledges.createdAt)),
    db.select().from(appointments)
      .where(
        and(
          eq(appointments.contactId, parsedContactId),
          eq(appointments.organizationId, parsedOrganizationId)
        )
      )
      .orderBy(desc(appointments.dateTime)),
    db.select().from(prayerRequests)
      .where(
        and(
          eq(prayerRequests.contactId, parsedContactId),
          eq(prayerRequests.organizationId, parsedOrganizationId)
        )
      )
      .orderBy(desc(prayerRequests.createdAt)),
    db.select({ item: pipelineItems, stage: pipelineStages })
      .from(pipelineItems)
      .leftJoin(pipelineStages, eq(pipelineItems.stageId, pipelineStages.id))
      .where(
        and(
          eq(pipelineItems.contactId, parsedContactId),
          eq(pipelineItems.organizationId, parsedOrganizationId)
        )
      )
      .orderBy(desc(pipelineItems.updatedAt)),
    db.select().from(volunteers)
      .where(
        and(
          eq(volunteers.contactId, parsedContactId),
          eq(volunteers.organizationId, parsedOrganizationId)
        )
      )
      .limit(1)
      .then(r => r[0] ?? null),
    db.select({ membership: ministryMembers, ministry: ministries })
      .from(ministryMembers)
      .innerJoin(ministries, eq(ministryMembers.ministryId, ministries.id))
      .where(eq(ministryMembers.contactId, parsedContactId)),
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

const MAX_IMPORT_ROWS = 10_000;
const DUPLICATE_GROUP_LIMIT = 100;
const CONTACT_SOURCE_VALUES = [
  "walk_in",
  "website",
  "referral",
  "event",
  "social_media",
  "other",
] as const;

type ContactSourceValue = (typeof CONTACT_SOURCE_VALUES)[number];

const organizationIdSchema = z.string().trim().min(1);
const contactIdSchema = z.string().trim().min(1);
const memberStatusSchema = z.enum(MEMBER_STATUS_VALUES);
const contactSourceSchema = z.enum(CONTACT_SOURCE_VALUES);

const importContactRowSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  memberStatus: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

const createContactSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  memberStatus: memberStatusSchema.optional(),
  source: contactSourceSchema.optional(),
  familyId: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  organizationId: organizationIdSchema,
});

const updateContactSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  memberStatus: memberStatusSchema.optional(),
  source: contactSourceSchema.optional(),
  familyId: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

const mergeContactsSchema = z.object({
  primaryContactId: contactIdSchema,
  duplicateContactId: contactIdSchema,
});

const VALID_ACTIVE_STATUSES = new Set(["visitor", "prospect", "regular_attendee", "member", "leader"]);

function normalizeContactSourceValue(value: string | null | undefined): ContactSourceValue {
  const normalized = typeof value === "string" ? value.trim() : "";
  return CONTACT_SOURCE_VALUES.find((source) => source === normalized) ?? "other";
}

async function findContactDuplicateByIdentifiers(params: {
  organizationId: string;
  email?: string | null;
  phone?: string | null;
  excludeContactId?: string;
}) {
  const normalizedEmail = normalizeContactEmail(params.email);
  const normalizedPhone = normalizeContactPhone(params.phone);

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
  if (normalizedEmail && normalizeContactEmail(duplicate.email) === normalizedEmail) {
    matchReasons.push("email");
  }
  if (normalizedPhone && normalizeContactPhone(duplicate.phone) === normalizedPhone) {
    matchReasons.push("phone");
  }

  return {
    duplicate,
    matchReasons,
  };
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
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`CSV import exceeds ${MAX_IMPORT_ROWS} rows`);
  }

  await requireOrgMembership(parsedOrganizationId);
  const result: ImportContactsResult = { inserted: 0, updated: 0, failed: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    try {
      const row = importContactRowSchema.parse(rows[i]);
      const firstName = row.firstName.trim();
      const lastName = row.lastName.trim();
      if (!firstName || !lastName) throw new Error("firstName and lastName are required");

      const email = row.email?.trim().toLowerCase() || null;
      const phone = row.phone?.replace(/\D/g, "") || null;
      const importedStatus = normalizeImportedMemberStatus(row.memberStatus);
      const memberStatus: MemberStatusValue = importedStatus ?? "visitor";
      const source = normalizeContactSourceValue(row.source);
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
              .where(and(eq(churchContacts.organizationId, parsedOrganizationId), or(...matchClauses)))
              .limit(1)
          : [];

      if (existing[0]) {
        const [updatedContact] = await db
          .update(churchContacts)
          .set({ firstName, lastName, email, phone, memberStatus, source, notes, updatedAt: new Date() })
          .where(eq(churchContacts.id, existing[0].id))
          .returning();
        await syncContactToDittofeedBestEffort("contacts.import.update", () =>
          syncContactUpdatedToDittofeed({
            organizationId: parsedOrganizationId,
            contact: updatedContact,
          })
        );
        result.updated++;
      } else {
        const [createdContact] = await db.insert(churchContacts).values({
          firstName,
          lastName,
          email,
          phone,
          memberStatus,
          source,
          notes,
          organizationId: parsedOrganizationId,
        }).returning();
        await syncContactToDittofeedBestEffort("contacts.import.create", () =>
          syncContactCreatedToDittofeed({
            organizationId: parsedOrganizationId,
            contact: createdContact,
            extraProperties: { importSource: "csv" },
          })
        );
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
  const parsedOrgId = organizationIdSchema.parse(orgId);
  await requireOrgMembership(parsedOrgId);
  const conditions: any[] = [eq(churchContacts.organizationId, parsedOrgId)];

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
    const normalizedStatus = normalizeMemberStatusValue(filters.status);
    if (!normalizedStatus) {
      throw new Error("Invalid contact status filter");
    }
    conditions.push(eq(churchContacts.memberStatus, normalizedStatus));
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
  const contactId = contactIdSchema.parse(id);
  const [existing] = await db
    .select({ organizationId: churchContacts.organizationId })
    .from(churchContacts)
    .where(eq(churchContacts.id, contactId))
    .limit(1);

  if (!existing) {
    return null;
  }

  await requireOrgMembership(existing.organizationId);
  const [contact] = await db
    .select()
    .from(churchContacts)
    .where(
      and(
        eq(churchContacts.id, contactId),
        eq(churchContacts.organizationId, existing.organizationId)
      )
    );
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
  const parsed = createContactSchema.parse(data);
  await requireOrgMembership(parsed.organizationId);

  const normalizedEmail = normalizeContactEmail(parsed.email);
  const normalizedPhone = normalizeContactPhone(parsed.phone);
  const duplicate = await findContactDuplicateByIdentifiers({
    organizationId: parsed.organizationId,
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
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email: normalizedEmail,
      phone: normalizedPhone,
      memberStatus: parsed.memberStatus ?? "visitor",
      source: parsed.source ?? "walk_in",
      familyId: parsed.familyId ?? null,
      notes: parsed.notes ?? null,
      organizationId: parsed.organizationId,
    })
    .returning();

  await syncContactToDittofeedBestEffort("contacts.create", () =>
    syncContactCreatedToDittofeed({
      organizationId: parsed.organizationId,
      contact,
    })
  );

  try {
    const { inngest } = await import("@/lib/inngest/client");
    const {
      INNGEST_EVENTS,
      buildContactCreatedIdempotencyKey,
    } = await import("@/lib/inngest/events");

    const idempotencyKey = buildContactCreatedIdempotencyKey({
      organizationId: parsed.organizationId,
      contactId: contact.id,
    });

    await inngest.send({
      id: idempotencyKey,
      name: INNGEST_EVENTS.CONTACT_CREATED,
      data: {
        organizationId: parsed.organizationId,
        contactId: contact.id,
        idempotencyKey,
      },
    });
  } catch (error) {
    console.error("[Contacts] Contact created but failed to enqueue post-create workflow", {
      contactId: contact.id,
      organizationId: parsed.organizationId,
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
  const contactId = contactIdSchema.parse(id);
  const parsed = updateContactSchema.parse(data);
  if (Object.keys(parsed).length === 0) {
    throw new Error("No contact fields provided to update");
  }

  const existing = await requireContactAccess(contactId);
  const [previousContact] = await db
    .select()
    .from(churchContacts)
    .where(
      and(eq(churchContacts.id, contactId), eq(churchContacts.organizationId, existing.organizationId))
    )
    .limit(1);

  const normalizedEmail =
    parsed.email !== undefined ? normalizeContactEmail(parsed.email) : undefined;
  const normalizedPhone =
    parsed.phone !== undefined ? normalizeContactPhone(parsed.phone) : undefined;

  const duplicate = await findContactDuplicateByIdentifiers({
    organizationId: existing.organizationId,
    email: normalizedEmail,
    phone: normalizedPhone,
    excludeContactId: contactId,
  });
  if (duplicate) {
    throw new Error(
      `Potential duplicate detected (${duplicate.matchReasons.join(" + ")}). Merge with contact ${duplicate.duplicate.id} or adjust identifiers.`
    );
  }

  const patch: Partial<typeof churchContacts.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsed.firstName !== undefined) patch.firstName = parsed.firstName;
  if (parsed.lastName !== undefined) patch.lastName = parsed.lastName;
  if (parsed.memberStatus !== undefined) patch.memberStatus = parsed.memberStatus;
  if (parsed.source !== undefined) patch.source = parsed.source;
  if (parsed.familyId !== undefined) patch.familyId = parsed.familyId;
  if (parsed.notes !== undefined) patch.notes = parsed.notes;
  if (normalizedEmail !== undefined) patch.email = normalizedEmail;
  if (normalizedPhone !== undefined) patch.phone = normalizedPhone;

  const [contact] = await db
    .update(churchContacts)
    .set(patch)
    .where(
      and(eq(churchContacts.id, contactId), eq(churchContacts.organizationId, existing.organizationId))
    )
    .returning();

  await syncContactToDittofeedBestEffort("contacts.update", () =>
    syncContactUpdatedToDittofeed({
      organizationId: existing.organizationId,
      contact,
      previousContact,
    })
  );
  return contact;
}

export async function archiveContact(id: string) {
  const contactId = contactIdSchema.parse(id);
  const existing = await requireContactAccess(contactId);
  const [previousContact] = await db
    .select()
    .from(churchContacts)
    .where(
      and(eq(churchContacts.id, contactId), eq(churchContacts.organizationId, existing.organizationId))
    )
    .limit(1);
  const [contact] = await db
    .update(churchContacts)
    .set({
      memberStatus: "inactive",
      updatedAt: new Date(),
    })
    .where(
      and(eq(churchContacts.id, contactId), eq(churchContacts.organizationId, existing.organizationId))
    )
    .returning();
  await syncContactToDittofeedBestEffort("contacts.archive", () =>
    syncContactArchivedToDittofeed({
      organizationId: existing.organizationId,
      contact,
      previousContact,
    })
  );
  return contact;
}

export async function restoreContact(id: string, status: string = "visitor") {
  const contactId = contactIdSchema.parse(id);
  const parsedStatus = z.string().trim().min(1).parse(status);
  const normalizedStatus = normalizeMemberStatusValue(parsedStatus);
  if (!normalizedStatus || !VALID_ACTIVE_STATUSES.has(normalizedStatus)) {
    throw new Error("Invalid restore status");
  }
  const existing = await requireContactAccess(contactId);
  const [previousContact] = await db
    .select()
    .from(churchContacts)
    .where(
      and(eq(churchContacts.id, contactId), eq(churchContacts.organizationId, existing.organizationId))
    )
    .limit(1);
  const [contact] = await db
    .update(churchContacts)
    .set({
      memberStatus: normalizedStatus,
      updatedAt: new Date(),
    })
    .where(
      and(eq(churchContacts.id, contactId), eq(churchContacts.organizationId, existing.organizationId))
    )
    .returning();
  await syncContactToDittofeedBestEffort("contacts.restore", () =>
    syncContactRestoredToDittofeed({
      organizationId: existing.organizationId,
      contact,
      previousContact,
    })
  );
  return contact;
}

export async function deleteContact(id: string) {
  const contactId = contactIdSchema.parse(id);
  const [existing] = await db
    .select({ organizationId: churchContacts.organizationId })
    .from(churchContacts)
    .where(eq(churchContacts.id, contactId))
    .limit(1);
  if (!existing) return;
  await requireOrgMembership(existing.organizationId);
  await db
    .delete(churchContacts)
    .where(
      and(eq(churchContacts.id, contactId), eq(churchContacts.organizationId, existing.organizationId))
    );
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

async function fetchDuplicateGroupsByExpression(params: {
  organizationId: string;
  reason: ContactDuplicateGroup["reason"];
  keyExpression: SQL<string>;
  valueFilter: SQL<unknown>;
}) {
  const duplicateKeys = await db
    .select({
      key: params.keyExpression,
      matchCount: count(),
    })
    .from(churchContacts)
    .where(and(eq(churchContacts.organizationId, params.organizationId), params.valueFilter))
    .groupBy(params.keyExpression)
    .having(sql`count(*) > 1`)
    .orderBy(desc(sql<number>`count(*)`), desc(sql<Date>`max(${churchContacts.updatedAt})`))
    .limit(DUPLICATE_GROUP_LIMIT);

  const keys = duplicateKeys.map((row) => row.key).filter((key): key is string => Boolean(key));
  if (keys.length === 0) {
    return [] as ContactDuplicateGroup[];
  }

  const groupedRows = await db
    .select({
      id: churchContacts.id,
      firstName: churchContacts.firstName,
      lastName: churchContacts.lastName,
      email: churchContacts.email,
      phone: churchContacts.phone,
      memberStatus: churchContacts.memberStatus,
      createdAt: churchContacts.createdAt,
      updatedAt: churchContacts.updatedAt,
      groupKey: params.keyExpression,
    })
    .from(churchContacts)
    .where(
      and(
        eq(churchContacts.organizationId, params.organizationId),
        params.valueFilter,
        sql`${params.keyExpression} in (${sql.join(keys.map((key) => sql`${key}`), sql`, `)})`
      )
    )
    .orderBy(desc(churchContacts.updatedAt));

  const groupsByKey = new Map<string, ContactDuplicateCandidate[]>();
  for (const row of groupedRows) {
    if (!row.groupKey) continue;
    const candidate: ContactDuplicateCandidate = {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      memberStatus: row.memberStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
    const existing = groupsByKey.get(row.groupKey) ?? [];
    existing.push(candidate);
    groupsByKey.set(row.groupKey, existing);
  }

  return keys
    .map((key) => ({
      key,
      reason: params.reason,
      contacts: groupsByKey.get(key) ?? [],
    }))
    .filter((group) => group.contacts.length > 1);
}

export async function findPotentialDuplicateContacts(orgId: string): Promise<ContactDuplicateGroup[]> {
  const parsedOrgId = organizationIdSchema.parse(orgId);
  await requireOrgMembership(parsedOrgId);

  const emailExpression = sql<string>`lower(trim(${churchContacts.email}))`;
  const phoneExpression = sql<string>`regexp_replace(coalesce(${churchContacts.phone}, ''), '[^0-9]', '', 'g')`;
  const nameExpression =
    sql<string>`lower(trim(${churchContacts.firstName})) || '|' || lower(trim(${churchContacts.lastName}))`;

  const [emailGroups, phoneGroups, nameGroups] = await Promise.all([
    fetchDuplicateGroupsByExpression({
      organizationId: parsedOrgId,
      reason: "email",
      keyExpression: emailExpression,
      valueFilter: sql`${churchContacts.email} is not null and trim(${churchContacts.email}) <> ''`,
    }),
    fetchDuplicateGroupsByExpression({
      organizationId: parsedOrgId,
      reason: "phone",
      keyExpression: phoneExpression,
      valueFilter:
        sql`${churchContacts.phone} is not null and regexp_replace(${churchContacts.phone}, '[^0-9]', '', 'g') <> ''`,
    }),
    fetchDuplicateGroupsByExpression({
      organizationId: parsedOrgId,
      reason: "name",
      keyExpression: nameExpression,
      valueFilter:
        sql`trim(${churchContacts.firstName}) <> '' and trim(${churchContacts.lastName}) <> ''`,
    }),
  ]);

  return [...emailGroups, ...phoneGroups, ...nameGroups].sort(
    (a, b) => b.contacts.length - a.contacts.length
  );
}

type MergeContactsInput = {
  primaryContactId: string;
  duplicateContactId: string;
};

export async function mergeContacts(input: MergeContactsInput) {
  const parsed = mergeContactsSchema.parse(input);
  const primaryAccess = await requireContactAccess(parsed.primaryContactId);
  const duplicateAccess = await requireContactAccess(parsed.duplicateContactId);

  if (parsed.primaryContactId === parsed.duplicateContactId) {
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
          eq(churchContacts.id, parsed.primaryContactId),
          eq(churchContacts.organizationId, organizationId)
        )
      )
      .limit(1);
    const [duplicate] = await tx
      .select()
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.id, parsed.duplicateContactId),
          eq(churchContacts.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!primary || !duplicate) {
      throw new Error("Contact not found");
    }

    const mergedPreferredStatus = resolveMergedMemberStatus(
      primary.memberStatus,
      duplicate.memberStatus
    );

    const [updatedPrimary] = await tx
      .update(churchContacts)
      .set({
        firstName: primary.firstName || duplicate.firstName,
        lastName: primary.lastName || duplicate.lastName,
        email:
          normalizeContactEmail(primary.email) ??
          normalizeContactEmail(duplicate.email),
        phone:
          normalizeContactPhone(primary.phone) ??
          normalizeContactPhone(duplicate.phone),
        memberStatus: mergedPreferredStatus,
        source: primary.source ?? duplicate.source,
        familyId: primary.familyId ?? duplicate.familyId,
        avatarUrl: primary.avatarUrl ?? duplicate.avatarUrl,
        dateOfBirth: primary.dateOfBirth ?? duplicate.dateOfBirth,
        firstVisitDate: primary.firstVisitDate ?? duplicate.firstVisitDate,
        notes: mergeContactNotes(primary.notes, duplicate.notes),
        updatedAt: new Date(),
      })
      .where(eq(churchContacts.id, parsed.primaryContactId))
      .returning();

    const primaryTags = await tx
      .select({ tag: contactTags.tag })
      .from(contactTags)
      .where(eq(contactTags.contactId, parsed.primaryContactId));
    const primaryTagValues = Array.from(new Set(primaryTags.map((row) => row.tag)));

    if (primaryTagValues.length > 0) {
      await tx
        .delete(contactTags)
        .where(
          and(
            eq(contactTags.contactId, parsed.duplicateContactId),
            inArray(contactTags.tag, primaryTagValues)
          )
        );
    }
    await tx
      .update(contactTags)
      .set({ contactId: parsed.primaryContactId })
      .where(eq(contactTags.contactId, parsed.duplicateContactId));

    const primaryMinistryMemberships = await tx
      .select({ ministryId: ministryMembers.ministryId })
      .from(ministryMembers)
      .where(eq(ministryMembers.contactId, parsed.primaryContactId));
    const primaryMinistryIds = Array.from(
      new Set(primaryMinistryMemberships.map((row) => row.ministryId))
    );

    if (primaryMinistryIds.length > 0) {
      await tx
        .delete(ministryMembers)
        .where(
          and(
            eq(ministryMembers.contactId, parsed.duplicateContactId),
            inArray(ministryMembers.ministryId, primaryMinistryIds)
          )
        );
    }

    await tx
      .update(ministryMembers)
      .set({ contactId: parsed.primaryContactId })
      .where(eq(ministryMembers.contactId, parsed.duplicateContactId));

    const [primarySchedulingProfile] = await tx
      .select()
      .from(serviceSchedulingProfiles)
      .where(
        and(
          eq(serviceSchedulingProfiles.organizationId, organizationId),
          eq(serviceSchedulingProfiles.contactId, parsed.primaryContactId)
        )
      )
      .limit(1);
    const [duplicateSchedulingProfile] = await tx
      .select()
      .from(serviceSchedulingProfiles)
      .where(
        and(
          eq(serviceSchedulingProfiles.organizationId, organizationId),
          eq(serviceSchedulingProfiles.contactId, parsed.duplicateContactId)
        )
      )
      .limit(1);

    if (duplicateSchedulingProfile) {
      if (!primarySchedulingProfile) {
        await tx
          .update(serviceSchedulingProfiles)
          .set({
            contactId: parsed.primaryContactId,
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
            notes: mergeContactNotes(
              primarySchedulingProfile.notes,
              duplicateSchedulingProfile.notes
            ),
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
          eq(volunteers.contactId, parsed.primaryContactId)
        )
      )
      .orderBy(volunteers.joinedAt);
    const duplicateVolunteerRows = await tx
      .select()
      .from(volunteers)
      .where(
        and(
          eq(volunteers.organizationId, organizationId),
          eq(volunteers.contactId, parsed.duplicateContactId)
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
          contactId: parsed.primaryContactId,
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
      .set({ contactId: parsed.primaryContactId })
      .where(
        and(
          eq(donations.organizationId, organizationId),
          eq(donations.contactId, parsed.duplicateContactId)
        )
      );
    await tx
      .update(pledges)
      .set({ contactId: parsed.primaryContactId })
      .where(
        and(
          eq(pledges.organizationId, organizationId),
          eq(pledges.contactId, parsed.duplicateContactId)
        )
      );
    await tx
      .update(appointments)
      .set({ contactId: parsed.primaryContactId })
      .where(
        and(
          eq(appointments.organizationId, organizationId),
          eq(appointments.contactId, parsed.duplicateContactId)
        )
      );
    await tx
      .update(prayerRequests)
      .set({ contactId: parsed.primaryContactId })
      .where(
        and(
          eq(prayerRequests.organizationId, organizationId),
          eq(prayerRequests.contactId, parsed.duplicateContactId)
        )
      );
    await tx
      .update(pipelineItems)
      .set({ contactId: parsed.primaryContactId, updatedAt: new Date() })
      .where(
        and(
          eq(pipelineItems.organizationId, organizationId),
          eq(pipelineItems.contactId, parsed.duplicateContactId)
        )
      );
    await tx
      .update(conversations)
      .set({ contactId: parsed.primaryContactId, updatedAt: new Date() })
      .where(
        and(
          eq(conversations.organizationId, organizationId),
          eq(conversations.contactId, parsed.duplicateContactId)
        )
      );
    await tx
      .update(ministries)
      .set({ leaderId: parsed.primaryContactId, updatedAt: new Date() })
      .where(
        and(
          eq(ministries.organizationId, organizationId),
          eq(ministries.leaderId, parsed.duplicateContactId)
        )
      );
    await tx
      .update(graceSessions)
      .set({ contactId: parsed.primaryContactId, updatedAt: new Date() })
      .where(
        and(
          eq(graceSessions.organizationId, organizationId),
          eq(graceSessions.contactId, parsed.duplicateContactId)
        )
      );
    await tx
      .update(graceSessions)
      .set({ matchedContactId: parsed.primaryContactId, updatedAt: new Date() })
      .where(
        and(
          eq(graceSessions.organizationId, organizationId),
          eq(graceSessions.matchedContactId, parsed.duplicateContactId)
        )
      );
    await tx
      .update(graceMessages)
      .set({ contactId: parsed.primaryContactId })
      .where(
        and(
          eq(graceMessages.organizationId, organizationId),
          eq(graceMessages.contactId, parsed.duplicateContactId)
        )
      );
    await tx
      .update(graceCalls)
      .set({ contactId: parsed.primaryContactId })
      .where(
        and(eq(graceCalls.organizationId, organizationId), eq(graceCalls.contactId, parsed.duplicateContactId))
      );
    await tx
      .update(graceMemory)
      .set({ contactId: parsed.primaryContactId })
      .where(
        and(eq(graceMemory.organizationId, organizationId), eq(graceMemory.contactId, parsed.duplicateContactId))
      );
    await tx
      .update(graceHandoffs)
      .set({ contactId: parsed.primaryContactId })
      .where(
        and(eq(graceHandoffs.organizationId, organizationId), eq(graceHandoffs.contactId, parsed.duplicateContactId))
      );
    await tx
      .update(graceFollowupProposals)
      .set({ contactId: parsed.primaryContactId })
      .where(
        and(
          eq(graceFollowupProposals.organizationId, organizationId),
          eq(graceFollowupProposals.contactId, parsed.duplicateContactId)
        )
      );
    await tx
      .update(graceContactMatchAudit)
      .set({ matchedContactId: parsed.primaryContactId })
      .where(
        and(
          eq(graceContactMatchAudit.organizationId, organizationId),
          eq(graceContactMatchAudit.matchedContactId, parsed.duplicateContactId)
        )
      );
    await tx
      .update(graceContactMatchAudit)
      .set({ createdContactId: parsed.primaryContactId })
      .where(
        and(
          eq(graceContactMatchAudit.organizationId, organizationId),
          eq(graceContactMatchAudit.createdContactId, parsed.duplicateContactId)
        )
      );

    await tx
      .delete(churchContacts)
      .where(
        and(
          eq(churchContacts.id, parsed.duplicateContactId),
          eq(churchContacts.organizationId, organizationId)
        )
      );

    return {
      contact: updatedPrimary,
      mergedFromContactId: parsed.duplicateContactId,
    };
  });
}

export async function getContactCount(orgId: string) {
  const parsedOrgId = organizationIdSchema.parse(orgId);
  await requireOrgMembership(parsedOrgId);
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(churchContacts)
    .where(eq(churchContacts.organizationId, parsedOrgId));
  return result?.count ?? 0;
}
