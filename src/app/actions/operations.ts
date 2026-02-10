"use server";

import { db } from "@/db";
import {
  appointments,
  volunteers,
  volunteerShifts,
  churchContacts,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

// ── Appointments ──
export async function getAppointments(
  orgId: string,
  filters?: { status?: string }
) {
  if (filters?.status) {
    return await db
      .select({ appointment: appointments, contact: churchContacts })
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
    .select({ appointment: appointments, contact: churchContacts })
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
  const [appointment] = await db
    .insert(appointments)
    .values({
      contactId: data.contactId ?? null,
      staffId: data.staffId ?? null,
      title: data.title,
      dateTime: data.dateTime,
      duration: data.duration ?? 30,
      type: data.type ?? null,
      notes: data.notes ?? null,
      organizationId: data.organizationId,
    })
    .returning();
  return appointment;
}

export async function updateAppointment(
  id: string,
  data: Partial<{
    status: string;
    dateTime: Date;
    notes: string | null;
  }>
) {
  const [appointment] = await db
    .update(appointments)
    .set(data as any)
    .where(eq(appointments.id, id))
    .returning();
  return appointment;
}

// ── Volunteers ──
export async function getVolunteers(orgId: string) {
  return await db
    .select({ volunteer: volunteers, contact: churchContacts })
    .from(volunteers)
    .leftJoin(churchContacts, eq(volunteers.contactId, churchContacts.id))
    .where(eq(volunteers.organizationId, orgId))
    .orderBy(desc(volunteers.joinedAt));
}

export async function createVolunteer(data: {
  contactId: string;
  role?: string;
  organizationId: string;
}) {
  const [volunteer] = await db
    .insert(volunteers)
    .values({
      contactId: data.contactId,
      role: data.role ?? null,
      organizationId: data.organizationId,
    })
    .returning();
  return volunteer;
}

export async function logVolunteerShift(data: {
  volunteerId: string;
  eventId?: string;
  date: Date;
  hours: number;
  notes?: string;
}) {
  const [shift] = await db
    .insert(volunteerShifts)
    .values({
      volunteerId: data.volunteerId,
      eventId: data.eventId ?? null,
      date: data.date,
      hours: data.hours,
      notes: data.notes ?? null,
    })
    .returning();
  return shift;
}
