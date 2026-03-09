"use server";

import { db } from "@/db";
import { pipelineStages, pipelineItems, churchContacts } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { requireOrgMembership } from "./utils";

export async function getPipelineData(orgId: string) {
  await requireOrgMembership(orgId);
  const stages = await db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.organizationId, orgId))
    .orderBy(asc(pipelineStages.order));

  const items = await db
    .select({
      item: pipelineItems,
      contact: churchContacts,
    })
    .from(pipelineItems)
    .leftJoin(churchContacts, eq(pipelineItems.contactId, churchContacts.id))
    .where(eq(pipelineItems.organizationId, orgId))
    .orderBy(asc(pipelineItems.order));

  return { stages, items };
}

export async function updateItemStage(
  itemId: string,
  stageId: string,
  order: number
) {
  const [existingItem] = await db
    .select({ organizationId: pipelineItems.organizationId })
    .from(pipelineItems)
    .where(eq(pipelineItems.id, itemId))
    .limit(1);
  if (!existingItem) throw new Error("Pipeline item not found");
  await requireOrgMembership(existingItem.organizationId);

  const [stage] = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(and(eq(pipelineStages.id, stageId), eq(pipelineStages.organizationId, existingItem.organizationId)))
    .limit(1);
  if (!stage) throw new Error("Stage not found in this organization");

  const [item] = await db
    .update(pipelineItems)
    .set({ stageId, order, updatedAt: new Date() })
    .where(and(eq(pipelineItems.id, itemId), eq(pipelineItems.organizationId, existingItem.organizationId)))
    .returning();
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
  await requireOrgMembership(data.organizationId);

  const [stage, contact] = await Promise.all([
    db
      .select({ id: pipelineStages.id })
      .from(pipelineStages)
      .where(and(eq(pipelineStages.id, data.stageId), eq(pipelineStages.organizationId, data.organizationId)))
      .limit(1)
      .then((rows) => rows[0]),
    db
      .select({ id: churchContacts.id })
      .from(churchContacts)
      .where(and(eq(churchContacts.id, data.contactId), eq(churchContacts.organizationId, data.organizationId)))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  if (!stage) throw new Error("Invalid pipeline stage");
  if (!contact) throw new Error("Invalid contact");

  const [item] = await db
    .insert(pipelineItems)
    .values({
      contactId: data.contactId,
      stageId: data.stageId,
      priority: (data.priority as any) ?? "medium",
      assigneeId: data.assigneeId ?? null,
      notes: data.notes ?? null,
      organizationId: data.organizationId,
    })
    .returning();
  return item;
}

export async function seedDefaultStages(orgId: string) {
  await requireOrgMembership(orgId);
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
        organizationId: orgId,
      }))
    )
    .returning();
  return stages;
}

export async function deletePipelineItem(id: string) {
  const [existingItem] = await db
    .select({ organizationId: pipelineItems.organizationId })
    .from(pipelineItems)
    .where(eq(pipelineItems.id, id))
    .limit(1);
  if (!existingItem) return;
  await requireOrgMembership(existingItem.organizationId);
  await db
    .delete(pipelineItems)
    .where(and(eq(pipelineItems.id, id), eq(pipelineItems.organizationId, existingItem.organizationId)));
}
