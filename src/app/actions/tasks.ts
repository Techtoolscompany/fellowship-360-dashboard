"use server";

import { db } from "@/db";
import { tasks } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";

export async function getTasks(
  orgId: string,
  filters?: { status?: string; priority?: string }
) {
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
  const [task] = await db
    .insert(tasks)
    .values({
      title: data.title,
      description: data.description ?? null,
      assigneeId: data.assigneeId ?? null,
      dueDate: data.dueDate ?? null,
      priority: (data.priority as any) ?? "medium",
      organizationId: data.organizationId,
    })
    .returning();
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
  }>
) {
  const [task] = await db
    .update(tasks)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(eq(tasks.id, id))
    .returning();
  return task;
}

export async function deleteTask(id: string) {
  await db.delete(tasks).where(eq(tasks.id, id));
}
