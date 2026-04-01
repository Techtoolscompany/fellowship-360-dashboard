import { db } from "@/db";
import { graceAuditStream } from "@/db/schema/grace-audit-stream";
import type { GraceActorType, GraceChannel } from "./types";

type AuditUsage = {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
};

export type WriteGraceAuditStreamInput = {
  organizationId: string;
  eventType: "ai_decision" | "action_execution" | "workflow_execution";
  source: "grace_router" | "grace_executor" | "automation_runtime";
  status: "success" | "error" | "queued" | "blocked" | "skipped";
  actorType?: GraceActorType;
  channel?: GraceChannel;
  sessionId?: string | null;
  workflowId?: string | null;
  workflowRunId?: string | null;
  intent?: string | null;
  toolName?: string | null;
  actionName?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  estimatedCostUsd?: number | null;
  errorText?: string | null;
  metadataJson?: Record<string, unknown>;
};

const DEFAULT_INPUT_COST_PER_MILLION_USD = 0.35;
const DEFAULT_OUTPUT_COST_PER_MILLION_USD = 1.05;

function resolveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function estimateModelCostUsd(params: {
  inputTokens?: number | null;
  outputTokens?: number | null;
}) {
  const inputTokens = Number(params.inputTokens ?? 0);
  const outputTokens = Number(params.outputTokens ?? 0);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) return null;
  if (inputTokens <= 0 && outputTokens <= 0) return 0;

  const inputRate = resolveNumber(
    process.env.GRACE_MODEL_INPUT_COST_PER_MILLION_USD,
    DEFAULT_INPUT_COST_PER_MILLION_USD
  );
  const outputRate = resolveNumber(
    process.env.GRACE_MODEL_OUTPUT_COST_PER_MILLION_USD,
    DEFAULT_OUTPUT_COST_PER_MILLION_USD
  );

  const cost = (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
  return Number(cost.toFixed(8));
}

export function normalizeAuditUsage(usage: unknown): AuditUsage {
  if (!usage || typeof usage !== "object") return {};
  const raw = usage as Record<string, unknown>;

  const inputTokensRaw =
    raw.promptTokens ?? raw.inputTokens ?? raw.prompt_tokens ?? raw.input_tokens ?? null;
  const outputTokensRaw =
    raw.completionTokens ??
    raw.outputTokens ??
    raw.completion_tokens ??
    raw.output_tokens ??
    null;
  const totalTokensRaw = raw.totalTokens ?? raw.total_tokens ?? null;

  const inputTokens = Number(inputTokensRaw);
  const outputTokens = Number(outputTokensRaw);
  const totalTokens = Number(totalTokensRaw);

  const safeInput = Number.isFinite(inputTokens) ? Math.max(0, Math.floor(inputTokens)) : null;
  const safeOutput = Number.isFinite(outputTokens)
    ? Math.max(0, Math.floor(outputTokens))
    : null;

  let safeTotal = Number.isFinite(totalTokens) ? Math.max(0, Math.floor(totalTokens)) : null;
  if (safeTotal === null && (safeInput !== null || safeOutput !== null)) {
    safeTotal = Number(safeInput ?? 0) + Number(safeOutput ?? 0);
  }

  return {
    inputTokens: safeInput,
    outputTokens: safeOutput,
    totalTokens: safeTotal,
  };
}

export async function writeGraceAuditStream(input: WriteGraceAuditStreamInput) {
  const payload: typeof graceAuditStream.$inferInsert = {
    organizationId: input.organizationId,
    sessionId: input.sessionId ?? null,
    workflowId: input.workflowId ?? null,
    workflowRunId: input.workflowRunId ?? null,
    eventType: input.eventType,
    source: input.source,
    status: input.status,
    actorType: input.actorType ?? "system",
    channel: input.channel,
    intent: input.intent ?? null,
    toolName: input.toolName ?? null,
    actionName: input.actionName ?? null,
    model: input.model ?? null,
    latencyMs:
      input.latencyMs !== undefined && input.latencyMs !== null
        ? Math.max(0, Math.round(input.latencyMs))
        : null,
    inputTokens:
      input.inputTokens !== undefined && input.inputTokens !== null
        ? Math.max(0, Math.floor(input.inputTokens))
        : null,
    outputTokens:
      input.outputTokens !== undefined && input.outputTokens !== null
        ? Math.max(0, Math.floor(input.outputTokens))
        : null,
    totalTokens:
      input.totalTokens !== undefined && input.totalTokens !== null
        ? Math.max(0, Math.floor(input.totalTokens))
        : null,
    estimatedCostUsd:
      input.estimatedCostUsd !== undefined && input.estimatedCostUsd !== null
        ? Number(input.estimatedCostUsd.toFixed(8))
        : null,
    errorText: input.errorText ?? null,
    metadataJson: input.metadataJson ?? {},
  };

  await db.insert(graceAuditStream).values(payload);
}

export async function writeGraceAuditStreamSafe(input: WriteGraceAuditStreamInput) {
  try {
    await writeGraceAuditStream(input);
  } catch (error) {
    console.error("[Grace audit stream] failed to write entry", {
      organizationId: input.organizationId,
      eventType: input.eventType,
      source: input.source,
      status: input.status,
      error,
    });
  }
}
