"use server";

import { db } from "@/db";
import { events } from "@/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { requireOrgMembership } from "./utils";

export async function getEvents(
  orgId: string,
  dateRange?: { start: Date; end: Date }
) {
  await requireOrgMembership(orgId);
  if (dateRange) {
    return await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.organizationId, orgId),
          gte(events.startDate, dateRange.start),
          lte(events.startDate, dateRange.end)
        )
      )
      .orderBy(events.startDate);
  }
  return await db
    .select()
    .from(events)
    .where(eq(events.organizationId, orgId))
    .orderBy(events.startDate);
}

export async function createEvent(data: {
  title: string;
  description?: string;
  startDate: Date;
  endDate?: Date;
  location?: string;
  isRecurring?: boolean;
  recurrenceRule?: string;
  organizationId: string;
}) {
  await requireOrgMembership(data.organizationId);
  const [event] = await db
    .insert(events)
    .values({
      title: data.title,
      description: data.description ?? null,
      startDate: data.startDate,
      endDate: data.endDate ?? null,
      location: data.location ?? null,
      isRecurring: data.isRecurring ?? false,
      recurrenceRule: data.recurrenceRule ?? null,
      organizationId: data.organizationId,
    })
    .returning();
  return event;
}

export async function updateEvent(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    startDate: Date;
    endDate: Date | null;
    location: string | null;
    isRecurring: boolean;
    recurrenceRule: string | null;
  }>
) {
  const [existing] = await db
    .select({ organizationId: events.organizationId })
    .from(events)
    .where(eq(events.id, id))
    .limit(1);
  if (!existing) throw new Error("Event not found");
  await requireOrgMembership(existing.organizationId);

  const [event] = await db
    .update(events)
    .set(data)
    .where(and(eq(events.id, id), eq(events.organizationId, existing.organizationId)))
    .returning();
  return event;
}

export async function deleteEvent(id: string) {
  const [existing] = await db
    .select({ organizationId: events.organizationId })
    .from(events)
    .where(eq(events.id, id))
    .limit(1);
  if (!existing) return;
  await requireOrgMembership(existing.organizationId);
  await db
    .delete(events)
    .where(and(eq(events.id, id), eq(events.organizationId, existing.organizationId)));
}
