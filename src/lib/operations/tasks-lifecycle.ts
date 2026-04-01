export const TASK_LIFECYCLE_STATUSES = [
  "todo",
  "in_progress",
  "done",
  "cancelled",
] as const;

export type TaskLifecycleStatus = (typeof TASK_LIFECYCLE_STATUSES)[number];

export type TaskSlaStatus =
  | "overdue"
  | "due_soon"
  | "due_next_72h"
  | "on_track"
  | "no_due_date"
  | "closed";

const TASK_STATUS_TRANSITIONS: Record<
  TaskLifecycleStatus,
  TaskLifecycleStatus[]
> = {
  todo: ["in_progress", "done", "cancelled"],
  in_progress: ["todo", "done", "cancelled"],
  done: ["todo"],
  cancelled: ["todo"],
};

export function canTransitionTaskStatus(
  currentStatus: TaskLifecycleStatus,
  nextStatus: TaskLifecycleStatus
) {
  if (currentStatus === nextStatus) return true;
  return TASK_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function assertTaskStatusTransition(
  currentStatus: TaskLifecycleStatus,
  nextStatus: TaskLifecycleStatus
) {
  if (canTransitionTaskStatus(currentStatus, nextStatus)) {
    return;
  }
  throw new Error(
    `Cannot transition task from "${currentStatus}" to "${nextStatus}"`
  );
}

export function normalizeOptionalTaskDueDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error("Invalid dueDate");
    }
    return value;
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid dueDate");
  }
  return parsed;
}

export function computeTaskSlaStatus(
  task: {
    status: TaskLifecycleStatus;
    dueDate: Date | null;
  },
  now: Date = new Date()
): TaskSlaStatus {
  if (task.status === "done" || task.status === "cancelled") {
    return "closed";
  }
  if (!task.dueDate) {
    return "no_due_date";
  }

  const nowMs = now.getTime();
  const dueAtMs = task.dueDate.getTime();
  if (dueAtMs < nowMs) {
    return "overdue";
  }
  if (dueAtMs <= nowMs + 24 * 60 * 60 * 1000) {
    return "due_soon";
  }
  if (dueAtMs <= nowMs + 72 * 60 * 60 * 1000) {
    return "due_next_72h";
  }
  return "on_track";
}
