"use server";

import { db } from "@/db";
import { events } from "@/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { requireOrgMembership } from "./utils";
import * as z from "zod";

const eventDateSchema = z.coerce.date();

const getEventsSchema = z.object({
  orgId: z.string().trim().min(1),
  dateRange: z
    .object({
      start: eventDateSchema,
      end: eventDateSchema,
    })
    .optional(),
});

const createEventSchema = z
  .object({
    title: z.string().trim().min(1),
    description: z.string().trim().optional(),
    startDate: eventDateSchema,
    endDate: eventDateSchema.optional(),
    location: z.string().trim().optional(),
    isRecurring: z.boolean().optional(),
    recurrenceRule: z.string().trim().optional(),
    organizationId: z.string().trim().min(1),
  })
  .superRefine((value, ctx) => {
    if (value.endDate && value.endDate.getTime() < value.startDate.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate cannot be before startDate",
        path: ["endDate"],
      });
    }
  });

const updateEventSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().nullable().optional(),
    startDate: eventDateSchema.optional(),
    endDate: eventDateSchema.nullable().optional(),
    location: z.string().trim().nullable().optional(),
    isRecurring: z.boolean().optional(),
    recurrenceRule: z.string().trim().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.startDate &&
      value.endDate &&
      value.endDate.getTime() < value.startDate.getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate cannot be before startDate",
        path: ["endDate"],
      });
    }
  });

const eventIdSchema = z.string().trim().min(1);

export async function getEvents(
  orgId: string,
  dateRange?: { start: Date; end: Date }
) {
  const parsed = getEventsSchema.parse({ orgId, dateRange });
  await requireOrgMembership(parsed.orgId);
  if (parsed.dateRange) {
    return await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.organizationId, parsed.orgId),
          gte(events.startDate, parsed.dateRange.start),
          lte(events.startDate, parsed.dateRange.end)
        )
      )
      .orderBy(events.startDate);
  }
  return await db
    .select()
    .from(events)
    .where(eq(events.organizationId, parsed.orgId))
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
  const parsed = createEventSchema.parse(data);
  await requireOrgMembership(parsed.organizationId);
  const [event] = await db
    .insert(events)
    .values({
      title: parsed.title,
      description: parsed.description ?? null,
      startDate: parsed.startDate,
      endDate: parsed.endDate ?? null,
      location: parsed.location ?? null,
      isRecurring: parsed.isRecurring ?? false,
      recurrenceRule: parsed.recurrenceRule ?? null,
      organizationId: parsed.organizationId,
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
  const eventId = eventIdSchema.parse(id);
  const parsed = updateEventSchema.parse(data);
  const [existing] = await db
    .select({ organizationId: events.organizationId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!existing) throw new Error("Event not found");
  await requireOrgMembership(existing.organizationId);

  const [event] = await db
    .update(events)
    .set(parsed)
    .where(and(eq(events.id, eventId), eq(events.organizationId, existing.organizationId)))
    .returning();
  return event;
}

export async function deleteEvent(id: string) {
  const eventId = eventIdSchema.parse(id);
  const [existing] = await db
    .select({ organizationId: events.organizationId })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!existing) return;
  await requireOrgMembership(existing.organizationId);
  await db
    .delete(events)
    .where(and(eq(events.id, eventId), eq(events.organizationId, existing.organizationId)));
}
