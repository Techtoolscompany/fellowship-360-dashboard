"use server";

import { db } from "@/db";
import {
  appointments,
  volunteers,
  volunteerShifts,
  serviceSchedulingProfiles,
  churchContacts,
  serviceTemplates,
  serviceTemplateRoleSlots,
  serviceTemplateTimelineSteps,
  serviceRuns,
  serviceAssignments,
  organizationMemberships,
  users,
  graceGoals,
  graceGoalSteps,
  graceMemory,
  tasks,
} from "@/db/schema";
import { eq, desc, and, gte, lte, ne, inArray, or, sql, ilike } from "drizzle-orm";
import { requireOrgMembership, auditAction } from "./utils";
import * as z from "zod";
import { inngest } from "@/lib/inngest/client";
import {
  INNGEST_EVENTS,
  buildAppointmentScheduledIdempotencyKey,
  buildGraceServiceAutostaffIdempotencyKey,
  buildServiceAssignmentReplacementIdempotencyKey,
  buildVolunteerCreatedIdempotencyKey,
} from "@/lib/inngest/events";
import { sendOrganizationSms } from "@/lib/sms-gateway/send";
import {
  APPOINTMENT_LIFECYCLE_STATUSES,
  assertAppointmentStatusTransition,
  canRescheduleAppointment,
  getRescheduledAppointmentStatus,
  type AppointmentLifecycleStatus,
} from "@/lib/operations/appointments-lifecycle";
import { compatibleChurchContactSelect } from "@/lib/contacts/projection";
import {
  buildVolunteerStaffingGoalResult,
  deriveVolunteerStaffingReplyProgress,
  ensureVolunteerStaffingGoalRecord,
  summarizeVolunteerStaffingAssignmentProgress,
  updateVolunteerStaffingGoalStatus,
  updateVolunteerStaffingGoalStep,
  VOLUNTEER_STAFFING_WORKFLOW_KEY,
} from "@/lib/grace/workflows/volunteer";
import {
  type SchedulingAvailabilitySlot,
  hasPreferredRoleMatch,
  isAvailabilityMatch,
  normalizeAvailabilitySlots,
  schedulingAvailabilitySlotSchema,
} from "@/lib/grace/assignment-scoring";
import {
  findStaffSchedulingConflict,
  findVolunteerSchedulingConflict,
  formatShortDateTime,
  parseAssignmentResponse,
  scoreStaffCandidate,
  scoreVolunteerCandidate,
} from "@/lib/operations/service-staffing";

function getConflictWindow(dateTime: Date) {
  return {
    start: new Date(dateTime.getTime() - 1000 * 60 * 30),
    end: new Date(dateTime.getTime() + 1000 * 60 * 30),
  };
}

async function findAppointmentConflict(params: {
  organizationId: string;
  dateTime: Date;
  excludeId?: string;
}) {
  const { start, end } = getConflictWindow(params.dateTime);
  const clauses = [
    eq(appointments.organizationId, params.organizationId),
    gte(appointments.dateTime, start),
    lte(appointments.dateTime, end),
    ne(appointments.status, "cancelled"),
    ne(appointments.status, "completed"),
  ];
  if (params.excludeId) {
    clauses.push(ne(appointments.id, params.excludeId));
  }

  const [conflict] = await db
    .select({
      id: appointments.id,
      title: appointments.title,
      dateTime: appointments.dateTime,
      status: appointments.status,
    })
    .from(appointments)
    .where(and(...clauses))
    .limit(1);

  return conflict ?? null;
}

function isAppointmentConflictError(error: unknown) {
  // Postgres exclusion violations return SQLSTATE 23P01.
  if (typeof error === "object" && error !== null && "code" in error) {
    return (error as { code?: string }).code === "23P01";
  }
  return false;
}

function normalizePhoneNumber(value: string | null | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

type PaidStaffLedgerStatus = "completed" | "no_show" | "cancelled" | "open";

type PaidStaffShiftLedgerItem = {
  assignmentId: string;
  serviceRunId: string;
  serviceRunName: string;
  serviceAt: Date;
  roleName: string;
  staffUserId: string | null;
  staffName: string | null;
  staffEmail: string | null;
  assignmentStatus: typeof serviceAssignments.$inferSelect.status;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
  runDurationMinutes: number;
  workedMinutes: number;
  status: PaidStaffLedgerStatus;
  payrollExportedAt: Date | null;
};

function computeWorkedMinutes(params: {
  checkedInAt: Date | string | null;
  checkedOutAt: Date | string | null;
  fallbackDurationMinutes: number;
}) {
  if (params.checkedInAt && params.checkedOutAt) {
    const checkedInAt = new Date(params.checkedInAt);
    const checkedOutAt = new Date(params.checkedOutAt);
    if (
      !Number.isNaN(checkedInAt.getTime()) &&
      !Number.isNaN(checkedOutAt.getTime()) &&
      checkedOutAt.getTime() >= checkedInAt.getTime()
    ) {
      return Math.max(
        0,
        Math.round((checkedOutAt.getTime() - checkedInAt.getTime()) / 60_000)
      );
    }
  }
  return Math.max(0, Math.round(params.fallbackDurationMinutes));
}

function resolvePaidStaffLedgerStatus(
  assignmentStatus: typeof serviceAssignments.$inferSelect.status
): PaidStaffLedgerStatus {
  if (assignmentStatus === "checked_out") return "completed";
  if (assignmentStatus === "no_show") return "no_show";
  if (assignmentStatus === "cancelled") return "cancelled";
  return "open";
}

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}

function toIsoDateTime(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

// ── Appointments ──
export async function getAppointments(
  orgId: string,
  filters?: { status?: string }
) {
  await requireOrgMembership(orgId);
  if (filters?.status) {
    return await db
      .select({ appointment: appointments, contact: compatibleChurchContactSelect })
      .from(appointments)
      .leftJoin(
        churchContacts,
        eq(appointments.contactId, churchContacts.id)
      )
      .where(
        and(
          eq(appointments.organizationId, orgId),
          eq(appointments.status, filters.status as any)
        )
      )
      .orderBy(appointments.dateTime);
  }
  return await db
    .select({ appointment: appointments, contact: compatibleChurchContactSelect })
    .from(appointments)
    .leftJoin(churchContacts, eq(appointments.contactId, churchContacts.id))
    .where(eq(appointments.organizationId, orgId))
    .orderBy(appointments.dateTime);
}

export async function createAppointment(data: {
  contactId?: string;
  staffId?: string;
  title: string;
  dateTime: Date;
  duration?: number;
  type?: string;
  notes?: string;
  organizationId: string;
}) {
  const parsed = z.object({
    contactId: z.string().optional(),
    staffId: z.string().optional(),
    title: z.string().min(1),
    dateTime: z.coerce.date(),
    duration: z.coerce.number().optional().default(30),
    type: z.string().optional(),
    notes: z.string().optional(),
    organizationId: z.string().min(1),
  }).parse(data);

  const session = await requireOrgMembership(parsed.organizationId);
  const conflict = await findAppointmentConflict({
    organizationId: parsed.organizationId,
    dateTime: parsed.dateTime,
  });
  if (conflict) {
    throw new Error("Appointment slot conflict. Please choose another time.");
  }

  let appointment;
  try {
    [appointment] = await db
      .insert(appointments)
      .values({
        contactId: parsed.contactId ?? null,
        staffId: parsed.staffId ?? null,
        title: parsed.title,
        dateTime: parsed.dateTime,
        duration: parsed.duration,
        type: parsed.type ?? null,
        notes: parsed.notes ?? null,
        organizationId: parsed.organizationId,
      })
      .returning();
  } catch (error) {
    if (isAppointmentConflictError(error)) {
      throw new Error("Appointment slot conflict. Please choose another time.");
    }
    throw error;
  }

  await auditAction({
    organizationId: parsed.organizationId,
    userId: session.userId,
    actionType: "create",
    entityName: "appointment",
    entityId: appointment.id,
    details: { contactId: parsed.contactId, staffId: parsed.staffId, type: parsed.type }
  });

  try {
    const idempotencyKey = buildAppointmentScheduledIdempotencyKey({
      organizationId: parsed.organizationId,
      appointmentId: appointment.id,
    });
    await inngest.send({
      id: idempotencyKey,
      name: INNGEST_EVENTS.APPOINTMENT_SCHEDULED,
      data: {
        organizationId: parsed.organizationId,
        appointmentId: appointment.id,
        contactId: appointment.contactId ?? undefined,
        staffId: appointment.staffId ?? undefined,
        title: appointment.title,
        dateTime: appointment.dateTime.toISOString(),
        duration: appointment.duration ?? undefined,
        type: appointment.type ?? null,
        status: "scheduled",
        idempotencyKey,
      },
    });
  } catch (error) {
    console.error("[Operations] Appointment scheduled workflow enqueue failed", {
      appointmentId: appointment.id,
      organizationId: parsed.organizationId,
      error,
    });
  }

  return appointment;
}

export async function updateAppointment(
  id: string,
  data: Partial<{
    contactId: string | null;
    staffId: string | null;
    title: string;
    status: AppointmentLifecycleStatus;
    dateTime: Date;
    duration: number;
    type: string | null;
    notes: string | null;
  }>
) {
  const parsed = z.object({
    contactId: z.string().nullable().optional(),
    staffId: z.string().nullable().optional(),
    title: z.string().optional(),
    status: z.enum(APPOINTMENT_LIFECYCLE_STATUSES).optional(),
    dateTime: z.coerce.date().optional(),
    duration: z.coerce.number().optional(),
    type: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  }).parse(data);

  const [existing] = await db.select().from(appointments).where(eq(appointments.id, id));
  if (!existing) throw new Error("Appointment not found");
  const session = await requireOrgMembership(existing.organizationId);
  const currentStatus = existing.status as AppointmentLifecycleStatus;

  if (parsed.status) {
    assertAppointmentStatusTransition(currentStatus, parsed.status);
  }

  if (parsed.dateTime) {
    if (!canRescheduleAppointment(currentStatus)) {
      throw new Error("Completed appointments cannot be rescheduled.");
    }
    const conflict = await findAppointmentConflict({
      organizationId: existing.organizationId,
      dateTime: parsed.dateTime,
      excludeId: id,
    });
    if (conflict) {
      throw new Error("Appointment slot conflict. Please choose another time.");
    }
  }

  let appointment;
  try {
    [appointment] = await db
      .update(appointments)
      .set(parsed as any)
      .where(eq(appointments.id, id))
      .returning();
  } catch (error) {
    if (isAppointmentConflictError(error)) {
      throw new Error("Appointment slot conflict. Please choose another time.");
    }
    throw error;
  }

  await auditAction({
    organizationId: existing.organizationId,
    userId: session.userId,
    actionType: "update",
    entityName: "appointment",
    entityId: appointment.id,
    details: {
      updatedFields: Object.keys(data),
      fromStatus: existing.status,
      toStatus: appointment.status,
      fromDateTime: existing.dateTime?.toISOString?.() ?? null,
      toDateTime: appointment.dateTime?.toISOString?.() ?? null,
    }
  });

  return appointment;
}

export async function rescheduleAppointment(data: {
  appointmentId: string;
  dateTime: Date;
  duration?: number;
  notes?: string | null;
  resetStatus?: boolean;
}) {
  const parsed = z
    .object({
      appointmentId: z.string().min(1),
      dateTime: z.coerce.date(),
      duration: z.coerce.number().optional(),
      notes: z.string().nullable().optional(),
      resetStatus: z.boolean().optional().default(true),
    })
    .parse(data);

  const [existing] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, parsed.appointmentId))
    .limit(1);
  if (!existing) throw new Error("Appointment not found");

  const session = await requireOrgMembership(existing.organizationId);
  const currentStatus = existing.status as AppointmentLifecycleStatus;
  if (!canRescheduleAppointment(currentStatus)) {
    throw new Error("Completed appointments cannot be rescheduled.");
  }

  const conflict = await findAppointmentConflict({
    organizationId: existing.organizationId,
    dateTime: parsed.dateTime,
    excludeId: parsed.appointmentId,
  });
  if (conflict) {
    throw new Error("Appointment slot conflict. Please choose another time.");
  }

  const patch: {
    dateTime: Date;
    duration?: number;
    notes?: string | null;
    status?: AppointmentLifecycleStatus;
  } = {
    dateTime: parsed.dateTime,
  };
  if (parsed.duration !== undefined) patch.duration = parsed.duration;
  if (parsed.notes !== undefined) patch.notes = parsed.notes;
  if (parsed.resetStatus) {
    patch.status = getRescheduledAppointmentStatus(currentStatus);
  }

  let appointment;
  try {
    [appointment] = await db
      .update(appointments)
      .set(patch as any)
      .where(eq(appointments.id, parsed.appointmentId))
      .returning();
  } catch (error) {
    if (isAppointmentConflictError(error)) {
      throw new Error("Appointment slot conflict. Please choose another time.");
    }
    throw error;
  }

  await auditAction({
    organizationId: existing.organizationId,
    userId: session.userId,
    actionType: "update",
    entityName: "appointment",
    entityId: appointment.id,
    details: {
      operation: "reschedule",
      fromDateTime: existing.dateTime?.toISOString?.() ?? null,
      toDateTime: appointment.dateTime?.toISOString?.() ?? null,
      fromStatus: existing.status,
      toStatus: appointment.status,
      duration: appointment.duration,
    },
  });

  return appointment;
}

export async function deleteAppointment(appointmentId: string) {
  const parsed = z.string().min(1).parse(appointmentId);

  const [existing] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, parsed))
    .limit(1);
  if (!existing) throw new Error("Appointment not found");

  const session = await requireOrgMembership(existing.organizationId, "admin");
  const [deleted] = await db
    .delete(appointments)
    .where(eq(appointments.id, parsed))
    .returning({ id: appointments.id });

  await auditAction({
    organizationId: existing.organizationId,
    userId: session.userId,
    actionType: "delete",
    entityName: "appointment",
    entityId: deleted.id,
    details: {
      status: existing.status,
      dateTime: existing.dateTime?.toISOString?.() ?? null,
      contactId: existing.contactId,
      staffId: existing.staffId,
    },
  });

  return { id: deleted.id };
}

// ── Volunteers ──
const volunteerStatusSchema = z.enum(["active", "inactive", "pending"]);
type VolunteerStatus = z.infer<typeof volunteerStatusSchema>;

const VOLUNTEER_STATUS_TRANSITIONS: Record<VolunteerStatus, VolunteerStatus[]> = {
  active: ["inactive", "pending"],
  inactive: ["active", "pending"],
  pending: ["active", "inactive"],
};

function assertVolunteerStatusTransition(
  currentStatus: VolunteerStatus,
  nextStatus: VolunteerStatus
) {
  if (currentStatus === nextStatus) return;
  const allowed = VOLUNTEER_STATUS_TRANSITIONS[currentStatus];
  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Cannot transition volunteer from "${currentStatus}" to "${nextStatus}"`
    );
  }
}

export async function getVolunteers(orgId: string) {
  await requireOrgMembership(orgId);
  return await db
    .select({ volunteer: volunteers, contact: compatibleChurchContactSelect })
    .from(volunteers)
    .leftJoin(churchContacts, eq(volunteers.contactId, churchContacts.id))
    .where(eq(volunteers.organizationId, orgId))
    .orderBy(desc(volunteers.joinedAt));
}

export async function createVolunteer(data: {
  contactId: string;
  role?: string;
  status?: string;
  organizationId: string;
}) {
  const parsed = z.object({
    contactId: z.string().min(1),
    role: z.string().optional(),
    status: volunteerStatusSchema.optional(),
    organizationId: z.string().min(1),
  }).parse(data);

  const session = await requireOrgMembership(parsed.organizationId);
  const [contact] = await db
    .select({ id: churchContacts.id })
    .from(churchContacts)
    .where(
      and(
        eq(churchContacts.id, parsed.contactId),
        eq(churchContacts.organizationId, parsed.organizationId)
      )
    )
    .limit(1);

  if (!contact) {
    throw new Error("Contact not found in this organization");
  }

  const [existing] = await db
    .select()
    .from(volunteers)
    .where(
      and(
        eq(volunteers.organizationId, parsed.organizationId),
        eq(volunteers.contactId, parsed.contactId)
      )
    )
    .limit(1);

  let volunteer;
  if (existing) {
    const patch: {
      role?: string | null;
      status?: VolunteerStatus;
    } = {};

    if (parsed.role !== undefined && parsed.role !== existing.role) {
      patch.role = parsed.role || null;
    }
    if (parsed.status && parsed.status !== existing.status) {
      assertVolunteerStatusTransition(existing.status as VolunteerStatus, parsed.status);
      patch.status = parsed.status;
    }

    if (Object.keys(patch).length > 0) {
      [volunteer] = await db
        .update(volunteers)
        .set(patch)
        .where(eq(volunteers.id, existing.id))
        .returning();
    } else {
      volunteer = existing;
    }
  } else {
    [volunteer] = await db
      .insert(volunteers)
      .values({
        contactId: parsed.contactId,
        role: parsed.role ?? null,
        status: parsed.status ?? "active",
        organizationId: parsed.organizationId,
      })
      .returning();
  }

  await auditAction({
    organizationId: parsed.organizationId,
    userId: session.userId,
    actionType: existing ? "update" : "create",
    entityName: "volunteer",
    entityId: volunteer.id,
    details: {
      contactId: parsed.contactId,
      role: parsed.role,
      status: parsed.status ?? volunteer.status,
      mode: existing ? "upsert_existing" : "created",
    }
  });

  if (!existing) {
    try {
      const idempotencyKey = buildVolunteerCreatedIdempotencyKey({
        organizationId: parsed.organizationId,
        volunteerId: volunteer.id,
      });

      await inngest.send({
        id: idempotencyKey,
        name: INNGEST_EVENTS.VOLUNTEER_CREATED,
        data: {
          organizationId: parsed.organizationId,
          volunteerId: volunteer.id,
          contactId: parsed.contactId,
          role: volunteer.role ?? null,
          status: volunteer.status,
          idempotencyKey,
        },
      });
    } catch (error) {
      console.error("[Operations] Volunteer created workflow enqueue failed", {
        volunteerId: volunteer.id,
        organizationId: parsed.organizationId,
        error,
      });
    }
  }

  return volunteer;
}

export async function updateVolunteer(
  volunteerId: string,
  data: Partial<{
    role: string | null;
    status: VolunteerStatus;
    contactId: string;
  }>
) {
  const parsed = z
    .object({
      role: z.string().nullable().optional(),
      status: volunteerStatusSchema.optional(),
      contactId: z.string().min(1).optional(),
    })
    .parse(data);

  const [existing] = await db
    .select()
    .from(volunteers)
    .where(eq(volunteers.id, volunteerId))
    .limit(1);
  if (!existing) {
    throw new Error("Volunteer not found");
  }

  const session = await requireOrgMembership(existing.organizationId, "admin");

  if (parsed.contactId) {
    const [contact] = await db
      .select({ id: churchContacts.id })
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.id, parsed.contactId),
          eq(churchContacts.organizationId, existing.organizationId)
        )
      )
      .limit(1);

    if (!contact) {
      throw new Error("Contact not found in this organization");
    }

    const [duplicate] = await db
      .select({ id: volunteers.id })
      .from(volunteers)
      .where(
        and(
          eq(volunteers.organizationId, existing.organizationId),
          eq(volunteers.contactId, parsed.contactId),
          ne(volunteers.id, existing.id)
        )
      )
      .limit(1);

    if (duplicate) {
      throw new Error("That contact already has a volunteer record");
    }
  }

  if (parsed.status) {
    assertVolunteerStatusTransition(
      existing.status as VolunteerStatus,
      parsed.status
    );
  }

  const patch: {
    role?: string | null;
    status?: VolunteerStatus;
    contactId?: string;
  } = {};

  if (parsed.role !== undefined) patch.role = parsed.role;
  if (parsed.status !== undefined) patch.status = parsed.status;
  if (parsed.contactId !== undefined) patch.contactId = parsed.contactId;

  if (Object.keys(patch).length === 0) {
    return existing;
  }

  const [updated] = await db
    .update(volunteers)
    .set(patch)
    .where(eq(volunteers.id, volunteerId))
    .returning();

  await auditAction({
    organizationId: existing.organizationId,
    userId: session.userId,
    actionType: "update",
    entityName: "volunteer",
    entityId: updated.id,
    details: {
      role: updated.role,
      status: updated.status,
      contactId: updated.contactId,
    },
  });

  return updated;
}

export async function deleteVolunteer(volunteerId: string) {
  const [existing] = await db
    .select()
    .from(volunteers)
    .where(eq(volunteers.id, volunteerId))
    .limit(1);
  if (!existing) {
    throw new Error("Volunteer not found");
  }

  const session = await requireOrgMembership(existing.organizationId, "admin");

  const [activeAssignmentCountRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(serviceAssignments)
    .where(
      and(
        eq(serviceAssignments.organizationId, existing.organizationId),
        eq(serviceAssignments.volunteerId, existing.id),
        inArray(serviceAssignments.status, [
          "proposed",
          "offered",
          "confirmed",
          "needs_replacement",
          "checked_in",
        ])
      )
    );

  if ((activeAssignmentCountRow?.count ?? 0) > 0) {
    throw new Error(
      "Volunteer has active service assignments. Reassign those seats before deleting."
    );
  }

  const [shiftCountRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(volunteerShifts)
    .where(eq(volunteerShifts.volunteerId, existing.id));

  const [deleted] = await db
    .delete(volunteers)
    .where(eq(volunteers.id, existing.id))
    .returning({ id: volunteers.id });

  await auditAction({
    organizationId: existing.organizationId,
    userId: session.userId,
    actionType: "delete",
    entityName: "volunteer",
    entityId: deleted.id,
    details: {
      contactId: existing.contactId,
      deletedShiftCount: shiftCountRow?.count ?? 0,
    },
  });

  return {
    id: deleted.id,
    deletedShiftCount: shiftCountRow?.count ?? 0,
  };
}

export async function logVolunteerShift(data: {
  volunteerId: string;
  eventId?: string;
  date: Date;
  hours: number;
  notes?: string;
}) {
  const parsed = z.object({
    volunteerId: z.string().min(1),
    eventId: z.string().optional(),
    date: z.coerce.date(),
    hours: z.coerce.number().positive(),
    notes: z.string().optional(),
  }).parse(data);

  const [volunteer] = await db.select().from(volunteers).where(eq(volunteers.id, parsed.volunteerId));
  if (!volunteer) throw new Error("Volunteer not found");
  const session = await requireOrgMembership(volunteer.organizationId);

  const [shift] = await db
    .insert(volunteerShifts)
    .values({
      volunteerId: parsed.volunteerId,
      eventId: parsed.eventId ?? null,
      date: parsed.date,
      hours: parsed.hours,
      notes: parsed.notes ?? null,
    })
    .returning();

  await auditAction({
    organizationId: volunteer.organizationId,
    userId: session.userId,
    actionType: "create",
    entityName: "volunteer_shift",
    entityId: shift.id,
    details: { volunteerId: parsed.volunteerId, hours: parsed.hours }
  });

  return shift;
}

export async function getVolunteerShifts(data: {
  organizationId: string;
  volunteerId?: string;
  fromDate?: Date;
  toDate?: Date;
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      volunteerId: z.string().min(1).optional(),
      fromDate: z.coerce.date().optional(),
      toDate: z.coerce.date().optional(),
    })
    .parse(data);

  await requireOrgMembership(parsed.organizationId);

  const clauses = [eq(volunteers.organizationId, parsed.organizationId)];
  if (parsed.volunteerId) {
    clauses.push(eq(volunteerShifts.volunteerId, parsed.volunteerId));
  }
  if (parsed.fromDate) {
    clauses.push(gte(volunteerShifts.date, parsed.fromDate));
  }
  if (parsed.toDate) {
    clauses.push(lte(volunteerShifts.date, parsed.toDate));
  }

  return db
    .select({
      shift: volunteerShifts,
      volunteer: volunteers,
      contact: compatibleChurchContactSelect,
    })
    .from(volunteerShifts)
    .innerJoin(volunteers, eq(volunteerShifts.volunteerId, volunteers.id))
    .leftJoin(churchContacts, eq(volunteers.contactId, churchContacts.id))
    .where(and(...clauses))
    .orderBy(desc(volunteerShifts.date));
}

export async function updateVolunteerShift(
  shiftId: string,
  data: Partial<{
    eventId: string | null;
    date: Date;
    hours: number;
    notes: string | null;
  }>
) {
  const parsed = z
    .object({
      eventId: z.string().nullable().optional(),
      date: z.coerce.date().optional(),
      hours: z.coerce.number().positive().optional(),
      notes: z.string().nullable().optional(),
    })
    .parse(data);

  const [existing] = await db
    .select({
      shiftId: volunteerShifts.id,
      organizationId: volunteers.organizationId,
    })
    .from(volunteerShifts)
    .innerJoin(volunteers, eq(volunteerShifts.volunteerId, volunteers.id))
    .where(eq(volunteerShifts.id, shiftId))
    .limit(1);
  if (!existing) {
    throw new Error("Volunteer shift not found");
  }

  const session = await requireOrgMembership(existing.organizationId, "admin");

  const patch: {
    eventId?: string | null;
    date?: Date;
    hours?: number;
    notes?: string | null;
  } = {};
  if (parsed.eventId !== undefined) patch.eventId = parsed.eventId;
  if (parsed.date !== undefined) patch.date = parsed.date;
  if (parsed.hours !== undefined) patch.hours = parsed.hours;
  if (parsed.notes !== undefined) patch.notes = parsed.notes;

  if (Object.keys(patch).length === 0) {
    const [unchanged] = await db
      .select()
      .from(volunteerShifts)
      .where(eq(volunteerShifts.id, shiftId))
      .limit(1);
    return unchanged;
  }

  const [updated] = await db
    .update(volunteerShifts)
    .set(patch)
    .where(eq(volunteerShifts.id, shiftId))
    .returning();

  await auditAction({
    organizationId: existing.organizationId,
    userId: session.userId,
    actionType: "update",
    entityName: "volunteer_shift",
    entityId: updated.id,
    details: {
      hours: updated.hours,
      date: updated.date.toISOString(),
      eventId: updated.eventId,
    },
  });

  return updated;
}

export async function deleteVolunteerShift(shiftId: string) {
  const [existing] = await db
    .select({
      shiftId: volunteerShifts.id,
      organizationId: volunteers.organizationId,
      volunteerId: volunteerShifts.volunteerId,
    })
    .from(volunteerShifts)
    .innerJoin(volunteers, eq(volunteerShifts.volunteerId, volunteers.id))
    .where(eq(volunteerShifts.id, shiftId))
    .limit(1);
  if (!existing) {
    throw new Error("Volunteer shift not found");
  }

  const session = await requireOrgMembership(existing.organizationId, "admin");
  const [deleted] = await db
    .delete(volunteerShifts)
    .where(eq(volunteerShifts.id, shiftId))
    .returning({ id: volunteerShifts.id });

  await auditAction({
    organizationId: existing.organizationId,
    userId: session.userId,
    actionType: "delete",
    entityName: "volunteer_shift",
    entityId: deleted.id,
    details: {
      volunteerId: existing.volunteerId,
    },
  });

  return { id: deleted.id };
}

type ServiceSchedulingMatrixPersonRow = {
  id: string;
  sourceType: "contact" | "staff";
  personType: "member" | "volunteer" | "paid_staff";
  contactId: string | null;
  volunteerId: string | null;
  staffUserId: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  memberStatus: string | null;
  volunteerRole: string | null;
  staffRole: string | null;
  isSchedulable: boolean;
  preferredRoles: string[];
  availabilitySlots: SchedulingAvailabilitySlot[];
  notes: string | null;
  hasProfile: boolean;
};

export async function getServiceSchedulingMatrix(orgId: string) {
  await requireOrgMembership(orgId);

  const [memberContacts, volunteerRows, staffRows, profileRows] = await Promise.all([
    db
      .select({
        id: churchContacts.id,
        firstName: churchContacts.firstName,
        lastName: churchContacts.lastName,
        email: churchContacts.email,
        phone: churchContacts.phone,
        memberStatus: churchContacts.memberStatus,
      })
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.organizationId, orgId),
          or(
            eq(churchContacts.memberStatus, "member"),
            eq(churchContacts.memberStatus, "leader"),
            eq(churchContacts.memberStatus, "regular_attendee")
          )
        )
      )
      .orderBy(churchContacts.firstName, churchContacts.lastName),
    db
      .select({
        volunteerId: volunteers.id,
        role: volunteers.role,
        status: volunteers.status,
        contactId: volunteers.contactId,
        firstName: churchContacts.firstName,
        lastName: churchContacts.lastName,
        email: churchContacts.email,
        phone: churchContacts.phone,
        memberStatus: churchContacts.memberStatus,
      })
      .from(volunteers)
      .leftJoin(churchContacts, eq(volunteers.contactId, churchContacts.id))
      .where(eq(volunteers.organizationId, orgId))
      .orderBy(desc(volunteers.joinedAt)),
    db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: organizationMemberships.role,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(eq(organizationMemberships.organizationId, orgId))
      .orderBy(users.name, users.email),
    db
      .select()
      .from(serviceSchedulingProfiles)
      .where(eq(serviceSchedulingProfiles.organizationId, orgId)),
  ]);

  const contactProfileById = new Map<
    string,
    {
      isSchedulable: boolean;
      preferredRoles: string[];
      availabilitySlots: SchedulingAvailabilitySlot[];
      notes: string | null;
    }
  >();
  const staffProfileById = new Map<
    string,
    {
      isSchedulable: boolean;
      preferredRoles: string[];
      availabilitySlots: SchedulingAvailabilitySlot[];
      notes: string | null;
    }
  >();

  for (const row of profileRows) {
    const preferredRoles = Array.isArray(row.preferredRoles)
      ? row.preferredRoles.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const availabilitySlots = normalizeAvailabilitySlots(row.availabilitySlots);
    const normalized = {
      isSchedulable: row.isSchedulable,
      preferredRoles,
      availabilitySlots,
      notes: row.notes ?? null,
    };

    if (row.personType === "contact" && row.contactId) {
      contactProfileById.set(row.contactId, normalized);
    }
    if (row.personType === "staff" && row.staffUserId) {
      staffProfileById.set(row.staffUserId, normalized);
    }
  }

  const contactById = new Map<
    string,
    {
      contactId: string;
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
      memberStatus: string;
      volunteerId: string | null;
      volunteerRole: string | null;
      volunteerStatus: string | null;
    }
  >();

  for (const row of memberContacts) {
    contactById.set(row.id, {
      contactId: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      phone: row.phone,
      memberStatus: row.memberStatus,
      volunteerId: null,
      volunteerRole: null,
      volunteerStatus: null,
    });
  }

  for (const row of volunteerRows) {
    if (!row.contactId) continue;
    const current = contactById.get(row.contactId);
    const next = {
      contactId: row.contactId,
      firstName: row.firstName ?? current?.firstName ?? "Unknown",
      lastName: row.lastName ?? current?.lastName ?? "Contact",
      email: row.email ?? current?.email ?? null,
      phone: row.phone ?? current?.phone ?? null,
      memberStatus: row.memberStatus ?? current?.memberStatus ?? "visitor",
      volunteerId: row.volunteerId,
      volunteerRole: row.role ?? null,
      volunteerStatus: row.status,
    };
    contactById.set(row.contactId, next);
  }

  const contactPeople: ServiceSchedulingMatrixPersonRow[] = Array.from(contactById.values())
    .map((row) => {
      const profile = contactProfileById.get(row.contactId);
      const defaultPreferredRoles = row.volunteerRole ? [row.volunteerRole] : [];
      const defaultSchedulable =
        row.volunteerStatus === "active" ||
        row.memberStatus === "member" ||
        row.memberStatus === "leader";

      return {
        id: `contact:${row.contactId}`,
        sourceType: "contact" as const,
        personType: (row.volunteerId ? "volunteer" : "member") as
          | "volunteer"
          | "member",
        contactId: row.contactId,
        volunteerId: row.volunteerId,
        staffUserId: null,
        displayName: `${row.firstName} ${row.lastName}`.trim(),
        email: row.email,
        phone: row.phone,
        memberStatus: row.memberStatus,
        volunteerRole: row.volunteerRole,
        staffRole: null,
        isSchedulable: profile ? profile.isSchedulable : defaultSchedulable,
        preferredRoles: profile ? profile.preferredRoles : defaultPreferredRoles,
        availabilitySlots: profile ? profile.availabilitySlots : [],
        notes: profile ? profile.notes : null,
        hasProfile: Boolean(profile),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const staffPeople: ServiceSchedulingMatrixPersonRow[] = staffRows
    .map((row) => {
      const profile = staffProfileById.get(row.userId);
      return {
        id: `staff:${row.userId}`,
        sourceType: "staff" as const,
        personType: "paid_staff" as const,
        contactId: null,
        volunteerId: null,
        staffUserId: row.userId,
        displayName: row.name || row.email || "Staff Member",
        email: row.email,
        phone: null,
        memberStatus: null,
        volunteerRole: null,
        staffRole: row.role,
        isSchedulable: profile ? profile.isSchedulable : true,
        preferredRoles: profile ? profile.preferredRoles : [],
        availabilitySlots: profile ? profile.availabilitySlots : [],
        notes: profile ? profile.notes : null,
        hasProfile: Boolean(profile),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const people = [...contactPeople, ...staffPeople];

  return {
    summary: {
      members: contactPeople.filter((person) => person.personType === "member").length,
      volunteers: contactPeople.filter((person) => person.personType === "volunteer").length,
      paidStaff: staffPeople.length,
      schedulable: people.filter((person) => person.isSchedulable).length,
      withAvailability: people.filter((person) => person.availabilitySlots.length > 0).length,
    },
    people,
  };
}

export async function upsertServiceSchedulingProfile(data: {
  organizationId: string;
  targetType: "contact" | "staff";
  contactId?: string;
  staffUserId?: string;
  isSchedulable: boolean;
  preferredRoles: string[];
  availabilitySlots: SchedulingAvailabilitySlot[];
  notes?: string | null;
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      targetType: z.enum(["contact", "staff"]),
      contactId: z.string().optional(),
      staffUserId: z.string().optional(),
      isSchedulable: z.boolean(),
      preferredRoles: z.array(z.string()).max(30).default([]),
      availabilitySlots: z.array(schedulingAvailabilitySlotSchema).max(24).default([]),
      notes: z.string().nullable().optional(),
    })
    .parse(data);

  const session = await requireOrgMembership(parsed.organizationId, "admin");
  const preferredRoles = parsed.preferredRoles
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
  const availabilitySlots = normalizeAvailabilitySlots(parsed.availabilitySlots);

  if (parsed.targetType === "contact") {
    if (!parsed.contactId) {
      throw new Error("Contact is required for contact scheduling profile");
    }

    const [contact] = await db
      .select({
        id: churchContacts.id,
      })
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.id, parsed.contactId),
          eq(churchContacts.organizationId, parsed.organizationId)
        )
      );

    if (!contact) {
      throw new Error("Contact not found in this organization");
    }

    const [existingProfile] = await db
      .select({ id: serviceSchedulingProfiles.id })
      .from(serviceSchedulingProfiles)
      .where(
        and(
          eq(serviceSchedulingProfiles.organizationId, parsed.organizationId),
          eq(serviceSchedulingProfiles.personType, "contact"),
          eq(serviceSchedulingProfiles.contactId, parsed.contactId)
        )
      );

    const payload = {
      personType: "contact" as const,
      organizationId: parsed.organizationId,
      contactId: parsed.contactId,
      staffUserId: null,
      isSchedulable: parsed.isSchedulable,
      preferredRoles,
      availabilitySlots,
      notes: parsed.notes ?? null,
      updatedAt: new Date(),
    };

    if (existingProfile) {
      await db
        .update(serviceSchedulingProfiles)
        .set(payload)
        .where(eq(serviceSchedulingProfiles.id, existingProfile.id));
    } else {
      await db.insert(serviceSchedulingProfiles).values({
        ...payload,
        createdAt: new Date(),
      });
    }

    const [existingVolunteer] = await db
      .select()
      .from(volunteers)
      .where(
        and(
          eq(volunteers.organizationId, parsed.organizationId),
          eq(volunteers.contactId, parsed.contactId)
        )
      );

    if (parsed.isSchedulable) {
      if (!existingVolunteer) {
        await db.insert(volunteers).values({
          contactId: parsed.contactId,
          organizationId: parsed.organizationId,
          role: preferredRoles[0] ?? null,
          status: "active",
        });
      } else {
        const nextRole = preferredRoles[0] ?? existingVolunteer.role ?? null;
        const updates: Record<string, unknown> = {};
        if (existingVolunteer.status !== "active") {
          updates.status = "active";
        }
        if (nextRole !== existingVolunteer.role) {
          updates.role = nextRole;
        }
        if (Object.keys(updates).length > 0) {
          await db
            .update(volunteers)
            .set(updates as {
              status?: "active" | "inactive" | "pending";
              role?: string | null;
            })
            .where(eq(volunteers.id, existingVolunteer.id));
        }
      }
    }

    await auditAction({
      organizationId: parsed.organizationId,
      userId: session.userId,
      actionType: "update",
      entityName: "service_scheduling_profile",
      entityId: parsed.contactId,
      details: {
        targetType: "contact",
        isSchedulable: parsed.isSchedulable,
        preferredRolesCount: preferredRoles.length,
        availabilitySlotsCount: availabilitySlots.length,
      },
    });

    return { success: true };
  }

  if (!parsed.staffUserId) {
    throw new Error("Staff user is required for staff scheduling profile");
  }

  const [staffMembership] = await db
    .select({ userId: organizationMemberships.userId })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, parsed.organizationId),
        eq(organizationMemberships.userId, parsed.staffUserId)
      )
    );

  if (!staffMembership) {
    throw new Error("Staff member not found in this organization");
  }

  const [existingProfile] = await db
    .select({ id: serviceSchedulingProfiles.id })
    .from(serviceSchedulingProfiles)
    .where(
      and(
        eq(serviceSchedulingProfiles.organizationId, parsed.organizationId),
        eq(serviceSchedulingProfiles.personType, "staff"),
        eq(serviceSchedulingProfiles.staffUserId, parsed.staffUserId)
      )
    );

  const payload = {
    personType: "staff" as const,
    organizationId: parsed.organizationId,
    contactId: null,
    staffUserId: parsed.staffUserId,
    isSchedulable: parsed.isSchedulable,
    preferredRoles,
    availabilitySlots,
    notes: parsed.notes ?? null,
    updatedAt: new Date(),
  };

  if (existingProfile) {
    await db
      .update(serviceSchedulingProfiles)
      .set(payload)
      .where(eq(serviceSchedulingProfiles.id, existingProfile.id));
  } else {
    await db.insert(serviceSchedulingProfiles).values({
      ...payload,
      createdAt: new Date(),
    });
  }

  await auditAction({
    organizationId: parsed.organizationId,
    userId: session.userId,
    actionType: "update",
    entityName: "service_scheduling_profile",
    entityId: parsed.staffUserId,
    details: {
      targetType: "staff",
      isSchedulable: parsed.isSchedulable,
      preferredRolesCount: preferredRoles.length,
      availabilitySlotsCount: availabilitySlots.length,
    },
  });

  return { success: true };
}

const serviceTemplateTypeSchema = z.enum([
  "sunday_am",
  "midweek",
  "special_event",
  "custom",
]);

const serviceTemplateRoleAssignmentSchema = z.enum([
  "paid_staff",
  "volunteer",
  "either",
]);

async function requireServiceTemplateAccess(
  templateId: string,
  requiredRole?: "admin" | "user"
) {
  const [template] = await db
    .select({
      id: serviceTemplates.id,
      organizationId: serviceTemplates.organizationId,
    })
    .from(serviceTemplates)
    .where(eq(serviceTemplates.id, templateId));

  if (!template) {
    throw new Error("Service template not found");
  }

  const session = await requireOrgMembership(template.organizationId, requiredRole);
  return { ...template, session };
}

async function requireServiceTemplateRoleSlotAccess(
  slotId: string,
  requiredRole?: "admin" | "user"
) {
  const [slot] = await db
    .select({
      id: serviceTemplateRoleSlots.id,
      templateId: serviceTemplateRoleSlots.templateId,
      organizationId: serviceTemplates.organizationId,
    })
    .from(serviceTemplateRoleSlots)
    .innerJoin(
      serviceTemplates,
      eq(serviceTemplateRoleSlots.templateId, serviceTemplates.id)
    )
    .where(eq(serviceTemplateRoleSlots.id, slotId));

  if (!slot) {
    throw new Error("Service template role slot not found");
  }

  const session = await requireOrgMembership(slot.organizationId, requiredRole);
  return { ...slot, session };
}

async function requireServiceTemplateTimelineStepAccess(
  stepId: string,
  requiredRole?: "admin" | "user"
) {
  const [step] = await db
    .select({
      id: serviceTemplateTimelineSteps.id,
      templateId: serviceTemplateTimelineSteps.templateId,
      organizationId: serviceTemplates.organizationId,
    })
    .from(serviceTemplateTimelineSteps)
    .innerJoin(
      serviceTemplates,
      eq(serviceTemplateTimelineSteps.templateId, serviceTemplates.id)
    )
    .where(eq(serviceTemplateTimelineSteps.id, stepId));

  if (!step) {
    throw new Error("Service template timeline step not found");
  }

  const session = await requireOrgMembership(step.organizationId, requiredRole);
  return { ...step, session };
}

async function requireServiceRunAccess(
  serviceRunId: string,
  requiredRole?: "admin" | "user"
) {
  const [serviceRun] = await db
    .select({
      id: serviceRuns.id,
      organizationId: serviceRuns.organizationId,
      templateId: serviceRuns.templateId,
      serviceAt: serviceRuns.serviceAt,
      name: serviceRuns.name,
      durationMinutes: serviceRuns.durationMinutes,
      status: serviceRuns.status,
    })
    .from(serviceRuns)
    .where(eq(serviceRuns.id, serviceRunId));

  if (!serviceRun) {
    throw new Error("Service run not found");
  }

  const session = await requireOrgMembership(serviceRun.organizationId, requiredRole);
  return { ...serviceRun, session };
}

async function requireServiceAssignmentAccess(
  assignmentId: string,
  requiredRole?: "admin" | "user"
) {
  const [assignment] = await db
    .select({
      id: serviceAssignments.id,
      organizationId: serviceAssignments.organizationId,
      serviceRunId: serviceAssignments.serviceRunId,
      roleSlotId: serviceAssignments.roleSlotId,
      assignmentType: serviceAssignments.assignmentType,
      volunteerId: serviceAssignments.volunteerId,
      staffUserId: serviceAssignments.staffUserId,
      status: serviceAssignments.status,
      checkedInAt: serviceAssignments.checkedInAt,
      checkedOutAt: serviceAssignments.checkedOutAt,
      payrollExportedAt: serviceAssignments.payrollExportedAt,
    })
    .from(serviceAssignments)
    .where(eq(serviceAssignments.id, assignmentId));

  if (!assignment) {
    throw new Error("Service assignment not found");
  }

  const session = await requireOrgMembership(assignment.organizationId, requiredRole);
  return { ...assignment, session };
}

async function assertRoleSlotBelongsToTemplate(
  roleSlotId: string,
  templateId: string
) {
  const [slot] = await db
    .select({
      id: serviceTemplateRoleSlots.id,
      templateId: serviceTemplateRoleSlots.templateId,
    })
    .from(serviceTemplateRoleSlots)
    .where(eq(serviceTemplateRoleSlots.id, roleSlotId));

  if (!slot || slot.templateId !== templateId) {
    throw new Error("Timeline step owner role slot must belong to the template");
  }
}

// ── Service Templates ──
export async function getServiceTemplates(orgId: string) {
  await requireOrgMembership(orgId);
  const templates = await db
    .select()
    .from(serviceTemplates)
    .where(eq(serviceTemplates.organizationId, orgId))
    .orderBy(serviceTemplates.name, desc(serviceTemplates.createdAt));

  if (!templates.length) {
    return [];
  }

  const templateIds = templates.map((template) => template.id);
  const [roleSlots, timelineSteps] = await Promise.all([
    db
      .select()
      .from(serviceTemplateRoleSlots)
      .where(inArray(serviceTemplateRoleSlots.templateId, templateIds))
      .orderBy(
        serviceTemplateRoleSlots.sortOrder,
        serviceTemplateRoleSlots.createdAt
      ),
    db
      .select()
      .from(serviceTemplateTimelineSteps)
      .where(inArray(serviceTemplateTimelineSteps.templateId, templateIds))
      .orderBy(
        serviceTemplateTimelineSteps.sortOrder,
        serviceTemplateTimelineSteps.offsetMinutes
      ),
  ]);

  return templates.map((template) => ({
    template,
    roleSlots: roleSlots.filter((slot) => slot.templateId === template.id),
    timelineSteps: timelineSteps.filter((step) => step.templateId === template.id),
  }));
}

export async function getServiceTemplate(templateId: string) {
  const existing = await requireServiceTemplateAccess(templateId);
  const [template] = await db
    .select()
    .from(serviceTemplates)
    .where(
      and(
        eq(serviceTemplates.id, templateId),
        eq(serviceTemplates.organizationId, existing.organizationId)
      )
    );

  if (!template) {
    throw new Error("Service template not found");
  }

  const [roleSlots, timelineSteps] = await Promise.all([
    db
      .select()
      .from(serviceTemplateRoleSlots)
      .where(eq(serviceTemplateRoleSlots.templateId, templateId))
      .orderBy(
        serviceTemplateRoleSlots.sortOrder,
        serviceTemplateRoleSlots.createdAt
      ),
    db
      .select()
      .from(serviceTemplateTimelineSteps)
      .where(eq(serviceTemplateTimelineSteps.templateId, templateId))
      .orderBy(
        serviceTemplateTimelineSteps.sortOrder,
        serviceTemplateTimelineSteps.offsetMinutes
      ),
  ]);

  return { template, roleSlots, timelineSteps };
}

export async function createServiceTemplate(data: {
  organizationId: string;
  name: string;
  description?: string;
  serviceType?: "sunday_am" | "midweek" | "special_event" | "custom";
  isActive?: boolean;
  serviceStartTime?: string;
  ownerUserId?: string;
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      serviceType: serviceTemplateTypeSchema.optional().default("custom"),
      isActive: z.boolean().optional().default(true),
      serviceStartTime: z.string().optional(),
      ownerUserId: z.string().optional(),
    })
    .parse(data);

  const session = await requireOrgMembership(parsed.organizationId, "admin");
  const [template] = await db
    .insert(serviceTemplates)
    .values({
      organizationId: parsed.organizationId,
      name: parsed.name,
      description: parsed.description ?? null,
      serviceType: parsed.serviceType,
      isActive: parsed.isActive,
      serviceStartTime: parsed.serviceStartTime ?? null,
      ownerUserId: parsed.ownerUserId ?? null,
    })
    .returning();

  await auditAction({
    organizationId: parsed.organizationId,
    userId: session.userId,
    actionType: "create",
    entityName: "service_template",
    entityId: template.id,
    details: {
      serviceType: template.serviceType,
      ownerUserId: template.ownerUserId,
    },
  });

  return template;
}

export async function updateServiceTemplate(
  templateId: string,
  data: Partial<{
    name: string;
    description: string | null;
    serviceType: "sunday_am" | "midweek" | "special_event" | "custom";
    isActive: boolean;
    serviceStartTime: string | null;
    ownerUserId: string | null;
  }>
) {
  const parsed = z
    .object({
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      serviceType: serviceTemplateTypeSchema.optional(),
      isActive: z.boolean().optional(),
      serviceStartTime: z.string().nullable().optional(),
      ownerUserId: z.string().nullable().optional(),
    })
    .parse(data);

  const existing = await requireServiceTemplateAccess(templateId, "admin");
  const [template] = await db
    .update(serviceTemplates)
    .set({
      ...parsed,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(serviceTemplates.id, templateId),
        eq(serviceTemplates.organizationId, existing.organizationId)
      )
    )
    .returning();

  if (!template) {
    throw new Error("Service template not found");
  }

  await auditAction({
    organizationId: existing.organizationId,
    userId: existing.session.userId,
    actionType: "update",
    entityName: "service_template",
    entityId: template.id,
    details: { updatedFields: Object.keys(parsed) },
  });

  return template;
}

export async function deleteServiceTemplate(templateId: string) {
  const existing = await requireServiceTemplateAccess(templateId, "admin");
  const [deleted] = await db
    .delete(serviceTemplates)
    .where(
      and(
        eq(serviceTemplates.id, templateId),
        eq(serviceTemplates.organizationId, existing.organizationId)
      )
    )
    .returning({ id: serviceTemplates.id });

  if (!deleted) {
    throw new Error("Service template not found");
  }

  await auditAction({
    organizationId: existing.organizationId,
    userId: existing.session.userId,
    actionType: "delete",
    entityName: "service_template",
    entityId: templateId,
  });

  return deleted;
}

export async function getServiceTemplateRoleSlots(templateId: string) {
  await requireServiceTemplateAccess(templateId);
  return await db
    .select()
    .from(serviceTemplateRoleSlots)
    .where(eq(serviceTemplateRoleSlots.templateId, templateId))
    .orderBy(serviceTemplateRoleSlots.sortOrder, serviceTemplateRoleSlots.createdAt);
}

export async function createServiceTemplateRoleSlot(data: {
  templateId: string;
  roleName: string;
  assignmentType?: "paid_staff" | "volunteer" | "either";
  isEnabled?: boolean;
  requiredCount?: number;
  isRequired?: boolean;
  notes?: string;
  sortOrder?: number;
}) {
  const parsed = z
    .object({
      templateId: z.string().min(1),
      roleName: z.string().min(1),
      assignmentType: serviceTemplateRoleAssignmentSchema
        .optional()
        .default("volunteer"),
      isEnabled: z.boolean().optional().default(true),
      requiredCount: z.coerce.number().int().positive().optional().default(1),
      isRequired: z.boolean().optional().default(true),
      notes: z.string().optional(),
      sortOrder: z.coerce.number().int().optional().default(0),
    })
    .parse(data);

  const existing = await requireServiceTemplateAccess(parsed.templateId, "admin");
  const [slot] = await db
    .insert(serviceTemplateRoleSlots)
    .values({
      templateId: parsed.templateId,
      roleName: parsed.roleName,
      assignmentType: parsed.assignmentType,
      isEnabled: parsed.isEnabled,
      requiredCount: parsed.requiredCount,
      isRequired: parsed.isRequired,
      notes: parsed.notes ?? null,
      sortOrder: parsed.sortOrder,
    })
    .returning();

  await auditAction({
    organizationId: existing.organizationId,
    userId: existing.session.userId,
    actionType: "create",
    entityName: "service_template_role_slot",
    entityId: slot.id,
    details: {
      templateId: parsed.templateId,
      assignmentType: slot.assignmentType,
      requiredCount: slot.requiredCount,
    },
  });

  return slot;
}

export async function updateServiceTemplateRoleSlot(
  slotId: string,
  data: Partial<{
    roleName: string;
    assignmentType: "paid_staff" | "volunteer" | "either";
    isEnabled: boolean;
    requiredCount: number;
    isRequired: boolean;
    notes: string | null;
    sortOrder: number;
  }>
) {
  const parsed = z
    .object({
      roleName: z.string().min(1).optional(),
      assignmentType: serviceTemplateRoleAssignmentSchema.optional(),
      isEnabled: z.boolean().optional(),
      requiredCount: z.coerce.number().int().positive().optional(),
      isRequired: z.boolean().optional(),
      notes: z.string().nullable().optional(),
      sortOrder: z.coerce.number().int().optional(),
    })
    .parse(data);

  const existing = await requireServiceTemplateRoleSlotAccess(slotId, "admin");
  const [slot] = await db
    .update(serviceTemplateRoleSlots)
    .set({
      ...parsed,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(serviceTemplateRoleSlots.id, slotId),
        eq(serviceTemplateRoleSlots.templateId, existing.templateId)
      )
    )
    .returning();

  if (!slot) {
    throw new Error("Service template role slot not found");
  }

  await auditAction({
    organizationId: existing.organizationId,
    userId: existing.session.userId,
    actionType: "update",
    entityName: "service_template_role_slot",
    entityId: slot.id,
    details: { updatedFields: Object.keys(parsed) },
  });

  return slot;
}

export async function deleteServiceTemplateRoleSlot(slotId: string) {
  const existing = await requireServiceTemplateRoleSlotAccess(slotId, "admin");
  const [deleted] = await db
    .delete(serviceTemplateRoleSlots)
    .where(
      and(
        eq(serviceTemplateRoleSlots.id, slotId),
        eq(serviceTemplateRoleSlots.templateId, existing.templateId)
      )
    )
    .returning({ id: serviceTemplateRoleSlots.id });

  if (!deleted) {
    throw new Error("Service template role slot not found");
  }

  await auditAction({
    organizationId: existing.organizationId,
    userId: existing.session.userId,
    actionType: "delete",
    entityName: "service_template_role_slot",
    entityId: slotId,
  });

  return deleted;
}

export async function getServiceTemplateTimelineSteps(templateId: string) {
  await requireServiceTemplateAccess(templateId);
  return await db
    .select()
    .from(serviceTemplateTimelineSteps)
    .where(eq(serviceTemplateTimelineSteps.templateId, templateId))
    .orderBy(
      serviceTemplateTimelineSteps.sortOrder,
      serviceTemplateTimelineSteps.offsetMinutes
    );
}

export async function createServiceTemplateTimelineStep(data: {
  templateId: string;
  title: string;
  description?: string;
  offsetMinutes: number;
  durationMinutes?: number;
  ownerRoleSlotId?: string;
  ownerUserId?: string;
  sortOrder?: number;
}) {
  const parsed = z
    .object({
      templateId: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional(),
      offsetMinutes: z.coerce.number().int(),
      durationMinutes: z.coerce.number().int().positive().optional(),
      ownerRoleSlotId: z.string().optional(),
      ownerUserId: z.string().optional(),
      sortOrder: z.coerce.number().int().optional().default(0),
    })
    .parse(data);

  const existing = await requireServiceTemplateAccess(parsed.templateId, "admin");
  if (parsed.ownerRoleSlotId) {
    await assertRoleSlotBelongsToTemplate(parsed.ownerRoleSlotId, parsed.templateId);
  }

  const [step] = await db
    .insert(serviceTemplateTimelineSteps)
    .values({
      templateId: parsed.templateId,
      title: parsed.title,
      description: parsed.description ?? null,
      offsetMinutes: parsed.offsetMinutes,
      durationMinutes: parsed.durationMinutes ?? null,
      ownerRoleSlotId: parsed.ownerRoleSlotId ?? null,
      ownerUserId: parsed.ownerUserId ?? null,
      sortOrder: parsed.sortOrder,
    })
    .returning();

  await auditAction({
    organizationId: existing.organizationId,
    userId: existing.session.userId,
    actionType: "create",
    entityName: "service_template_timeline_step",
    entityId: step.id,
    details: {
      templateId: parsed.templateId,
      offsetMinutes: parsed.offsetMinutes,
      ownerRoleSlotId: parsed.ownerRoleSlotId,
      ownerUserId: parsed.ownerUserId,
    },
  });

  return step;
}

export async function updateServiceTemplateTimelineStep(
  stepId: string,
  data: Partial<{
    title: string;
    description: string | null;
    offsetMinutes: number;
    durationMinutes: number | null;
    ownerRoleSlotId: string | null;
    ownerUserId: string | null;
    sortOrder: number;
  }>
) {
  const parsed = z
    .object({
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      offsetMinutes: z.coerce.number().int().optional(),
      durationMinutes: z.coerce.number().int().positive().nullable().optional(),
      ownerRoleSlotId: z.string().nullable().optional(),
      ownerUserId: z.string().nullable().optional(),
      sortOrder: z.coerce.number().int().optional(),
    })
    .parse(data);

  const existing = await requireServiceTemplateTimelineStepAccess(stepId, "admin");
  if (parsed.ownerRoleSlotId) {
    await assertRoleSlotBelongsToTemplate(parsed.ownerRoleSlotId, existing.templateId);
  }

  const [step] = await db
    .update(serviceTemplateTimelineSteps)
    .set({
      ...parsed,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(serviceTemplateTimelineSteps.id, stepId),
        eq(serviceTemplateTimelineSteps.templateId, existing.templateId)
      )
    )
    .returning();

  if (!step) {
    throw new Error("Service template timeline step not found");
  }

  await auditAction({
    organizationId: existing.organizationId,
    userId: existing.session.userId,
    actionType: "update",
    entityName: "service_template_timeline_step",
    entityId: step.id,
    details: { updatedFields: Object.keys(parsed) },
  });

  return step;
}

export async function deleteServiceTemplateTimelineStep(stepId: string) {
  const existing = await requireServiceTemplateTimelineStepAccess(stepId, "admin");
  const [deleted] = await db
    .delete(serviceTemplateTimelineSteps)
    .where(
      and(
        eq(serviceTemplateTimelineSteps.id, stepId),
        eq(serviceTemplateTimelineSteps.templateId, existing.templateId)
      )
    )
    .returning({ id: serviceTemplateTimelineSteps.id });

  if (!deleted) {
    throw new Error("Service template timeline step not found");
  }

  await auditAction({
    organizationId: existing.organizationId,
    userId: existing.session.userId,
    actionType: "delete",
    entityName: "service_template_timeline_step",
    entityId: stepId,
  });

  return deleted;
}

// ── Service Run Planning ──
export async function getServiceRuns(orgId: string) {
  await requireOrgMembership(orgId);
  return await db
    .select({
      run: serviceRuns,
      template: serviceTemplates,
    })
    .from(serviceRuns)
    .leftJoin(serviceTemplates, eq(serviceRuns.templateId, serviceTemplates.id))
    .where(eq(serviceRuns.organizationId, orgId))
    .orderBy(desc(serviceRuns.serviceAt), desc(serviceRuns.createdAt));
}

export async function getServiceRunAssignments(serviceRunId: string) {
  const serviceRun = await requireServiceRunAccess(serviceRunId);
  return await db
    .select({
      assignment: serviceAssignments,
      volunteer: volunteers,
      contact: compatibleChurchContactSelect,
      staff: users,
    })
    .from(serviceAssignments)
    .leftJoin(volunteers, eq(serviceAssignments.volunteerId, volunteers.id))
    .leftJoin(churchContacts, eq(volunteers.contactId, churchContacts.id))
    .leftJoin(users, eq(serviceAssignments.staffUserId, users.id))
    .where(
      and(
        eq(serviceAssignments.organizationId, serviceRun.organizationId),
        eq(serviceAssignments.serviceRunId, serviceRun.id)
      )
    )
    .orderBy(serviceAssignments.roleName, serviceAssignments.createdAt);
}

export async function getPaidStaffShiftLedger(input: {
  organizationId: string;
  fromDate?: Date | string;
  toDate?: Date | string;
  serviceRunId?: string;
  includeOpen?: boolean;
  includeExported?: boolean;
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      fromDate: z.coerce.date().optional(),
      toDate: z.coerce.date().optional(),
      serviceRunId: z.string().optional(),
      includeOpen: z.boolean().optional().default(false),
      includeExported: z.boolean().optional().default(false),
    })
    .parse(input);

  await requireOrgMembership(parsed.organizationId, "admin");

  const clauses = [
    eq(serviceAssignments.organizationId, parsed.organizationId),
    ne(serviceAssignments.assignmentType, "volunteer"),
    sql`${serviceAssignments.staffUserId} is not null`,
  ];

  if (parsed.serviceRunId) {
    clauses.push(eq(serviceAssignments.serviceRunId, parsed.serviceRunId));
  }
  if (parsed.fromDate) {
    clauses.push(gte(serviceRuns.serviceAt, parsed.fromDate));
  }
  if (parsed.toDate) {
    clauses.push(lte(serviceRuns.serviceAt, parsed.toDate));
  }
  if (!parsed.includeOpen) {
    clauses.push(
      inArray(serviceAssignments.status, ["checked_out", "no_show", "cancelled"])
    );
  }
  if (!parsed.includeExported) {
    clauses.push(sql`${serviceAssignments.payrollExportedAt} is null`);
  }

  const rows = await db
    .select({
      assignmentId: serviceAssignments.id,
      serviceRunId: serviceAssignments.serviceRunId,
      roleName: serviceAssignments.roleName,
      assignmentStatus: serviceAssignments.status,
      checkedInAt: serviceAssignments.checkedInAt,
      checkedOutAt: serviceAssignments.checkedOutAt,
      payrollExportedAt: serviceAssignments.payrollExportedAt,
      staffUserId: serviceAssignments.staffUserId,
      serviceRunName: serviceRuns.name,
      serviceAt: serviceRuns.serviceAt,
      runDurationMinutes: serviceRuns.durationMinutes,
      staffName: users.name,
      staffEmail: users.email,
    })
    .from(serviceAssignments)
    .innerJoin(serviceRuns, eq(serviceAssignments.serviceRunId, serviceRuns.id))
    .leftJoin(users, eq(serviceAssignments.staffUserId, users.id))
    .where(and(...clauses))
    .orderBy(serviceRuns.serviceAt, serviceAssignments.roleName, serviceAssignments.createdAt);

  return rows.map((row): PaidStaffShiftLedgerItem => {
    const plannedMinutes = Number(row.runDurationMinutes ?? 0);
    return {
      assignmentId: row.assignmentId,
      serviceRunId: row.serviceRunId,
      serviceRunName: row.serviceRunName,
      serviceAt: row.serviceAt,
      roleName: row.roleName,
      staffUserId: row.staffUserId,
      staffName: row.staffName ?? null,
      staffEmail: row.staffEmail ?? null,
      assignmentStatus: row.assignmentStatus,
      checkedInAt: row.checkedInAt,
      checkedOutAt: row.checkedOutAt,
      runDurationMinutes: plannedMinutes,
      workedMinutes: computeWorkedMinutes({
        checkedInAt: row.checkedInAt,
        checkedOutAt: row.checkedOutAt,
        fallbackDurationMinutes: plannedMinutes,
      }),
      status: resolvePaidStaffLedgerStatus(row.assignmentStatus),
      payrollExportedAt: row.payrollExportedAt,
    };
  });
}

export async function exportPaidStaffShiftLedgerCsv(input: {
  organizationId: string;
  fromDate?: Date | string;
  toDate?: Date | string;
  serviceRunId?: string;
  includeOpen?: boolean;
  markExported?: boolean;
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      fromDate: z.coerce.date().optional(),
      toDate: z.coerce.date().optional(),
      serviceRunId: z.string().optional(),
      includeOpen: z.boolean().optional().default(false),
      markExported: z.boolean().optional().default(true),
    })
    .parse(input);

  const { userId } = await requireOrgMembership(parsed.organizationId, "admin");
  const ledger = await getPaidStaffShiftLedger({
    organizationId: parsed.organizationId,
    fromDate: parsed.fromDate,
    toDate: parsed.toDate,
    serviceRunId: parsed.serviceRunId,
    includeOpen: parsed.includeOpen,
    includeExported: false,
  });

  const header = [
    "assignment_id",
    "service_run_id",
    "service_run_name",
    "service_at",
    "role_name",
    "staff_user_id",
    "staff_name",
    "staff_email",
    "ledger_status",
    "assignment_status",
    "checked_in_at",
    "checked_out_at",
    "worked_minutes",
    "planned_minutes",
    "payroll_exported_at",
  ];

  const rows = ledger.map((item) => [
    item.assignmentId,
    item.serviceRunId,
    item.serviceRunName,
    toIsoDateTime(item.serviceAt),
    item.roleName,
    item.staffUserId ?? "",
    item.staffName ?? "",
    item.staffEmail ?? "",
    item.status,
    item.assignmentStatus,
    toIsoDateTime(item.checkedInAt),
    toIsoDateTime(item.checkedOutAt),
    item.workedMinutes,
    item.runDurationMinutes,
    toIsoDateTime(item.payrollExportedAt),
  ]);

  const csvLines = [header, ...rows]
    .map((line) => line.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");

  const now = new Date();
  if (parsed.markExported && ledger.length > 0) {
    await db
      .update(serviceAssignments)
      .set({
        payrollExportedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(serviceAssignments.organizationId, parsed.organizationId),
          inArray(
            serviceAssignments.id,
            ledger.map((item) => item.assignmentId)
          )
        )
      );
  }

  await auditAction({
    organizationId: parsed.organizationId,
    userId,
    actionType: "export",
    entityName: "service_assignment_payroll_ledger",
    details: {
      exportedCount: ledger.length,
      fromDate: parsed.fromDate?.toISOString() ?? null,
      toDate: parsed.toDate?.toISOString() ?? null,
      serviceRunId: parsed.serviceRunId ?? null,
      includeOpen: parsed.includeOpen,
      markExported: parsed.markExported,
    },
  });

  const stamp = now.toISOString().slice(0, 10).replaceAll("-", "");
  return {
    fileName: `payroll-ledger-${stamp}.csv`,
    contentType: "text/csv; charset=utf-8",
    csv: `${csvLines}\n`,
    exportedCount: ledger.length,
    rows: ledger,
  };
}

async function findLatestServiceRunRecap(params: {
  organizationId: string;
  serviceRunId: string;
}) {
  const [recap] = await db
    .select()
    .from(graceMemory)
    .where(
      and(
        eq(graceMemory.organizationId, params.organizationId),
        eq(graceMemory.memoryType, "service_recap"),
        sql`${graceMemory.metadataJson} ->> 'serviceRunId' = ${params.serviceRunId}`
      )
    )
    .orderBy(desc(graceMemory.createdAt))
    .limit(1);

  return recap ?? null;
}

export async function generateServiceRunRecapRecord(input: {
  organizationId: string;
  serviceRunId: string;
  force?: boolean;
  createdByUserId?: string | null;
  createdByActorType?: "staff" | "system";
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      serviceRunId: z.string().min(1),
      force: z.boolean().optional().default(false),
      createdByUserId: z.string().nullable().optional(),
      createdByActorType: z.enum(["staff", "system"]).optional().default("system"),
    })
    .parse(input);

  const [serviceRun] = await db
    .select({
      id: serviceRuns.id,
      organizationId: serviceRuns.organizationId,
      name: serviceRuns.name,
      status: serviceRuns.status,
      serviceAt: serviceRuns.serviceAt,
      durationMinutes: serviceRuns.durationMinutes,
    })
    .from(serviceRuns)
    .where(
      and(
        eq(serviceRuns.id, parsed.serviceRunId),
        eq(serviceRuns.organizationId, parsed.organizationId)
      )
    )
    .limit(1);

  if (!serviceRun) {
    throw new Error("Service run not found");
  }

  const existing = await findLatestServiceRunRecap({
    organizationId: parsed.organizationId,
    serviceRunId: parsed.serviceRunId,
  });
  if (existing && !parsed.force) {
    return {
      generated: false as const,
      recap: existing,
      serviceRun,
    };
  }

  const [assignmentRows, openTaskRows] = await Promise.all([
    db
      .select({
        id: serviceAssignments.id,
        roleName: serviceAssignments.roleName,
        status: serviceAssignments.status,
        volunteerId: serviceAssignments.volunteerId,
        staffUserId: serviceAssignments.staffUserId,
      })
      .from(serviceAssignments)
      .where(
        and(
          eq(serviceAssignments.organizationId, parsed.organizationId),
          eq(serviceAssignments.serviceRunId, parsed.serviceRunId)
        )
      )
      .orderBy(serviceAssignments.roleName, serviceAssignments.createdAt),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, parsed.organizationId),
          inArray(tasks.status, ["todo", "in_progress"]),
          or(
            ilike(tasks.title, `%${serviceRun.name}%`),
            ilike(tasks.description, `%${parsed.serviceRunId}%`)
          )
        )
      )
      .orderBy(desc(tasks.createdAt))
      .limit(8),
  ]);

  const totalSeats = assignmentRows.length;
  const filledSeats = assignmentRows.filter(
    (row) => Boolean(row.volunteerId || row.staffUserId)
  ).length;
  const checkedIn = assignmentRows.filter((row) => row.status === "checked_in").length;
  const checkedOut = assignmentRows.filter((row) => row.status === "checked_out").length;
  const noShow = assignmentRows.filter((row) => row.status === "no_show").length;
  const needsReplacement = assignmentRows.filter(
    (row) => row.status === "needs_replacement"
  ).length;
  const unresolvedStatuses = new Set([
    "proposed",
    "offered",
    "declined",
    "needs_replacement",
    "no_show",
  ]);
  const unresolvedRoles = Array.from(
    new Set(
      assignmentRows
        .filter((row) => unresolvedStatuses.has(row.status))
        .map((row) => row.roleName)
    )
  );
  const openSeats = assignmentRows.filter((row) => unresolvedStatuses.has(row.status)).length;
  const closeCoverageSeats = assignmentRows.filter((row) =>
    ["confirmed", "checked_in", "checked_out"].includes(row.status)
  ).length;
  const coveragePercent =
    totalSeats > 0 ? Math.round((closeCoverageSeats / totalSeats) * 100) : 0;

  const serviceAtLabel = formatShortDateTime(serviceRun.serviceAt);
  const summary =
    `Service recap for "${serviceRun.name}" (${serviceAtLabel}): ` +
    `${checkedOut}/${totalSeats} seats checked out, ${noShow} no-show` +
    `${noShow === 1 ? "" : "s"}, ${coveragePercent}% close coverage.`;

  const openTaskLines =
    openTaskRows.length > 0
      ? openTaskRows.map((task) => `- [${task.status}] ${task.title} (${task.id})`)
      : ["- none"];

  const detailLines: string[] = [
    `Service run: ${serviceRun.name}`,
    `Scheduled at: ${serviceAtLabel}`,
    `Run status: ${serviceRun.status}`,
    `Duration (planned): ${serviceRun.durationMinutes} minutes`,
    "",
    "Seat summary:",
    `- Total seats: ${totalSeats}`,
    `- Filled seats: ${filledSeats}`,
    `- Checked in: ${checkedIn}`,
    `- Checked out: ${checkedOut}`,
    `- No-show: ${noShow}`,
    `- Needs replacement: ${needsReplacement}`,
    `- Open/unresolved seats: ${openSeats}`,
    "",
    "Coverage at close:",
    `- Coverage: ${coveragePercent}% (${closeCoverageSeats}/${totalSeats || 1} seats)`,
    "",
    "Unresolved roles:",
    unresolvedRoles.length > 0 ? `- ${unresolvedRoles.join(", ")}` : "- none",
    "",
    "Open follow-up tasks:",
    ...openTaskLines,
    "",
    `Generated at: ${new Date().toISOString()}`,
  ];

  const [created] = await db
    .insert(graceMemory)
    .values({
      organizationId: parsed.organizationId,
      memoryType: "service_recap",
      summary,
      details: detailLines.join("\n"),
      tags: ["service_recap", serviceRun.status, `coverage_${coveragePercent}`],
      metadataJson: {
        reportType: "service_run_recap",
        serviceRunId: parsed.serviceRunId,
        serviceRunName: serviceRun.name,
        serviceAt: serviceRun.serviceAt.toISOString(),
        serviceStatus: serviceRun.status,
        coveragePercent,
        seatMetrics: {
          totalSeats,
          filledSeats,
          checkedIn,
          checkedOut,
          noShow,
          needsReplacement,
          openSeats,
          closeCoverageSeats,
        },
        unresolvedRoles,
        openTaskIds: openTaskRows.map((task) => task.id),
      },
      createdByActorType: parsed.createdByActorType,
      createdByUserId: parsed.createdByUserId ?? null,
    })
    .returning();

  return {
    generated: true as const,
    recap: created,
    serviceRun,
  };
}

function getOperationsSystemToken() {
  return (
    process.env.OPERATIONS_SYSTEM_TOKEN ??
    process.env.AUTOMATION_SYSTEM_TOKEN ??
    process.env.INNGEST_EVENT_KEY ??
    process.env.INNGEST_SIGNING_KEY ??
    null
  );
}

function hasInngestEventKey() {
  return Boolean(process.env.INNGEST_EVENT_KEY?.trim());
}

function isInngestDispatchConfigurationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /event key not found/i.test(message) || /\b401\b/.test(message);
}

function assertOperationsSystemToken(token: string) {
  const expected = getOperationsSystemToken();
  if (!expected) {
    throw new Error(
      "Operations system token is not configured (set OPERATIONS_SYSTEM_TOKEN or AUTOMATION_SYSTEM_TOKEN)."
    );
  }
  if (token !== expected) {
    throw new Error("Invalid operations system token");
  }
}

export async function generateServiceRunRecap(input: {
  serviceRunId: string;
  force?: boolean;
}) {
  const parsed = z
    .object({
      serviceRunId: z.string().min(1),
      force: z.boolean().optional().default(false),
    })
    .parse(input);

  const serviceRun = await requireServiceRunAccess(parsed.serviceRunId, "admin");
  const result = await generateServiceRunRecapRecord({
    organizationId: serviceRun.organizationId,
    serviceRunId: parsed.serviceRunId,
    force: parsed.force,
    createdByUserId: serviceRun.session.userId,
    createdByActorType: "staff",
  });

  if (result.generated) {
    await auditAction({
      organizationId: serviceRun.organizationId,
      userId: serviceRun.session.userId,
      actionType: "create",
      entityName: "service_run_recap",
      entityId: result.recap.id,
      details: {
        serviceRunId: parsed.serviceRunId,
        force: parsed.force,
      },
    });
  }

  return result;
}

export async function getServiceRunRecaps(input: {
  serviceRunId: string;
  limit?: number;
}) {
  const parsed = z
    .object({
      serviceRunId: z.string().min(1),
      limit: z.coerce.number().int().min(1).max(50).optional().default(10),
    })
    .parse(input);

  const serviceRun = await requireServiceRunAccess(parsed.serviceRunId, "user");

  return db
    .select()
    .from(graceMemory)
    .where(
      and(
        eq(graceMemory.organizationId, serviceRun.organizationId),
        eq(graceMemory.memoryType, "service_recap"),
        sql`${graceMemory.metadataJson} ->> 'serviceRunId' = ${parsed.serviceRunId}`
      )
    )
    .orderBy(desc(graceMemory.createdAt))
    .limit(parsed.limit);
}

export async function generateDueServiceRunRecaps(input: {
  organizationId?: string;
  limit?: number;
  lookbackHours?: number;
  systemToken: string;
}) {
  const parsed = z
    .object({
      organizationId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(500).optional().default(50),
      lookbackHours: z.coerce.number().int().min(1).max(720).optional().default(72),
      systemToken: z.string().min(1),
    })
    .parse(input);

  assertOperationsSystemToken(parsed.systemToken);

  const now = new Date();
  const recapCutoff = new Date(now.getTime() - 30 * 60 * 1000);
  const lookbackStart = new Date(
    now.getTime() - parsed.lookbackHours * 60 * 60 * 1000
  );

  const clauses = [
    ne(serviceRuns.status, "cancelled"),
    lte(serviceRuns.serviceAt, recapCutoff),
    gte(serviceRuns.serviceAt, lookbackStart),
  ];
  if (parsed.organizationId) {
    clauses.push(eq(serviceRuns.organizationId, parsed.organizationId));
  }

  const rows = await db
    .select({
      organizationId: serviceRuns.organizationId,
      serviceRunId: serviceRuns.id,
    })
    .from(serviceRuns)
    .where(and(...clauses))
    .orderBy(serviceRuns.serviceAt)
    .limit(parsed.limit);

  let generated = 0;
  let skipped = 0;
  const errors: Array<{ serviceRunId: string; error: string }> = [];

  for (const row of rows) {
    try {
      const result = await generateServiceRunRecapRecord({
        organizationId: row.organizationId,
        serviceRunId: row.serviceRunId,
        createdByActorType: "system",
      });
      if (result.generated) {
        generated += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      skipped += 1;
      errors.push({
        serviceRunId: row.serviceRunId,
        error:
          error instanceof Error ? error.message : "service_recap_generation_failed",
      });
    }
  }

  return {
    scanned: rows.length,
    generated,
    skipped,
    errors,
  };
}

export async function createServiceRun(data: {
  organizationId: string;
  templateId?: string;
  name?: string;
  serviceAt: Date;
  durationMinutes?: number;
  notes?: string;
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      templateId: z.string().optional(),
      name: z.string().optional(),
      serviceAt: z.coerce.date(),
      durationMinutes: z.coerce.number().int().positive().optional().default(90),
      notes: z.string().optional(),
    })
    .parse(data);

  const session = await requireOrgMembership(parsed.organizationId, "admin");
  let templateName: string | null = null;

  if (parsed.templateId) {
    const [template] = await db
      .select({
        id: serviceTemplates.id,
        name: serviceTemplates.name,
      })
      .from(serviceTemplates)
      .where(
        and(
          eq(serviceTemplates.id, parsed.templateId),
          eq(serviceTemplates.organizationId, parsed.organizationId)
        )
      );
    if (!template) {
      throw new Error("Service template not found");
    }
    templateName = template.name;
  }

  const runName =
    parsed.name?.trim() ||
    templateName ||
    `Service Run ${parsed.serviceAt.toLocaleDateString()}`;

  const [serviceRun] = await db
    .insert(serviceRuns)
    .values({
      organizationId: parsed.organizationId,
      templateId: parsed.templateId ?? null,
      name: runName,
      serviceAt: parsed.serviceAt,
      durationMinutes: parsed.durationMinutes,
      notes: parsed.notes ?? null,
      createdByUserId: session.userId,
    })
    .returning();

  await auditAction({
    organizationId: parsed.organizationId,
    userId: session.userId,
    actionType: "create",
    entityName: "service_run",
    entityId: serviceRun.id,
    details: {
      templateId: serviceRun.templateId,
      serviceAt: serviceRun.serviceAt,
      durationMinutes: serviceRun.durationMinutes,
    },
  });

  return serviceRun;
}

export async function generateServiceRunAssignmentsFromTemplate(data: {
  serviceRunId: string;
  overwriteExisting?: boolean;
}) {
  const parsed = z
    .object({
      serviceRunId: z.string().min(1),
      overwriteExisting: z.boolean().optional().default(false),
    })
    .parse(data);

  const serviceRun = await requireServiceRunAccess(parsed.serviceRunId, "admin");
  if (!serviceRun.templateId) {
    throw new Error("Service run has no linked template");
  }

  const templateBundle = await getServiceTemplate(serviceRun.templateId);
  const existingAssignments = await db
    .select()
    .from(serviceAssignments)
    .where(eq(serviceAssignments.serviceRunId, serviceRun.id));

  if (existingAssignments.length > 0 && !parsed.overwriteExisting) {
    return existingAssignments;
  }

  if (existingAssignments.length > 0 && parsed.overwriteExisting) {
    await db
      .delete(serviceAssignments)
      .where(eq(serviceAssignments.serviceRunId, serviceRun.id));
  }

  const assignmentRows = templateBundle.roleSlots
    .filter((roleSlot) => roleSlot.isEnabled)
    .flatMap((roleSlot) => {
      const seats = Math.max(1, roleSlot.requiredCount);
      return Array.from({ length: seats }, (_, seatIndex) => ({
        organizationId: serviceRun.organizationId,
        serviceRunId: serviceRun.id,
      templateId: serviceRun.templateId,
      roleSlotId: roleSlot.id,
      roleName: roleSlot.roleName,
      assignmentType: roleSlot.assignmentType,
      status: "proposed" as const,
      notes:
        seats > 1
          ? `Seat ${seatIndex + 1} of ${seats}${roleSlot.notes ? ` · ${roleSlot.notes}` : ""}`
          : roleSlot.notes ?? null,
      }));
    });

  if (assignmentRows.length === 0) {
    return [];
  }

  const createdAssignments = await db
    .insert(serviceAssignments)
    .values(assignmentRows)
    .returning();

  await auditAction({
    organizationId: serviceRun.organizationId,
    userId: serviceRun.session.userId,
    actionType: "create",
    entityName: "service_assignment",
    entityId: serviceRun.id,
    details: {
      generatedCount: createdAssignments.length,
      templateId: serviceRun.templateId,
    },
  });

  return createdAssignments;
}

export async function assignServiceAssignmentSeat(data: {
  assignmentId: string;
  volunteerId?: string | null;
  staffUserId?: string | null;
  notes?: string | null;
}) {
  const parsed = z
    .object({
      assignmentId: z.string().min(1),
      volunteerId: z.string().nullable().optional(),
      staffUserId: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    })
    .parse(data);

  const assignment = await requireServiceAssignmentAccess(parsed.assignmentId, "admin");
  const serviceRun = await requireServiceRunAccess(assignment.serviceRunId);

  const hasVolunteer = Boolean(parsed.volunteerId);
  const hasStaff = Boolean(parsed.staffUserId);
  if (hasVolunteer && hasStaff) {
    throw new Error("Choose either volunteer or staff, not both");
  }

  if (assignment.assignmentType === "volunteer" && hasStaff) {
    throw new Error("This seat only accepts volunteer assignments");
  }
  if (assignment.assignmentType === "paid_staff" && hasVolunteer) {
    throw new Error("This seat only accepts paid staff assignments");
  }

  if (parsed.volunteerId) {
    const [volunteer] = await db
      .select({
        id: volunteers.id,
        organizationId: volunteers.organizationId,
      })
      .from(volunteers)
      .where(eq(volunteers.id, parsed.volunteerId));
    if (!volunteer || volunteer.organizationId !== assignment.organizationId) {
      throw new Error("Volunteer not found in this organization");
    }

    const conflictMessage = await findVolunteerSchedulingConflict({
      organizationId: assignment.organizationId,
      assignmentId: assignment.id,
      volunteerId: parsed.volunteerId,
      serviceAt: serviceRun.serviceAt,
      durationMinutes: serviceRun.durationMinutes,
    });
    if (conflictMessage) {
      throw new Error(`Scheduling conflict: ${conflictMessage}`);
    }
  }

  if (parsed.staffUserId) {
    const [membership] = await db
      .select({
        userId: organizationMemberships.userId,
      })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, assignment.organizationId),
          eq(organizationMemberships.userId, parsed.staffUserId)
        )
      );
    if (!membership) {
      throw new Error("Staff member not found in this organization");
    }

    const conflictMessage = await findStaffSchedulingConflict({
      organizationId: assignment.organizationId,
      assignmentId: assignment.id,
      staffUserId: parsed.staffUserId,
      serviceAt: serviceRun.serviceAt,
      durationMinutes: serviceRun.durationMinutes,
    });
    if (conflictMessage) {
      throw new Error(`Scheduling conflict: ${conflictMessage}`);
    }
  }

  const [updated] = await db
    .update(serviceAssignments)
    .set({
      volunteerId: parsed.volunteerId ?? null,
      staffUserId: parsed.staffUserId ?? null,
      status: "proposed",
      checkedInAt: null,
      checkedOutAt: null,
      payrollExportedAt: null,
      notes: parsed.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(serviceAssignments.id, parsed.assignmentId))
    .returning();

  await auditAction({
    organizationId: assignment.organizationId,
    userId: assignment.session.userId,
    actionType: "update",
    entityName: "service_assignment",
    entityId: updated.id,
    details: {
      volunteerId: updated.volunteerId,
      staffUserId: updated.staffUserId,
    },
  });

  return updated;
}

export async function sendServiceAssignmentOffers(data: {
  serviceRunId: string;
  assignmentIds?: string[];
  messageTemplate?: string;
}) {
  const parsed = z
    .object({
      serviceRunId: z.string().min(1),
      assignmentIds: z.array(z.string()).optional(),
      messageTemplate: z.string().optional(),
    })
    .parse(data);

  const serviceRun = await requireServiceRunAccess(parsed.serviceRunId, "admin");
  const workflowGoalRecord = await ensureVolunteerStaffingGoalRecord({
    organizationId: serviceRun.organizationId,
    serviceRunId: serviceRun.id,
    serviceRunName: serviceRun.name,
    serviceAt: serviceRun.serviceAt,
    templateId: serviceRun.templateId,
    sourceChannel: "in_app",
    triggerSource: "service_page",
    requestedByUserId: serviceRun.session.userId,
    objectiveText:
      parsed.messageTemplate?.trim() ||
      `Send volunteer offers for "${serviceRun.name}".`,
  });

  const rows = await db
    .select({
      assignment: serviceAssignments,
      volunteer: volunteers,
      contact: compatibleChurchContactSelect,
      staff: users,
    })
    .from(serviceAssignments)
    .leftJoin(volunteers, eq(serviceAssignments.volunteerId, volunteers.id))
    .leftJoin(churchContacts, eq(volunteers.contactId, churchContacts.id))
    .leftJoin(users, eq(serviceAssignments.staffUserId, users.id))
    .where(
      and(
        eq(serviceAssignments.organizationId, serviceRun.organizationId),
        eq(serviceAssignments.serviceRunId, serviceRun.id)
      )
    )
    .orderBy(serviceAssignments.createdAt);

  const statusFilter = new Set([
    "proposed",
    "declined",
    "needs_replacement",
  ]);
  const idFilter = parsed.assignmentIds?.length
    ? new Set(parsed.assignmentIds)
    : null;

  const candidateRows = rows.filter((row) => {
    if (!statusFilter.has(row.assignment.status)) return false;
    if (idFilter && !idFilter.has(row.assignment.id)) return false;
    return true;
  });

  const results: Array<{
    assignmentId: string;
    sent: boolean;
    skipped?: string;
    error?: string;
    to?: string;
  }> = [];

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const row of candidateRows) {
    const recipientPhone = normalizePhoneNumber(row.contact?.phone ?? null);
    if (!recipientPhone) {
      skippedCount += 1;
      results.push({
        assignmentId: row.assignment.id,
        sent: false,
        skipped: row.assignment.staffUserId
          ? "No staff SMS phone configured; assign a volunteer contact for SMS offer"
          : "No contact phone on assignment",
      });
      continue;
    }

    const message = parsed.messageTemplate
      ? parsed.messageTemplate
          .replaceAll("{role}", row.assignment.roleName)
          .replaceAll("{service_at}", formatShortDateTime(serviceRun.serviceAt))
      : `Grace scheduling: can you serve as ${row.assignment.roleName} on ${formatShortDateTime(
          serviceRun.serviceAt
        )}? Reply YES to confirm, NO to decline, or SWAP for a different time.`;

    const sendResult = await sendOrganizationSms({
      organizationId: serviceRun.organizationId,
      to: recipientPhone,
      message,
      idempotencyKey: `${serviceRun.id}:${row.assignment.id}:offer`,
    });

    if (!sendResult.success) {
      failedCount += 1;
      results.push({
        assignmentId: row.assignment.id,
        sent: false,
        error: sendResult.error ?? "SMS send failed",
        to: recipientPhone,
      });
      continue;
    }

    sentCount += 1;
    await db
      .update(serviceAssignments)
      .set({
        status: "offered",
        offeredAt: new Date(),
        responseChannel: null,
        responseText: null,
        respondedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(serviceAssignments.id, row.assignment.id));

    results.push({
      assignmentId: row.assignment.id,
      sent: true,
      to: recipientPhone,
    });
  }

  await auditAction({
    organizationId: serviceRun.organizationId,
    userId: serviceRun.session.userId,
    actionType: "update",
    entityName: "service_assignment_offers",
    entityId: serviceRun.id,
    details: {
      serviceRunId: serviceRun.id,
      attempted: candidateRows.length,
      sent: sentCount,
      skipped: skippedCount,
      failed: failedCount,
    },
  });

  const progress = await summarizeVolunteerStaffingAssignmentProgress({
    organizationId: serviceRun.organizationId,
    serviceRunId: serviceRun.id,
  });
  const workflowStatus: "waiting" | "completed" =
    progress.unresolvedRequiredSeats <= 0 ? "completed" : "waiting";

  await updateVolunteerStaffingGoalStep({
    organizationId: serviceRun.organizationId,
    goalId: workflowGoalRecord.goal.id,
    serviceRunId: serviceRun.id,
    stepKey: "send_offers",
    status: "completed",
    source: "grace_executor",
    actorType: "staff",
    channel: "in_app",
    sessionId: null,
    outputJson: {
      attempted: candidateRows.length,
      sent: sentCount,
      skipped: skippedCount,
      failed: failedCount,
      workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
    },
    actionName: "sendServiceAssignmentOffers",
  });

  await updateVolunteerStaffingGoalStep({
    organizationId: serviceRun.organizationId,
    goalId: workflowGoalRecord.goal.id,
    serviceRunId: serviceRun.id,
    stepKey: "wait_responses",
    status: workflowStatus === "completed" ? "completed" : "waiting",
    source: "grace_executor",
    actorType: "staff",
    channel: "in_app",
    sessionId: null,
    outputJson: {
      waitingForReplies: workflowStatus !== "completed",
      openRequiredSeats: progress.unresolvedRequiredSeats,
      openRoles: progress.openRequiredRoles,
      workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
    },
    actionName: "sendServiceAssignmentOffers",
  });

  await updateVolunteerStaffingGoalStatus({
    organizationId: serviceRun.organizationId,
    goalId: workflowGoalRecord.goal.id,
    serviceRunId: serviceRun.id,
    status: workflowStatus,
    source: "grace_executor",
    actorType: "staff",
    channel: "in_app",
    sessionId: null,
    contextJsonPatch: {
      lastManualActionAt: new Date().toISOString(),
      lastManualAction: "sendServiceAssignmentOffers",
      lastOfferSummary: {
        attempted: candidateRows.length,
        sent: sentCount,
        skipped: skippedCount,
        failed: failedCount,
      },
    },
    resultJsonPatch: buildVolunteerStaffingGoalResult({
      serviceRunId: serviceRun.id,
      status: workflowStatus,
      summary: {
        attempted: candidateRows.length,
        sent: sentCount,
        skipped: skippedCount,
        failed: failedCount,
      },
      openRequiredSeats: progress.unresolvedRequiredSeats,
      openRoles: progress.openRequiredRoles,
    }),
    actionName: "sendServiceAssignmentOffers",
  });

  return {
    serviceRunId: serviceRun.id,
    attempted: candidateRows.length,
    sent: sentCount,
    skipped: skippedCount,
    failed: failedCount,
    results,
  };
}

export async function processServiceAssignmentSmsReply(data: {
  organizationId: string;
  fromPhone: string;
  message: string;
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      fromPhone: z.string().min(1),
      message: z.string().min(1),
    })
    .parse(data);

  const response = parseAssignmentResponse(parsed.message);
  if (!response) {
    return { handled: false as const };
  }

  const normalizedFrom = normalizePhoneNumber(parsed.fromPhone);
  if (!normalizedFrom) {
    return { handled: false as const };
  }

  const offeredAssignments = await db
    .select({
      assignment: serviceAssignments,
      run: serviceRuns,
      volunteer: volunteers,
      contact: compatibleChurchContactSelect,
    })
    .from(serviceAssignments)
    .innerJoin(serviceRuns, eq(serviceAssignments.serviceRunId, serviceRuns.id))
    .leftJoin(volunteers, eq(serviceAssignments.volunteerId, volunteers.id))
    .leftJoin(churchContacts, eq(volunteers.contactId, churchContacts.id))
    .where(
      and(
        eq(serviceAssignments.organizationId, parsed.organizationId),
        eq(serviceAssignments.status, "offered")
      )
    )
    .orderBy(desc(serviceAssignments.offeredAt), desc(serviceAssignments.createdAt))
    .limit(80);

  const matched = offeredAssignments.find(
    (row) => normalizePhoneNumber(row.contact?.phone ?? null) === normalizedFrom
  );

  if (!matched) {
    return { handled: false as const };
  }

  const [updated] = await db
    .update(serviceAssignments)
    .set({
      status: response.nextStatus,
      respondedAt: new Date(),
      responseChannel: "sms_public",
      responseText: parsed.message,
      updatedAt: new Date(),
    })
    .where(eq(serviceAssignments.id, matched.assignment.id))
    .returning();

  if (response.nextStatus === "needs_replacement") {
    await ensureReplacementCoverageTask({
      organizationId: parsed.organizationId,
      serviceRunId: matched.run.id,
      serviceRunName: matched.run.name,
      serviceAt: matched.run.serviceAt,
      roleName: updated.roleName,
      roleSlotId: updated.roleSlotId,
      reasonStatus: "needs_replacement",
      assignmentId: updated.id,
    });

    await enqueueServiceAssignmentReplacementFlow({
      organizationId: parsed.organizationId,
      serviceRunId: matched.run.id,
      assignmentId: updated.id,
      reasonStatus: "needs_replacement",
      occurredAt: new Date(),
    });
  }

  let replyMessage = "";
  if (response.nextStatus === "confirmed") {
    replyMessage = `Grace: confirmed, thank you for serving as ${updated.roleName} on ${formatShortDateTime(
      matched.run.serviceAt
    )}.`;
  } else if (response.nextStatus === "declined") {
    replyMessage =
      "Grace: thanks for letting us know. We will arrange replacement coverage.";
  } else {
    replyMessage =
      "Grace: got it. We will follow up with a replacement or alternate scheduling option.";
  }

  const sendResult = await sendOrganizationSms({
    organizationId: parsed.organizationId,
    to: normalizedFrom,
    message: replyMessage,
    idempotencyKey: `${updated.id}:reply:${response.nextStatus}`,
  });

  const workflowGoalRecord = await ensureVolunteerStaffingGoalRecord({
    organizationId: parsed.organizationId,
    serviceRunId: matched.run.id,
    serviceRunName: matched.run.name,
    serviceAt: matched.run.serviceAt,
    templateId: matched.run.templateId ?? null,
    sourceChannel: "sms_public",
    triggerSource: "sms_reply",
    objectiveText: `Continue volunteer staffing for "${matched.run.name}" after an inbound volunteer reply.`,
  });

  const progress = await summarizeVolunteerStaffingAssignmentProgress({
    organizationId: parsed.organizationId,
    serviceRunId: matched.run.id,
  });
  const workflowProgress = deriveVolunteerStaffingReplyProgress({
    assignmentStatus: updated.status,
    unresolvedRequiredSeats: progress.unresolvedRequiredSeats,
  });

  const workflowResult = buildVolunteerStaffingGoalResult({
    serviceRunId: matched.run.id,
    status: workflowProgress.workflowStatus,
    summary: {
      assignmentId: updated.id,
      assignmentStatus: updated.status,
      replyQueued: sendResult.success,
      replySent: sendResult.success,
      replyProviderMessageId: sendResult.providerMessageId ?? null,
    },
    lastReply: {
      assignmentId: updated.id,
      assignmentStatus: updated.status,
      replyMessage,
      replyQueued: sendResult.success,
      replyProviderMessageId: sendResult.providerMessageId ?? null,
      repliedAt: new Date().toISOString(),
    },
    openRequiredSeats: progress.unresolvedRequiredSeats,
    openRoles: progress.openRequiredRoles,
  });

  await updateVolunteerStaffingGoalStep({
    organizationId: parsed.organizationId,
    goalId: workflowGoalRecord.goal.id,
    serviceRunId: matched.run.id,
    stepKey: "wait_responses",
    status: workflowProgress.stepStatus,
    source: "grace_executor",
    actorType: "public",
    channel: "sms_public",
    sessionId: null,
    outputJson: {
      assignmentId: updated.id,
      assignmentStatus: updated.status,
      replyMessage,
      replyQueued: sendResult.success,
      replyProviderMessageId: sendResult.providerMessageId ?? null,
      workflowStatus: workflowProgress.workflowStatus,
      unresolvedRequiredSeats: progress.unresolvedRequiredSeats,
      openRoles: progress.openRequiredRoles,
      workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
    },
    errorText: sendResult.success ? null : sendResult.error ?? "SMS reply dispatch failed",
    actionName: "processServiceAssignmentSmsReply",
  });

  await updateVolunteerStaffingGoalStatus({
    organizationId: parsed.organizationId,
    goalId: workflowGoalRecord.goal.id,
    serviceRunId: matched.run.id,
    status: workflowProgress.workflowStatus,
    source: "grace_executor",
    actorType: "public",
    channel: "sms_public",
    sessionId: null,
    completedAt: workflowProgress.workflowStatus === "completed" ? new Date() : null,
    contextJsonPatch: {
      lastReplyAt: new Date().toISOString(),
      lastReplyAssignmentId: updated.id,
      lastReplyAssignmentStatus: updated.status,
      lastReplyMessage: replyMessage,
      currentRequiredSeats: progress.unresolvedRequiredSeats,
      currentOpenRoles: progress.openRequiredRoles,
    },
    resultJsonPatch: workflowResult,
    errorText: sendResult.success ? null : sendResult.error ?? "SMS reply dispatch failed",
    actionName: "processServiceAssignmentSmsReply",
  });

  return {
    handled: true as const,
    assignmentId: updated.id,
    assignmentStatus: updated.status,
    replyMessage,
    replySendResult: sendResult,
    replyQueued: sendResult.success,
    providerMessageId: sendResult.providerMessageId,
    replySent: sendResult.success,
    replyProviderMessageId: sendResult.providerMessageId,
    replyError: sendResult.error ?? null,
    workflowGoalId: workflowGoalRecord.goal.id,
    workflowStatus: workflowProgress.workflowStatus,
    workflowKey: VOLUNTEER_STAFFING_WORKFLOW_KEY,
  };
}

export async function getGraceGoals(
  orgId: string,
  filters?: {
    status?: "queued" | "in_progress" | "waiting" | "completed" | "failed" | "cancelled" | "escalated";
    goalType?: "service_staffing" | "communications_followup" | "operations" | "custom";
    workflowKey?: "volunteer_staffing" | "guest_followup" | "prayer_care" | "legacy_goal";
    serviceRunId?: string;
  }
) {
  await requireOrgMembership(orgId);
  const clauses = [eq(graceGoals.organizationId, orgId)];
  if (filters?.status) {
    clauses.push(eq(graceGoals.status, filters.status));
  }
  if (filters?.goalType) {
    clauses.push(eq(graceGoals.goalType, filters.goalType));
  }
  if (filters?.workflowKey) {
    clauses.push(eq(graceGoals.workflowKey, filters.workflowKey));
  }
  if (filters?.serviceRunId) {
    clauses.push(eq(graceGoals.serviceRunId, filters.serviceRunId));
  }

  return db
    .select({
      goal: graceGoals,
      serviceRun: serviceRuns,
    })
    .from(graceGoals)
    .leftJoin(serviceRuns, eq(graceGoals.serviceRunId, serviceRuns.id))
    .where(and(...clauses))
    .orderBy(desc(graceGoals.createdAt));
}

export async function getGraceGoalWithSteps(goalId: string) {
  const [goal] = await db
    .select()
    .from(graceGoals)
    .where(eq(graceGoals.id, goalId))
    .limit(1);

  if (!goal) {
    throw new Error("Grace goal not found");
  }

  await requireOrgMembership(goal.organizationId);
  const steps = await db
    .select()
    .from(graceGoalSteps)
    .where(eq(graceGoalSteps.goalId, goal.id))
    .orderBy(graceGoalSteps.runOrder, graceGoalSteps.createdAt);

  return { goal, steps };
}

export async function startServiceRunAutostaffGoal(data: {
  serviceRunId: string;
  sourceChannel?: string;
  objectiveText?: string;
  waitHours?: number;
}) {
  const parsed = z
    .object({
      serviceRunId: z.string().min(1),
      sourceChannel: z.string().optional().default("in_app"),
      objectiveText: z.string().optional(),
      waitHours: z.coerce.number().int().positive().optional(),
    })
    .parse(data);

  const serviceRun = await requireServiceRunAccess(parsed.serviceRunId, "admin");
  const goalRecord = await ensureVolunteerStaffingGoalRecord({
    organizationId: serviceRun.organizationId,
    serviceRunId: serviceRun.id,
    serviceRunName: serviceRun.name,
    serviceAt: serviceRun.serviceAt,
    templateId: serviceRun.templateId,
    sourceChannel: parsed.sourceChannel,
    triggerSource: "service_page",
    requestedByUserId: serviceRun.session.userId,
    objectiveText:
      parsed.objectiveText?.trim() ||
      `Auto-staff "${serviceRun.name}" for ${formatShortDateTime(serviceRun.serviceAt)}.`,
    waitHours: parsed.waitHours ?? null,
  });

  if (!goalRecord.created) {
    return {
      goal: goalRecord.goal,
      created: false,
      dispatched: false,
      waitHours: null,
    };
  }

  const goal = goalRecord.goal;

  const markGoalDispatchFailed = async (errorText: string) => {
    const [updatedGoal] = await db
      .update(graceGoals)
      .set({
        status: "failed",
        errorText,
        updatedAt: new Date(),
      })
      .where(eq(graceGoals.id, goal.id))
      .returning();

    return updatedGoal ?? { ...goal, status: "failed", errorText, updatedAt: new Date() };
  };

  if (!hasInngestEventKey()) {
    const errorText =
      "Autostaff goal was created, but Inngest event dispatch is not configured in this environment.";
    const updatedGoal = await markGoalDispatchFailed(errorText);

    return {
      goal: updatedGoal,
      created: true,
      dispatched: false,
      waitHours: parsed.waitHours ?? null,
      message: errorText,
    };
  }

  try {
    await inngest.send({
      name: INNGEST_EVENTS.GRACE_SERVICE_AUTOSTAFF_REQUESTED,
      data: {
        organizationId: serviceRun.organizationId,
        serviceRunId: serviceRun.id,
        goalId: goal.id,
        waitHours: parsed.waitHours,
        idempotencyKey: buildGraceServiceAutostaffIdempotencyKey({
          organizationId: serviceRun.organizationId,
          serviceRunId: serviceRun.id,
          goalId: goal.id,
        }),
      },
    });
  } catch (error) {
    const errorText =
      error instanceof Error ? error.message : "Failed to dispatch auto-staff workflow";
    const updatedGoal = await markGoalDispatchFailed(errorText);

    if (isInngestDispatchConfigurationError(error)) {
      return {
        goal: updatedGoal,
        created: true,
        dispatched: false,
        waitHours: parsed.waitHours ?? null,
        message:
          "Autostaff goal was created, but the background runner could not be reached. Configure a valid Inngest event key and try again.",
      };
    }

    throw new Error(errorText);
  }

  await auditAction({
    organizationId: serviceRun.organizationId,
    userId: serviceRun.session.userId,
    actionType: "create",
    entityName: "grace_goal",
    entityId: goal.id,
    details: {
      goalType: "service_staffing",
      serviceRunId: serviceRun.id,
    },
  });

  return {
    goal,
    created: true,
    dispatched: true,
    waitHours: parsed.waitHours ?? null,
  };
}

type ServiceTemplateAssignmentSuggestion = {
  assigneeType: "paid_staff" | "volunteer";
  assigneeId: string;
  displayName: string;
  primaryRole: string;
  score: number;
  available: boolean;
  conflictReason?: string;
  reasons: string[];
  recentLoad: number;
};

type ServiceTemplateRoleRecommendation = {
  roleSlot: Awaited<ReturnType<typeof getServiceTemplateRoleSlots>>[number];
  requiredCount: number;
  suggestions: ServiceTemplateAssignmentSuggestion[];
  recommended: ServiceTemplateAssignmentSuggestion[];
  unfilledSeats: number;
};

export async function getServiceTemplateAssignmentPreview(data: {
  templateId: string;
  serviceAt: Date;
  serviceDurationMinutes?: number;
  includeUnavailable?: boolean;
}) {
  const parsed = z
    .object({
      templateId: z.string().min(1),
      serviceAt: z.coerce.date(),
      serviceDurationMinutes: z.coerce.number().int().positive().optional().default(90),
      includeUnavailable: z.boolean().optional().default(false),
    })
    .parse(data);

  const existing = await requireServiceTemplateAccess(parsed.templateId);
  const templateBundle = await getServiceTemplate(parsed.templateId);
  const roleSlots = templateBundle.roleSlots.filter((roleSlot) => roleSlot.isEnabled);

  const serviceAt = parsed.serviceAt;
  const serviceStart = new Date(serviceAt.getTime() - 30 * 60 * 1000);
  const serviceEnd = new Date(
    serviceAt.getTime() + parsed.serviceDurationMinutes * 60 * 1000 + 30 * 60 * 1000
  );
  const loadWindowStart = new Date(serviceAt.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    staffMembers,
    volunteerMembers,
    conflictingStaffAppointments,
    recentStaffAppointments,
    conflictingVolunteerShifts,
    recentVolunteerShifts,
    schedulingProfiles,
  ] =
    await Promise.all([
      db
        .select({
          userId: organizationMemberships.userId,
          membershipRole: organizationMemberships.role,
          name: users.name,
          email: users.email,
        })
        .from(organizationMemberships)
        .innerJoin(users, eq(organizationMemberships.userId, users.id))
        .where(eq(organizationMemberships.organizationId, existing.organizationId)),
      db
        .select({
          volunteerId: volunteers.id,
          contactId: volunteers.contactId,
          role: volunteers.role,
          status: volunteers.status,
          totalHours: volunteers.totalHours,
          contactFirstName: churchContacts.firstName,
          contactLastName: churchContacts.lastName,
          contactEmail: churchContacts.email,
        })
        .from(volunteers)
        .leftJoin(churchContacts, eq(volunteers.contactId, churchContacts.id))
        .where(
          and(
            eq(volunteers.organizationId, existing.organizationId),
            eq(volunteers.status, "active")
          )
        ),
      db
        .select({
          staffId: appointments.staffId,
          title: appointments.title,
          dateTime: appointments.dateTime,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.organizationId, existing.organizationId),
            gte(appointments.dateTime, serviceStart),
            lte(appointments.dateTime, serviceEnd),
            ne(appointments.status, "cancelled"),
            ne(appointments.status, "completed"),
            ne(appointments.status, "no_show")
          )
        ),
      db
        .select({
          staffId: appointments.staffId,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.organizationId, existing.organizationId),
            gte(appointments.dateTime, loadWindowStart),
            lte(appointments.dateTime, serviceAt),
            ne(appointments.status, "cancelled"),
            ne(appointments.status, "no_show")
          )
        ),
      db
        .select({
          volunteerId: volunteerShifts.volunteerId,
          date: volunteerShifts.date,
        })
        .from(volunteerShifts)
        .innerJoin(volunteers, eq(volunteerShifts.volunteerId, volunteers.id))
        .where(
          and(
            eq(volunteers.organizationId, existing.organizationId),
            gte(volunteerShifts.date, serviceStart),
            lte(volunteerShifts.date, serviceEnd)
          )
        ),
      db
        .select({
          volunteerId: volunteerShifts.volunteerId,
        })
        .from(volunteerShifts)
        .innerJoin(volunteers, eq(volunteerShifts.volunteerId, volunteers.id))
        .where(
          and(
            eq(volunteers.organizationId, existing.organizationId),
            gte(volunteerShifts.date, loadWindowStart),
            lte(volunteerShifts.date, serviceAt)
          )
        ),
      db
        .select()
        .from(serviceSchedulingProfiles)
        .where(eq(serviceSchedulingProfiles.organizationId, existing.organizationId)),
    ]);

  const staffConflictById = new Map<string, string>();
  for (const row of conflictingStaffAppointments) {
    if (!row.staffId || staffConflictById.has(row.staffId)) continue;
    const title = row.title || "another appointment";
    staffConflictById.set(
      row.staffId,
      `${title} at ${formatShortDateTime(row.dateTime)}`
    );
  }

  const staffLoadCountById = new Map<string, number>();
  for (const row of recentStaffAppointments) {
    if (!row.staffId) continue;
    staffLoadCountById.set(
      row.staffId,
      (staffLoadCountById.get(row.staffId) ?? 0) + 1
    );
  }

  const volunteerConflictById = new Map<string, string>();
  for (const row of conflictingVolunteerShifts) {
    if (volunteerConflictById.has(row.volunteerId)) continue;
    volunteerConflictById.set(
      row.volunteerId,
      `scheduled shift at ${formatShortDateTime(row.date)}`
    );
  }

  const volunteerLoadCountById = new Map<string, number>();
  for (const row of recentVolunteerShifts) {
    volunteerLoadCountById.set(
      row.volunteerId,
      (volunteerLoadCountById.get(row.volunteerId) ?? 0) + 1
    );
  }

  const staffProfileById = new Map<
    string,
    {
      isSchedulable: boolean;
      preferredRoles: string[];
      availabilitySlots: SchedulingAvailabilitySlot[];
    }
  >();
  const volunteerProfileByContactId = new Map<
    string,
    {
      isSchedulable: boolean;
      preferredRoles: string[];
      availabilitySlots: SchedulingAvailabilitySlot[];
    }
  >();

  for (const profile of schedulingProfiles) {
    const normalized = {
      isSchedulable: profile.isSchedulable,
      preferredRoles: Array.isArray(profile.preferredRoles)
        ? profile.preferredRoles.map((item) => String(item).trim()).filter(Boolean)
        : [],
      availabilitySlots: normalizeAvailabilitySlots(profile.availabilitySlots),
    };

    if (profile.personType === "staff" && profile.staffUserId) {
      staffProfileById.set(profile.staffUserId, normalized);
    }
    if (profile.personType === "contact" && profile.contactId) {
      volunteerProfileByContactId.set(profile.contactId, normalized);
    }
  }

  const roleRecommendations: ServiceTemplateRoleRecommendation[] = roleSlots.map((roleSlot) => {
    const slotSuggestions: ServiceTemplateAssignmentSuggestion[] = [];

    if (roleSlot.assignmentType !== "volunteer") {
      for (const staff of staffMembers) {
        const staffProfile = staffProfileById.get(staff.userId);
        const schedulableConflict =
          staffProfile && !staffProfile.isSchedulable
            ? "Scheduling disabled in matrix"
            : undefined;
        const availabilityConflict =
          staffProfile &&
          !isAvailabilityMatch(serviceAt, staffProfile.availabilitySlots)
            ? "Outside saved availability"
            : undefined;
        const conflictReason =
          schedulableConflict ??
          availabilityConflict ??
          staffConflictById.get(staff.userId);
        const recentLoad = staffLoadCountById.get(staff.userId) ?? 0;
        const scored = scoreStaffCandidate({
          roleName: roleSlot.roleName,
          membershipRole: staff.membershipRole,
          recentLoad,
          conflictReason,
        });
        const reasons = [...scored.reasons];
        let score = scored.score;
        if (staffProfile?.preferredRoles.length) {
          if (hasPreferredRoleMatch(roleSlot.roleName, staffProfile.preferredRoles)) {
            score += 12;
            reasons.push("Preferred position match");
          } else {
            score -= 6;
            reasons.push("Outside preferred positions");
          }
        }
        if (availabilityConflict) {
          score -= 30;
          reasons.push("Outside saved availability");
        }
        if (schedulableConflict) {
          score -= 60;
          reasons.push("Scheduling disabled");
        }

        slotSuggestions.push({
          assigneeType: "paid_staff",
          assigneeId: staff.userId,
          displayName: staff.name || staff.email || "Unnamed staff",
          primaryRole: staff.membershipRole,
          score: Math.max(1, score),
          available: !conflictReason,
          conflictReason,
          reasons,
          recentLoad,
        });
      }
    }

    if (roleSlot.assignmentType !== "paid_staff") {
      for (const volunteer of volunteerMembers) {
        const volunteerProfile = volunteerProfileByContactId.get(volunteer.contactId);
        const schedulableConflict =
          volunteerProfile && !volunteerProfile.isSchedulable
            ? "Scheduling disabled in matrix"
            : undefined;
        const availabilityConflict =
          volunteerProfile &&
          !isAvailabilityMatch(serviceAt, volunteerProfile.availabilitySlots)
            ? "Outside saved availability"
            : undefined;
        const conflictReason =
          schedulableConflict ??
          availabilityConflict ??
          volunteerConflictById.get(volunteer.volunteerId);
        const recentLoad = volunteerLoadCountById.get(volunteer.volunteerId) ?? 0;
        const scored = scoreVolunteerCandidate({
          roleName: roleSlot.roleName,
          volunteerRole: volunteer.role,
          totalHours: volunteer.totalHours,
          recentLoad,
          conflictReason,
        });
        const reasons = [...scored.reasons];
        let score = scored.score;
        if (volunteerProfile?.preferredRoles.length) {
          if (hasPreferredRoleMatch(roleSlot.roleName, volunteerProfile.preferredRoles)) {
            score += 16;
            reasons.push("Preferred position match");
          } else {
            score -= 8;
            reasons.push("Outside preferred positions");
          }
        }
        if (availabilityConflict) {
          score -= 30;
          reasons.push("Outside saved availability");
        }
        if (schedulableConflict) {
          score -= 60;
          reasons.push("Scheduling disabled");
        }

        const displayName = [volunteer.contactFirstName, volunteer.contactLastName]
          .filter(Boolean)
          .join(" ")
          .trim();

        slotSuggestions.push({
          assigneeType: "volunteer",
          assigneeId: volunteer.volunteerId,
          displayName: displayName || volunteer.contactEmail || "Unnamed volunteer",
          primaryRole: volunteer.role || "General",
          score: Math.max(1, score),
          available: !conflictReason,
          conflictReason,
          reasons,
          recentLoad,
        });
      }
    }

    slotSuggestions.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      if (a.score !== b.score) return b.score - a.score;
      if (a.recentLoad !== b.recentLoad) return a.recentLoad - b.recentLoad;
      return a.displayName.localeCompare(b.displayName);
    });

    const recommended = slotSuggestions
      .filter((candidate) => candidate.available)
      .slice(0, roleSlot.requiredCount);
    const unfilledSeats = Math.max(0, roleSlot.requiredCount - recommended.length);
    const visibleSuggestions = parsed.includeUnavailable
      ? slotSuggestions.slice(0, Math.max(6, roleSlot.requiredCount + 2))
      : slotSuggestions
          .filter((candidate) => candidate.available)
          .slice(0, Math.max(6, roleSlot.requiredCount + 2));

    return {
      roleSlot,
      requiredCount: roleSlot.requiredCount,
      suggestions: visibleSuggestions,
      recommended,
      unfilledSeats,
    };
  });

  const summary = roleRecommendations.reduce(
    (acc, recommendation) => {
      acc.roleSlots += 1;
      acc.totalSeats += recommendation.roleSlot.requiredCount;
      acc.recommendedSeats += recommendation.recommended.length;
      if (recommendation.roleSlot.isRequired) {
        acc.requiredSeats += recommendation.roleSlot.requiredCount;
        acc.unfilledRequiredSeats += recommendation.unfilledSeats;
      } else {
        acc.optionalSeats += recommendation.roleSlot.requiredCount;
      }
      if (recommendation.roleSlot.isRequired && recommendation.recommended.length === 0) {
        acc.requiredRolesWithoutCoverage += 1;
      }
      return acc;
    },
    {
      roleSlots: 0,
      requiredSeats: 0,
      optionalSeats: 0,
      totalSeats: 0,
      recommendedSeats: 0,
      unfilledRequiredSeats: 0,
      requiredRolesWithoutCoverage: 0,
    }
  );

  await auditAction({
    organizationId: existing.organizationId,
    userId: existing.session.userId,
    actionType: "read",
    entityName: "service_template_assignment_preview",
    entityId: parsed.templateId,
    details: {
      serviceAt: parsed.serviceAt.toISOString(),
      serviceDurationMinutes: parsed.serviceDurationMinutes,
      roleSlots: summary.roleSlots,
    },
  });

  return {
    template: templateBundle.template,
    serviceAt: parsed.serviceAt,
    serviceDurationMinutes: parsed.serviceDurationMinutes,
    generatedAt: new Date(),
    summary,
    roleRecommendations,
  };
}

export async function clearServiceAssignmentSeat(assignmentId: string) {
  const assignment = await requireServiceAssignmentAccess(assignmentId, "admin");
  const [updated] = await db
    .update(serviceAssignments)
    .set({
      volunteerId: null,
      staffUserId: null,
      status: "proposed",
      updatedAt: new Date(),
    })
    .where(eq(serviceAssignments.id, assignment.id))
    .returning();
  return updated;
}

const serviceAssignmentStatusSchema = z.enum([
  "proposed",
  "offered",
  "confirmed",
  "declined",
  "needs_replacement",
  "checked_in",
  "checked_out",
  "no_show",
  "cancelled",
]);

const TASK_OPEN_STATUSES = ["todo", "in_progress"] as const;

async function ensureReplacementCoverageTask(params: {
  organizationId: string;
  serviceRunId: string;
  serviceRunName: string;
  serviceAt: Date;
  roleName: string;
  roleSlotId: string | null;
  reasonStatus: "needs_replacement" | "no_show";
  assignmentId: string;
}) {
  let isRequired = true;
  if (params.roleSlotId) {
    const [slot] = await db
      .select({ isRequired: serviceTemplateRoleSlots.isRequired })
      .from(serviceTemplateRoleSlots)
      .where(eq(serviceTemplateRoleSlots.id, params.roleSlotId))
      .limit(1);
    if (slot) {
      isRequired = slot.isRequired;
    }
  }

  const taskTitle = `URGENT ${params.reasonStatus.replaceAll("_", " ")} replacement · ${params.roleName} (${params.serviceRunId})`;
  const [existingTask] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.organizationId, params.organizationId),
        eq(tasks.title, taskTitle),
        inArray(tasks.status, [...TASK_OPEN_STATUSES])
      )
    )
    .limit(1);

  if (existingTask) {
    return { taskId: existingTask.id, created: false };
  }

  const taskDescription = [
    `Grace flagged this seat as ${params.reasonStatus.replaceAll("_", " ")}.`,
    `Service: ${params.serviceRunName} at ${formatShortDateTime(params.serviceAt)}.`,
    `Role: ${params.roleName}.`,
    `Assignment ID: ${params.assignmentId}.`,
    "Action: assign replacement coverage and resend confirmation immediately.",
  ].join(" ");

  const [createdTask] = await db
    .insert(tasks)
    .values({
      organizationId: params.organizationId,
      title: taskTitle,
      description: taskDescription,
      dueDate: params.serviceAt,
      priority: params.reasonStatus === "no_show" || isRequired ? "urgent" : "high",
      status: "todo",
    })
    .returning({ id: tasks.id });

  return { taskId: createdTask.id, created: true };
}

async function enqueueServiceAssignmentReplacementFlow(params: {
  organizationId: string;
  serviceRunId: string;
  assignmentId: string;
  reasonStatus: "needs_replacement" | "no_show";
  occurredAt: Date;
}) {
  try {
    const occurredAtIso = params.occurredAt.toISOString();
    const idempotencyKey = buildServiceAssignmentReplacementIdempotencyKey({
      organizationId: params.organizationId,
      serviceRunId: params.serviceRunId,
      assignmentId: params.assignmentId,
      reasonStatus: params.reasonStatus,
      occurredAt: occurredAtIso,
    });

    await inngest.send({
      id: idempotencyKey,
      name: INNGEST_EVENTS.GRACE_SERVICE_ASSIGNMENT_REPLACEMENT_REQUESTED,
      data: {
        organizationId: params.organizationId,
        serviceRunId: params.serviceRunId,
        assignmentId: params.assignmentId,
        reasonStatus: params.reasonStatus,
        occurredAt: occurredAtIso,
        idempotencyKey,
      },
    });
  } catch (error) {
    console.error("[Operations] Failed to enqueue service assignment replacement workflow", {
      organizationId: params.organizationId,
      serviceRunId: params.serviceRunId,
      assignmentId: params.assignmentId,
      reasonStatus: params.reasonStatus,
      error,
    });
  }
}

export async function updateServiceAssignmentStatus(data: {
  assignmentId: string;
  status: z.infer<typeof serviceAssignmentStatusSchema>;
  notes?: string | null;
  responseChannel?: string | null;
  responseText?: string | null;
}) {
  const parsed = z
    .object({
      assignmentId: z.string().min(1),
      status: serviceAssignmentStatusSchema,
      notes: z.string().nullable().optional(),
      responseChannel: z.string().nullable().optional(),
      responseText: z.string().nullable().optional(),
    })
    .parse(data);

  const assignment = await requireServiceAssignmentAccess(parsed.assignmentId, "admin");
  const serviceRun = await requireServiceRunAccess(assignment.serviceRunId, "admin");
  const hasAssignee = Boolean(assignment.volunteerId || assignment.staffUserId);

  const assignedStatuses = new Set([
    "offered",
    "confirmed",
    "declined",
    "needs_replacement",
    "checked_in",
    "checked_out",
    "no_show",
  ]);
  if (assignedStatuses.has(parsed.status) && !hasAssignee) {
    throw new Error("Assign a volunteer or staff member before updating this status");
  }

  if (
    parsed.status === "checked_in" &&
    !["proposed", "offered", "confirmed", "checked_in"].includes(assignment.status)
  ) {
    throw new Error(`Cannot check in assignment from "${assignment.status}" status`);
  }

  if (parsed.status === "checked_out" && assignment.status !== "checked_in") {
    throw new Error(`Cannot check out assignment from "${assignment.status}" status`);
  }

  if (parsed.status === "no_show" && assignment.status === "checked_out") {
    throw new Error("Checked-out assignments cannot be marked no-show");
  }

  const now = new Date();
  const patch: {
    status: z.infer<typeof serviceAssignmentStatusSchema>;
    notes?: string | null;
    offeredAt?: Date | null;
    respondedAt?: Date | null;
    responseChannel?: string | null;
    responseText?: string | null;
    checkedInAt?: Date | null;
    checkedOutAt?: Date | null;
    payrollExportedAt?: Date | null;
    updatedAt: Date;
  } = {
    status: parsed.status,
    updatedAt: now,
  };

  if (parsed.notes !== undefined) {
    patch.notes = parsed.notes;
  }

  if (parsed.status === "proposed") {
    patch.offeredAt = null;
    patch.respondedAt = null;
    patch.responseChannel = null;
    patch.responseText = null;
    patch.checkedInAt = null;
    patch.checkedOutAt = null;
    patch.payrollExportedAt = null;
  } else if (parsed.status === "offered") {
    patch.offeredAt = now;
    patch.respondedAt = null;
    patch.responseChannel = null;
    patch.responseText = null;
  } else if (
    parsed.status === "confirmed" ||
    parsed.status === "declined" ||
    parsed.status === "needs_replacement" ||
    parsed.status === "no_show"
  ) {
    patch.respondedAt = now;
    patch.responseChannel = parsed.responseChannel ?? "manual";
    patch.responseText = parsed.responseText ?? `Marked ${parsed.status.replaceAll("_", " ")} by staff`;
  }

  if (parsed.status === "checked_in") {
    patch.checkedInAt = assignment.checkedInAt ?? now;
    patch.checkedOutAt = null;
    patch.payrollExportedAt = null;
  }

  if (parsed.status === "checked_out") {
    patch.checkedInAt = assignment.checkedInAt ?? now;
    patch.checkedOutAt = now;
  }

  if (
    parsed.status === "declined" ||
    parsed.status === "needs_replacement" ||
    parsed.status === "no_show" ||
    parsed.status === "cancelled"
  ) {
    patch.payrollExportedAt = null;
    if (parsed.status !== "no_show") {
      patch.checkedOutAt = null;
    }
  }

  const [updated] = await db
    .update(serviceAssignments)
    .set(patch)
    .where(eq(serviceAssignments.id, assignment.id))
    .returning();

  let replacementTask: { taskId: string; created: boolean } | null = null;
  if (parsed.status === "needs_replacement" || parsed.status === "no_show") {
    replacementTask = await ensureReplacementCoverageTask({
      organizationId: assignment.organizationId,
      serviceRunId: serviceRun.id,
      serviceRunName: serviceRun.name,
      serviceAt: serviceRun.serviceAt,
      roleName: updated.roleName,
      roleSlotId: updated.roleSlotId,
      reasonStatus: parsed.status,
      assignmentId: updated.id,
    });

    await enqueueServiceAssignmentReplacementFlow({
      organizationId: assignment.organizationId,
      serviceRunId: serviceRun.id,
      assignmentId: updated.id,
      reasonStatus: parsed.status,
      occurredAt: now,
    });
  }

  await auditAction({
    organizationId: assignment.organizationId,
    userId: assignment.session.userId,
    actionType: "update",
    entityName: "service_assignment",
    entityId: updated.id,
    details: {
      fromStatus: assignment.status,
      toStatus: updated.status,
      volunteerId: updated.volunteerId,
      staffUserId: updated.staffUserId,
      replacementTaskId: replacementTask?.taskId ?? null,
      replacementTaskCreated: replacementTask?.created ?? false,
    },
  });

  return updated;
}
