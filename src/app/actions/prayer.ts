"use server";

import { db } from "@/db";
import { prayerRequests, tasks } from "@/db/schema";
import { eq, desc, and, ilike, inArray } from "drizzle-orm";
import { requireOrgMembership } from "./utils";
import {
  buildPrayerEscalationTaskMarker,
  buildPrayerEscalationTaskTitle,
  isPrayerRequestActive,
  normalizePrayerStatus,
  resolvePrayerRouting,
  type PrayerStatus,
  type PrayerUrgency,
} from "@/lib/prayer/routing";

const ACTIVE_TASK_STATUSES: Array<"todo" | "in_progress"> = ["todo", "in_progress"];

async function ensurePrayerEscalationTask(params: {
  organizationId: string;
  requestId: string;
  requesterName: string;
  urgency: PrayerUrgency;
  content: string;
  assignedTeam: string;
}) {
  const marker = buildPrayerEscalationTaskMarker(params.requestId);

  const [existingOpenTask] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.organizationId, params.organizationId),
        inArray(tasks.status, ACTIVE_TASK_STATUSES),
        ilike(tasks.description, `%${marker}%`)
      )
    )
    .limit(1);

  if (existingOpenTask) {
    return existingOpenTask.id;
  }

  const dueDate =
    params.urgency === "critical"
      ? new Date(Date.now() + 60 * 60 * 1000)
      : new Date(Date.now() + 6 * 60 * 60 * 1000);

  const [createdTask] = await db
    .insert(tasks)
    .values({
      organizationId: params.organizationId,
      title: buildPrayerEscalationTaskTitle({
        requesterName: params.requesterName,
        urgency: params.urgency,
      }),
      description: [
        marker,
        `Assigned Team: ${params.assignedTeam}`,
        `Request: ${params.content}`,
      ].join("\n"),
      priority: params.urgency === "critical" ? "urgent" : "high",
      status: "todo",
      dueDate,
    })
    .returning({ id: tasks.id });

  return createdTask?.id ?? null;
}

async function closePrayerEscalationTasks(params: {
  organizationId: string;
  requestId: string;
}) {
  const marker = buildPrayerEscalationTaskMarker(params.requestId);
  await db
    .update(tasks)
    .set({
      status: "done",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tasks.organizationId, params.organizationId),
        inArray(tasks.status, ACTIVE_TASK_STATUSES),
        ilike(tasks.description, `%${marker}%`)
      )
    );
}

async function enqueuePrayerFollowupSequence(params: {
  organizationId: string;
  requestId: string;
  trigger: "created" | "updated";
  status: PrayerStatus;
  urgency: PrayerUrgency;
  occurredAt: Date;
}) {
  try {
    const { inngest } = await import("@/lib/inngest/client");
    const {
      INNGEST_EVENTS,
      buildPrayerRequestFollowupIdempotencyKey,
    } = await import("@/lib/inngest/events");

    const occurredAt = params.occurredAt.toISOString();
    const idempotencyKey = buildPrayerRequestFollowupIdempotencyKey({
      organizationId: params.organizationId,
      requestId: params.requestId,
      trigger: params.trigger,
      status: params.status,
      urgency: params.urgency,
      occurredAt,
    });

    await inngest.send({
      id: idempotencyKey,
      name: INNGEST_EVENTS.GRACE_PRAYER_REQUEST_FOLLOWUP_REQUESTED,
      data: {
        organizationId: params.organizationId,
        requestId: params.requestId,
        trigger: params.trigger,
        status: params.status,
        urgency: params.urgency,
        occurredAt,
        idempotencyKey,
      },
    });
  } catch (error) {
    console.error("[Prayer] Failed to enqueue prayer follow-up sequence", {
      requestId: params.requestId,
      organizationId: params.organizationId,
      trigger: params.trigger,
      error,
    });
  }
}

export async function getPrayerRequests(
  orgId: string,
  filters?: { status?: string; urgency?: string }
) {
  await requireOrgMembership(orgId);
  const clauses: any[] = [eq(prayerRequests.organizationId, orgId)];

  if (filters?.status) {
    clauses.push(eq(prayerRequests.status, normalizePrayerStatus(filters.status)));
  }

  if (filters?.urgency) {
    const routed = resolvePrayerRouting({
      content: "",
      urgency: filters.urgency,
    });
    clauses.push(eq(prayerRequests.urgency, routed.urgency));
  }

  return await db
    .select()
    .from(prayerRequests)
    .where(and(...clauses))
    .orderBy(desc(prayerRequests.createdAt));
}

export async function createPrayerRequest(data: {
  contactId?: string;
  contactName?: string;
  content: string;
  urgency?: string;
  assignedTeam?: string;
  isAnonymous?: boolean;
  organizationId: string;
}) {
  await requireOrgMembership(data.organizationId);
  const routing = resolvePrayerRouting({
    content: data.content,
    urgency: data.urgency,
    assignedTeam: data.assignedTeam,
  });

  const requesterName = data.isAnonymous
    ? "Anonymous"
    : data.contactName?.trim() || "Community Member";

  const [request] = await db
    .insert(prayerRequests)
    .values({
      contactId: data.contactId ?? null,
      contactName: requesterName,
      content: data.content,
      urgency: routing.urgency,
      isAnonymous: data.isAnonymous ? "true" : "false",
      assignedTeam: routing.assignedTeam,
      organizationId: data.organizationId,
    })
    .returning();

  if (routing.escalationPriority !== "none") {
    await ensurePrayerEscalationTask({
      organizationId: request.organizationId,
      requestId: request.id,
      requesterName,
      urgency: routing.urgency,
      content: request.content,
      assignedTeam: routing.assignedTeam,
    });
  }

  await enqueuePrayerFollowupSequence({
    organizationId: request.organizationId,
    requestId: request.id,
    trigger: "created",
    status: "new",
    urgency: routing.urgency,
    occurredAt: request.createdAt ?? new Date(),
  });

  return request;
}

export async function updatePrayerRequest(
  id: string,
  data: Partial<{
    contactId: string | null;
    contactName: string | null;
    content: string;
    isAnonymous: boolean | string;
    status: string;
    urgency: string;
    assignedTeam: string | null;
    response: string | null;
  }>
) {
  const [existing] = await db
    .select({
      id: prayerRequests.id,
      organizationId: prayerRequests.organizationId,
      content: prayerRequests.content,
      contactName: prayerRequests.contactName,
      status: prayerRequests.status,
      urgency: prayerRequests.urgency,
      assignedTeam: prayerRequests.assignedTeam,
      isAnonymous: prayerRequests.isAnonymous,
    })
    .from(prayerRequests)
    .where(eq(prayerRequests.id, id))
    .limit(1);
  if (!existing) throw new Error("Prayer request not found");
  await requireOrgMembership(existing.organizationId);

  const normalized = { ...data } as Record<string, unknown>;
  if (typeof normalized.isAnonymous === "boolean") {
    normalized.isAnonymous = normalized.isAnonymous ? "true" : "false";
  }

  const resolvedStatus = data.status ? normalizePrayerStatus(data.status) : (existing.status as PrayerStatus);
  const routing = resolvePrayerRouting({
    content: data.content ?? existing.content,
    urgency: data.urgency ?? existing.urgency,
    assignedTeam:
      data.assignedTeam !== undefined ? data.assignedTeam : existing.assignedTeam,
  });

  normalized.urgency = routing.urgency;
  normalized.status = resolvedStatus;
  normalized.assignedTeam = routing.assignedTeam;

  const [request] = await db
    .update(prayerRequests)
    .set({ ...normalized, updatedAt: new Date() } as any)
    .where(and(eq(prayerRequests.id, id), eq(prayerRequests.organizationId, existing.organizationId)))
    .returning();

  if (isPrayerRequestActive(resolvedStatus) && routing.escalationPriority !== "none") {
    await ensurePrayerEscalationTask({
      organizationId: request.organizationId,
      requestId: request.id,
      requesterName:
        request.isAnonymous === "true" ? "Anonymous" : (request.contactName ?? "Community Member"),
      urgency: routing.urgency,
      content: request.content,
      assignedTeam: routing.assignedTeam,
    });
  }

  if (!isPrayerRequestActive(resolvedStatus)) {
    await closePrayerEscalationTasks({
      organizationId: request.organizationId,
      requestId: request.id,
    });
  }

  if (isPrayerRequestActive(resolvedStatus)) {
    await enqueuePrayerFollowupSequence({
      organizationId: request.organizationId,
      requestId: request.id,
      trigger: "updated",
      status: resolvedStatus,
      urgency: routing.urgency,
      occurredAt: request.updatedAt ?? new Date(),
    });
  }

  return request;
}

export async function deletePrayerRequest(id: string) {
  const [existing] = await db
    .select({ organizationId: prayerRequests.organizationId })
    .from(prayerRequests)
    .where(eq(prayerRequests.id, id))
    .limit(1);
  if (!existing) return;
  await requireOrgMembership(existing.organizationId);
  await db
    .delete(prayerRequests)
    .where(and(eq(prayerRequests.id, id), eq(prayerRequests.organizationId, existing.organizationId)));
}
