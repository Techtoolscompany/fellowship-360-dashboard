"use server";

import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireOrgMembership, auditAction } from "./utils";
import * as z from "zod";

export async function getTasks(
  orgId: string,
  filters?: { status?: string; priority?: string }
) {
  await requireOrgMembership(orgId);
  if (filters?.status) {
    return await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, orgId),
          eq(tasks.status, filters.status as any)
        )
      )
      .orderBy(desc(tasks.createdAt));
  }
  return await db
    .select()
    .from(tasks)
    .where(eq(tasks.organizationId, orgId))
    .orderBy(desc(tasks.createdAt));
}

export async function createTask(data: {
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: Date;
  priority?: string;
  organizationId: string;
}) {
  const parsed = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    assigneeId: z.string().optional(),
    dueDate: z.coerce.date().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    organizationId: z.string().min(1)
  }).parse(data);

  const { userId } = await requireOrgMembership(parsed.organizationId);
  const [task] = await db
    .insert(tasks)
    .values({
      title: parsed.title,
      description: parsed.description ?? null,
      assigneeId: parsed.assigneeId ?? null,
      dueDate: parsed.dueDate ?? null,
      priority: (parsed.priority as any) ?? "medium",
      organizationId: parsed.organizationId,
    })
    .returning();

  await auditAction({
    organizationId: parsed.organizationId,
    userId,
    actionType: "create",
    entityName: "task",
    entityId: task.id,
    details: { priority: parsed.priority, assigneeId: parsed.assigneeId }
  });

  return task;
}

export async function updateTask(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    assigneeId: string | null;
    dueDate: Date | null;
    status: string;
    priority: string;
    organizationId: string;
  }>
) {
  if (!data.organizationId) throw new Error("organizationId is required");
  const parsed = z.object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    assigneeId: z.string().nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    organizationId: z.string().min(1)
  }).parse(data);

  const { userId } = await requireOrgMembership(parsed.organizationId);
  const [existing] = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, parsed.organizationId)))
    .limit(1);
  if (!existing) throw new Error("Task not found");

  const { organizationId, ...updateData } = parsed;
  const [task] = await db
    .update(tasks)
    .set({ ...updateData, updatedAt: new Date() } as any)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, organizationId)))
    .returning();

  await auditAction({
    organizationId,
    userId,
    actionType: "update",
    entityName: "task",
    entityId: task.id,
    details: { status: parsed.status, priority: parsed.priority }
  });

  return task;
}

export async function deleteTask(id: string, organizationId: string) {
  const { userId } = await requireOrgMembership(organizationId);
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.organizationId, organizationId)));

  await auditAction({
    organizationId,
    userId,
    actionType: "delete",
    entityName: "task",
    entityId: id
  });
}
