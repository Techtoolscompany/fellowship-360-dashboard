"use server";

import { db } from "@/db";
import { tasks, users, organizationMemberships } from "@/db/schema";
import { eq, desc, and, isNull, asc } from "drizzle-orm";
import { requireOrgMembership, auditAction } from "./utils";
import * as z from "zod";
import {
  TASK_LIFECYCLE_STATUSES,
  assertTaskStatusTransition,
  computeTaskSlaStatus,
  normalizeOptionalTaskDueDate,
  type TaskLifecycleStatus,
} from "@/lib/operations/tasks-lifecycle";

const TASK_PRIORITY_VALUES = ["low", "medium", "high", "urgent"] as const;

const taskStatusSchema = z.enum(TASK_LIFECYCLE_STATUSES);
const taskPrioritySchema = z.enum(TASK_PRIORITY_VALUES);

type TaskStatus = TaskLifecycleStatus;
type TaskPriority = z.infer<typeof taskPrioritySchema>;

async function assertAssigneeInOrganization(organizationId: string, assigneeId: string | null | undefined) {
  if (!assigneeId) return;

  const [member] = await db
    .select({ userId: organizationMemberships.userId })
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.userId, assigneeId)
      )
    )
    .limit(1);

  if (!member) {
    throw new Error("Assignee is not a member of this organization");
  }
}

async function getTaskWithAssignee(taskId: string, organizationId: string) {
  const [row] = await db
    .select({
      task: tasks,
      assigneeName: users.name,
      assigneeEmail: users.email,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(and(eq(tasks.id, taskId), eq(tasks.organizationId, organizationId)))
    .limit(1);

  if (!row) {
    throw new Error("Task not found");
  }

  return {
    ...row.task,
    assigneeName: row.assigneeName ?? row.assigneeEmail ?? null,
    assigneeEmail: row.assigneeEmail ?? null,
    slaStatus: computeTaskSlaStatus({
      status: row.task.status as TaskStatus,
      dueDate: row.task.dueDate,
    }),
  };
}

export async function getTasks(
  orgId: string,
  filters?: {
    status?: string;
    priority?: string;
    assigneeId?: string;
    sla?: string;
  }
) {
  await requireOrgMembership(orgId);
  const clauses: any[] = [eq(tasks.organizationId, orgId)];

  if (
    filters?.status &&
    TASK_LIFECYCLE_STATUSES.includes(filters.status as TaskStatus)
  ) {
    clauses.push(eq(tasks.status, filters.status as TaskStatus));
  }
  if (filters?.priority && TASK_PRIORITY_VALUES.includes(filters.priority as TaskPriority)) {
    clauses.push(eq(tasks.priority, filters.priority as TaskPriority));
  }
  if (filters?.assigneeId) {
    if (filters.assigneeId === "unassigned") {
      clauses.push(isNull(tasks.assigneeId));
    } else {
      clauses.push(eq(tasks.assigneeId, filters.assigneeId));
    }
  }

  const rows = await db
    .select({
      task: tasks,
      assigneeName: users.name,
      assigneeEmail: users.email,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(and(...clauses))
    .orderBy(desc(tasks.createdAt));

  const mapped = rows.map((row) => ({
    ...row.task,
    assigneeName: row.assigneeName ?? row.assigneeEmail ?? null,
    assigneeEmail: row.assigneeEmail ?? null,
    slaStatus: computeTaskSlaStatus({
      status: row.task.status as TaskStatus,
      dueDate: row.task.dueDate,
    }),
  }));

  if (filters?.sla) {
    return mapped.filter((task) => task.slaStatus === filters.sla);
  }

  return mapped;
}

export async function getTaskAssignees(orgId: string) {
  await requireOrgMembership(orgId);
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: organizationMemberships.role,
    })
    .from(organizationMemberships)
    .innerJoin(users, eq(organizationMemberships.userId, users.id))
    .where(eq(organizationMemberships.organizationId, orgId))
    .orderBy(asc(users.name), asc(users.email));
}

export async function getTaskSlaStats(orgId: string) {
  const rows = await getTasks(orgId);
  const summary = {
    total: rows.length,
    active: 0,
    closed: 0,
    overdue: 0,
    dueSoon: 0,
    dueNext72h: 0,
    noDueDate: 0,
    unassigned: 0,
  };

  for (const row of rows) {
    if (row.status === "done" || row.status === "cancelled") {
      summary.closed += 1;
    } else {
      summary.active += 1;
    }
    if (!row.assigneeId) {
      summary.unassigned += 1;
    }
    if (row.slaStatus === "overdue") {
      summary.overdue += 1;
    } else if (row.slaStatus === "due_soon") {
      summary.dueSoon += 1;
    } else if (row.slaStatus === "due_next_72h") {
      summary.dueNext72h += 1;
    } else if (row.slaStatus === "no_due_date") {
      summary.noDueDate += 1;
    }
  }

  return summary;
}

export async function createTask(data: {
  title: string;
  description?: string;
  assigneeId?: string;
  dueDate?: Date | string | null;
  priority?: string;
  organizationId: string;
}) {
  const parsed = z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      assigneeId: z.string().optional(),
      dueDate: z.unknown().optional(),
      priority: taskPrioritySchema.optional(),
      organizationId: z.string().min(1),
    })
    .parse(data);

  const dueDate = normalizeOptionalTaskDueDate(parsed.dueDate);
  const { userId } = await requireOrgMembership(parsed.organizationId);
  await assertAssigneeInOrganization(parsed.organizationId, parsed.assigneeId ?? null);

  const [created] = await db
    .insert(tasks)
    .values({
      title: parsed.title,
      description: parsed.description ?? null,
      assigneeId: parsed.assigneeId ?? null,
      dueDate,
      priority: parsed.priority ?? "medium",
      status: "todo",
      organizationId: parsed.organizationId,
    })
    .returning({ id: tasks.id });

  await auditAction({
    organizationId: parsed.organizationId,
    userId,
    actionType: "create",
    entityName: "task",
    entityId: created.id,
    details: {
      priority: parsed.priority ?? "medium",
      assigneeId: parsed.assigneeId ?? null,
      dueDate: dueDate?.toISOString() ?? null,
    },
  });

  return getTaskWithAssignee(created.id, parsed.organizationId);
}

export async function updateTask(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    assigneeId: string | null;
    dueDate: Date | string | null;
    status: string;
    priority: string;
    organizationId: string;
  }>
) {
  if (!data.organizationId) throw new Error("organizationId is required");
  const parsed = z
    .object({
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      assigneeId: z.string().nullable().optional(),
      dueDate: z.unknown().optional(),
      status: taskStatusSchema.optional(),
      priority: taskPrioritySchema.optional(),
      organizationId: z.string().min(1),
    })
    .parse(data);

  const { userId } = await requireOrgMembership(parsed.organizationId);
  const [existing] = await db
    .select({
      id: tasks.id,
      status: tasks.status,
    })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, parsed.organizationId)))
    .limit(1);

  if (!existing) throw new Error("Task not found");
  if (parsed.status) {
    assertTaskStatusTransition(existing.status as TaskStatus, parsed.status);
  }
  if (parsed.assigneeId !== undefined) {
    await assertAssigneeInOrganization(parsed.organizationId, parsed.assigneeId);
  }

  const dueDate =
    parsed.dueDate !== undefined
      ? normalizeOptionalTaskDueDate(parsed.dueDate)
      : undefined;
  const { organizationId, ...rest } = parsed;
  const patch: Record<string, unknown> = { ...rest };
  if (dueDate !== undefined) {
    patch.dueDate = dueDate;
  }
  patch.updatedAt = new Date();

  const [updated] = await db
    .update(tasks)
    .set(patch as any)
    .where(and(eq(tasks.id, id), eq(tasks.organizationId, organizationId)))
    .returning({ id: tasks.id });

  await auditAction({
    organizationId,
    userId,
    actionType: "update",
    entityName: "task",
    entityId: updated.id,
    details: {
      status: parsed.status,
      priority: parsed.priority,
      assigneeId: parsed.assigneeId,
      dueDate: dueDate?.toISOString() ?? undefined,
    },
  });

  return getTaskWithAssignee(updated.id, organizationId);
}

export async function transitionTaskStatus(input: {
  taskId: string;
  organizationId: string;
  status: TaskStatus;
}) {
  return updateTask(input.taskId, {
    organizationId: input.organizationId,
    status: input.status,
  });
}

export async function deleteTask(id: string, organizationId: string) {
  const { userId } = await requireOrgMembership(organizationId);
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.organizationId, organizationId)));

  await auditAction({
    organizationId,
    userId,
    actionType: "delete",
    entityName: "task",
    entityId: id,
  });
}
