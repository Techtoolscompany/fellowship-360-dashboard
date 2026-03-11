export const FIRST_TIME_GUEST_STAGE_KEYWORDS = {
  stageQualifier: /\b(first|new)\b/i,
  guestDescriptor: /\b(guest|visitor|visitors)\b/i,
} as const;

export function isFirstTimeGuestStageName(stageName: string | null | undefined) {
  if (!stageName) return false;
  const normalized = stageName.trim();
  if (!normalized) return false;

  return (
    FIRST_TIME_GUEST_STAGE_KEYWORDS.stageQualifier.test(normalized) &&
    FIRST_TIME_GUEST_STAGE_KEYWORDS.guestDescriptor.test(normalized)
  );
}

export function buildFirstTimeGuestTaskMarker(pipelineItemId: string) {
  return `[FirstTimeGuestAppointment:${pipelineItemId}]`;
}

export function buildFirstTimeGuestTaskTitle(contactName: string) {
  const normalized = contactName.trim() || "Guest";
  return `First-time guest appointment follow-up: ${normalized}`;
}
