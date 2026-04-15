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
import { derivePrayerLifecycleEffects } from "@/lib/operations/prayer-lifecycle";
import {
  buildPrayerCareCorrelationKey,
  ensurePrayerCareWorkflowGoal,
  markPrayerCareWorkflowKickoffConfirmed,
  updatePrayerCareWorkflowGoal,
  PRAYER_CARE_WORKFLOW_KEY,
} from "@/lib/grace/workflows/prayer-care";
import * as z from "zod";

const ACTIVE_TASK_STATUSES: Array<"todo" | "in_progress"> = ["todo", "in_progress"];
const organizationIdSchema = z.string().trim().min(1);
const prayerRequestIdSchema = z.string().trim().min(1);

const createPrayerRequestSchema = z.object({
  contactId: z.string().trim().min(1).optional(),
  contactName: z.string().trim().optional(),
  content: z.string().trim().min(1),
  urgency: z.string().trim().optional(),
  assignedTeam: z.string().trim().optional(),
  isAnonymous: z.boolean().optional(),
  organizationId: organizationIdSchema,
});

const updatePrayerRequestSchema = z.object({
  contactId: z.string().trim().nullable().optional(),
  contactName: z.string().trim().nullable().optional(),
  content: z.string().trim().min(1).optional(),
  isAnonymous: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
  status: z.string().trim().min(1).optional(),
  urgency: z.string().trim().min(1).optional(),
  assignedTeam: z.string().trim().nullable().optional(),
  response: z.string().trim().nullable().optional(),
});

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

function buildPrayerCareWorkflowSummary(params: {
  content: string;
  status: PrayerStatus;
  urgency: PrayerUrgency;
  assignedTeam: string;
}) {
  const urgencyLabel =
    params.urgency === "critical"
      ? "critical"
      : params.urgency === "urgent"
        ? "urgent"
        : "normal";
  return `Prayer care workflow ${params.status} for ${params.assignedTeam} (${urgencyLabel}): ${params.content}`;
}

export async function getPrayerRequests(
  orgId: string,
  filters?: { status?: string; urgency?: string }
) {
  const parsedOrgId = organizationIdSchema.parse(orgId);
  await requireOrgMembership(parsedOrgId);
  const clauses: any[] = [eq(prayerRequests.organizationId, parsedOrgId)];

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
  const parsed = createPrayerRequestSchema.parse(data);
  const { userId } = await requireOrgMembership(parsed.organizationId);
  const routing = resolvePrayerRouting({
    content: parsed.content,
    urgency: parsed.urgency,
    assignedTeam: parsed.assignedTeam,
  });

  const requesterName = parsed.isAnonymous
    ? "Anonymous"
    : parsed.contactName?.trim() || "Community Member";

  const [request] = await db
    .insert(prayerRequests)
    .values({
      contactId: parsed.contactId ?? null,
      contactName: requesterName,
      content: parsed.content,
      urgency: routing.urgency,
      isAnonymous: parsed.isAnonymous ? "true" : "false",
      assignedTeam: routing.assignedTeam,
      organizationId: parsed.organizationId,
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

  const prayerWorkflow = await ensurePrayerCareWorkflowGoal({
    organizationId: request.organizationId,
    requestId: request.id,
    sourceChannel: "in_app",
    triggerSource: "prayer_request.create",
    status: "new",
    urgency: routing.urgency,
    assignedTeam: routing.assignedTeam,
    content: request.content,
    contactId: request.contactId ?? null,
    objectiveText: buildPrayerCareWorkflowSummary({
      content: request.content,
      status: "new",
      urgency: routing.urgency,
      assignedTeam: routing.assignedTeam,
    }),
    requestedByUserId: userId,
    lastDecisionSummary: "Prayer request created and queued for Grace follow-up.",
    nextCheckpointAt: request.createdAt ?? new Date(),
  });

  await markPrayerCareWorkflowKickoffConfirmed({
    goalId: prayerWorkflow.goal.id,
    organizationId: request.organizationId,
    summary: "Staff created the prayer request and confirmed Grace should follow up.",
    source: PRAYER_CARE_WORKFLOW_KEY,
  });

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
  const prayerRequestId = prayerRequestIdSchema.parse(id);
  const parsed = updatePrayerRequestSchema.parse(data);
  const [existing] = await db
    .select({
      id: prayerRequests.id,
      organizationId: prayerRequests.organizationId,
      contactId: prayerRequests.contactId,
      content: prayerRequests.content,
      contactName: prayerRequests.contactName,
      status: prayerRequests.status,
      urgency: prayerRequests.urgency,
      assignedTeam: prayerRequests.assignedTeam,
      isAnonymous: prayerRequests.isAnonymous,
    })
    .from(prayerRequests)
    .where(eq(prayerRequests.id, prayerRequestId))
    .limit(1);
  if (!existing) throw new Error("Prayer request not found");
  const { userId } = await requireOrgMembership(existing.organizationId);

  const normalized = { ...parsed } as Record<string, unknown>;
  if (typeof normalized.isAnonymous === "boolean") {
    normalized.isAnonymous = normalized.isAnonymous ? "true" : "false";
  }

  const resolvedStatus = parsed.status
    ? normalizePrayerStatus(parsed.status)
    : (existing.status as PrayerStatus);
  const routing = resolvePrayerRouting({
    content: parsed.content ?? existing.content,
    urgency: parsed.urgency ?? existing.urgency,
    assignedTeam:
      parsed.assignedTeam !== undefined ? parsed.assignedTeam : existing.assignedTeam,
  });

  normalized.urgency = routing.urgency;
  normalized.status = resolvedStatus;
  normalized.assignedTeam = routing.assignedTeam;

  const [request] = await db
    .update(prayerRequests)
    .set({ ...normalized, updatedAt: new Date() })
    .where(
      and(eq(prayerRequests.id, prayerRequestId), eq(prayerRequests.organizationId, existing.organizationId))
    )
    .returning();

  const effects = derivePrayerLifecycleEffects({
    status: resolvedStatus,
    escalationPriority: routing.escalationPriority,
  });

  if (effects.ensureEscalationTask) {
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

  if (isPrayerRequestActive(resolvedStatus)) {
    const prayerWorkflow = await ensurePrayerCareWorkflowGoal({
      organizationId: request.organizationId,
      requestId: request.id,
      sourceChannel: "in_app",
      triggerSource: "prayer_request.update",
      status: resolvedStatus,
      urgency: routing.urgency,
      assignedTeam: routing.assignedTeam,
      content: request.content,
      contactId: request.contactId ?? existing.contactId ?? null,
      objectiveText: buildPrayerCareWorkflowSummary({
        content: request.content,
        status: resolvedStatus,
        urgency: routing.urgency,
        assignedTeam: routing.assignedTeam,
      }),
      requestedByUserId: userId,
      lastDecisionSummary: `Prayer request updated to ${resolvedStatus} and remains active.`,
      nextCheckpointAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    await updatePrayerCareWorkflowGoal({
      goalId: prayerWorkflow.goal.id,
      organizationId: request.organizationId,
      status: "waiting",
      requestId: request.id,
      summary: `Prayer request ${resolvedStatus} remains active and is awaiting Grace follow-up.`,
      nextCheckpointAt: new Date(Date.now() + 15 * 60 * 1000),
      resultJson: {
        prayerRequestStatus: resolvedStatus,
        urgency: routing.urgency,
        assignedTeam: routing.assignedTeam,
        correlationKey: buildPrayerCareCorrelationKey(request.id),
      },
    });
  } else {
    const existingWorkflow = await ensurePrayerCareWorkflowGoal({
      organizationId: request.organizationId,
      requestId: request.id,
      sourceChannel: "in_app",
      triggerSource: "prayer_request.update",
      status: resolvedStatus,
      urgency: routing.urgency,
      assignedTeam: routing.assignedTeam,
      content: request.content,
      contactId: request.contactId ?? existing.contactId ?? null,
      objectiveText: buildPrayerCareWorkflowSummary({
        content: request.content,
        status: resolvedStatus,
        urgency: routing.urgency,
        assignedTeam: routing.assignedTeam,
      }),
      requestedByUserId: userId,
      lastDecisionSummary: `Prayer request updated to ${resolvedStatus}.`,
      nextCheckpointAt: null,
    });

    await updatePrayerCareWorkflowGoal({
      goalId: existingWorkflow.goal.id,
      organizationId: request.organizationId,
      status: "completed",
      requestId: request.id,
      summary: `Prayer request resolved with status ${resolvedStatus}.`,
      nextCheckpointAt: null,
      resultJson: {
        prayerRequestStatus: resolvedStatus,
        urgency: routing.urgency,
        assignedTeam: routing.assignedTeam,
        correlationKey: buildPrayerCareCorrelationKey(request.id),
      },
    });
  }

  if (effects.closeEscalationTasks) {
    await closePrayerEscalationTasks({
      organizationId: request.organizationId,
      requestId: request.id,
    });
  }

  if (effects.enqueueFollowupSequence) {
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
  const prayerRequestId = prayerRequestIdSchema.parse(id);
  const [existing] = await db
    .select({ organizationId: prayerRequests.organizationId })
    .from(prayerRequests)
    .where(eq(prayerRequests.id, prayerRequestId))
    .limit(1);
  if (!existing) return;
  await requireOrgMembership(existing.organizationId);
  await db
    .delete(prayerRequests)
    .where(
      and(eq(prayerRequests.id, prayerRequestId), eq(prayerRequests.organizationId, existing.organizationId))
    );
}
