import { churchContacts } from "@/db/schema";
import { identifyDittofeedUser, trackDittofeedEvent } from "./client";
import { resolveDittofeedProviderForOrganization } from "./provider";

const VISITOR_LIKE_STATUSES = new Set(["visitor", "prospect"]);
const MEMBER_LIKE_STATUSES = new Set(["regular_attendee", "member", "leader"]);

export const DITTOFEED_CONTACT_EVENTS = {
  created: "ChurchContactCreated",
  updated: "ChurchContactUpdated",
  statusChanged: "ChurchContactStatusChanged",
  archived: "ChurchContactArchived",
  restored: "ChurchContactRestored",
  visitorCreated: "ChurchVisitorCreated",
  memberCreated: "ChurchMemberCreated",
} as const;

type ContactDateLike = Date | string | null | undefined;

export type DittofeedContactSnapshot = Omit<
  typeof churchContacts.$inferSelect,
  "createdAt" | "updatedAt" | "dateOfBirth" | "firstVisitDate"
> & {
  createdAt: ContactDateLike;
  updatedAt: ContactDateLike;
  dateOfBirth: ContactDateLike;
  firstVisitDate: ContactDateLike;
};

function getString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toIsoString(value: ContactDateLike) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return null;
}

function buildContactTraits(params: {
  organizationId: string;
  organizationExternalId?: string | null;
  contact: DittofeedContactSnapshot;
}) {
  const fullName = `${params.contact.firstName} ${params.contact.lastName}`.trim();

  return {
    firstName: params.contact.firstName,
    lastName: params.contact.lastName,
    fullName,
    email: getString(params.contact.email),
    phone: getString(params.contact.phone),
    memberStatus: params.contact.memberStatus,
    source: params.contact.source,
    notes: getString(params.contact.notes),
    avatarUrl: getString(params.contact.avatarUrl),
    familyId: getString(params.contact.familyId),
    organizationId: params.organizationId,
    organizationExternalId: params.organizationExternalId ?? params.organizationId,
    firstVisitDate: toIsoString(params.contact.firstVisitDate),
    dateOfBirth: toIsoString(params.contact.dateOfBirth),
    createdAt: toIsoString(params.contact.createdAt),
    updatedAt: toIsoString(params.contact.updatedAt),
  };
}

function buildLifecycleProperties(params: {
  organizationId: string;
  organizationExternalId?: string | null;
  contact: DittofeedContactSnapshot;
  previousContact?: Partial<DittofeedContactSnapshot> | null;
  extraProperties?: Record<string, unknown>;
}) {
  return {
    contactId: params.contact.id,
    organizationId: params.organizationId,
    organizationExternalId: params.organizationExternalId ?? params.organizationId,
    memberStatus: params.contact.memberStatus,
    previousMemberStatus: params.previousContact?.memberStatus ?? null,
    source: params.contact.source,
    email: getString(params.contact.email),
    phone: getString(params.contact.phone),
    firstName: params.contact.firstName,
    lastName: params.contact.lastName,
    fullName: `${params.contact.firstName} ${params.contact.lastName}`.trim(),
    createdAt: toIsoString(params.contact.createdAt),
    updatedAt: toIsoString(params.contact.updatedAt),
    ...params.extraProperties,
  };
}

async function syncContactToDittofeed(params: {
  organizationId: string;
  contact: DittofeedContactSnapshot;
  primaryEvent?: string;
  previousContact?: Partial<DittofeedContactSnapshot> | null;
  extraProperties?: Record<string, unknown>;
}) {
  const provider = await resolveDittofeedProviderForOrganization(params.organizationId);
  if (!provider?.writeKey) return false;

  const organizationExternalId = provider.externalId ?? params.organizationId;
  await identifyDittofeedUser({
    baseUrl: provider.baseUrl,
    writeKey: provider.writeKey,
    userId: params.contact.id,
    messageId: `dittofeed-contact-identify-${params.contact.id}-${toIsoString(params.contact.updatedAt) ?? "updated"}`,
    traits: buildContactTraits({
      organizationId: params.organizationId,
      organizationExternalId,
      contact: params.contact,
    }),
  });

  const events: Array<{ event: string; properties?: Record<string, unknown> }> = [];
  if (params.primaryEvent) {
    events.push({
      event: params.primaryEvent,
      properties: buildLifecycleProperties({
        organizationId: params.organizationId,
        organizationExternalId,
        contact: params.contact,
        previousContact: params.previousContact,
        extraProperties: params.extraProperties,
      }),
    });
  }

  const previousStatus = params.previousContact?.memberStatus ?? null;
  if (
    previousStatus &&
    previousStatus !== params.contact.memberStatus
  ) {
    events.push({
      event: DITTOFEED_CONTACT_EVENTS.statusChanged,
      properties: buildLifecycleProperties({
        organizationId: params.organizationId,
        organizationExternalId,
        contact: params.contact,
        previousContact: params.previousContact,
        extraProperties: params.extraProperties,
      }),
    });
  }

  if (params.primaryEvent === DITTOFEED_CONTACT_EVENTS.created) {
    if (VISITOR_LIKE_STATUSES.has(params.contact.memberStatus)) {
      events.push({
        event: DITTOFEED_CONTACT_EVENTS.visitorCreated,
        properties: buildLifecycleProperties({
          organizationId: params.organizationId,
          organizationExternalId,
          contact: params.contact,
          previousContact: params.previousContact,
        }),
      });
    }

    if (MEMBER_LIKE_STATUSES.has(params.contact.memberStatus)) {
      events.push({
        event: DITTOFEED_CONTACT_EVENTS.memberCreated,
        properties: buildLifecycleProperties({
          organizationId: params.organizationId,
          organizationExternalId,
          contact: params.contact,
          previousContact: params.previousContact,
        }),
      });
    }
  }

  for (const row of events) {
    await trackDittofeedEvent({
      baseUrl: provider.baseUrl,
      writeKey: provider.writeKey,
      userId: params.contact.id,
      event: row.event,
      messageId: `dittofeed-contact-event-${row.event}-${params.contact.id}-${toIsoString(params.contact.updatedAt) ?? "updated"}`,
      properties: row.properties,
    });
  }

  return true;
}

export async function syncContactCreatedToDittofeed(params: {
  organizationId: string;
  contact: DittofeedContactSnapshot;
  extraProperties?: Record<string, unknown>;
}) {
  return syncContactToDittofeed({
    organizationId: params.organizationId,
    contact: params.contact,
    primaryEvent: DITTOFEED_CONTACT_EVENTS.created,
    extraProperties: params.extraProperties,
  });
}

export async function syncContactUpdatedToDittofeed(params: {
  organizationId: string;
  contact: DittofeedContactSnapshot;
  previousContact?: Partial<DittofeedContactSnapshot> | null;
  extraProperties?: Record<string, unknown>;
}) {
  return syncContactToDittofeed({
    organizationId: params.organizationId,
    contact: params.contact,
    previousContact: params.previousContact,
    primaryEvent: DITTOFEED_CONTACT_EVENTS.updated,
    extraProperties: params.extraProperties,
  });
}

export async function syncContactArchivedToDittofeed(params: {
  organizationId: string;
  contact: DittofeedContactSnapshot;
  previousContact?: Partial<DittofeedContactSnapshot> | null;
}) {
  return syncContactToDittofeed({
    organizationId: params.organizationId,
    contact: params.contact,
    previousContact: params.previousContact,
    primaryEvent: DITTOFEED_CONTACT_EVENTS.archived,
  });
}

export async function syncContactRestoredToDittofeed(params: {
  organizationId: string;
  contact: DittofeedContactSnapshot;
  previousContact?: Partial<DittofeedContactSnapshot> | null;
}) {
  return syncContactToDittofeed({
    organizationId: params.organizationId,
    contact: params.contact,
    previousContact: params.previousContact,
    primaryEvent: DITTOFEED_CONTACT_EVENTS.restored,
  });
}

export async function syncContactToDittofeedBestEffort(
  operation: string,
  work: () => Promise<unknown>
) {
  try {
    return await work();
  } catch (error) {
    console.error(`[Dittofeed] Failed to sync contact during ${operation}:`, error);
    return null;
  }
}
