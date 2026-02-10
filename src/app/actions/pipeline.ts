"use server";

import { db } from "@/db";
import { pipelineStages, pipelineItems, churchContacts } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

export async function getPipelineData(orgId: string) {
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
  const [item] = await db
    .update(pipelineItems)
    .set({ stageId, order, updatedAt: new Date() })
    .where(eq(pipelineItems.id, itemId))
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
  await db.delete(pipelineItems).where(eq(pipelineItems.id, id));
}
