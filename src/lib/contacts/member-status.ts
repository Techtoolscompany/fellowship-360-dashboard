export const MEMBER_STATUS_VALUES = [
  "visitor",
  "prospect",
  "regular_attendee",
  "member",
  "leader",
  "inactive",
] as const;

export type MemberStatusValue = (typeof MEMBER_STATUS_VALUES)[number];

const MEMBER_STATUS_LABELS: Record<MemberStatusValue, string> = {
  visitor: "Visitor",
  prospect: "New Guest",
  regular_attendee: "Regular Attendee",
  member: "Member",
  leader: "Leader",
  inactive: "Inactive",
};

const MEMBER_STATUS_PLURAL_LABELS: Record<MemberStatusValue, string> = {
  visitor: "Visitors",
  prospect: "New Guests",
  regular_attendee: "Regular Attendees",
  member: "Members",
  leader: "Leaders",
  inactive: "Archived",
};

const IMPORT_MEMBER_STATUS_ALIASES: Record<string, MemberStatusValue> = {
  visitor: "visitor",
  visitors: "visitor",
  prospect: "prospect",
  prospects: "prospect",
  new_guest: "prospect",
  new_guests: "prospect",
  newguest: "prospect",
  newguests: "prospect",
  regular_attendee: "regular_attendee",
  regular_attendees: "regular_attendee",
  member: "member",
  members: "member",
  leader: "leader",
  leaders: "leader",
  inactive: "inactive",
  archived: "inactive",
};

const STATUS_SET = new Set<string>(MEMBER_STATUS_VALUES);

export function getMemberStatusLabel(status: string | null | undefined) {
  const normalized = normalizeMemberStatusValue(status);
  return normalized ? MEMBER_STATUS_LABELS[normalized] : "Visitor";
}

export function getMemberStatusPluralLabel(status: string | null | undefined) {
  const normalized = normalizeMemberStatusValue(status);
  return normalized ? MEMBER_STATUS_PLURAL_LABELS[normalized] : "People";
}

export function normalizeMemberStatusValue(
  status: string | null | undefined
): MemberStatusValue | null {
  const normalized = normalizeStatusToken(status);
  if (!normalized || !STATUS_SET.has(normalized)) return null;
  return normalized as MemberStatusValue;
}

export function normalizeImportedMemberStatus(
  status: string | null | undefined
): MemberStatusValue | null {
  const normalized = normalizeStatusToken(status);
  if (!normalized) return null;
  return IMPORT_MEMBER_STATUS_ALIASES[normalized] ?? null;
}

function normalizeStatusToken(status: string | null | undefined) {
  if (!status) return "";
  return status.trim().toLowerCase().replace(/[\s-]+/g, "_");
}
