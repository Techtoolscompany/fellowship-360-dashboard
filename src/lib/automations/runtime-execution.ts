import { db } from "@/db";
import {
  aiConfig,
  appointments,
  automationDeadLetters,
  automationWorkflowRuns,
  automationWorkflows,
  broadcasts,
  churchContacts,
  contactTags,
  smsMessages,
  tasks,
  volunteers,
} from "@/db/schema";
import { and, eq, gte, inArray } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import sendMail from "@/lib/email/sendMail";
import { writeGraceAuditStreamSafe } from "@/lib/grace/audit-stream";
import { inngest } from "@/lib/inngest/client";
import {
  buildAutomationWorkflowRunExecutionIdempotencyKey,
  buildBroadcastSendIdempotencyKey,
  INNGEST_EVENTS,
} from "@/lib/inngest/events";
import {
  appendSystemConversationMessage,
  getOrCreateSystemConversation,
} from "@/lib/communications/system-conversations";
import { normalizeContactPhone } from "@/lib/operations/contacts-lifecycle";
import { sendOrganizationSms } from "@/lib/sms-gateway/send";
import { normalizeAutomationDefinition } from "./editor";
import { isWithinQuietHours } from "./policy";
import { computeDeadLetterRetryAt } from "./runtime-controls";
import type { AutomationDefinition, AutomationNode } from "./types";

export type AutomationRunSource =
  | "manual_trigger"
  | "event_trigger"
  | "dead_letter_replay";

type AutomationRunMetadata = {
  source: AutomationRunSource;
  metadata?: Record<string, unknown>;
  enrollment?: Record<string, unknown>;
  trace?: AutomationTraceEntry[];
  actionState?: AutomationActionState;
  deadLetterId?: string | null;
};

type AutomationTraceEntry = Record<string, unknown> & {
  key: string;
  at: string;
  event: string;
};

type AutomationActionState = {
  conversationIdsByChannel?: Partial<Record<"sms" | "email", string>>;
  lastActionAtByNode?: Record<string, string>;
  createdTaskIdsByNode?: Record<string, string[]>;
  outboundMessageIdsByNode?: Record<string, string>;
  smsGatewayMessageIdsByNode?: Record<string, string[]>;
};

type StepTools = {
  run: (id: string, fn: () => Promise<unknown>) => Promise<unknown>;
  sleep: (id: string, duration: string) => Promise<unknown>;
};

type StartAutomationWorkflowRunInput = {
  organizationId: string;
  workflow: typeof automationWorkflows.$inferSelect;
  contactId?: string;
  metadata?: Record<string, unknown>;
  enrollment?: Record<string, unknown>;
  source: AutomationRunSource;
  deadLetterId?: string;
};

function getNodeConfig(node: AutomationNode) {
  return (node.config ?? {}) as Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readRunMetadata(value: unknown): AutomationRunMetadata {
  const record = asRecord(value);
  const rawTrace = Array.isArray(record.trace) ? record.trace : [];
  return {
    source:
      record.source === "manual_trigger" ||
      record.source === "event_trigger" ||
      record.source === "dead_letter_replay"
        ? record.source
        : "event_trigger",
    metadata: asRecord(record.metadata),
    enrollment: asRecord(record.enrollment),
    trace: rawTrace
      .filter((entry): entry is AutomationTraceEntry => Boolean(entry && typeof entry === "object"))
      .map((entry) => ({
        ...entry,
        key: String(entry.key ?? ""),
        at: String(entry.at ?? new Date().toISOString()),
        event: String(entry.event ?? "trace"),
      })),
    actionState: asRecord(record.actionState) as AutomationActionState,
    deadLetterId: typeof record.deadLetterId === "string" ? record.deadLetterId : null,
  };
}

function appendTrace(
  metadata: AutomationRunMetadata,
  entry: Omit<AutomationTraceEntry, "at">
) {
  const trace = metadata.trace ?? [];
  if (trace.some((existing) => existing.key === entry.key)) {
    metadata.trace = trace;
    return;
  }

  metadata.trace = [
    ...trace,
    {
      ...(entry as Record<string, unknown>),
      at: new Date().toISOString(),
    } as AutomationTraceEntry,
  ];
}

function ensureActionState(metadata: AutomationRunMetadata) {
  const state = metadata.actionState ?? {};
  metadata.actionState = state;
  state.conversationIdsByChannel ??= {};
  state.lastActionAtByNode ??= {};
  state.createdTaskIdsByNode ??= {};
  state.outboundMessageIdsByNode ??= {};
  state.smsGatewayMessageIdsByNode ??= {};
  return state;
}

function stringifyMetadata(metadata: AutomationRunMetadata) {
  return {
    source: metadata.source,
    metadata: metadata.metadata ?? {},
    enrollment: metadata.enrollment ?? {},
    trace: metadata.trace ?? [],
    actionState: metadata.actionState ?? {},
    deadLetterId: metadata.deadLetterId ?? null,
  };
}

function getTemplateValue(
  input: Record<string, unknown>,
  path: string
): string | number | boolean | null {
  const parts = path.split(".");
  let current: unknown = input;
  for (const part of parts) {
    if (!current || typeof current !== "object") {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (
    typeof current === "string" ||
    typeof current === "number" ||
    typeof current === "boolean"
  ) {
    return current;
  }

  if (current instanceof Date) {
    return current.toISOString();
  }

  return null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function toHtmlEmailBody(value: string) {
  if (/<[a-z][\s\S]*>/i.test(value)) {
    return value;
  }
  return `<p>${escapeHtml(value).replaceAll("\n", "<br />")}</p>`;
}

function formatDate(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

function formatTime(value: unknown) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function resolveEventAnchorDate(metadata: Record<string, unknown>) {
  const raw =
    metadata.appointmentDateTime ??
    metadata.dateTime ??
    metadata.eventDateTime ??
    metadata.eventStartAt ??
    null;
  if (!raw) return null;
  const date = raw instanceof Date ? raw : new Date(String(raw));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function renderTemplateText(input: string, context: Record<string, unknown>) {
  const template = input.trim();
  if (!template) {
    return "";
  }

  return template.replace(/{{\s*([^}]+?)\s*}}/g, (_, rawExpression: string) => {
    const [token, ...filters] = rawExpression.split("|").map((part) => part.trim());
    const aliases: Record<string, string> = {
      first_name: "contact.firstName",
      last_name: "contact.lastName",
      contact_name: "contact.fullName",
      firstName: "contact.firstName",
      lastName: "contact.lastName",
      church_name: "church.name",
      appointment_date: "metadata.appointmentDate",
      appointment_time: "metadata.appointmentTime",
    };
    const resolved = getTemplateValue(context, aliases[token] ?? token);
    if (resolved !== null && String(resolved).trim().length > 0) {
      return String(resolved);
    }

    const defaultFilter = filters.find((filter) =>
      filter.toLowerCase().startsWith("default:")
    );
    if (defaultFilter) {
      const rawDefault = defaultFilter.slice("default:".length).trim();
      return rawDefault.replace(/^['"]|['"]$/g, "");
    }

    return "";
  });
}

function inferActionType(node: AutomationNode) {
  const config = getNodeConfig(node);
  if (typeof config.actionType === "string" && config.actionType.trim()) {
    return config.actionType.trim();
  }

  const label = node.label.trim().toLowerCase();
  if (label.includes("email")) return "send_email";
  if (label.includes("task") || label.includes("escalat") || label.includes("page")) {
    return "create_task";
  }
  if (label.includes("broadcast")) return "broadcast_send";
  return "send_sms";
}

function inferDefaultMessage(params: {
  workflowName: string;
  actionType: string;
  nodeLabel: string;
}) {
  if (params.actionType === "send_email") {
    return {
      subject: `${params.workflowName} update from {{church_name}}`,
      body:
        "Hi {{first_name}},\n\nThis is a follow-up from {{church_name}}. Reply to this email if we can help you take a next step.\n\n{{church_name}}",
    };
  }

  if (params.actionType === "create_task") {
    return {
      title: params.nodeLabel || `${params.workflowName} follow-up`,
      instructions:
        "Automation requested a manual follow-up because the contact still needs personal outreach.",
    };
  }

  return {
    message:
      "Hi {{first_name}}, this is a quick follow-up from {{church_name}}. Reply here if we can help with prayer, questions, or your next step.",
  };
}

function addDuration(date: Date, amount: number, unit: string, direction: "before" | "after") {
  const next = new Date(date);
  const multiplier = direction === "before" ? -1 : 1;
  if (unit === "minutes") next.setMinutes(next.getMinutes() + amount * multiplier);
  else if (unit === "hours") next.setHours(next.getHours() + amount * multiplier);
  else if (unit === "days") next.setDate(next.getDate() + amount * multiplier);
  else next.setDate(next.getDate() + amount * 7 * multiplier);
  return next;
}

function coercePositiveInteger(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return Math.max(1, Math.floor(numeric));
}

function parseRelativeDelayFromLabel(label: string, enteredAt: Date) {
  const lowered = label.toLowerCase();
  const waitMatch = /wait\s+(\d+)\s+(minute|minutes|hour|hours|day|days|week|weeks)/i.exec(label);
  if (waitMatch) {
    return {
      targetAt: addDuration(
        new Date(),
        Number(waitMatch[1]),
        waitMatch[2].toLowerCase().endsWith("s")
          ? waitMatch[2].toLowerCase()
          : `${waitMatch[2].toLowerCase()}s`,
        "after"
      ),
      reason: "label_relative",
    };
  }

  const dayMatch = /until day\s+(\d+)/i.exec(lowered);
  if (dayMatch) {
    return {
      targetAt: addDuration(enteredAt, Number(dayMatch[1]), "days", "after"),
      reason: "label_day_offset",
    };
  }

  return null;
}

function buildDurationString(ms: number) {
  const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
  if (totalSeconds % 604800 === 0) return `${totalSeconds / 604800}w`;
  if (totalSeconds % 86400 === 0) return `${totalSeconds / 86400}d`;
  if (totalSeconds % 3600 === 0) return `${totalSeconds / 3600}h`;
  if (totalSeconds % 60 === 0) return `${totalSeconds / 60}m`;
  return `${totalSeconds}s`;
}

function getQuietHoursResumeAt(params: {
  now: Date;
  quietHoursStart: string;
  quietHoursEnd: string;
}) {
  const [endHour, endMinute] = params.quietHoursEnd.split(":").map((part) => Number(part));
  if (!Number.isFinite(endHour) || !Number.isFinite(endMinute)) {
    return null;
  }

  const resumeAt = new Date(params.now);
  resumeAt.setHours(endHour, endMinute, 0, 0);
  if (resumeAt.getTime() <= params.now.getTime()) {
    resumeAt.setDate(resumeAt.getDate() + 1);
  }
  return resumeAt;
}

async function updateRunState(params: {
  runId: string;
  status: typeof automationWorkflowRuns.$inferSelect.status;
  currentNodeId?: string | null;
  currentNodeType?: string | null;
  lastError?: string | null;
  completedAt?: Date | null;
  exitedAt?: Date | null;
  metadata: AutomationRunMetadata;
}) {
  const [updated] = await db
    .update(automationWorkflowRuns)
    .set({
      status: params.status,
      currentNodeId: params.currentNodeId ?? null,
      currentNodeType: params.currentNodeType ?? null,
      lastError: params.lastError ?? null,
      metadataJson: stringifyMetadata(params.metadata),
      updatedAt: new Date(),
      completedAt: params.completedAt ?? null,
      exitedAt: params.exitedAt ?? null,
    })
    .where(eq(automationWorkflowRuns.id, params.runId))
    .returning();

  return updated;
}

async function createOrUpdateDeadLetter(params: {
  run: typeof automationWorkflowRuns.$inferSelect;
  workflow: typeof automationWorkflows.$inferSelect;
  metadata: AutomationRunMetadata;
  errorMessage: string;
}) {
  const now = new Date();
  const existingDeadLetterId = params.metadata.deadLetterId ?? null;
  const payloadJson = {
    source: params.metadata.source,
    triggerEvent:
      typeof params.metadata.metadata?.triggerEvent === "string"
        ? params.metadata.metadata.triggerEvent
        : params.workflow.triggerEvent,
    metadata: params.metadata.metadata ?? {},
    runId: params.run.id,
  } satisfies Record<string, unknown>;

  if (existingDeadLetterId) {
    const [existing] = await db
      .select({ attemptCount: automationDeadLetters.attemptCount })
      .from(automationDeadLetters)
      .where(eq(automationDeadLetters.id, existingDeadLetterId))
      .limit(1);

    const nextAttemptCount = Number(existing?.attemptCount ?? 0) + 1;
    const [updated] = await db
      .update(automationDeadLetters)
      .set({
        status: "pending",
        attemptCount: nextAttemptCount,
        lastError: params.errorMessage,
        runId: params.run.id,
        contactId: params.run.contactId ?? null,
        triggerEvent:
          typeof params.metadata.metadata?.triggerEvent === "string"
            ? params.metadata.metadata.triggerEvent
            : params.workflow.triggerEvent,
        source: params.metadata.source,
        payloadJson,
        lastFailedAt: now,
        nextRetryAt: computeDeadLetterRetryAt({
          attemptCount: nextAttemptCount,
          now,
        }),
        resolvedAt: null,
        resolutionNote: null,
        updatedAt: now,
      })
      .where(eq(automationDeadLetters.id, existingDeadLetterId))
      .returning();

    return updated ?? null;
  }

  const [created] = await db
    .insert(automationDeadLetters)
    .values({
      organizationId: params.run.organizationId,
      workflowId: params.run.workflowId,
      runId: params.run.id,
      contactId: params.run.contactId ?? null,
      triggerEvent:
        typeof params.metadata.metadata?.triggerEvent === "string"
          ? params.metadata.metadata.triggerEvent
          : params.workflow.triggerEvent,
      source: params.metadata.source,
      status: "pending",
      attemptCount: 1,
      lastError: params.errorMessage,
      payloadJson,
      firstFailedAt: now,
      lastFailedAt: now,
      nextRetryAt: computeDeadLetterRetryAt({
        attemptCount: 1,
        now,
      }),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created ?? null;
}

async function markDeadLetterResolved(params: {
  deadLetterId: string;
  organizationId: string;
  note: string;
}) {
  await db
    .update(automationDeadLetters)
    .set({
      status: "replayed",
      resolvedAt: new Date(),
      resolutionNote: params.note,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(automationDeadLetters.id, params.deadLetterId),
        eq(automationDeadLetters.organizationId, params.organizationId)
      )
    );
}

async function queueBroadcastAction(params: {
  organizationId: string;
  workflowId: string;
  runId: string;
  nodeId: string;
  broadcastId: string;
}) {
  const [broadcast] = await db
    .select({
      id: broadcasts.id,
      title: broadcasts.title,
      status: broadcasts.status,
    })
    .from(broadcasts)
    .where(
      and(
        eq(broadcasts.organizationId, params.organizationId),
        eq(broadcasts.id, params.broadcastId)
      )
    )
    .limit(1);

  if (!broadcast) {
    throw new Error("Broadcast not found in organization scope");
  }

  if (broadcast.status !== "draft" && broadcast.status !== "scheduled") {
    throw new Error(`Broadcast status "${broadcast.status}" is not sendable`);
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

async function resolveDelayTarget(params: {
  node: AutomationNode;
  enteredAt: Date;
  metadata: Record<string, unknown>;
}) {
  const config = getNodeConfig(params.node);
  const labelFallback = parseRelativeDelayFromLabel(params.node.label, params.enteredAt);
  const relativeTo =
    typeof config.relativeTo === "string" ? config.relativeTo.trim() : null;
  const direction =
    String(config.offsetDirection ?? config.direction ?? "after") === "before"
      ? "before"
      : "after";

  if (relativeTo === "workflow_start" && typeof config.amount !== "undefined") {
    return {
      targetAt: addDuration(
        params.enteredAt,
        coercePositiveInteger(config.amount, 1),
        String(config.unit ?? "days"),
        direction
      ),
      reason: "config_workflow_start",
    };
  }

  if (relativeTo === "event_start") {
    const anchor = resolveEventAnchorDate(params.metadata);
    if (anchor) {
      return {
        targetAt: addDuration(
          anchor,
          coercePositiveInteger(config.amount, 1),
          String(config.unit ?? "hours"),
          direction
        ),
        reason: "config_event_start",
      };
    }
  }

  const anchorFieldCandidates = [
    config.anchorField,
    config.metadataField,
    config.referenceField,
    config.waitUntilField,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (anchorFieldCandidates.length > 0) {
    const anchorRaw = getTemplateValue({ metadata: params.metadata }, `metadata.${anchorFieldCandidates[0]}`);
    if (anchorRaw) {
      const anchor = new Date(String(anchorRaw));
      if (!Number.isNaN(anchor.getTime())) {
        const amount = coercePositiveInteger(
          config.offsetAmount ?? config.amount ?? 0,
          0
        );
        const unit = String(config.offsetUnit ?? config.unit ?? "hours");
        return {
          targetAt:
            amount > 0 ? addDuration(anchor, amount, unit, direction) : anchor,
          reason: "config_anchor",
        };
      }
    }
  }

  if (typeof config.amount !== "undefined") {
    const amount = coercePositiveInteger(config.amount, 1);
    const unit = String(config.unit ?? "days");
    return {
      targetAt: addDuration(new Date(), amount, unit, "after"),
      reason: "config_relative",
    };
  }

  if (/t-\d+/i.test(params.node.label)) {
    const hoursMatch = /t-(\d+)/i.exec(params.node.label);
    const anchorRaw =
      getTemplateValue({ metadata: params.metadata }, "metadata.appointmentDateTime") ??
      getTemplateValue({ metadata: params.metadata }, "metadata.dateTime") ??
      getTemplateValue({ metadata: params.metadata }, "metadata.eventDateTime");
    if (hoursMatch && anchorRaw) {
      const anchor = new Date(String(anchorRaw));
      if (!Number.isNaN(anchor.getTime())) {
        return {
          targetAt: addDuration(anchor, Number(hoursMatch[1]), "hours", "before"),
          reason: "label_anchor_hours_before",
        };
      }
    }
  }

  if (/hours before event/i.test(params.node.label)) {
    const hoursMatch = /(\d+)\s+hours before/i.exec(params.node.label);
    const anchorRaw =
      getTemplateValue({ metadata: params.metadata }, "metadata.eventDateTime") ??
      getTemplateValue({ metadata: params.metadata }, "metadata.dateTime");
    if (hoursMatch && anchorRaw) {
      const anchor = new Date(String(anchorRaw));
      if (!Number.isNaN(anchor.getTime())) {
        return {
          targetAt: addDuration(anchor, Number(hoursMatch[1]), "hours", "before"),
          reason: "label_event_hours_before",
        };
      }
    }
  }

  return labelFallback;
}

async function evaluateCondition(params: {
  node: AutomationNode;
  run: typeof automationWorkflowRuns.$inferSelect;
  workflow: typeof automationWorkflows.$inferSelect;
  contact: typeof churchContacts.$inferSelect | null;
  metadata: AutomationRunMetadata;
}) {
  const config = getNodeConfig(params.node);
  const type =
    typeof config.conditionType === "string" && config.conditionType.trim().length > 0
      ? config.conditionType.trim()
      : inferConditionTypeFromLabel(params.node.label);
  const matchValue =
    typeof config.matchValue === "string" || typeof config.matchValue === "number"
      ? String(config.matchValue)
      : null;

  if (type === "contact_replied") {
    return {
      matched: await hasContactReplySince(params),
      reason: "contact_replied",
    };
  }

  if (type === "engaged") {
    return {
      matched: await hasContactEngagedSince(params),
      reason: "engaged",
    };
  }

  if (type === "task_completed") {
    return {
      matched: await hasTrackedTaskCompleted({
        run: params.run,
        metadata: params.metadata,
        nodeId:
          typeof config.taskNodeId === "string" && config.taskNodeId.trim().length > 0
            ? config.taskNodeId
            : null,
      }),
      reason: "task_completed",
    };
  }

  if (type === "field_matches") {
    return {
      matched: await doesContactFieldMatch({
        contact: params.contact,
        contactId: params.run.contactId ?? null,
        fieldKey:
          typeof config.fieldKey === "string" && config.fieldKey.trim().length > 0
            ? config.fieldKey
            : "memberStatus",
        matchValue: matchValue ?? "",
        metadata: params.metadata.metadata ?? {},
      }),
      reason: "field_matches",
    };
  }

  if (type === "appointment_status") {
    return {
      matched: await doesAppointmentMatchStatus({
        appointmentId:
          typeof params.metadata.metadata?.appointmentId === "string"
            ? params.metadata.metadata.appointmentId
            : null,
        expectedStatus: matchValue ?? "no_show",
      }),
      reason: "appointment_status",
    };
  }

  if (type === "metadata_matches") {
    return {
      matched: doesMetadataMatch({
        metadata: params.metadata.metadata ?? {},
        fieldKey:
          typeof config.fieldKey === "string" && config.fieldKey.trim().length > 0
            ? config.fieldKey
            : "urgency",
        matchValue: matchValue ?? "",
      }),
      reason: "metadata_matches",
    };
  }

  if (type === "manual_review") {
    const approved =
      params.metadata.metadata?.manualReviewApproved === true ||
      params.metadata.metadata?.[`manualReviewApproved:${params.node.id}`] === true;
    return {
      matched: approved,
      reason: "manual_review",
    };
  }

  if (type === "email_opened") {
    const opened =
      params.metadata.metadata?.emailOpened === true ||
      params.metadata.metadata?.[`emailOpened:${params.node.id}`] === true;
    return {
      matched: opened,
      reason: "email_opened",
    };
  }

  return {
    matched: false,
    reason: type || "unsupported_condition",
  };
}

function inferConditionTypeFromLabel(label: string) {
  const lowered = label.trim().toLowerCase();
  if (lowered.includes("no-show")) return "appointment_status";
  if (lowered.includes("urgency")) return "metadata_matches";
  if (lowered.includes("reply")) return "contact_replied";
  if (lowered.includes("engaged")) return "engaged";
  if (lowered.includes("acknowledged")) return "contact_replied";
  if (lowered.includes("attendance confirmed")) return "metadata_matches";
  return "contact_replied";
}

async function hasContactReplySince(params: {
  run: typeof automationWorkflowRuns.$inferSelect;
  contact: typeof churchContacts.$inferSelect | null;
}) {
  if (!params.run.contactId) {
    return false;
  }

  const contactPhone = normalizeContactPhone(params.contact?.phone ?? null);
  if (!contactPhone) {
    return false;
  }

  const smsReplies = await db
    .select({ id: smsMessages.id, fromNumber: smsMessages.fromNumber })
    .from(smsMessages)
    .where(
      and(
        eq(smsMessages.organizationId, params.run.organizationId),
        eq(smsMessages.direction, "inbound"),
        gte(smsMessages.createdAt, params.run.enteredAt)
      )
    )
    .limit(200);

  const contactSuffix =
    contactPhone.length > 10 ? contactPhone.slice(-10) : contactPhone;
  return smsReplies.some((reply) => {
    const normalizedFrom = normalizeContactPhone(reply.fromNumber ?? null);
    if (!normalizedFrom) return false;
    const fromSuffix =
      normalizedFrom.length > 10 ? normalizedFrom.slice(-10) : normalizedFrom;
    return fromSuffix === contactSuffix;
  });
}

async function hasContactEngagedSince(params: {
  run: typeof automationWorkflowRuns.$inferSelect;
  contact: typeof churchContacts.$inferSelect | null;
}) {
  const replied = await hasContactReplySince({
    run: params.run,
    contact: params.contact,
  });
  if (replied) {
    return true;
  }

  if (params.run.contactId) {
    const [appointment] = await db
      .select({ id: appointments.id })
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, params.run.organizationId),
          eq(appointments.contactId, params.run.contactId),
          gte(appointments.createdAt, params.run.enteredAt)
        )
      )
      .limit(1);
    if (appointment) {
      return true;
    }

    const [volunteer] = await db
      .select({ id: volunteers.id })
      .from(volunteers)
      .where(
        and(
          eq(volunteers.organizationId, params.run.organizationId),
          eq(volunteers.contactId, params.run.contactId),
          gte(volunteers.joinedAt, params.run.enteredAt)
        )
      )
      .limit(1);
    if (volunteer) {
      return true;
    }
  }

  const status = params.contact?.memberStatus ?? "";
  return ["regular_attendee", "member", "leader"].includes(status);
}

async function hasTrackedTaskCompleted(params: {
  run: typeof automationWorkflowRuns.$inferSelect;
  metadata: AutomationRunMetadata;
  nodeId: string | null;
}) {
  const actionState = ensureActionState(params.metadata);
  const grouped = actionState.createdTaskIdsByNode ?? {};
  const taskIds = params.nodeId
    ? grouped[params.nodeId] ?? []
    : Object.values(grouped).flat();

  if (taskIds.length === 0) {
    return false;
  }

  const rows = await db
    .select({ id: tasks.id, status: tasks.status })
    .from(tasks)
    .where(
      and(
        eq(tasks.organizationId, params.run.organizationId),
        inArray(tasks.id, taskIds)
      )
    );

  return rows.some((row) => taskIds.includes(row.id) && row.status === "done");
}

async function doesContactFieldMatch(params: {
  contactId: string | null;
  contact: typeof churchContacts.$inferSelect | null;
  fieldKey: string;
  matchValue: string;
  metadata: Record<string, unknown>;
}) {
  if (!params.contactId) {
    return doesMetadataMatch({
      metadata: params.metadata,
      fieldKey: params.fieldKey,
      matchValue: params.matchValue,
    });
  }

  const normalizedMatch = params.matchValue.trim().toLowerCase();
  if (params.fieldKey === "tag" || params.fieldKey === "tags") {
    const rows = await db
      .select({ tag: contactTags.tag })
      .from(contactTags)
      .where(eq(contactTags.contactId, params.contactId));
    return rows.some((row) => row.tag.trim().toLowerCase() === normalizedMatch);
  }

  const value =
    params.contact &&
    params.fieldKey in params.contact &&
    typeof params.contact[params.fieldKey as keyof typeof params.contact] !== "undefined"
      ? params.contact[params.fieldKey as keyof typeof params.contact]
      : null;

  if (String(value ?? "").trim().toLowerCase() === normalizedMatch) {
    return true;
  }

  if (params.fieldKey === "status" || params.fieldKey === "appointmentStatus") {
    return doesAppointmentMatchStatus({
      appointmentId:
        typeof params.metadata.appointmentId === "string"
          ? params.metadata.appointmentId
          : null,
      expectedStatus: params.matchValue,
    });
  }

  return doesMetadataMatch({
    metadata: params.metadata,
    fieldKey: params.fieldKey,
    matchValue: params.matchValue,
  });
}

async function doesAppointmentMatchStatus(params: {
  appointmentId: string | null;
  expectedStatus: string;
}) {
  if (!params.appointmentId) {
    return false;
  }

  const [appointment] = await db
    .select({ status: appointments.status })
    .from(appointments)
    .where(eq(appointments.id, params.appointmentId))
    .limit(1);

  return appointment?.status === params.expectedStatus;
}

function doesMetadataMatch(params: {
  metadata: Record<string, unknown>;
  fieldKey: string;
  matchValue: string;
}) {
  const actual = getTemplateValue({ metadata: params.metadata }, `metadata.${params.fieldKey}`);
  return String(actual ?? "").trim().toLowerCase() === params.matchValue.trim().toLowerCase();
}

async function fetchRunExecutionContext(runId: string) {
  const [row] = await db
    .select({
      run: automationWorkflowRuns,
      workflow: automationWorkflows,
      contact: churchContacts,
      churchName: aiConfig.churchName,
    })
    .from(automationWorkflowRuns)
    .innerJoin(automationWorkflows, eq(automationWorkflowRuns.workflowId, automationWorkflows.id))
    .leftJoin(churchContacts, eq(automationWorkflowRuns.contactId, churchContacts.id))
    .leftJoin(aiConfig, eq(automationWorkflowRuns.organizationId, aiConfig.organizationId))
    .where(eq(automationWorkflowRuns.id, runId))
    .limit(1);

  if (!row) {
    throw new NonRetriableError(`Automation workflow run not found: ${runId}`);
  }

  return {
    run: row.run,
    workflow: row.workflow,
    contact: row.contact ?? null,
    churchName: row.churchName ?? "your church",
  };
}

export async function startAutomationWorkflowRun(input: StartAutomationWorkflowRunInput) {
  const definition = normalizeAutomationDefinition(
    input.workflow.definitionJson as AutomationDefinition
  );
  const startNodeId =
    definition.startNodeId ?? definition.nodes.find((node) => node.type === "trigger")?.id;

  if (!startNodeId) {
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
      metadataJson: stringifyMetadata({
        source: input.source,
        metadata: input.metadata ?? {},
        enrollment: input.enrollment ?? {},
        deadLetterId: input.deadLetterId ?? null,
        trace: [],
        actionState: {},
      }),
    })
    .returning();

  const idempotencyKey = buildAutomationWorkflowRunExecutionIdempotencyKey({
    organizationId: input.organizationId,
    workflowId: input.workflow.id,
    runId: createdRun.id,
  });

  try {
    await inngest.send({
      id: idempotencyKey,
      name: INNGEST_EVENTS.AUTOMATION_WORKFLOW_RUN_REQUESTED,
      data: {
        organizationId: input.organizationId,
        workflowId: input.workflow.id,
        runId: createdRun.id,
        source: input.source,
        deadLetterId: input.deadLetterId ?? null,
        idempotencyKey,
      },
    });
  } catch (error) {
    await db
      .update(automationWorkflowRuns)
      .set({
        status: "failed",
        lastError:
          error instanceof Error ? error.message : "automation_run_queue_failed",
        updatedAt: new Date(),
      })
      .where(eq(automationWorkflowRuns.id, createdRun.id));
    throw error;
  }

  return createdRun;
}

async function executeAction(params: {
  node: AutomationNode;
  run: typeof automationWorkflowRuns.$inferSelect;
  workflow: typeof automationWorkflows.$inferSelect;
  contact: typeof churchContacts.$inferSelect | null;
  metadata: AutomationRunMetadata;
  churchName: string;
}) {
  const config = getNodeConfig(params.node);
  const actionType = inferActionType(params.node);
  const defaults = inferDefaultMessage({
    workflowName: params.workflow.name,
    actionType,
    nodeLabel: params.node.label,
  });

  const context = {
    contact: {
      firstName: params.contact?.firstName ?? "there",
      lastName: params.contact?.lastName ?? "",
      fullName: `${params.contact?.firstName ?? ""} ${params.contact?.lastName ?? ""}`.trim(),
      email: params.contact?.email ?? "",
      phone: params.contact?.phone ?? "",
      memberStatus: params.contact?.memberStatus ?? "",
    },
    church: {
      name: params.churchName,
    },
    metadata: {
      ...(params.metadata.metadata ?? {}),
      appointmentDate: formatDate(
        params.metadata.metadata?.appointmentDateTime ??
          params.metadata.metadata?.dateTime ??
          params.metadata.metadata?.eventDateTime
      ),
      appointmentTime: formatTime(
        params.metadata.metadata?.appointmentDateTime ??
          params.metadata.metadata?.dateTime ??
          params.metadata.metadata?.eventDateTime
      ),
    },
    workflow: {
      name: params.workflow.name,
    },
  } satisfies Record<string, unknown>;

  const actionState = ensureActionState(params.metadata);
  const subjectBase = `${params.workflow.name} automation`;

  if (actionType === "send_sms") {
    const recipient =
      (typeof config.toPhone === "string" && config.toPhone.trim()) ||
      params.contact?.phone;
    const to = normalizeContactPhone(recipient ?? null);
    if (!to) {
      throw new Error(`Action node ${params.node.id} is missing an SMS recipient`);
    }

    const messageText = renderTemplateText(
      String(config.messageText ?? defaults.message ?? ""),
      context
    );
    if (!messageText.trim()) {
      throw new Error(`Action node ${params.node.id} is missing SMS content`);
    }

    const sendResult = await sendOrganizationSms({
      organizationId: params.run.organizationId,
      to,
      message: messageText,
      idempotencyKey: `automation:${params.run.id}:node:${params.node.id}:sms`,
      metadataJson: {
        automationRunId: params.run.id,
        workflowId: params.workflow.id,
        nodeId: params.node.id,
        contactId: params.run.contactId ?? null,
      },
    });

    if (!sendResult.success) {
      throw new Error(sendResult.error ?? "SMS delivery failed");
    }

    const channel = "sms" as const;
    const conversationId =
      actionState.conversationIdsByChannel?.[channel] ??
      (await getOrCreateSystemConversation({
        organizationId: params.run.organizationId,
        contactId: params.run.contactId ?? null,
        channel,
        subject: `${subjectBase} SMS`,
      }));

    const messageLog = await appendSystemConversationMessage({
      organizationId: params.run.organizationId,
      conversationId,
      contactId: params.run.contactId ?? null,
      channel,
      subject: `${subjectBase} SMS`,
      content: messageText,
      direction: "outbound",
      senderType: "system",
    });

    actionState.conversationIdsByChannel![channel] = conversationId;
    actionState.outboundMessageIdsByNode![params.node.id] = messageLog.messageId;
    actionState.smsGatewayMessageIdsByNode![params.node.id] = sendResult.messageIds;
    actionState.lastActionAtByNode![params.node.id] = new Date().toISOString();

    return {
      actionType,
      recipient: to,
      messageId: messageLog.messageId,
      gatewayMessageIds: sendResult.messageIds,
    };
  }

  if (actionType === "send_email") {
    const recipient =
      (typeof config.toEmail === "string" && config.toEmail.trim()) ||
      params.contact?.email;
    const to = String(recipient ?? "").trim().toLowerCase();
    if (!to) {
      throw new Error(`Action node ${params.node.id} is missing an email recipient`);
    }

    const subject = renderTemplateText(
      String(config.emailSubject ?? defaults.subject ?? `${params.workflow.name} from {{church_name}}`),
      context
    );
    const bodyText = renderTemplateText(
      String(config.emailBody ?? defaults.body ?? ""),
      context
    );
    if (!subject.trim() || !bodyText.trim()) {
      throw new Error(`Action node ${params.node.id} is missing email content`);
    }

    const emailResult = await sendMail(to, subject, toHtmlEmailBody(bodyText));
    const channel = "email" as const;
    const conversationId =
      actionState.conversationIdsByChannel?.[channel] ??
      (await getOrCreateSystemConversation({
        organizationId: params.run.organizationId,
        contactId: params.run.contactId ?? null,
        channel,
        subject,
      }));

    const messageLog = await appendSystemConversationMessage({
      organizationId: params.run.organizationId,
      conversationId,
      contactId: params.run.contactId ?? null,
      channel,
      subject,
      content: bodyText,
      direction: "outbound",
      senderType: "system",
    });

    actionState.conversationIdsByChannel![channel] = conversationId;
    actionState.outboundMessageIdsByNode![params.node.id] = messageLog.messageId;
    actionState.lastActionAtByNode![params.node.id] = new Date().toISOString();

    return {
      actionType,
      recipient: to,
      providerMessageId: emailResult.id,
      mocked: emailResult.mocked,
      messageId: messageLog.messageId,
    };
  }

  if (actionType === "create_task") {
    const title = renderTemplateText(
      String(config.taskTitle ?? defaults.title ?? params.node.label),
      context
    );
    const description = renderTemplateText(
      String(config.taskInstructions ?? defaults.instructions ?? ""),
      context
    );

    const dueAt = typeof config.dueInDays !== "undefined"
      ? addDuration(new Date(), coercePositiveInteger(config.dueInDays, 1), "days", "after")
      : null;

    const [task] = await db
      .insert(tasks)
      .values({
        organizationId: params.run.organizationId,
        title,
        description: description || null,
        status: "todo",
        priority:
          typeof config.taskPriority === "string" &&
          ["low", "medium", "high", "urgent"].includes(config.taskPriority)
            ? (config.taskPriority as "low" | "medium" | "high" | "urgent")
            : "medium",
        dueDate: dueAt,
      })
      .returning({ id: tasks.id });

    const existingTaskIds = actionState.createdTaskIdsByNode![params.node.id] ?? [];
    actionState.createdTaskIdsByNode![params.node.id] = [...existingTaskIds, task.id];
    actionState.lastActionAtByNode![params.node.id] = new Date().toISOString();

    return {
      actionType,
      taskId: task.id,
    };
  }

  if (actionType === "broadcast_send") {
    const broadcastId = String(config.broadcastId ?? "").trim();
    if (!broadcastId) {
      throw new Error(`Action node ${params.node.id} is missing a broadcastId`);
    }
    const queued = await queueBroadcastAction({
      organizationId: params.run.organizationId,
      workflowId: params.workflow.id,
      runId: params.run.id,
      nodeId: params.node.id,
      broadcastId,
    });
    actionState.lastActionAtByNode![params.node.id] = new Date().toISOString();
    return {
      actionType,
      ...queued,
    };
  }

  actionState.lastActionAtByNode![params.node.id] = new Date().toISOString();
  return {
    actionType,
    skipped: true,
  };
}

export async function executeAutomationWorkflowRunById(params: {
  runId: string;
  step: StepTools;
}) {
  const { run: existingRun, workflow, contact, churchName } =
    await fetchRunExecutionContext(params.runId);

  if (["completed", "failed", "exited"].includes(existingRun.status)) {
    const metadata = readRunMetadata(existingRun.metadataJson);
    return {
      run: existingRun,
      metadata,
      deadLetterId: typeof metadata.deadLetterId === "string" ? metadata.deadLetterId : null,
    };
  }

  if (workflow.status !== "published" && workflow.status !== "draft") {
    throw new NonRetriableError(`Workflow ${workflow.id} is not executable in status ${workflow.status}`);
  }

  const definition = normalizeAutomationDefinition(
    workflow.definitionJson as AutomationDefinition
  );
  const nodesById = new Map(definition.nodes.map((node) => [node.id, node]));
  const metadata = readRunMetadata(existingRun.metadataJson);
  ensureActionState(metadata);
  let run = existingRun;
  let currentNodeId =
    existingRun.currentNodeId ??
    definition.startNodeId ??
    definition.nodes.find((node) => node.type === "trigger")?.id ??
    null;
  let currentNodeType: string | null = existingRun.currentNodeType ?? null;
  let status: typeof automationWorkflowRuns.$inferSelect.status = "running";
  let lastError: string | null = null;

  try {
    for (let guard = 0; guard < 200; guard += 1) {
      if (!currentNodeId) {
        status = "exited";
        appendTrace(metadata, {
          key: "run:exit:missing_next_node",
          event: "exit",
          reason: "missing_next_node",
        });
        break;
      }

      const node = nodesById.get(currentNodeId);
      if (!node) {
        throw new Error(`Node "${currentNodeId}" no longer exists`);
      }

      currentNodeType = node.type;
      run = await updateRunState({
        runId: run.id,
        status: "running",
        currentNodeId: node.id,
        currentNodeType: node.type,
        metadata,
      });

      appendTrace(metadata, {
        key: `node_enter:${node.id}`,
        event: "node_enter",
        nodeId: node.id,
        nodeType: node.type,
      });

      if (node.type === "trigger") {
        currentNodeId = node.nextIds?.[0] ?? null;
        continue;
      }

      if (node.type === "stop") {
        status = "completed";
        currentNodeId = node.id;
        appendTrace(metadata, {
          key: `node_stop:${node.id}`,
          event: "stop",
          nodeId: node.id,
        });
        break;
      }

      if (node.type === "delay") {
        const resolved = await resolveDelayTarget({
          node,
          enteredAt: run.enteredAt,
          metadata: metadata.metadata ?? {},
        });

        if (resolved?.targetAt && resolved.targetAt.getTime() > Date.now()) {
          appendTrace(metadata, {
            key: `delay_wait:${node.id}`,
            event: "delay_wait",
            nodeId: node.id,
            targetAt: resolved.targetAt.toISOString(),
            reason: resolved.reason,
          });
          await params.step.sleep(
            `automation-delay-${run.id}-${node.id}`,
            buildDurationString(resolved.targetAt.getTime() - Date.now())
          );
        }

        appendTrace(metadata, {
          key: `delay_complete:${node.id}`,
          event: "delay_complete",
          nodeId: node.id,
        });
        currentNodeId = node.nextIds?.[0] ?? null;
        continue;
      }

      if (node.type === "condition") {
        const decision = (await params.step.run(
          `automation-condition-${run.id}-${node.id}`,
          async () =>
            evaluateCondition({
              node,
              run,
              workflow,
              contact,
              metadata,
            })
        )) as { matched: boolean; reason: string };

        currentNodeId = node.nextIds?.[decision.matched ? 0 : 1] ?? node.nextIds?.[0] ?? null;
        appendTrace(metadata, {
          key: `condition:${node.id}`,
          event: "condition_evaluated",
          nodeId: node.id,
          matched: decision.matched,
          reason: decision.reason,
          nextNodeId: currentNodeId,
        });
        continue;
      }

      if (node.type === "action") {
        const actionType = inferActionType(node);
        const now = new Date();
        if (
          ["send_sms", "send_email", "broadcast_send"].includes(actionType) &&
          isWithinQuietHours({
            now,
            quietHoursEnabled: workflow.quietHoursEnabled,
            quietHoursStart: workflow.quietHoursStart,
            quietHoursEnd: workflow.quietHoursEnd,
          })
        ) {
          const resumeAt = getQuietHoursResumeAt({
            now,
            quietHoursStart: workflow.quietHoursStart,
            quietHoursEnd: workflow.quietHoursEnd,
          });
          if (resumeAt && resumeAt.getTime() > now.getTime()) {
            appendTrace(metadata, {
              key: `quiet_hours_wait:${node.id}`,
              event: "quiet_hours_wait",
              nodeId: node.id,
              resumeAt: resumeAt.toISOString(),
            });
            await params.step.sleep(
              `automation-quiet-hours-${run.id}-${node.id}`,
              buildDurationString(resumeAt.getTime() - now.getTime())
            );
          }
        }

        const actionResult = await params.step.run(
          `automation-action-${run.id}-${node.id}`,
          async () =>
            executeAction({
              node,
              run,
              workflow,
              contact,
              metadata,
              churchName,
            })
        );

        appendTrace(metadata, {
          key: `action:${node.id}`,
          event: "action_executed",
          nodeId: node.id,
          actionType,
          ...asRecord(actionResult),
        });
        currentNodeId = node.nextIds?.[0] ?? null;
        continue;
      }
    }

    if (status === "running") {
      status = "failed";
      lastError = "step_limit_reached";
    }
  } catch (error) {
    status = "failed";
    lastError = error instanceof Error ? error.message : "automation_workflow_run_failed";
    appendTrace(metadata, {
      key: `run_error:${run.id}`,
      event: "error",
      reason: lastError,
    });
  }

  const finalizedRun = await updateRunState({
    runId: run.id,
    status,
    currentNodeId,
    currentNodeType,
    lastError,
    completedAt: status === "completed" ? new Date() : null,
    exitedAt: status === "exited" ? new Date() : null,
    metadata,
  });

  let deadLetterId = metadata.deadLetterId ?? null;
  if (status === "failed") {
    const deadLetter = await createOrUpdateDeadLetter({
      run: finalizedRun,
      workflow,
      metadata,
      errorMessage: lastError ?? "automation_workflow_run_failed",
    });
    deadLetterId = deadLetter?.id ?? deadLetterId;
  } else if (deadLetterId && (status === "completed" || status === "exited")) {
    await markDeadLetterResolved({
      deadLetterId,
      organizationId: finalizedRun.organizationId,
      note: `run_${status}`,
    });
  }

  await writeGraceAuditStreamSafe({
    organizationId: finalizedRun.organizationId,
    workflowId: finalizedRun.workflowId,
    workflowRunId: finalizedRun.id,
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
      workflowId: finalizedRun.workflowId,
      source: metadata.source,
      runStatus: status,
      deadLetterId,
      traceLength: metadata.trace?.length ?? 0,
      contactId: finalizedRun.contactId ?? null,
    },
  });

  return {
    run: finalizedRun,
    metadata,
    deadLetterId,
  };
}
