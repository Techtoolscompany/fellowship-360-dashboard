export const APPOINTMENT_LIFECYCLE_STATUSES = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type AppointmentLifecycleStatus =
  (typeof APPOINTMENT_LIFECYCLE_STATUSES)[number];

const APPOINTMENT_STATUS_TRANSITIONS: Record<
  AppointmentLifecycleStatus,
  AppointmentLifecycleStatus[]
> = {
  scheduled: ["confirmed", "cancelled", "no_show", "completed"],
  confirmed: ["scheduled", "completed", "cancelled", "no_show"],
  completed: [],
  cancelled: ["scheduled"],
  no_show: ["scheduled", "cancelled"],
};

export function canTransitionAppointmentStatus(
  currentStatus: AppointmentLifecycleStatus,
  nextStatus: AppointmentLifecycleStatus
) {
  if (currentStatus === nextStatus) return true;
  return APPOINTMENT_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function assertAppointmentStatusTransition(
  currentStatus: AppointmentLifecycleStatus,
  nextStatus: AppointmentLifecycleStatus
) {
  if (canTransitionAppointmentStatus(currentStatus, nextStatus)) {
    return;
  }
  throw new Error(
    `Cannot transition appointment from "${currentStatus}" to "${nextStatus}"`
  );
}

export function canRescheduleAppointment(status: AppointmentLifecycleStatus) {
  return status !== "completed";
}

export function getRescheduledAppointmentStatus(
  currentStatus: AppointmentLifecycleStatus
): AppointmentLifecycleStatus {
  if (currentStatus === "cancelled" || currentStatus === "no_show") {
    return "scheduled";
  }
  return currentStatus;
}
