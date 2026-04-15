import { sql } from "drizzle-orm";

import { churchContacts } from "@/db/schema";

export const compatibleMemberSinceDate = sql<Date | null>`
  nullif(to_jsonb(${churchContacts}) ->> 'member_since_date', '')::timestamp
`;

export const compatibleChurchContactSelect = {
  id: churchContacts.id,
  firstName: churchContacts.firstName,
  lastName: churchContacts.lastName,
  email: churchContacts.email,
  phone: churchContacts.phone,
  memberStatus: churchContacts.memberStatus,
  source: churchContacts.source,
  familyId: churchContacts.familyId,
  avatarUrl: churchContacts.avatarUrl,
  dateOfBirth: churchContacts.dateOfBirth,
  firstVisitDate: churchContacts.firstVisitDate,
  memberSinceDate: compatibleMemberSinceDate,
  notes: churchContacts.notes,
  organizationId: churchContacts.organizationId,
  createdAt: churchContacts.createdAt,
  updatedAt: churchContacts.updatedAt,
} as const;
