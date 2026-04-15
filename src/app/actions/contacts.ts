"use server";

import { db } from "@/db";
import {
  churchContacts,
  contactTags,
  families,
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
  attendanceEntries,
  attendanceSessions,
  serviceAssignments,
  serviceRuns,
} from "@/db/schema";
import { eq, and, ilike, or, desc, sql, count, inArray, ne, asc, type SQL } from "drizzle-orm";
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
  compatibleChurchContactSelect,
  compatibleMemberSinceDate,
} from "@/lib/contacts/projection";
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
    .select(compatibleChurchContactSelect)
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
      household: null,
      tags: [],
      donations: [],
      pledges: [],
      appointments: [],
      prayer: [],
      pipeline: [],
      volunteer: null,
      shifts: [],
      ministries: [],
      conversations: [],
      graceSessions: [],
      handoffs: [],
      followupProposals: [],
      attendance: [],
      serviceAttendance: [],
      attendanceSummary: {
        worship: 0,
        ministry: 0,
        serving: 0,
        total: 0,
        lastRecordedAt: null,
      },
      careSummary: {
        openPrayer: 0,
        openConversations: 0,
        pendingAppointments: 0,
        openHandoffs: 0,
        pendingGraceFollowups: 0,
        overdueItems: 0,
      },
      financeSummary: {
        totalGiving: 0,
        donationCount: 0,
        activePledges: 0,
      },
      timeline: [],
    };
  }

  const [
    tags,
    household,
    householdMembers,
    contactDonations,
    contactPledges,
    contactAppointments,
    contactPrayer,
    pipelineData,
    volunteerRecord,
    contactMinistries,
    contactConversations,
    contactGraceSessions,
    contactHandoffs,
    contactFollowupProposals,
    contactAttendance,
    contactServiceAttendance,
  ] = await Promise.all([
    db.select().from(contactTags).where(eq(contactTags.contactId, parsedContactId)),
    contact.familyId
      ? db
          .select()
          .from(families)
          .where(
            and(
              eq(families.id, contact.familyId),
              eq(families.organizationId, parsedOrganizationId)
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    contact.familyId
      ? db
          .select({
            id: churchContacts.id,
            firstName: churchContacts.firstName,
            lastName: churchContacts.lastName,
            email: churchContacts.email,
            phone: churchContacts.phone,
            memberStatus: churchContacts.memberStatus,
            memberSinceDate: compatibleMemberSinceDate,
          })
          .from(churchContacts)
          .where(
            and(
              eq(churchContacts.familyId, contact.familyId),
              eq(churchContacts.organizationId, parsedOrganizationId)
            )
          )
          .orderBy(asc(churchContacts.firstName), asc(churchContacts.lastName))
      : Promise.resolve([]),
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
    db.select()
      .from(conversations)
      .where(
        and(
          eq(conversations.contactId, parsedContactId),
          eq(conversations.organizationId, parsedOrganizationId)
        )
      )
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.updatedAt)),
    db.select()
      .from(graceSessions)
      .where(
        and(
          eq(graceSessions.organizationId, parsedOrganizationId),
          or(
            eq(graceSessions.contactId, parsedContactId),
            eq(graceSessions.matchedContactId, parsedContactId)
          )
        )
      )
      .orderBy(desc(graceSessions.updatedAt), desc(graceSessions.createdAt)),
    db.select()
      .from(graceHandoffs)
      .where(
        and(
          eq(graceHandoffs.contactId, parsedContactId),
          eq(graceHandoffs.organizationId, parsedOrganizationId)
        )
      )
      .orderBy(desc(graceHandoffs.createdAt)),
    db.select()
      .from(graceFollowupProposals)
      .where(
        and(
          eq(graceFollowupProposals.contactId, parsedContactId),
          eq(graceFollowupProposals.organizationId, parsedOrganizationId)
        )
      )
      .orderBy(desc(graceFollowupProposals.createdAt)),
    db.select({ entry: attendanceEntries, session: attendanceSessions })
      .from(attendanceEntries)
      .innerJoin(attendanceSessions, eq(attendanceEntries.sessionId, attendanceSessions.id))
      .where(
        and(
          eq(attendanceEntries.contactId, parsedContactId),
          eq(attendanceEntries.organizationId, parsedOrganizationId)
        )
      )
      .orderBy(desc(attendanceSessions.occurredAt), desc(attendanceEntries.recordedAt)),
    db.select({ assignment: serviceAssignments, serviceRun: serviceRuns })
      .from(serviceAssignments)
      .innerJoin(serviceRuns, eq(serviceAssignments.serviceRunId, serviceRuns.id))
      .innerJoin(volunteers, eq(serviceAssignments.volunteerId, volunteers.id))
      .where(
        and(
          eq(serviceAssignments.organizationId, parsedOrganizationId),
          eq(volunteers.contactId, parsedContactId)
        )
      )
      .orderBy(desc(serviceRuns.serviceAt), desc(serviceAssignments.checkedInAt)),
  ]);

  // Volunteer shifts if a volunteer record exists
  const shifts = volunteerRecord
    ? await db.select().from(volunteerShifts)
        .where(eq(volunteerShifts.volunteerId, volunteerRecord.id))
        .orderBy(desc(volunteerShifts.date))
    : [];

  const attendanceSummary = {
    worship: contactAttendance.filter(
      (row) => row.session.type === "worship" && row.entry.status === "present"
    ).length,
    ministry: contactAttendance.filter(
      (row) => row.session.type === "ministry" && row.entry.status === "present"
    ).length,
    serving: contactServiceAttendance.filter(
      (row) =>
        Boolean(row.assignment.checkedInAt) ||
        row.assignment.status === "checked_in" ||
        row.assignment.status === "checked_out"
    ).length,
    total: 0,
    lastRecordedAt: null as Date | null,
  };
  attendanceSummary.total =
    attendanceSummary.worship + attendanceSummary.ministry + attendanceSummary.serving;
  attendanceSummary.lastRecordedAt =
    [
      ...contactAttendance.map((row) => row.entry.recordedAt ?? row.session.occurredAt),
      ...contactServiceAttendance.map(
        (row) => row.assignment.checkedInAt ?? row.serviceRun.serviceAt
      ),
    ]
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const careSummary = {
    openPrayer: contactPrayer.filter((row) => row.status !== "answered" && row.status !== "archived")
      .length,
    openConversations: contactConversations.filter(
      (row) => row.status === "open" || row.status === "waiting"
    ).length,
    pendingAppointments: contactAppointments.filter(
      (row) =>
        row.status === "scheduled" ||
        row.status === "confirmed"
    ).length,
    openHandoffs: contactHandoffs.filter((row) => row.status !== "resolved").length,
    pendingGraceFollowups: contactFollowupProposals.filter((row) => row.status === "pending")
      .length,
    overdueItems:
      contactAppointments.filter(
        (row) =>
          (row.status === "scheduled" || row.status === "confirmed") &&
          new Date(row.dateTime).getTime() < Date.now()
      ).length +
      contactFollowupProposals.filter((row) => row.status === "pending").length,
  };

  const financeSummary = {
    totalGiving: contactDonations.reduce((sum, donation) => sum + Number(donation.amount ?? 0), 0),
    donationCount: contactDonations.length,
    activePledges: contactPledges.filter((pledge) => {
      if (!pledge.endDate) return true;
      return new Date(pledge.endDate).getTime() >= Date.now();
    }).length,
  };

  const timeline = [
    ...contactDonations.map((donation) => ({
      id: `donation:${donation.id}`,
      type: "donation",
      occurredAt: donation.date ?? donation.createdAt,
      title: `Donation received • $${Number(donation.amount ?? 0).toFixed(2)}`,
      detail: [donation.fund ?? "General", donation.method?.replaceAll("_", " ") ?? "cash"]
        .filter(Boolean)
        .join(" • "),
      status: donation.receiptSent ? "receipt_sent" : "receipt_pending",
    })),
    ...contactPledges.map((pledge) => ({
      id: `pledge:${pledge.id}`,
      type: "pledge",
      occurredAt: pledge.createdAt,
      title: `Pledge created • $${Number(pledge.totalAmount ?? 0).toFixed(2)}`,
      detail: [pledge.frequency, pledge.fund ?? "General"].filter(Boolean).join(" • "),
      status: pledge.endDate && new Date(pledge.endDate).getTime() < Date.now() ? "completed" : "active",
    })),
    ...contactPrayer.map((request) => ({
      id: `prayer:${request.id}`,
      type: "prayer_request",
      occurredAt: request.updatedAt ?? request.createdAt,
      title: `Prayer request • ${request.urgency}`,
      detail: request.content,
      status: request.status,
    })),
    ...contactAppointments.map((appointment) => ({
      id: `appointment:${appointment.id}`,
      type: "appointment",
      occurredAt: appointment.dateTime,
      title: appointment.title,
      detail: [appointment.type, appointment.notes].filter(Boolean).join(" • "),
      status: appointment.status,
    })),
    ...contactMinistries.map(({ membership, ministry }) => ({
      id: `ministry:${membership.id}`,
      type: "ministry_membership",
      occurredAt: membership.joinedAt,
      title: `Joined ${ministry.name}`,
      detail: membership.role.replaceAll("_", " "),
      status: membership.role,
    })),
    ...contactConversations.map((conversation) => ({
      id: `conversation:${conversation.id}`,
      type: "conversation",
      occurredAt:
        conversation.lastMessageAt ?? conversation.updatedAt ?? conversation.createdAt,
      title: `Conversation • ${conversation.channel}`,
      detail: conversation.subject ?? "No subject",
      status: conversation.status,
    })),
    ...contactGraceSessions.map((session) => ({
      id: `grace-session:${session.id}`,
      type: "grace_session",
      occurredAt: session.updatedAt ?? session.createdAt,
      title: `Grace ${session.channel} session`,
      detail: session.finalSummary ?? session.handoffReason ?? "Grace interaction recorded",
      status: session.status,
    })),
    ...contactHandoffs.map((handoff) => ({
      id: `grace-handoff:${handoff.id}`,
      type: "grace_handoff",
      occurredAt: handoff.createdAt,
      title: `Grace handoff • ${handoff.reason.replaceAll("_", " ")}`,
      detail: handoff.summaryText ?? handoff.assignedTeam ?? "Awaiting staff resolution",
      status: handoff.status,
    })),
    ...contactFollowupProposals.map((proposal) => ({
      id: `grace-followup:${proposal.id}`,
      type: "grace_followup",
      occurredAt: proposal.createdAt,
      title: `Grace follow-up proposal • ${proposal.proposedChannel}`,
      detail: proposal.reason ?? proposal.subject ?? proposal.messageText,
      status: proposal.status,
    })),
    ...contactAttendance.map((row) => ({
      id: `attendance:${row.entry.id}`,
      type: "attendance",
      occurredAt: row.session.occurredAt,
      title: `${row.session.name}`,
      detail: `${row.session.type} attendance • ${row.entry.status}`,
      status: row.entry.status,
    })),
    ...contactServiceAttendance.map((row) => ({
      id: `service-attendance:${row.assignment.id}`,
      type: "service_attendance",
      occurredAt: row.assignment.checkedInAt ?? row.serviceRun.serviceAt,
      title: `${row.serviceRun.name} • ${row.assignment.roleName}`,
      detail: row.assignment.notes ?? "Serving attendance recorded",
      status: row.assignment.status,
    })),
  ]
    .filter((item) => Boolean(item.occurredAt))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  return {
    contact,
    household: household
      ? {
          family: household,
          members: householdMembers,
        }
      : null,
    tags,
    donations: contactDonations,
    pledges: contactPledges,
    appointments: contactAppointments,
    prayer: contactPrayer,
    pipeline: pipelineData,
    volunteer: volunteerRecord,
    shifts,
    ministries: contactMinistries,
    conversations: contactConversations,
    graceSessions: contactGraceSessions,
    handoffs: contactHandoffs,
    followupProposals: contactFollowupProposals,
    attendance: contactAttendance,
    serviceAttendance: contactServiceAttendance,
    attendanceSummary,
    careSummary,
    financeSummary,
    timeline,
  };
}

// ── CSV Import ──────────────────────────────────────────────────────────────

export type ImportContactRow = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  family?: string;
  household?: string;
  tags?: string;
  memberStatus?: string;
  source?: string;
  firstVisitDate?: string;
  memberSinceDate?: string;
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
  family: z.string().optional(),
  household: z.string().optional(),
  tags: z.string().optional(),
  memberStatus: z.string().optional(),
  source: z.string().optional(),
  firstVisitDate: z.string().optional(),
  memberSinceDate: z.string().optional(),
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
  dateOfBirth: z.union([z.coerce.date(), z.null()]).optional(),
  firstVisitDate: z.union([z.coerce.date(), z.null()]).optional(),
  memberSinceDate: z.union([z.coerce.date(), z.null()]).optional(),
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
  dateOfBirth: z.union([z.coerce.date(), z.null()]).optional(),
  firstVisitDate: z.union([z.coerce.date(), z.null()]).optional(),
  memberSinceDate: z.union([z.coerce.date(), z.null()]).optional(),
  notes: z.string().trim().nullable().optional(),
});

const mergeContactsSchema = z.object({
  primaryContactId: contactIdSchema,
  duplicateContactId: contactIdSchema,
});

const VALID_ACTIVE_STATUSES = new Set(["visitor", "prospect", "regular_attendee", "member", "leader"]);
const MEMBER_LIKE_STATUSES = new Set<MemberStatusValue>(["member", "leader"]);

function isMemberLikeStatus(status: string | null | undefined): status is "member" | "leader" {
  const normalized = normalizeMemberStatusValue(status);
  return normalized ? MEMBER_LIKE_STATUSES.has(normalized) : false;
}

function normalizeContactSourceValue(value: string | null | undefined): ContactSourceValue {
  const normalized = typeof value === "string" ? value.trim() : "";
  const aliasMap: Record<string, ContactSourceValue> = {
    walkin: "walk_in",
    "walk in": "walk_in",
    guest_card: "walk_in",
    guestcard: "walk_in",
    web: "website",
    webform: "website",
    web_form: "website",
    online: "website",
    invite: "referral",
    friend: "referral",
    family: "referral",
    social: "social_media",
    instagram: "social_media",
    facebook: "social_media",
  };
  const collapsed = normalized.toLowerCase().replace(/[\s-]+/g, "_");
  return (
    CONTACT_SOURCE_VALUES.find((source) => source === collapsed) ??
    aliasMap[normalized.toLowerCase()] ??
    aliasMap[collapsed] ??
    "other"
  );
}

function normalizeImportDate(value: string | null | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} must be a valid date`);
  }
  return parsed;
}

function normalizeDelimitedTags(value: string | null | undefined) {
  if (!value) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .split(/[|,;]+/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

async function getOrCreateFamilyByName(params: {
  organizationId: string;
  familyName?: string | null;
}) {
  const normalized = params.familyName?.trim();
  if (!normalized) {
    return null;
  }

  const [existing] = await db
    .select()
    .from(families)
    .where(
      and(
        eq(families.organizationId, params.organizationId),
        sql`lower(trim(${families.name})) = ${normalized.toLowerCase()}`
      )
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(families)
    .values({
      organizationId: params.organizationId,
      name: normalized,
    })
    .returning();

  return created ?? null;
}

async function replaceContactTags(contactId: string, tags: string[]) {
  await db.delete(contactTags).where(eq(contactTags.contactId, contactId));
  if (tags.length === 0) {
    return;
  }
  await db.insert(contactTags).values(
    tags.map((tag) => ({
      contactId,
      tag,
    }))
  );
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

      const email = normalizeContactEmail(row.email);
      const phone = normalizeContactPhone(row.phone);
      const importedStatus = normalizeImportedMemberStatus(row.memberStatus);
      const source =
        row.source && row.source.trim().length > 0
          ? normalizeContactSourceValue(row.source)
          : undefined;
      const notes = row.notes?.trim() || null;
      const firstVisitDate = normalizeImportDate(row.firstVisitDate, "firstVisitDate");
      const memberSinceDate = normalizeImportDate(row.memberSinceDate, "memberSinceDate");
      const familyName = row.household?.trim() || row.family?.trim() || null;
      const tags = normalizeDelimitedTags(row.tags);
      const family = await getOrCreateFamilyByName({
        organizationId: parsedOrganizationId,
        familyName,
      });

      // Upsert: match existing contact by email or phone within this org
      const matchClauses = [];
      if (email) matchClauses.push(eq(churchContacts.email, email));
      if (phone) matchClauses.push(eq(churchContacts.phone, phone));

      const existing =
        matchClauses.length > 0
          ? await db
              .select({
                id: churchContacts.id,
                memberStatus: churchContacts.memberStatus,
                source: churchContacts.source,
                familyId: churchContacts.familyId,
                firstVisitDate: churchContacts.firstVisitDate,
                memberSinceDate: compatibleMemberSinceDate,
                notes: churchContacts.notes,
              })
              .from(churchContacts)
              .where(and(eq(churchContacts.organizationId, parsedOrganizationId), or(...matchClauses)))
              .limit(1)
          : [];

      if (existing[0]) {
        const [updatedContact] = await db
          .update(churchContacts)
          .set({
            firstName,
            lastName,
            email,
            phone,
            memberStatus: importedStatus ?? existing[0].memberStatus,
            source: source ?? existing[0].source ?? "walk_in",
            familyId: family?.id ?? existing[0].familyId ?? null,
            firstVisitDate: firstVisitDate ?? existing[0].firstVisitDate ?? null,
            memberSinceDate: memberSinceDate ?? existing[0].memberSinceDate ?? null,
            notes: notes ?? existing[0].notes ?? null,
            updatedAt: new Date(),
          })
          .where(eq(churchContacts.id, existing[0].id))
          .returning();
        if (row.tags !== undefined) {
          await replaceContactTags(updatedContact.id, tags);
        }
        await syncContactToDittofeedBestEffort("contacts.import.update", () =>
          syncContactUpdatedToDittofeed({
            organizationId: parsedOrganizationId,
            contact: updatedContact,
          })
        );
        result.updated++;
      } else {
        const memberStatus: MemberStatusValue = importedStatus ?? "visitor";
        const [createdContact] = await db.insert(churchContacts).values({
          firstName,
          lastName,
          email,
          phone,
          memberStatus,
          source: source ?? "walk_in",
          familyId: family?.id ?? null,
          firstVisitDate,
          memberSinceDate,
          notes,
          organizationId: parsedOrganizationId,
        }).returning();
        if (tags.length > 0) {
          await replaceContactTags(createdContact.id, tags);
        }
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
    db
      .select(compatibleChurchContactSelect)
      .from(churchContacts)
      .where(where)
      .orderBy(desc(churchContacts.createdAt))
      .limit(CONTACTS_PAGE_SIZE)
      .offset(offset),
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
    .select(compatibleChurchContactSelect)
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
  dateOfBirth?: Date | null;
  firstVisitDate?: Date | null;
  memberSinceDate?: Date | null;
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
      dateOfBirth: parsed.dateOfBirth ?? null,
      firstVisitDate: parsed.firstVisitDate ?? null,
      memberSinceDate: parsed.memberSinceDate ?? null,
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

  if (isMemberLikeStatus(contact.memberStatus)) {
    try {
      const { inngest } = await import("@/lib/inngest/client");
      const {
        INNGEST_EVENTS,
        buildContactMemberCreatedIdempotencyKey,
      } = await import("@/lib/inngest/events");

      const idempotencyKey = buildContactMemberCreatedIdempotencyKey({
        organizationId: parsed.organizationId,
        contactId: contact.id,
        memberStatus: contact.memberStatus,
        occurredAt: contact.createdAt.toISOString(),
      });

      await inngest.send({
        id: idempotencyKey,
        name: INNGEST_EVENTS.CONTACT_MEMBER_CREATED,
        data: {
          organizationId: parsed.organizationId,
          contactId: contact.id,
          memberStatus: contact.memberStatus,
          occurredAt: contact.createdAt.toISOString(),
          source: "contact_create",
          idempotencyKey,
        },
      });
    } catch (error) {
      console.error("[Contacts] Contact member workflow enqueue failed", {
        contactId: contact.id,
        organizationId: parsed.organizationId,
        error,
      });
    }
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
    dateOfBirth: Date | null;
    firstVisitDate: Date | null;
    memberSinceDate: Date | null;
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
    .select(compatibleChurchContactSelect)
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
  if (parsed.dateOfBirth !== undefined) patch.dateOfBirth = parsed.dateOfBirth;
  if (parsed.firstVisitDate !== undefined) patch.firstVisitDate = parsed.firstVisitDate;
  if (parsed.memberSinceDate !== undefined) patch.memberSinceDate = parsed.memberSinceDate;
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

  if (
    !isMemberLikeStatus(previousContact.memberStatus) &&
    isMemberLikeStatus(contact.memberStatus)
  ) {
    try {
      const { inngest } = await import("@/lib/inngest/client");
      const {
        INNGEST_EVENTS,
        buildContactMemberCreatedIdempotencyKey,
      } = await import("@/lib/inngest/events");

      const idempotencyKey = buildContactMemberCreatedIdempotencyKey({
        organizationId: existing.organizationId,
        contactId: contact.id,
        memberStatus: contact.memberStatus,
        occurredAt: contact.updatedAt.toISOString(),
      });

      await inngest.send({
        id: idempotencyKey,
        name: INNGEST_EVENTS.CONTACT_MEMBER_CREATED,
        data: {
          organizationId: existing.organizationId,
          contactId: contact.id,
          memberStatus: contact.memberStatus,
          occurredAt: contact.updatedAt.toISOString(),
          source: "contact_update",
          idempotencyKey,
        },
      });
    } catch (error) {
      console.error("[Contacts] Contact member workflow enqueue failed", {
        contactId: contact.id,
        organizationId: existing.organizationId,
        error,
      });
    }
  }
  return contact;
}

export async function archiveContact(id: string) {
  const contactId = contactIdSchema.parse(id);
  const existing = await requireContactAccess(contactId);
  const [previousContact] = await db
    .select(compatibleChurchContactSelect)
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
    .select(compatibleChurchContactSelect)
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
      .select(compatibleChurchContactSelect)
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.id, parsed.primaryContactId),
          eq(churchContacts.organizationId, organizationId)
        )
      )
      .limit(1);
    const [duplicate] = await tx
      .select(compatibleChurchContactSelect)
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
        memberSinceDate: primary.memberSinceDate ?? duplicate.memberSinceDate,
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
    const primaryAttendanceSessions = await tx
      .select({ sessionId: attendanceEntries.sessionId })
      .from(attendanceEntries)
      .where(
        and(
          eq(attendanceEntries.organizationId, organizationId),
          eq(attendanceEntries.contactId, parsed.primaryContactId)
        )
      );
    const primaryAttendanceSessionIds = Array.from(
      new Set(primaryAttendanceSessions.map((row) => row.sessionId))
    );
    if (primaryAttendanceSessionIds.length > 0) {
      await tx
        .delete(attendanceEntries)
        .where(
          and(
            eq(attendanceEntries.organizationId, organizationId),
            eq(attendanceEntries.contactId, parsed.duplicateContactId),
            inArray(attendanceEntries.sessionId, primaryAttendanceSessionIds)
          )
        );
    }
    await tx
      .update(attendanceEntries)
      .set({ contactId: parsed.primaryContactId })
      .where(
        and(
          eq(attendanceEntries.organizationId, organizationId),
          eq(attendanceEntries.contactId, parsed.duplicateContactId)
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
