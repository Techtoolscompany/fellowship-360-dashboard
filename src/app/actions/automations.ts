"use server";

import { db } from "@/db";
import {
  automationDeadLetters,
  automationWorkflows,
  automationWorkflowVersions,
  automationWorkflowRuns,
  broadcasts,
  churchContacts,
  contactTags,
} from "@/db/schema";
import { and, desc, eq, gte, inArray, lt, lte, ne, sql } from "drizzle-orm";
import * as z from "zod";
import { auditAction, requireOrgMembership } from "./utils";
import {
  AUTOMATION_ENROLLMENT_MODES,
  AUTOMATION_NODE_TYPES,
  DEFAULT_AUTOMATION_COMPLIANCE_POLICY,
  type AutomationDefinition,
  type AutomationNode,
} from "@/lib/automations/types";
import {
  createBuilderStarterDefinition,
  getAutomationTemplateByKey,
  getAutomationTemplateCatalog,
} from "@/lib/automations/templates";
import { validateAutomationDefinition } from "@/lib/automations/validation";
import { evaluateEnrollmentPolicy, isWithinQuietHours } from "@/lib/automations/policy";
import {
  AUTOMATION_RUNTIME_LIMITS,
  computeDeadLetterRetryAt,
  evaluateAutomationConcurrency,
  resolveWorkflowDispatchWindow,
} from "@/lib/automations/runtime-controls";
import { computeWorkflowAnalytics } from "@/lib/automations/analytics";
import { writeGraceAuditStreamSafe } from "@/lib/grace/audit-stream";
import { inngest } from "@/lib/inngest/client";
import {
  buildBroadcastSendIdempotencyKey,
  INNGEST_EVENTS,
} from "@/lib/inngest/events";

const TIME_OF_DAY_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const OPT_OUT_TAGS = new Set([
  "opt_out",
  "do_not_contact",
  "do_not_text",
  "unsubscribe",
  "sms_opt_out",
  "email_opt_out",
]);

const automationNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(AUTOMATION_NODE_TYPES),
  label: z.string().min(1),
  description: z.string().nullable().optional(),
  config: z.record(z.unknown()).optional(),
  nextIds: z.array(z.string().min(1)).optional(),
});

const automationDefinitionSchema = z.object({
  version: z.coerce.number().int().min(1).default(1),
  startNodeId: z.string().min(1).nullable().optional(),
  nodes: z.array(automationNodeSchema).min(1),
});

const automationPolicySchema = z.object({
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(TIME_OF_DAY_RE).optional(),
  quietHoursEnd: z.string().regex(TIME_OF_DAY_RE).optional(),
  dailySendCap: z.coerce.number().int().min(1).max(10000).optional(),
  respectOptOut: z.boolean().optional(),
  enrollmentMode: z.enum(AUTOMATION_ENROLLMENT_MODES).optional(),
  reentryCooldownMinutes: z.coerce.number().int().min(1).max(525600).optional(),
});

const automationPolicySnapshotSchema = z.object({
  quietHoursEnabled: z.boolean(),
  quietHoursStart: z.string().regex(TIME_OF_DAY_RE),
  quietHoursEnd: z.string().regex(TIME_OF_DAY_RE),
  dailySendCap: z.coerce.number().int().min(1).max(10000),
  respectOptOut: z.boolean(),
  enrollmentMode: z.enum(AUTOMATION_ENROLLMENT_MODES),
  reentryCooldownMinutes: z.coerce.number().int().min(1).max(525600),
});

const triggerWorkflowSchema = z.object({
  organizationId: z.string().min(1),
  workflowId: z.string().min(1),
  contactId: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
  allowDraft: z.boolean().optional().default(false),
});

const triggerWorkflowsForEventSchema = z.object({
  organizationId: z.string().min(1),
  triggerEvent: z.string().min(1),
  contactId: z.string().min(1).optional(),
  metadata: z.record(z.unknown()).optional(),
  systemToken: z.string().min(1),
});

const listDeadLettersSchema = z.object({
  organizationId: z.string().min(1),
  status: z.enum(["pending", "replayed", "discarded"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const replayDeadLetterSchema = z.object({
  organizationId: z.string().min(1),
  deadLetterId: z.string().min(1),
  force: z.boolean().optional().default(false),
});

const replayDueDeadLettersSchema = z.object({
  organizationId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  systemToken: z.string().min(1),
});

const getWorkflowVersionsSchema = z.object({
  organizationId: z.string().min(1),
  workflowId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const rollbackWorkflowVersionSchema = z
  .object({
    organizationId: z.string().min(1),
    workflowId: z.string().min(1),
    versionId: z.string().min(1).optional(),
    versionNumber: z.coerce.number().int().min(1).optional(),
    publish: z.boolean().optional().default(false),
  })
  .refine((value) => Boolean(value.versionId) || value.versionNumber !== undefined, {
    message: "versionId or versionNumber is required",
    path: ["versionId"],
  });

const getWorkflowAnalyticsSchema = z.object({
  organizationId: z.string().min(1),
  workflowId: z.string().optional(),
  days: z.coerce.number().int().min(1).max(90).optional(),
  limitWorkflows: z.coerce.number().int().min(1).max(100).optional(),
});

const COMMUNICATION_ACTION_TYPES = new Set([
  "broadcast_send",
  "send_sms",
  "send_email",
]);

function normalizeDefinition(definition: AutomationDefinition): AutomationDefinition {
  const normalizedNodes = definition.nodes.map((node) => {
    const nextIds = Array.from(new Set((node.nextIds ?? []).filter(Boolean)));
    return {
      ...node,
      nextIds,
      description: node.description ?? null,
      config: node.config ?? {},
    };
  });

  return {
    version: definition.version,
    startNodeId:
      definition.startNodeId ?? normalizedNodes.find((node) => node.type === "trigger")?.id,
    nodes: normalizedNodes,
  };
}

function getWorkflowPolicySnapshot(
  workflow: typeof automationWorkflows.$inferSelect
) {
  return {
    quietHoursEnabled: workflow.quietHoursEnabled,
    quietHoursStart: workflow.quietHoursStart,
    quietHoursEnd: workflow.quietHoursEnd,
    dailySendCap: workflow.dailySendCap,
    respectOptOut: workflow.respectOptOut,
    enrollmentMode: workflow.enrollmentMode,
    reentryCooldownMinutes: workflow.reentryCooldownMinutes,
  };
}

async function createWorkflowVersionSnapshot(params: {
  organizationId: string;
  workflow: typeof automationWorkflows.$inferSelect;
  publishedByUserId?: string | null;
}) {
  const definition = normalizeDefinition(
    automationDefinitionSchema.parse(
      (params.workflow.definitionJson ?? { version: 1, nodes: [] }) as AutomationDefinition
    )
  );

  const policy = automationPolicySnapshotSchema.parse(
    getWorkflowPolicySnapshot(params.workflow)
  );

  const [latest] = await db
    .select({
      latestVersionNumber: sql<number>`coalesce(max(${automationWorkflowVersions.versionNumber}), 0)`,
    })
    .from(automationWorkflowVersions)
    .where(
      and(
        eq(automationWorkflowVersions.organizationId, params.organizationId),
        eq(automationWorkflowVersions.workflowId, params.workflow.id)
      )
    );

  const nextVersionNumber = Number(latest?.latestVersionNumber ?? 0) + 1;

  const [created] = await db
    .insert(automationWorkflowVersions)
    .values({
      organizationId: params.organizationId,
      workflowId: params.workflow.id,
      versionNumber: nextVersionNumber,
      triggerEvent: params.workflow.triggerEvent,
      definitionJson: definition,
      policyJson: policy,
      publishedByUserId: params.publishedByUserId ?? null,
    })
    .returning();

  return created;
}

function getDayWindow(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function getNodeConfig(node: AutomationNode) {
  return (node.config ?? {}) as Record<string, unknown>;
}

function getAutomationSystemToken() {
  return (
    process.env.AUTOMATION_SYSTEM_TOKEN ??
    process.env.INNGEST_EVENT_KEY ??
    process.env.INNGEST_SIGNING_KEY ??
    null
  );
}

function assertSystemToken(token: string) {
  const expected = getAutomationSystemToken();
  if (!expected) {
    throw new Error(
      "System automation token is not configured (set AUTOMATION_SYSTEM_TOKEN or INNGEST_EVENT_KEY)."
    );
  }
  if (token !== expected) {
    throw new Error("Invalid system automation token");
  }
}

function buildDeadLetterPayload(params: {
  source: ExecuteAutomationRunInput["source"];
  triggerEvent: string | null;
  metadata: Record<string, unknown>;
  runId?: string;
}) {
  return {
    source: params.source,
    triggerEvent: params.triggerEvent,
    metadata: params.metadata,
    ...(params.runId && { runId: params.runId }),
  } as Record<string, unknown>;
}

async function writeDeadLetter(params: {
  organizationId: string;
  workflowId: string;
  runId: string;
  contactId?: string;
  source: ExecuteAutomationRunInput["source"];
  triggerEvent: string | null;
  metadata: Record<string, unknown>;
  errorMessage: string;
  deadLetterId?: string;
}) {
  const now = new Date();

  if (params.deadLetterId) {
    const [existing] = await db
      .select({ attemptCount: automationDeadLetters.attemptCount })
      .from(automationDeadLetters)
      .where(
        and(
          eq(automationDeadLetters.id, params.deadLetterId),
          eq(automationDeadLetters.organizationId, params.organizationId)
        )
      )
      .limit(1);

    const nextAttemptCount = Number(existing?.attemptCount ?? 0) + 1;
    const [updated] = await db
      .update(automationDeadLetters)
      .set({
        status: "pending",
        attemptCount: nextAttemptCount,
        lastError: params.errorMessage,
        runId: params.runId,
        contactId: params.contactId ?? null,
        source: params.source,
        triggerEvent: params.triggerEvent,
        payloadJson: buildDeadLetterPayload({
          source: params.source,
          triggerEvent: params.triggerEvent,
          metadata: params.metadata,
          runId: params.runId,
        }),
        lastFailedAt: now,
        nextRetryAt: computeDeadLetterRetryAt({
          attemptCount: nextAttemptCount,
          now,
        }),
        resolvedAt: null,
        resolutionNote: null,
        updatedAt: now,
      })
      .where(eq(automationDeadLetters.id, params.deadLetterId))
      .returning();

    if (updated) return updated;
  }

  const [created] = await db
    .insert(automationDeadLetters)
    .values({
      organizationId: params.organizationId,
      workflowId: params.workflowId,
      runId: params.runId,
      contactId: params.contactId ?? null,
      triggerEvent: params.triggerEvent,
      source: params.source,
      status: "pending",
      attemptCount: 1,
      lastError: params.errorMessage,
      payloadJson: buildDeadLetterPayload({
        source: params.source,
        triggerEvent: params.triggerEvent,
        metadata: params.metadata,
        runId: params.runId,
      }),
      firstFailedAt: now,
      lastFailedAt: now,
      nextRetryAt: computeDeadLetterRetryAt({
        attemptCount: 1,
        now,
      }),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [automationDeadLetters.runId],
      set: {
        status: "pending",
        lastError: params.errorMessage,
        source: params.source,
        triggerEvent: params.triggerEvent,
        payloadJson: buildDeadLetterPayload({
          source: params.source,
          triggerEvent: params.triggerEvent,
          metadata: params.metadata,
          runId: params.runId,
        }),
        lastFailedAt: now,
        nextRetryAt: computeDeadLetterRetryAt({
          attemptCount: 1,
          now,
        }),
        updatedAt: now,
      },
    })
    .returning();

  return created;
}

async function markDeadLetterReplayed(params: {
  deadLetterId: string;
  organizationId: string;
  note: string;
}) {
  const now = new Date();
  const [updated] = await db
    .update(automationDeadLetters)
    .set({
      status: "replayed",
      resolvedAt: now,
      resolutionNote: params.note,
      updatedAt: now,
    })
    .where(
      and(
        eq(automationDeadLetters.id, params.deadLetterId),
        eq(automationDeadLetters.organizationId, params.organizationId)
      )
    )
    .returning();

  return updated ?? null;
}

async function markDeadLetterPendingWithBackoff(params: {
  deadLetterId: string;
  organizationId: string;
  reason: string;
  retryAt?: Date | null;
}) {
  const now = new Date();
  const [existing] = await db
    .select({ attemptCount: automationDeadLetters.attemptCount })
    .from(automationDeadLetters)
    .where(
      and(
        eq(automationDeadLetters.id, params.deadLetterId),
        eq(automationDeadLetters.organizationId, params.organizationId)
      )
    )
    .limit(1);

  const nextAttemptCount = Number(existing?.attemptCount ?? 0) + 1;

  const [updated] = await db
    .update(automationDeadLetters)
    .set({
      status: "pending",
      attemptCount: nextAttemptCount,
      lastError: params.reason,
      lastFailedAt: now,
      nextRetryAt:
        params.retryAt ??
        computeDeadLetterRetryAt({
          attemptCount: nextAttemptCount,
          now,
        }),
      resolvedAt: null,
      resolutionNote: null,
      updatedAt: now,
    })
    .where(eq(automationDeadLetters.id, params.deadLetterId))
    .returning();

  return updated ?? null;
}

async function requireAutomationWorkflowAccess(
  organizationId: string,
  workflowId: string,
  requiredRole: "admin" | "user" = "admin"
) {
  const session = await requireOrgMembership(organizationId, requiredRole);

  const [workflow] = await db
    .select()
    .from(automationWorkflows)
    .where(
      and(
        eq(automationWorkflows.id, workflowId),
        eq(automationWorkflows.organizationId, organizationId)
      )
    )
    .limit(1);

  if (!workflow) {
    throw new Error("Automation workflow not found");
  }

  return { session, workflow };
}

async function hasContactOptOut(params: {
  organizationId: string;
  contactId: string;
}) {
  const rows = await db
    .select({ tag: contactTags.tag })
    .from(contactTags)
    .innerJoin(churchContacts, eq(contactTags.contactId, churchContacts.id))
    .where(
      and(
        eq(contactTags.contactId, params.contactId),
        eq(churchContacts.organizationId, params.organizationId)
      )
    );

  return rows.some((row) => OPT_OUT_TAGS.has((row.tag ?? "").trim().toLowerCase()));
}

async function evaluateEnrollmentState(params: {
  organizationId: string;
  workflowId: string;
  contactId?: string;
  now: Date;
  respectOptOut: boolean;
  enrollmentMode: "every_trigger" | "once_per_contact" | "cooldown";
  reentryCooldownMinutes: number;
  dailySendCap: number;
}) {
  const { start, end } = getDayWindow(params.now);

  const [[dailyStats], latestContactRun, optedOut] = await Promise.all([
    db
      .select({ total: sql<number>`count(*)` })
      .from(automationWorkflowRuns)
      .where(
        and(
          eq(automationWorkflowRuns.workflowId, params.workflowId),
          eq(automationWorkflowRuns.organizationId, params.organizationId),
          gte(automationWorkflowRuns.enteredAt, start),
          lt(automationWorkflowRuns.enteredAt, end)
        )
      ),
    params.contactId
      ? db
          .select({ enteredAt: automationWorkflowRuns.enteredAt })
          .from(automationWorkflowRuns)
          .where(
            and(
              eq(automationWorkflowRuns.workflowId, params.workflowId),
              eq(automationWorkflowRuns.organizationId, params.organizationId),
              eq(automationWorkflowRuns.contactId, params.contactId)
            )
          )
          .orderBy(desc(automationWorkflowRuns.enteredAt))
          .limit(1)
      : Promise.resolve([]),
    params.contactId && params.respectOptOut
      ? hasContactOptOut({
          organizationId: params.organizationId,
          contactId: params.contactId,
        })
      : Promise.resolve(false),
  ]);

  const latestRunAt = latestContactRun[0]?.enteredAt ?? null;

  const decision = evaluateEnrollmentPolicy({
    enrollmentMode: params.enrollmentMode,
    reentryCooldownMinutes: params.reentryCooldownMinutes,
    hasPriorRun: Boolean(latestRunAt),
    latestRunAt,
    hasOptOut: optedOut,
    respectOptOut: params.respectOptOut,
    dailySendCap: params.dailySendCap,
    runsToday: Number(dailyStats?.total ?? 0),
    now: params.now,
  });

  return {
    ...decision,
    runsToday: Number(dailyStats?.total ?? 0),
    latestRunAt,
    hasOptOut: optedOut,
  };
}

async function queueAutomationBroadcastAction(params: {
  organizationId: string;
  workflowId: string;
  runId: string;
  nodeId: string;
  broadcastId: string;
}) {
  const [broadcast] = await db
    .select({
      id: broadcasts.id,
      status: broadcasts.status,
      title: broadcasts.title,
      organizationId: broadcasts.organizationId,
    })
    .from(broadcasts)
    .where(
      and(
        eq(broadcasts.id, params.broadcastId),
        eq(broadcasts.organizationId, params.organizationId)
      )
    )
    .limit(1);

  if (!broadcast) {
    throw new Error("Broadcast action failed: broadcast not found in organization scope");
  }

  if (broadcast.status !== "draft" && broadcast.status !== "scheduled") {
    throw new Error(
      `Broadcast action failed: broadcast status \"${broadcast.status}\" is not sendable`
    );
  }

  const baseKey = buildBroadcastSendIdempotencyKey({
    organizationId: params.organizationId,
    broadcastId: params.broadcastId,
  });
  const idempotencyKey = `${baseKey}:wf:${params.workflowId}:run:${params.runId}:node:${params.nodeId}`;

  await inngest.send({
    id: idempotencyKey,
    name: INNGEST_EVENTS.COMMUNICATIONS_BROADCAST_SEND_REQUESTED,
    data: {
      organizationId: params.organizationId,
      broadcastId: params.broadcastId,
      idempotencyKey,
    },
  });

  return {
    broadcastId: broadcast.id,
    broadcastTitle: broadcast.title,
    idempotencyKey,
  };
}

export async function getAutomationTemplates() {
  return getAutomationTemplateCatalog().map((template) => ({
    key: template.key,
    name: template.name,
    description: template.description,
    category: template.category,
    triggerEvent: template.triggerEvent,
    recommendedChannels: template.recommendedChannels,
    nodeCount: template.definition.nodes.length,
  }));
}

export async function getAutomationWorkflows(organizationId: string) {
  await requireOrgMembership(organizationId);

  const [workflows, runStats] = await Promise.all([
    db
      .select()
      .from(automationWorkflows)
      .where(eq(automationWorkflows.organizationId, organizationId))
      .orderBy(desc(automationWorkflows.updatedAt)),
    db
      .select({
        workflowId: automationWorkflowRuns.workflowId,
        entered: sql<number>`count(*) filter (where ${automationWorkflowRuns.status} = 'entered')`,
        running: sql<number>`count(*) filter (where ${automationWorkflowRuns.status} = 'running')`,
        failed: sql<number>`count(*) filter (where ${automationWorkflowRuns.status} = 'failed')`,
        completed: sql<number>`count(*) filter (where ${automationWorkflowRuns.status} = 'completed')`,
        exited: sql<number>`count(*) filter (where ${automationWorkflowRuns.status} = 'exited')`,
      })
      .from(automationWorkflowRuns)
      .where(eq(automationWorkflowRuns.organizationId, organizationId))
      .groupBy(automationWorkflowRuns.workflowId),
  ]);

  const runStatsByWorkflowId = new Map(
    runStats.map((row) => [
      row.workflowId,
      {
        entered: Number(row.entered ?? 0),
        running: Number(row.running ?? 0),
        failed: Number(row.failed ?? 0),
        completed: Number(row.completed ?? 0),
        exited: Number(row.exited ?? 0),
      },
    ])
  );

  return workflows.map((workflow) => ({
    ...workflow,
    runStats: runStatsByWorkflowId.get(workflow.id) ?? {
      entered: 0,
      running: 0,
      failed: 0,
      completed: 0,
      exited: 0,
    },
  }));
}

export async function createAutomationWorkflow(input: {
  organizationId: string;
  name: string;
  description?: string;
  mode: "template" | "builder";
  triggerEvent?: string;
  definition?: AutomationDefinition;
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      name: z.string().min(2),
      description: z.string().optional(),
      mode: z.enum(["template", "builder"]),
      triggerEvent: z.string().optional(),
      definition: automationDefinitionSchema.optional(),
    })
    .parse(input);

  const session = await requireOrgMembership(parsed.organizationId, "admin");

  const initialDefinition =
    parsed.definition ??
    (parsed.mode === "builder"
      ? createBuilderStarterDefinition()
      : {
          version: 1,
          nodes: [],
        });

  const normalized = normalizeDefinition(initialDefinition);
  const validationErrors = validateAutomationDefinition(normalized);

  const [created] = await db
    .insert(automationWorkflows)
    .values({
      organizationId: parsed.organizationId,
      name: parsed.name,
      description: parsed.description ?? null,
      mode: parsed.mode,
      triggerEvent: parsed.triggerEvent ?? null,
      definitionJson: normalized,
      validationErrors,
      ...DEFAULT_AUTOMATION_COMPLIANCE_POLICY,
      createdByUserId: session.userId,
      lastValidatedAt: new Date(),
    })
    .returning();

  await auditAction({
    organizationId: parsed.organizationId,
    userId: session.userId,
    actionType: "create",
    entityName: "automation_workflow",
    entityId: created.id,
    details: {
      mode: created.mode,
      name: created.name,
      validationErrors,
    },
  });

  return created;
}

export async function installAutomationTemplate(input: {
  organizationId: string;
  templateKey: string;
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      templateKey: z.string().min(1),
    })
    .parse(input);

  const session = await requireOrgMembership(parsed.organizationId, "admin");
  const template = getAutomationTemplateByKey(parsed.templateKey);

  if (!template) {
    throw new Error("Automation template not found");
  }

  const [existing] = await db
    .select()
    .from(automationWorkflows)
    .where(
      and(
        eq(automationWorkflows.organizationId, parsed.organizationId),
        eq(automationWorkflows.mode, "template"),
        eq(automationWorkflows.templateKey, parsed.templateKey),
        ne(automationWorkflows.status, "archived")
      )
    )
    .limit(1);

  if (existing) {
    return {
      alreadyInstalled: true as const,
      workflow: existing,
    };
  }

  const normalized = normalizeDefinition(template.definition);
  const validationErrors = validateAutomationDefinition(normalized);

  if (validationErrors.length > 0) {
    throw new Error(
      `Template ${template.name} is invalid: ${validationErrors.join(" ")}`
    );
  }

  const [created] = await db
    .insert(automationWorkflows)
    .values({
      organizationId: parsed.organizationId,
      name: template.name,
      description: template.description,
      mode: "template",
      status: "published",
      templateKey: template.key,
      triggerEvent: template.triggerEvent,
      definitionJson: normalized,
      validationErrors: [],
      ...DEFAULT_AUTOMATION_COMPLIANCE_POLICY,
      createdByUserId: session.userId,
      lastValidatedAt: new Date(),
      publishedAt: new Date(),
    })
    .returning();

  const publishedVersion = await createWorkflowVersionSnapshot({
    organizationId: parsed.organizationId,
    workflow: created,
    publishedByUserId: session.userId,
  });

  await auditAction({
    organizationId: parsed.organizationId,
    userId: session.userId,
    actionType: "install",
    entityName: "automation_template",
    entityId: created.id,
    details: {
      templateKey: template.key,
      triggerEvent: template.triggerEvent,
      versionNumber: publishedVersion.versionNumber,
    },
  });

  return {
    alreadyInstalled: false as const,
    workflow: created,
  };
}

export async function updateAutomationWorkflow(input: {
  organizationId: string;
  workflowId: string;
  name?: string;
  description?: string | null;
  triggerEvent?: string | null;
  definition?: AutomationDefinition;
  policy?: {
    quietHoursEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    dailySendCap?: number;
    respectOptOut?: boolean;
    enrollmentMode?: "every_trigger" | "once_per_contact" | "cooldown";
    reentryCooldownMinutes?: number;
  };
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      workflowId: z.string().min(1),
      name: z.string().min(2).optional(),
      description: z.string().nullable().optional(),
      triggerEvent: z.string().nullable().optional(),
      definition: automationDefinitionSchema.optional(),
      policy: automationPolicySchema.optional(),
    })
    .parse(input);

  const { session, workflow } = await requireAutomationWorkflowAccess(
    parsed.organizationId,
    parsed.workflowId,
    "admin"
  );

  const patch: Partial<typeof automationWorkflows.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (parsed.name !== undefined) {
    patch.name = parsed.name;
  }
  if (parsed.description !== undefined) {
    patch.description = parsed.description;
  }
  if (parsed.triggerEvent !== undefined) {
    patch.triggerEvent = parsed.triggerEvent;
  }

  let validationErrors = workflow.validationErrors as string[];

  if (parsed.definition) {
    const normalized = normalizeDefinition(parsed.definition);
    validationErrors = validateAutomationDefinition(normalized);
    patch.definitionJson = normalized;
    patch.validationErrors = validationErrors;
    patch.lastValidatedAt = new Date();
  }

  if (parsed.policy) {
    const policyPatch = parsed.policy;
    if (policyPatch.quietHoursEnabled !== undefined) {
      patch.quietHoursEnabled = policyPatch.quietHoursEnabled;
    }
    if (policyPatch.quietHoursStart !== undefined) {
      patch.quietHoursStart = policyPatch.quietHoursStart;
    }
    if (policyPatch.quietHoursEnd !== undefined) {
      patch.quietHoursEnd = policyPatch.quietHoursEnd;
    }
    if (policyPatch.dailySendCap !== undefined) {
      patch.dailySendCap = policyPatch.dailySendCap;
    }
    if (policyPatch.respectOptOut !== undefined) {
      patch.respectOptOut = policyPatch.respectOptOut;
    }
    if (policyPatch.enrollmentMode !== undefined) {
      patch.enrollmentMode = policyPatch.enrollmentMode;
    }
    if (policyPatch.reentryCooldownMinutes !== undefined) {
      patch.reentryCooldownMinutes = policyPatch.reentryCooldownMinutes;
    }
  }

  const [updated] = await db
    .update(automationWorkflows)
    .set(patch)
    .where(eq(automationWorkflows.id, parsed.workflowId))
    .returning();

  await auditAction({
    organizationId: parsed.organizationId,
    userId: session.userId,
    actionType: "update",
    entityName: "automation_workflow",
    entityId: updated.id,
    details: {
      hadDefinitionUpdate: Boolean(parsed.definition),
      validationErrors,
    },
  });

  return updated;
}

export async function publishAutomationWorkflow(input: {
  organizationId: string;
  workflowId: string;
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      workflowId: z.string().min(1),
    })
    .parse(input);

  const { session, workflow } = await requireAutomationWorkflowAccess(
    parsed.organizationId,
    parsed.workflowId,
    "admin"
  );

  const definition = automationDefinitionSchema.parse(
    (workflow.definitionJson ?? { version: 1, nodes: [] }) as AutomationDefinition
  );
  const normalized = normalizeDefinition(definition);
  const validationErrors = validateAutomationDefinition(normalized);

  if (validationErrors.length > 0) {
    throw new Error(`Cannot publish invalid workflow. ${validationErrors.join(" ")}`);
  }

  const [updated] = await db
    .update(automationWorkflows)
    .set({
      status: "published",
      publishedAt: new Date(),
      updatedAt: new Date(),
      definitionJson: normalized,
      validationErrors: [],
      lastValidatedAt: new Date(),
    })
    .where(eq(automationWorkflows.id, parsed.workflowId))
    .returning();

  const publishedVersion = await createWorkflowVersionSnapshot({
    organizationId: parsed.organizationId,
    workflow: updated,
    publishedByUserId: session.userId,
  });

  await auditAction({
    organizationId: parsed.organizationId,
    userId: session.userId,
    actionType: "publish",
    entityName: "automation_workflow",
    entityId: updated.id,
    details: {
      mode: updated.mode,
      triggerEvent: updated.triggerEvent,
      versionNumber: publishedVersion.versionNumber,
    },
  });

  return updated;
}

export async function setAutomationWorkflowStatus(input: {
  organizationId: string;
  workflowId: string;
  status: "draft" | "published" | "paused" | "archived";
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      workflowId: z.string().min(1),
      status: z.enum(["draft", "published", "paused", "archived"]),
    })
    .parse(input);

  if (parsed.status === "published") {
    return publishAutomationWorkflow(parsed);
  }

  const { session } = await requireAutomationWorkflowAccess(
    parsed.organizationId,
    parsed.workflowId,
    "admin"
  );

  const [updated] = await db
    .update(automationWorkflows)
    .set({
      status: parsed.status,
      updatedAt: new Date(),
    })
    .where(eq(automationWorkflows.id, parsed.workflowId))
    .returning();

  await auditAction({
    organizationId: parsed.organizationId,
    userId: session.userId,
    actionType: "status_update",
    entityName: "automation_workflow",
    entityId: updated.id,
    details: {
      status: parsed.status,
    },
  });

  return updated;
}

export async function getAutomationWorkflowVersions(input: {
  organizationId: string;
  workflowId: string;
  limit?: number;
}) {
  const parsed = getWorkflowVersionsSchema.parse(input);

  await requireAutomationWorkflowAccess(parsed.organizationId, parsed.workflowId, "user");

  return db
    .select()
    .from(automationWorkflowVersions)
    .where(
      and(
        eq(automationWorkflowVersions.organizationId, parsed.organizationId),
        eq(automationWorkflowVersions.workflowId, parsed.workflowId)
      )
    )
    .orderBy(desc(automationWorkflowVersions.versionNumber))
    .limit(parsed.limit ?? 20);
}

export async function rollbackAutomationWorkflowVersion(input: {
  organizationId: string;
  workflowId: string;
  versionId?: string;
  versionNumber?: number;
  publish?: boolean;
}) {
  const parsed = rollbackWorkflowVersionSchema.parse(input);
  const { session, workflow } = await requireAutomationWorkflowAccess(
    parsed.organizationId,
    parsed.workflowId,
    "admin"
  );

  const [version] = await db
    .select()
    .from(automationWorkflowVersions)
    .where(
      and(
        eq(automationWorkflowVersions.organizationId, parsed.organizationId),
        eq(automationWorkflowVersions.workflowId, parsed.workflowId),
        parsed.versionId
          ? eq(automationWorkflowVersions.id, parsed.versionId)
          : eq(automationWorkflowVersions.versionNumber, Number(parsed.versionNumber))
      )
    )
    .limit(1);

  if (!version) {
    throw new Error("Automation workflow version not found");
  }

  const definition = normalizeDefinition(
    automationDefinitionSchema.parse(
      (version.definitionJson ?? { version: 1, nodes: [] }) as AutomationDefinition
    )
  );
  const validationErrors = validateAutomationDefinition(definition);
  if (validationErrors.length > 0) {
    throw new Error(
      `Version ${version.versionNumber} cannot be restored because it is invalid. ${validationErrors.join(
        " "
      )}`
    );
  }

  const policy = automationPolicySnapshotSchema.parse(version.policyJson);
  const now = new Date();

  const [restored] = await db
    .update(automationWorkflows)
    .set({
      triggerEvent: version.triggerEvent ?? null,
      definitionJson: definition,
      validationErrors: [],
      quietHoursEnabled: policy.quietHoursEnabled,
      quietHoursStart: policy.quietHoursStart,
      quietHoursEnd: policy.quietHoursEnd,
      dailySendCap: policy.dailySendCap,
      respectOptOut: policy.respectOptOut,
      enrollmentMode: policy.enrollmentMode,
      reentryCooldownMinutes: policy.reentryCooldownMinutes,
      status: "draft",
      updatedAt: now,
      lastValidatedAt: now,
      publishedAt: null,
    })
    .where(eq(automationWorkflows.id, parsed.workflowId))
    .returning();

  await auditAction({
    organizationId: parsed.organizationId,
    userId: session.userId,
    actionType: "rollback",
    entityName: "automation_workflow",
    entityId: workflow.id,
    details: {
      restoredFromVersionNumber: version.versionNumber,
      publishAfterRestore: parsed.publish,
    },
  });

  if (parsed.publish) {
    return publishAutomationWorkflow({
      organizationId: parsed.organizationId,
      workflowId: parsed.workflowId,
    });
  }

  return restored;
}

export async function evaluateAutomationEnrollment(input: {
  organizationId: string;
  workflowId: string;
  contactId?: string;
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      workflowId: z.string().min(1),
      contactId: z.string().optional(),
    })
    .parse(input);

  const { workflow } = await requireAutomationWorkflowAccess(
    parsed.organizationId,
    parsed.workflowId,
    "user"
  );

  return evaluateEnrollmentState({
    organizationId: parsed.organizationId,
    workflowId: parsed.workflowId,
    contactId: parsed.contactId,
    now: new Date(),
    respectOptOut: workflow.respectOptOut,
    enrollmentMode: workflow.enrollmentMode,
    reentryCooldownMinutes: workflow.reentryCooldownMinutes,
    dailySendCap: workflow.dailySendCap,
  });
}

type ExecuteAutomationRunInput = {
  organizationId: string;
  workflow: typeof automationWorkflows.$inferSelect;
  contactId?: string;
  metadata?: Record<string, unknown>;
  allowDraft?: boolean;
  source: "manual_trigger" | "event_trigger" | "dead_letter_replay";
  deadLetterId?: string;
  auditUserId?: string;
};

async function executeAutomationWorkflowRun(input: ExecuteAutomationRunInput) {
  if (!input.allowDraft && input.workflow.status !== "published") {
    throw new Error("Only published workflows can be triggered");
  }

  const definition = normalizeDefinition(
    automationDefinitionSchema.parse(input.workflow.definitionJson as AutomationDefinition)
  );
  const now = new Date();

  const enrollment = await evaluateEnrollmentState({
    organizationId: input.organizationId,
    workflowId: input.workflow.id,
    contactId: input.contactId,
    now,
    respectOptOut: input.workflow.respectOptOut,
    enrollmentMode: input.workflow.enrollmentMode,
    reentryCooldownMinutes: input.workflow.reentryCooldownMinutes,
    dailySendCap: input.workflow.dailySendCap,
  });

  if (!enrollment.allowed) {
    await writeGraceAuditStreamSafe({
      organizationId: input.organizationId,
      workflowId: input.workflow.id,
      eventType: "workflow_execution",
      source: "automation_runtime",
      status: "skipped",
      actorType: "system",
      actionName: "enrollment_evaluation",
      metadataJson: {
        workflowId: input.workflow.id,
        source: input.source,
        reason: enrollment.reason ?? "enrollment_blocked",
        retryAt: enrollment.retryAt ? new Date(enrollment.retryAt).toISOString() : null,
      },
    });
    return {
      skipped: true as const,
      reason: enrollment.reason,
      retryAt: enrollment.retryAt ?? null,
      enrollment,
    };
  }

  const [activeRunStats] = await db
    .select({ total: sql<number>`count(*)` })
    .from(automationWorkflowRuns)
    .where(
      and(
        eq(automationWorkflowRuns.organizationId, input.organizationId),
        eq(automationWorkflowRuns.workflowId, input.workflow.id),
        inArray(automationWorkflowRuns.status, ["entered", "running"])
      )
    );

  const concurrency = evaluateAutomationConcurrency({
    activeRuns: Number(activeRunStats?.total ?? 0),
    now,
    maxConcurrentRuns: AUTOMATION_RUNTIME_LIMITS.maxConcurrentRunsPerWorkflow,
    retryMinutes: AUTOMATION_RUNTIME_LIMITS.concurrencyRetryMinutes,
  });

  if (!concurrency.allowed) {
    await writeGraceAuditStreamSafe({
      organizationId: input.organizationId,
      workflowId: input.workflow.id,
      eventType: "workflow_execution",
      source: "automation_runtime",
      status: "skipped",
      actorType: "system",
      actionName: "concurrency_guard",
      metadataJson: {
        workflowId: input.workflow.id,
        source: input.source,
        reason: concurrency.reason ?? "concurrency_guard_blocked",
        retryAt: concurrency.retryAt ? concurrency.retryAt.toISOString() : null,
      },
    });
    return {
      skipped: true as const,
      reason: concurrency.reason,
      retryAt: concurrency.retryAt,
      enrollment,
      concurrency,
    };
  }

  const nodesById = new Map(definition.nodes.map((node) => [node.id, node]));
  const startNodeId =
    definition.startNodeId ??
    definition.nodes.find((node) => node.type === "trigger")?.id;

  if (!startNodeId || !nodesById.has(startNodeId)) {
    throw new Error("Workflow start node is invalid");
  }

  const [createdRun] = await db
    .insert(automationWorkflowRuns)
    .values({
      organizationId: input.organizationId,
      workflowId: input.workflow.id,
      contactId: input.contactId ?? null,
      status: "entered",
      currentNodeId: startNodeId,
      currentNodeType: "trigger",
      metadataJson: {
        source: input.source,
        metadata: input.metadata ?? {},
      },
    })
    .returning();

  const trace: Array<Record<string, unknown>> = [];
  const pushTrace = (entry: Record<string, unknown>) => {
    trace.push({ at: new Date().toISOString(), ...entry });
  };

  let status: "running" | "completed" | "failed" | "exited" = "running";
  let currentNodeId: string | null = startNodeId;
  let lastError: string | null = null;

  try {
    for (let step = 0; step < 60; step += 1) {
      if (!currentNodeId) {
        status = "exited";
        pushTrace({ event: "exit", reason: "missing_next_node" });
        break;
      }

      const node = nodesById.get(currentNodeId);
      if (!node) {
        throw new Error(`Node \"${currentNodeId}\" no longer exists`);
      }

      await db
        .update(automationWorkflowRuns)
        .set({
          status: "running",
          currentNodeId: node.id,
          currentNodeType: node.type,
          updatedAt: new Date(),
        })
        .where(eq(automationWorkflowRuns.id, createdRun.id));

      pushTrace({
        event: "node_enter",
        nodeId: node.id,
        nodeType: node.type,
      });

      if (node.type === "stop") {
        status = "completed";
        pushTrace({ event: "stop", nodeId: node.id });
        break;
      }

      const nextIds = node.nextIds ?? [];
      let nextNodeId: string | null = nextIds[0] ?? null;

      if (node.type === "condition") {
        const config = getNodeConfig(node);
        const branchIndex =
          typeof config.branchIndex === "number" && Number.isFinite(config.branchIndex)
            ? Math.max(0, Math.floor(config.branchIndex))
            : 0;
        nextNodeId = nextIds[branchIndex] ?? nextIds[0] ?? null;
        pushTrace({
          event: "condition_branch",
          nodeId: node.id,
          branchIndex,
          selectedNextNodeId: nextNodeId,
        });
      }

      if (node.type === "action") {
        const config = getNodeConfig(node);
        const actionType = String(config.actionType ?? "generic");

        if (
          COMMUNICATION_ACTION_TYPES.has(actionType) &&
          isWithinQuietHours({
            now,
            quietHoursEnabled: input.workflow.quietHoursEnabled,
            quietHoursStart: input.workflow.quietHoursStart,
            quietHoursEnd: input.workflow.quietHoursEnd,
          })
        ) {
          status = "exited";
          pushTrace({
            event: "action_skipped",
            nodeId: node.id,
            actionType,
            reason: "quiet_hours_active",
          });
          break;
        }

        if (actionType === "broadcast_send") {
          const broadcastId = String(config.broadcastId ?? "").trim();
          if (!broadcastId) {
            throw new Error(`Action node ${node.id} is missing broadcastId`);
          }

          const queued = await queueAutomationBroadcastAction({
            organizationId: input.organizationId,
            workflowId: input.workflow.id,
            runId: createdRun.id,
            nodeId: node.id,
            broadcastId,
          });

          pushTrace({
            event: "action_queued",
            nodeId: node.id,
            actionType,
            broadcastId: queued.broadcastId,
            idempotencyKey: queued.idempotencyKey,
          });
        } else {
          pushTrace({ event: "action_executed", nodeId: node.id, actionType });
        }
      }

      if (!nextNodeId) {
        status = "exited";
        pushTrace({ event: "exit", reason: "node_has_no_next", nodeId: node.id });
        break;
      }

      currentNodeId = nextNodeId;
    }

    if (status === "running") {
      status = "failed";
      lastError = "step_limit_reached";
      pushTrace({ event: "error", reason: "step_limit_reached" });
    }
  } catch (error) {
    status = "failed";
    lastError = error instanceof Error ? error.message : "workflow_execution_failed";
    pushTrace({ event: "error", reason: lastError });
  }

  const [updatedRun] = await db
    .update(automationWorkflowRuns)
    .set({
      status,
      currentNodeId: currentNodeId ?? undefined,
      currentNodeType: currentNodeId ? nodesById.get(currentNodeId)?.type : undefined,
      lastError,
      metadataJson: {
        source: input.source,
        metadata: input.metadata ?? {},
        enrollment,
        trace,
      },
      updatedAt: new Date(),
      completedAt: status === "completed" ? new Date() : null,
      exitedAt: status === "exited" ? new Date() : null,
    })
    .where(eq(automationWorkflowRuns.id, createdRun.id))
    .returning();

  let deadLetterId: string | null = null;
  if (status === "failed") {
    const deadLetter = await writeDeadLetter({
      organizationId: input.organizationId,
      workflowId: input.workflow.id,
      runId: updatedRun.id,
      contactId: input.contactId ?? undefined,
      source: input.source,
      triggerEvent:
        typeof input.metadata?.triggerEvent === "string"
          ? input.metadata.triggerEvent
          : input.workflow.triggerEvent,
      metadata: input.metadata ?? {},
      errorMessage: lastError ?? "workflow_execution_failed",
      deadLetterId: input.deadLetterId,
    });
    deadLetterId = deadLetter?.id ?? null;
  }

  if (input.auditUserId) {
    await auditAction({
      organizationId: input.organizationId,
      userId: input.auditUserId,
      actionType: "trigger",
      entityName: "automation_workflow_run",
      entityId: updatedRun.id,
      details: {
        workflowId: input.workflow.id,
        status,
        contactId: input.contactId ?? null,
        reason: lastError,
        source: input.source,
      },
    });
  }

  await writeGraceAuditStreamSafe({
    organizationId: input.organizationId,
    workflowId: input.workflow.id,
    workflowRunId: updatedRun.id,
    eventType: "workflow_execution",
    source: "automation_runtime",
    status:
      status === "failed"
        ? "error"
        : status === "exited"
          ? "skipped"
          : "success",
    actorType: "system",
    actionName: "automation_workflow_run",
    errorText: lastError,
    metadataJson: {
      workflowId: input.workflow.id,
      source: input.source,
      runStatus: status,
      deadLetterId,
      traceLength: trace.length,
      contactId: input.contactId ?? null,
    },
  });

  return {
    skipped: false as const,
    run: updatedRun,
    trace,
    enrollment,
    deadLetterId,
  };
}

export async function triggerAutomationWorkflowRun(input: {
  organizationId: string;
  workflowId: string;
  contactId?: string;
  metadata?: Record<string, unknown>;
  allowDraft?: boolean;
}) {
  const parsed = triggerWorkflowSchema.parse(input);
  const { session, workflow } = await requireAutomationWorkflowAccess(
    parsed.organizationId,
    parsed.workflowId,
    "admin"
  );

  return executeAutomationWorkflowRun({
    organizationId: parsed.organizationId,
    workflow,
    contactId: parsed.contactId,
    metadata: parsed.metadata,
    allowDraft: parsed.allowDraft,
    source: "manual_trigger",
    auditUserId: session.userId,
  });
}

export async function triggerAutomationWorkflowsForEvent(input: {
  organizationId: string;
  triggerEvent: string;
  contactId?: string;
  metadata?: Record<string, unknown>;
  systemToken: string;
}) {
  const parsed = triggerWorkflowsForEventSchema.parse(input);
  assertSystemToken(parsed.systemToken);

  const workflows = await db
    .select()
    .from(automationWorkflows)
    .where(
      and(
        eq(automationWorkflows.organizationId, parsed.organizationId),
        eq(automationWorkflows.status, "published"),
        eq(automationWorkflows.triggerEvent, parsed.triggerEvent)
      )
    )
    .orderBy(desc(automationWorkflows.updatedAt));

  const dispatchWindow = resolveWorkflowDispatchWindow({
    workflowCount: workflows.length,
    maxWorkflowsPerEvent: AUTOMATION_RUNTIME_LIMITS.maxWorkflowsPerEvent,
  });

  const workflowsToDispatch = workflows.slice(0, dispatchWindow.selectedCount);
  const results = [];
  for (const workflow of workflowsToDispatch) {
    const result = await executeAutomationWorkflowRun({
      organizationId: parsed.organizationId,
      workflow,
      contactId: parsed.contactId,
      metadata: {
        triggerEvent: parsed.triggerEvent,
        ...(parsed.metadata ?? {}),
      },
      allowDraft: false,
      source: "event_trigger",
      auditUserId: "system",
    });

    results.push({
      workflowId: workflow.id,
      workflowName: workflow.name,
      result,
    });
  }

  return {
    dispatched: results.length,
    throttled: dispatchWindow.throttledCount,
    maxWorkflowsPerEvent: dispatchWindow.maxWorkflowsPerEvent,
    results,
  };
}

async function replayDeadLetterRow(
  deadLetter: typeof automationDeadLetters.$inferSelect
) {
  const [workflow] = await db
    .select()
    .from(automationWorkflows)
    .where(
      and(
        eq(automationWorkflows.id, deadLetter.workflowId),
        eq(automationWorkflows.organizationId, deadLetter.organizationId),
        eq(automationWorkflows.status, "published")
      )
    )
    .limit(1);

  if (!workflow) {
    await markDeadLetterPendingWithBackoff({
      deadLetterId: deadLetter.id,
      organizationId: deadLetter.organizationId,
      reason: "workflow_not_available_for_replay",
    });
    return {
      replayed: false as const,
      skipped: true as const,
      reason: "workflow_not_available_for_replay",
    };
  }

  const payload = (deadLetter.payloadJson ?? {}) as Record<string, unknown>;
  const payloadMetadata = (payload.metadata ?? {}) as Record<string, unknown>;
  const triggerEventFromPayload =
    typeof payload.triggerEvent === "string" ? payload.triggerEvent : null;

  const result = await executeAutomationWorkflowRun({
    organizationId: deadLetter.organizationId,
    workflow,
    contactId: deadLetter.contactId ?? undefined,
    metadata: {
      ...payloadMetadata,
      triggerEvent: deadLetter.triggerEvent ?? triggerEventFromPayload ?? workflow.triggerEvent,
      replayDeadLetterId: deadLetter.id,
    },
    allowDraft: false,
    source: "dead_letter_replay",
    deadLetterId: deadLetter.id,
    auditUserId: "system",
  });

  if (result.skipped) {
    await markDeadLetterPendingWithBackoff({
      deadLetterId: deadLetter.id,
      organizationId: deadLetter.organizationId,
      reason: result.reason ?? "replay_skipped",
      retryAt: result.retryAt ? new Date(result.retryAt) : null,
    });
    return {
      replayed: false as const,
      skipped: true as const,
      reason: result.reason,
      retryAt: result.retryAt ?? null,
    };
  }

  if (result.run.status === "failed") {
    return {
      replayed: false as const,
      skipped: false as const,
      reason: result.run.lastError ?? "replay_failed",
      runId: result.run.id,
      deadLetterId: result.deadLetterId ?? deadLetter.id,
    };
  }

  await markDeadLetterReplayed({
    deadLetterId: deadLetter.id,
    organizationId: deadLetter.organizationId,
    note: `replay_${result.run.status}`,
  });

  return {
    replayed: true as const,
    runId: result.run.id,
    status: result.run.status,
    deadLetterId: deadLetter.id,
  };
}

export async function getAutomationDeadLetters(input: {
  organizationId: string;
  status?: "pending" | "replayed" | "discarded";
  limit?: number;
}) {
  const parsed = listDeadLettersSchema.parse(input);
  await requireOrgMembership(parsed.organizationId, "user");

  const clauses = [eq(automationDeadLetters.organizationId, parsed.organizationId)];
  if (parsed.status) {
    clauses.push(eq(automationDeadLetters.status, parsed.status));
  }

  return db
    .select()
    .from(automationDeadLetters)
    .where(and(...clauses))
    .orderBy(desc(automationDeadLetters.updatedAt))
    .limit(parsed.limit ?? 50);
}

export async function replayAutomationDeadLetter(input: {
  organizationId: string;
  deadLetterId: string;
  force?: boolean;
}) {
  const parsed = replayDeadLetterSchema.parse(input);
  await requireOrgMembership(parsed.organizationId, "admin");

  const [deadLetter] = await db
    .select()
    .from(automationDeadLetters)
    .where(
      and(
        eq(automationDeadLetters.id, parsed.deadLetterId),
        eq(automationDeadLetters.organizationId, parsed.organizationId)
      )
    )
    .limit(1);

  if (!deadLetter) {
    throw new Error("Automation dead-letter item not found");
  }

  if (deadLetter.status === "discarded") {
    throw new Error("Cannot replay discarded dead-letter item");
  }

  if (
    !parsed.force &&
    deadLetter.nextRetryAt &&
    new Date(deadLetter.nextRetryAt).getTime() > Date.now()
  ) {
    return {
      replayed: false as const,
      skipped: true as const,
      reason: "retry_window_not_reached",
      nextRetryAt: deadLetter.nextRetryAt,
    };
  }

  return replayDeadLetterRow(deadLetter);
}

export async function replayDueAutomationDeadLetters(input: {
  organizationId?: string;
  limit?: number;
  systemToken: string;
}) {
  const parsed = replayDueDeadLettersSchema.parse(input);
  assertSystemToken(parsed.systemToken);

  const now = new Date();
  const clauses = [
    eq(automationDeadLetters.status, "pending"),
    lte(automationDeadLetters.nextRetryAt, now),
  ];
  if (parsed.organizationId) {
    clauses.push(eq(automationDeadLetters.organizationId, parsed.organizationId));
  }

  const rows = await db
    .select()
    .from(automationDeadLetters)
    .where(and(...clauses))
    .orderBy(automationDeadLetters.nextRetryAt)
    .limit(parsed.limit ?? 100);

  let replayed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const result = await replayDeadLetterRow(row);
      if (result.replayed) {
        replayed += 1;
      } else if (result.skipped) {
        skipped += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      failed += 1;
      await markDeadLetterPendingWithBackoff({
        deadLetterId: row.id,
        organizationId: row.organizationId,
        reason:
          error instanceof Error
            ? error.message
            : "dead_letter_replay_unhandled_failure",
      });
    }
  }

  return {
    processed: rows.length,
    replayed,
    skipped,
    failed,
  };
}

function toRatePercent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

export async function getAutomationWorkflowAnalytics(input: {
  organizationId: string;
  workflowId?: string;
  days?: number;
  limitWorkflows?: number;
}) {
  const parsed = getWorkflowAnalyticsSchema.parse(input);
  await requireOrgMembership(parsed.organizationId, "user");

  const days = parsed.days ?? 30;
  const limitWorkflows = parsed.limitWorkflows ?? 50;
  const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const workflowClauses = [eq(automationWorkflows.organizationId, parsed.organizationId)];
  if (parsed.workflowId) {
    workflowClauses.push(eq(automationWorkflows.id, parsed.workflowId));
  }

  const workflows = await db
    .select({
      id: automationWorkflows.id,
      name: automationWorkflows.name,
      mode: automationWorkflows.mode,
      status: automationWorkflows.status,
      triggerEvent: automationWorkflows.triggerEvent,
      updatedAt: automationWorkflows.updatedAt,
    })
    .from(automationWorkflows)
    .where(and(...workflowClauses))
    .orderBy(desc(automationWorkflows.updatedAt))
    .limit(limitWorkflows);

  if (workflows.length === 0) {
    return {
      generatedAt: new Date(),
      windowDays: days,
      windowStart,
      totals: {
        totalRuns: 0,
        replyCount: 0,
        completionCount: 0,
        conversionCount: 0,
        replyRatePercent: 0,
        completionRatePercent: 0,
        conversionRatePercent: 0,
      },
      workflows: [],
    };
  }

  const workflowIds = workflows.map((workflow) => workflow.id);
  const runRows = await db
    .select({
      workflowId: automationWorkflowRuns.workflowId,
      status: automationWorkflowRuns.status,
      enteredAt: automationWorkflowRuns.enteredAt,
      metadataJson: automationWorkflowRuns.metadataJson,
    })
    .from(automationWorkflowRuns)
    .where(
      and(
        eq(automationWorkflowRuns.organizationId, parsed.organizationId),
        inArray(automationWorkflowRuns.workflowId, workflowIds),
        gte(automationWorkflowRuns.enteredAt, windowStart)
      )
    );

  const runsByWorkflowId = new Map<string, typeof runRows>();
  for (const row of runRows) {
    const list = runsByWorkflowId.get(row.workflowId) ?? [];
    list.push(row);
    runsByWorkflowId.set(row.workflowId, list);
  }

  const workflowAnalytics = workflows
    .map((workflow) => {
      const rows = runsByWorkflowId.get(workflow.id) ?? [];
      const analytics = computeWorkflowAnalytics(workflow.id, rows);
      return {
        workflow,
        analytics,
      };
    })
    .sort((a, b) => b.analytics.totalRuns - a.analytics.totalRuns);

  const totals = workflowAnalytics.reduce(
    (acc, row) => {
      acc.totalRuns += row.analytics.totalRuns;
      acc.replyCount += row.analytics.replyCount;
      acc.completionCount += row.analytics.completionCount;
      acc.conversionCount += row.analytics.conversionCount;
      return acc;
    },
    {
      totalRuns: 0,
      replyCount: 0,
      completionCount: 0,
      conversionCount: 0,
    }
  );

  return {
    generatedAt: new Date(),
    windowDays: days,
    windowStart,
    totals: {
      ...totals,
      replyRatePercent: toRatePercent(totals.replyCount, totals.totalRuns),
      completionRatePercent: toRatePercent(totals.completionCount, totals.totalRuns),
      conversionRatePercent: toRatePercent(totals.conversionCount, totals.totalRuns),
    },
    workflows: workflowAnalytics,
  };
}

export async function getAutomationWorkflowRuns(input: {
  organizationId: string;
  workflowId?: string;
  limit?: number;
}) {
  const parsed = z
    .object({
      organizationId: z.string().min(1),
      workflowId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    })
    .parse(input);

  await requireOrgMembership(parsed.organizationId);

  const baseConditions = [eq(automationWorkflowRuns.organizationId, parsed.organizationId)];

  if (parsed.workflowId) {
    baseConditions.push(eq(automationWorkflowRuns.workflowId, parsed.workflowId));
  }

  return db
    .select({
      run: automationWorkflowRuns,
      workflow: {
        id: automationWorkflows.id,
        name: automationWorkflows.name,
        mode: automationWorkflows.mode,
        status: automationWorkflows.status,
      },
    })
    .from(automationWorkflowRuns)
    .innerJoin(
      automationWorkflows,
      eq(automationWorkflowRuns.workflowId, automationWorkflows.id)
    )
    .where(and(...baseConditions))
    .orderBy(desc(automationWorkflowRuns.enteredAt))
    .limit(parsed.limit ?? 30);
}
