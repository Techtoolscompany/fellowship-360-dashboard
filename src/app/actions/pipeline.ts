"use server";

import { db } from "@/db";
import {
  pipelineStages,
  pipelineItems,
  churchContacts,
  actionAuditLogs,
  organizationMemberships,
} from "@/db/schema";
import { eq, asc, and, desc, inArray } from "drizzle-orm";
import { isFirstTimeGuestStageName } from "@/lib/pipeline/first-time-guest";
import { auditAction, requireOrgMembership } from "./utils";
import { compatibleChurchContactSelect } from "@/lib/contacts/projection";
import { createOrReuseGuestFollowupGoal } from "@/lib/grace/workflows/guest-followup";
import * as z from "zod";

const organizationIdSchema = z.string().trim().min(1);
const pipelineItemIdSchema = z.string().trim().min(1);
const pipelineStageIdSchema = z.string().trim().min(1);
const pipelinePrioritySchema = z.enum(["low", "medium", "high"]);
const optionalDateInputSchema = z.union([z.coerce.date(), z.null()]).optional();

const createPipelineItemSchema = z.object({
  contactId: z.string().trim().min(1),
  stageId: pipelineStageIdSchema,
  priority: pipelinePrioritySchema.optional(),
  assigneeId: z.string().trim().min(1).optional(),
  notes: z.string().trim().optional(),
  organizationId: organizationIdSchema,
});

const updatePipelineItemSchema = z.object({
  stageId: pipelineStageIdSchema.optional(),
  order: z.number().int().nonnegative().optional(),
  priority: pipelinePrioritySchema.optional(),
  assigneeId: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  lastContactDate: optionalDateInputSchema,
  nextActionDate: optionalDateInputSchema,
});

const movementAuditSchema = z.object({
  organizationId: organizationIdSchema,
  itemId: z.string().trim().min(1).optional(),
  limit: z.number().int().optional(),
});

function normalizeOptionalDate(value: Date | string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value");
  }
  return date;
}

async function assertAssigneeInOrganization(organizationId: string, assigneeId: string | null | undefined) {
  if (!assigneeId) return;
  const [membership] = await db
    .select({ userId: organizationMemberships.userId })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.userId, assigneeId)
      )
    )
    .limit(1);

  if (!membership) {
    throw new Error("Assignee must be a member of this organization");
  }
}

export async function enqueueFirstTimeGuestAppointment(params: {
  organizationId: string;
  pipelineItemId: string;
  contactId: string;
  stageId: string;
  stageName: string;
  trigger: "created" | "stage_changed";
  occurredAt: Date;
  requestedByUserId?: string | null;
}) {
  if (!isFirstTimeGuestStageName(params.stageName)) {
    return;
  }

  try {
    const { inngest } = await import("@/lib/inngest/client");
    const {
      INNGEST_EVENTS,
      buildFirstTimeGuestAppointmentIdempotencyKey,
    } = await import("@/lib/inngest/events");

    const occurredAtIso = params.occurredAt.toISOString();
    const idempotencyKey = buildFirstTimeGuestAppointmentIdempotencyKey({
      organizationId: params.organizationId,
      pipelineItemId: params.pipelineItemId,
      contactId: params.contactId,
      stageId: params.stageId,
      trigger: params.trigger,
      occurredAt: occurredAtIso,
    });

    const objectiveText = `Follow up with first-time guest from ${params.stageName} for pipeline item ${params.pipelineItemId}.`;
    const workflow = await createOrReuseGuestFollowupGoal({
      organizationId: params.organizationId,
      sourceChannel: "in_app",
      requestedByUserId: params.requestedByUserId ?? null,
      objectiveText,
      context: {
        pipelineItemId: params.pipelineItemId,
        contactId: params.contactId,
        stageId: params.stageId,
        stageName: params.stageName,
        contactName: "",
        firstName: "",
        recipientPhone: null,
        recipientEmail: null,
        channel: "sms",
        churchName: "",
        sessionId: "",
        conversationId: "",
        sequenceStartedAtIso: occurredAtIso,
        trigger: params.trigger,
      },
    });

    if (workflow.created) {
      await inngest.send({
        id: idempotencyKey,
        name: INNGEST_EVENTS.GRACE_FIRST_TIME_GUEST_APPOINTMENT_REQUESTED,
        data: {
          organizationId: params.organizationId,
          pipelineItemId: params.pipelineItemId,
          contactId: params.contactId,
          stageId: params.stageId,
          stageName: params.stageName,
          trigger: params.trigger,
          occurredAt: occurredAtIso,
          idempotencyKey,
        },
      });
    }
  } catch (error) {
    console.error("[Pipeline] Failed to enqueue first-time guest appointment sequence", {
      pipelineItemId: params.pipelineItemId,
      organizationId: params.organizationId,
      stageId: params.stageId,
      trigger: params.trigger,
      error,
    });
  }
}

export async function getPipelineData(orgId: string) {
  const parsedOrgId = organizationIdSchema.parse(orgId);
  await requireOrgMembership(parsedOrgId);
  const stages = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.organizationId, parsedOrgId))
    .orderBy(asc(pipelineStages.order));

  const items = await db
    .select({
      item: pipelineItems,
      contact: compatibleChurchContactSelect,
    })
    .from(pipelineItems)
    .leftJoin(churchContacts, eq(pipelineItems.contactId, churchContacts.id))
    .where(eq(pipelineItems.organizationId, parsedOrgId))
    .orderBy(asc(pipelineItems.order));

  return { stages, items };
}

export async function updateItemStage(
  itemId: string,
  stageId: string,
  order: number
) {
  const parsedItemId = pipelineItemIdSchema.parse(itemId);
  const parsedStageId = pipelineStageIdSchema.parse(stageId);
  const parsedOrder = z.number().int().nonnegative().parse(order);
  const [existingItem] = await db
    .select({
      id: pipelineItems.id,
      organizationId: pipelineItems.organizationId,
      stageId: pipelineItems.stageId,
      contactId: pipelineItems.contactId,
      order: pipelineItems.order,
    })
    .from(pipelineItems)
    .where(eq(pipelineItems.id, parsedItemId))
    .limit(1);
  if (!existingItem) throw new Error("Pipeline item not found");
  const { userId } = await requireOrgMembership(existingItem.organizationId);

  const [stage] = await db
    .select({ id: pipelineStages.id, name: pipelineStages.name })
    .from(pipelineStages)
    .where(
      and(eq(pipelineStages.id, parsedStageId), eq(pipelineStages.organizationId, existingItem.organizationId))
    )
    .limit(1);
  if (!stage) throw new Error("Stage not found in this organization");

  const [item] = await db
    .update(pipelineItems)
    .set({ stageId: parsedStageId, order: parsedOrder, updatedAt: new Date() })
    .where(
      and(eq(pipelineItems.id, parsedItemId), eq(pipelineItems.organizationId, existingItem.organizationId))
    )
    .returning();

  if (existingItem.stageId !== parsedStageId) {
    await enqueueFirstTimeGuestAppointment({
      organizationId: item.organizationId,
      pipelineItemId: item.id,
      contactId: item.contactId,
      stageId: stage.id,
      stageName: stage.name,
      trigger: "stage_changed",
      occurredAt: item.updatedAt ?? new Date(),
      requestedByUserId: userId,
    });
  }

  await auditAction({
    organizationId: item.organizationId,
    userId,
    actionType: existingItem.stageId === stageId ? "reorder" : "move_stage",
    entityName: "pipeline_item",
    entityId: item.id,
    details: {
      fromStageId: existingItem.stageId,
      toStageId: parsedStageId,
      fromOrder: existingItem.order,
      toOrder: parsedOrder,
    },
  });

  return item;
}

export async function createPipelineItem(data: {
  contactId: string;
  stageId: string;
  priority?: string;
  assigneeId?: string;
  notes?: string;
  organizationId: string;
}) {
  const parsed = createPipelineItemSchema.parse(data);
  const { userId } = await requireOrgMembership(parsed.organizationId);

  const [stage, contact] = await Promise.all([
    db
      .select({ id: pipelineStages.id, name: pipelineStages.name })
      .from(pipelineStages)
      .where(
        and(eq(pipelineStages.id, parsed.stageId), eq(pipelineStages.organizationId, parsed.organizationId))
      )
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ id: churchContacts.id })
      .from(churchContacts)
      .where(
        and(eq(churchContacts.id, parsed.contactId), eq(churchContacts.organizationId, parsed.organizationId))
      )
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  if (!stage) throw new Error("Invalid pipeline stage");
  if (!contact) throw new Error("Invalid contact");

  const [item] = await db
    .insert(pipelineItems)
    .values({
      contactId: parsed.contactId,
      stageId: parsed.stageId,
      priority: parsed.priority ?? "medium",
      assigneeId: parsed.assigneeId ?? null,
      notes: parsed.notes ?? null,
      organizationId: parsed.organizationId,
    })
    .returning();

  await enqueueFirstTimeGuestAppointment({
    organizationId: item.organizationId,
    pipelineItemId: item.id,
    contactId: item.contactId,
    stageId: stage.id,
    stageName: stage.name,
    trigger: "created",
    occurredAt: item.createdAt ?? new Date(),
  });

  await auditAction({
    organizationId: item.organizationId,
    userId,
    actionType: "create",
    entityName: "pipeline_item",
    entityId: item.id,
    details: {
      stageId: item.stageId,
      contactId: item.contactId,
      priority: item.priority ?? "medium",
      assigneeId: item.assigneeId,
    },
  });

  return item;
}

export async function updatePipelineItem(
  itemId: string,
  data: Partial<{
    stageId: string;
    order: number;
    priority: "low" | "medium" | "high";
    assigneeId: string | null;
    notes: string | null;
    lastContactDate: Date | string | null;
    nextActionDate: Date | string | null;
  }>
) {
  const parsedItemId = pipelineItemIdSchema.parse(itemId);
  const parsed = updatePipelineItemSchema.parse(data);
  const [existing] = await db
    .select({
      id: pipelineItems.id,
      organizationId: pipelineItems.organizationId,
      stageId: pipelineItems.stageId,
      order: pipelineItems.order,
      priority: pipelineItems.priority,
      assigneeId: pipelineItems.assigneeId,
      notes: pipelineItems.notes,
      lastContactDate: pipelineItems.lastContactDate,
      nextActionDate: pipelineItems.nextActionDate,
    })
    .from(pipelineItems)
    .where(eq(pipelineItems.id, parsedItemId))
    .limit(1);
  if (!existing) throw new Error("Pipeline item not found");

  const { userId } = await requireOrgMembership(existing.organizationId);
  const wantsMove = parsed.stageId !== undefined || parsed.order !== undefined;
  const wantsOtherFields =
    parsed.priority !== undefined ||
    parsed.assigneeId !== undefined ||
    parsed.notes !== undefined ||
    parsed.lastContactDate !== undefined ||
    parsed.nextActionDate !== undefined;

  if (wantsMove) {
    if (parsed.stageId === undefined || parsed.order === undefined) {
      throw new Error("stageId and order must be provided together when moving an item");
    }
    if (wantsOtherFields) {
      throw new Error("Move operations must be requested separately from field updates");
    }
    return updateItemStage(parsedItemId, parsed.stageId, parsed.order);
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (parsed.priority !== undefined) {
    patch.priority = parsed.priority;
  }

  if (parsed.assigneeId !== undefined) {
    await assertAssigneeInOrganization(existing.organizationId, parsed.assigneeId);
    patch.assigneeId = parsed.assigneeId;
  }

  if (parsed.notes !== undefined) {
    patch.notes = parsed.notes;
  }

  if (parsed.lastContactDate !== undefined) {
    patch.lastContactDate = normalizeOptionalDate(parsed.lastContactDate);
  }

  if (parsed.nextActionDate !== undefined) {
    patch.nextActionDate = normalizeOptionalDate(parsed.nextActionDate);
  }

  if (Object.keys(patch).length === 1) {
    throw new Error("No pipeline item fields provided to update");
  }

  const [updated] = await db
    .update(pipelineItems)
    .set(patch)
    .where(
      and(
        eq(pipelineItems.id, parsedItemId),
        eq(pipelineItems.organizationId, existing.organizationId)
      )
    )
    .returning();

  await auditAction({
    organizationId: existing.organizationId,
    userId,
    actionType: "update",
    entityName: "pipeline_item",
    entityId: updated.id,
    details: {
      priority: updated.priority,
      assigneeId: updated.assigneeId,
      notesUpdated: parsed.notes !== undefined,
      lastContactDate: updated.lastContactDate?.toISOString() ?? null,
      nextActionDate: updated.nextActionDate?.toISOString() ?? null,
    },
  });

  return updated;
}

export async function seedDefaultStages(orgId: string) {
  const parsedOrgId = organizationIdSchema.parse(orgId);
  await requireOrgMembership(parsedOrgId);
  const defaultStages = [
    { name: "First-Time Visitors", color: "#6366f1", order: 0 },
    { name: "Attempted Contact", color: "#f59e0b", order: 1 },
    { name: "Connected", color: "#10b981", order: 2 },
    { name: "Membership Class", color: "#3b82f6", order: 3 },
    { name: "New Members", color: "#8b5cf6", order: 4 },
    { name: "Inactive / Lost", color: "#6b7280", order: 5 },
  ];

  const stages = await db
    .insert(pipelineStages)
    .values(
      defaultStages.map((s) => ({
        ...s,
        organizationId: parsedOrgId,
      }))
    )
    .returning();
  return stages;
}

export async function deletePipelineItem(id: string) {
  const parsedItemId = pipelineItemIdSchema.parse(id);
  const [existingItem] = await db
    .select({
      id: pipelineItems.id,
      organizationId: pipelineItems.organizationId,
      stageId: pipelineItems.stageId,
      contactId: pipelineItems.contactId,
      priority: pipelineItems.priority,
      assigneeId: pipelineItems.assigneeId,
    })
    .from(pipelineItems)
    .where(eq(pipelineItems.id, parsedItemId))
    .limit(1);
  if (!existingItem) return;
  const { userId } = await requireOrgMembership(existingItem.organizationId);
  await db
    .delete(pipelineItems)
    .where(
      and(eq(pipelineItems.id, parsedItemId), eq(pipelineItems.organizationId, existingItem.organizationId))
    );

  await auditAction({
    organizationId: existingItem.organizationId,
    userId,
    actionType: "delete",
    entityName: "pipeline_item",
    entityId: parsedItemId,
    details: {
      stageId: existingItem.stageId,
      contactId: existingItem.contactId,
      priority: existingItem.priority,
      assigneeId: existingItem.assigneeId,
    },
  });
}

export async function getPipelineMovementAudit(input: {
  organizationId: string;
  itemId?: string;
  limit?: number;
}) {
  const parsed = movementAuditSchema.parse(input);
  await requireOrgMembership(parsed.organizationId);
  const limit = Math.min(Math.max(parsed.limit ?? 50, 1), 200);
  const clauses = [
    eq(actionAuditLogs.organizationId, parsed.organizationId),
    eq(actionAuditLogs.entityName, "pipeline_item"),
    inArray(actionAuditLogs.actionType, [
      "create",
      "update",
      "move_stage",
      "reorder",
      "delete",
    ]),
  ];
  if (parsed.itemId) {
    clauses.push(eq(actionAuditLogs.entityId, parsed.itemId));
  }

  return db
    .select()
    .from(actionAuditLogs)
    .where(and(...clauses))
    .orderBy(desc(actionAuditLogs.createdAt))
    .limit(limit);
}
