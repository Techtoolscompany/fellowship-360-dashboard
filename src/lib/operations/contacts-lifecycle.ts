import type { MemberStatusValue } from "@/lib/contacts/member-status";

export function normalizeContactEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

export function normalizeContactPhone(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits || null;
}

export function mergeContactNotes(
  primary: string | null,
  duplicate: string | null
) {
  if (!primary && !duplicate) return null;
  if (!primary) return duplicate;
  if (!duplicate) return primary;
  if (primary.trim() === duplicate.trim()) return primary;
  return `${primary}\n\nMerged note:\n${duplicate}`;
}

export function resolveMergedMemberStatus(
  primaryStatus: MemberStatusValue,
  duplicateStatus: MemberStatusValue
): MemberStatusValue {
  if (primaryStatus === "inactive" && duplicateStatus !== "inactive") {
    return duplicateStatus;
  }
  return primaryStatus;
}
