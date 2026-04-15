"use server";

import { db } from "@/db";
import {
  attendanceEntries,
  attendanceSessions,
  ministries,
  serviceRuns,
} from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import * as z from "zod";
import { requireOrgMembership } from "./utils";

const organizationIdSchema = z.string().trim().min(1);

const createAttendanceSessionSchema = z.object({
  organizationId: organizationIdSchema,
  type: z.enum(["worship", "ministry", "service"]),
  name: z.string().trim().min(1),
  occurredAt: z.coerce.date(),
  ministryId: z.string().trim().nullable().optional(),
  serviceRunId: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

const recordAttendanceSchema = z.object({
  organizationId: organizationIdSchema,
  sessionId: z.string().trim().min(1),
  contactId: z.string().trim().min(1),
  status: z.enum(["present", "absent", "served"]).default("present"),
  source: z.enum(["manual", "import", "service_run", "ministry", "worship"]).default("manual"),
  notes: z.string().trim().nullable().optional(),
});

const attendanceFiltersSchema = z.object({
  type: z.enum(["worship", "ministry", "service"]).optional(),
  ministryId: z.string().trim().min(1).optional(),
  serviceRunId: z.string().trim().min(1).optional(),
}).optional();

export async function getAttendanceSessions(
  organizationId: string,
  filters?: {
    type?: "worship" | "ministry" | "service";
    ministryId?: string;
    serviceRunId?: string;
  }
) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  const parsedFilters = attendanceFiltersSchema.parse(filters);
  await requireOrgMembership(parsedOrganizationId);

  const clauses = [eq(attendanceSessions.organizationId, parsedOrganizationId)];
  if (parsedFilters?.type) clauses.push(eq(attendanceSessions.type, parsedFilters.type));
  if (parsedFilters?.ministryId) clauses.push(eq(attendanceSessions.ministryId, parsedFilters.ministryId));
  if (parsedFilters?.serviceRunId) clauses.push(eq(attendanceSessions.serviceRunId, parsedFilters.serviceRunId));

  return db
    .select({
      session: attendanceSessions,
      ministry: ministries,
      serviceRun: serviceRuns,
    })
    .from(attendanceSessions)
    .leftJoin(ministries, eq(attendanceSessions.ministryId, ministries.id))
    .leftJoin(serviceRuns, eq(attendanceSessions.serviceRunId, serviceRuns.id))
    .where(and(...clauses))
    .orderBy(desc(attendanceSessions.occurredAt));
}

export async function createAttendanceSession(input: {
  organizationId: string;
  type: "worship" | "ministry" | "service";
  name: string;
  occurredAt: Date | string;
  ministryId?: string | null;
  serviceRunId?: string | null;
  notes?: string | null;
}) {
  const parsed = createAttendanceSessionSchema.parse(input);
  const { userId } = await requireOrgMembership(parsed.organizationId);

  const [session] = await db
    .insert(attendanceSessions)
    .values({
      organizationId: parsed.organizationId,
      type: parsed.type,
      name: parsed.name,
      occurredAt: parsed.occurredAt,
      ministryId: parsed.ministryId ?? null,
      serviceRunId: parsed.serviceRunId ?? null,
      notes: parsed.notes ?? null,
      createdByUserId: userId,
    })
    .returning();

  return session;
}

export async function recordAttendance(input: {
  organizationId: string;
  sessionId: string;
  contactId: string;
  status?: "present" | "absent" | "served";
  source?: "manual" | "import" | "service_run" | "ministry" | "worship";
  notes?: string | null;
}) {
  const parsed = recordAttendanceSchema.parse(input);
  const { userId } = await requireOrgMembership(parsed.organizationId);

  const [existing] = await db
    .select({ id: attendanceEntries.id })
    .from(attendanceEntries)
    .where(
      and(
        eq(attendanceEntries.organizationId, parsed.organizationId),
        eq(attendanceEntries.sessionId, parsed.sessionId),
        eq(attendanceEntries.contactId, parsed.contactId)
      )
    )
    .limit(1);

  if (existing) {
    const [entry] = await db
      .update(attendanceEntries)
      .set({
        status: parsed.status,
        source: parsed.source,
        notes: parsed.notes ?? null,
        recordedByUserId: userId,
        recordedAt: new Date(),
      })
      .where(eq(attendanceEntries.id, existing.id))
      .returning();
    return entry;
  }

  const [entry] = await db
    .insert(attendanceEntries)
    .values({
      organizationId: parsed.organizationId,
      sessionId: parsed.sessionId,
      contactId: parsed.contactId,
      status: parsed.status,
      source: parsed.source,
      notes: parsed.notes ?? null,
      recordedByUserId: userId,
    })
    .returning();

  return entry;
}
