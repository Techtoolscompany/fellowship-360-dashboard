export const CONVERSATION_LIFECYCLE_STATUSES = [
  "open",
  "waiting",
  "resolved",
  "archived",
] as const;

export type ConversationLifecycleStatus =
  (typeof CONVERSATION_LIFECYCLE_STATUSES)[number];

const CONVERSATION_STATUS_SET = new Set<string>(CONVERSATION_LIFECYCLE_STATUSES);

const CONVERSATION_STATUS_TRANSITIONS: Record<
  ConversationLifecycleStatus,
  ConversationLifecycleStatus[]
> = {
  open: ["waiting", "resolved", "archived"],
  waiting: ["open", "resolved", "archived"],
  resolved: ["open", "archived"],
  archived: ["open"],
};

export function parseConversationLifecycleStatus(
  status: string
): ConversationLifecycleStatus {
  if (!CONVERSATION_STATUS_SET.has(status)) {
    throw new Error(`Invalid conversation status: ${status}`);
  }
  return status as ConversationLifecycleStatus;
}

export function canTransitionConversationStatus(
  currentStatus: ConversationLifecycleStatus,
  nextStatus: ConversationLifecycleStatus
) {
  if (currentStatus === nextStatus) return true;
  return CONVERSATION_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function assertConversationStatusTransition(
  currentStatus: ConversationLifecycleStatus,
  nextStatus: ConversationLifecycleStatus
) {
  if (canTransitionConversationStatus(currentStatus, nextStatus)) {
    return;
  }
  throw new Error(
    `Cannot transition conversation from ${currentStatus} to ${nextStatus}`
  );
}
