import { db } from "@/db";
import { graceToolAudit } from "@/db/schema/grace-tool-audit";
import type { GraceActionOutcome, GraceSessionContext, ProposedAction, ToolResult } from "../types";
import { evaluatePolicy } from "../policy/engine";
import { queueApproval } from "../policy/approvals";
import { findGraceTool } from "../tools/registry";

async function writeAudit(params: {
  organizationId: string;
  sessionId: string;
  actorType: GraceSessionContext["actorType"];
  channel: GraceSessionContext["channel"];
  toolName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: "success" | "error";
  idempotencyKey: string;
  latencyMs: number;
}) {
  await db.insert(graceToolAudit).values({
    organizationId: params.organizationId,
    sessionId: params.sessionId,
    actorType: params.actorType,
    channel: params.channel,
    toolName: params.toolName,
    inputJson: params.input,
    outputJson: params.output,
    status: params.status,
    idempotencyKey: params.idempotencyKey,
    latencyMs: params.latencyMs,
  });
}

function didToolRetry(output: Record<string, unknown> | undefined): boolean {
  if (!output) return false;
  const retried = output.retried ?? output.wasRetried ?? output.didRetry;
  if (typeof retried === "boolean") return retried;

  const attempt = output.attempt ?? output.retryCount;
  return typeof attempt === "number" && attempt > 1;
}

export async function executePlannedActions(params: {
  actions: ProposedAction[];
  context: GraceSessionContext;
  skipApprovals?: boolean;
}): Promise<{ results: ToolResult[]; queuedApprovals: string[]; actionOutcomes: GraceActionOutcome[] }> {
  const results: ToolResult[] = [];
  const queuedApprovals: string[] = [];
  const actionOutcomes: GraceActionOutcome[] = [];

  for (const action of params.actions) {
    const occurredAt = new Date().toISOString();
    const policy = evaluatePolicy(params.context, action.tool);
    if (!policy.allowed) {
      const errorMessage = policy.reason ?? "Action blocked by policy";
      results.push({ success: false, error: errorMessage });
      actionOutcomes.push({
        actionId: action.id,
        tool: action.tool,
        reason: action.reason,
        requiresApproval: action.requiresApproval,
        status: "failed",
        error: errorMessage,
        occurredAt,
      });
      continue;
    }

    if (!params.skipApprovals && (policy.requiresApproval || action.requiresApproval)) {
      const approval = await queueApproval({
        organizationId: params.context.organizationId,
        sessionId: params.context.sessionId,
        requestedByUserId: params.context.userId,
        action,
      });
      queuedApprovals.push(approval.id);
      const queuedOutput = { approvalQueued: true, approvalId: approval.id };
      results.push({ success: true, output: queuedOutput });
      actionOutcomes.push({
        actionId: action.id,
        tool: action.tool,
        reason: action.reason,
        requiresApproval: action.requiresApproval,
        status: "queued",
        approvalId: approval.id,
        output: queuedOutput,
        occurredAt,
      });
      continue;
    }

    const tool = findGraceTool(action.tool);
    if (!tool) {
      const errorMessage = `Tool not found: ${action.tool}`;
      results.push({ success: false, error: errorMessage });
      actionOutcomes.push({
        actionId: action.id,
        tool: action.tool,
        reason: action.reason,
        requiresApproval: action.requiresApproval,
        status: "failed",
        error: errorMessage,
        occurredAt,
      });
      continue;
    }

    const start = Date.now();
    const idempotencyKey = `${params.context.sessionId}:${action.id}:${action.tool}`;
    let result: ToolResult;

    try {
      result = await tool.execute(action.input, params.context);
    } catch (error) {
      result = {
        success: false,
        error: error instanceof Error ? error.message : "Tool execution failed",
      };
    }

    await writeAudit({
      organizationId: params.context.organizationId,
      sessionId: params.context.sessionId,
      actorType: params.context.actorType,
      channel: params.context.channel,
      toolName: action.tool,
      input: action.input,
      output: result.output ?? { error: result.error ?? "unknown" },
      status: result.success ? "success" : "error",
      idempotencyKey,
      latencyMs: Date.now() - start,
    });

    results.push(result);
    actionOutcomes.push({
      actionId: action.id,
      tool: action.tool,
      reason: action.reason,
      requiresApproval: action.requiresApproval,
      status: !result.success ? "failed" : didToolRetry(result.output) ? "retried" : "executed",
      output: result.output,
      error: result.error,
      occurredAt,
    });
  }

  return { results, queuedApprovals, actionOutcomes };
}
