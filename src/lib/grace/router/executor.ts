import { db } from "@/db";
import { graceToolAudit } from "@/db/schema/grace-tool-audit";
import { graceFollowupProposals } from "@/db/schema/grace-followup-proposals";
import type { GraceActionOutcome, GraceSessionContext, ProposedAction, ToolResult } from "../types";
import { evaluatePolicy } from "../policy/engine";
import { queueApproval } from "../policy/approvals";
import { findGraceTool, resolveAgencyTier } from "../tools/registry";
import { writeGraceAuditStreamSafe } from "../audit-stream";

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
  /** When true, the executor is running inside the agentic loop and should
   *  return tool results for Grace to reason about on the next iteration. */
  returnToolResults?: boolean;
}): Promise<{ results: ToolResult[]; queuedApprovals: string[]; actionOutcomes: GraceActionOutcome[] }> {
  const results: ToolResult[] = [];
  const queuedApprovals: string[] = [];
  const actionOutcomes: GraceActionOutcome[] = [];

  for (const action of params.actions) {
    const occurredAt = new Date().toISOString();
    const policy = evaluatePolicy(params.context, action.tool, action.input);
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
      await writeGraceAuditStreamSafe({
        organizationId: params.context.organizationId,
        sessionId: params.context.sessionId,
        actorType: params.context.actorType,
        channel: params.context.channel,
        eventType: "action_execution",
        source: "grace_executor",
        status: "blocked",
        toolName: action.tool,
        actionName: action.reason,
        errorText: errorMessage,
        metadataJson: {
          actionId: action.id,
          requiresApproval: action.requiresApproval,
        },
      });
      continue;
    }

    // Resolve the agency tier for this tool
    const agencyTier = resolveAgencyTier(action.tool);
    const approvalRequired =
      agencyTier === "always_ask" || policy.requiresApproval || action.requiresApproval;

    // 🔴 ALWAYS_ASK — always queue for staff approval regardless of other flags
    const shouldQueueApproval =
      !params.skipApprovals &&
      approvalRequired;

    // 🟡 SUGGEST — create a followup proposal instead of executing
    const shouldSuggest =
      !params.skipApprovals &&
      !shouldQueueApproval &&
      agencyTier === "suggest";

    if (shouldSuggest) {
      // Create a followup proposal for staff to review
      try {
        await db.insert(graceFollowupProposals).values({
          organizationId: params.context.organizationId,
          sessionId: params.context.sessionId,
          actorType: params.context.actorType,
          channel: params.context.channel,
          contactId: typeof action.input.contactId === "string" ? action.input.contactId : null,
          proposedChannel: action.tool.startsWith("messages.send") ? (action.tool === "messages.sendSMS" ? "sms" : "email") : "system",
          reason: action.reason,
          messageText: typeof action.input.message === "string"
            ? action.input.message
            : typeof action.input.html === "string"
              ? action.input.html
              : JSON.stringify(action.input),
          status: "pending",
          metadataJson: {
            toolName: action.tool,
            toolInput: action.input,
            actionId: action.id,
            agencyTier: "suggest",
          },
        });
      } catch (err) {
        console.error("[Grace Executor] Failed to create suggestion proposal:", err);
      }

      const suggestedOutput = { suggested: true, agencyTier: "suggest", tool: action.tool };
      results.push({ success: true, output: suggestedOutput });
      actionOutcomes.push({
        actionId: action.id,
        tool: action.tool,
        reason: action.reason,
        requiresApproval: false,
        status: "suggested",
        output: suggestedOutput,
        occurredAt,
      });
      await writeGraceAuditStreamSafe({
        organizationId: params.context.organizationId,
        sessionId: params.context.sessionId,
        actorType: params.context.actorType,
        channel: params.context.channel,
        eventType: "action_execution",
        source: "grace_executor",
        status: "skipped",
        toolName: action.tool,
        actionName: action.reason,
        metadataJson: {
          actionId: action.id,
          agencyTier: "suggest",
        },
      });
      continue;
    }

    if (shouldQueueApproval) {
      const approval = await queueApproval({
        organizationId: params.context.organizationId,
        sessionId: params.context.sessionId,
        requestedByUserId: params.context.userId,
        action,
      });
      queuedApprovals.push(approval.id);
      const queuedOutput = { approvalQueued: true, approvalId: approval.id, agencyTier };
      results.push({ success: true, output: queuedOutput });
      actionOutcomes.push({
        actionId: action.id,
        tool: action.tool,
        reason: action.reason,
        requiresApproval: approvalRequired,
        status: "queued",
        approvalId: approval.id,
        output: queuedOutput,
        occurredAt,
      });
      await writeGraceAuditStreamSafe({
        organizationId: params.context.organizationId,
        sessionId: params.context.sessionId,
        actorType: params.context.actorType,
        channel: params.context.channel,
        eventType: "action_execution",
        source: "grace_executor",
        status: "queued",
        toolName: action.tool,
        actionName: action.reason,
        metadataJson: {
          actionId: action.id,
          approvalId: approval.id,
          requiresApproval: approvalRequired,
          agencyTier,
        },
      });
      continue;
    }

    // 🟢 AUTONOMOUS — execute immediately
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
      await writeGraceAuditStreamSafe({
        organizationId: params.context.organizationId,
        sessionId: params.context.sessionId,
        actorType: params.context.actorType,
        channel: params.context.channel,
        eventType: "action_execution",
        source: "grace_executor",
        status: "error",
        toolName: action.tool,
        actionName: action.reason,
        errorText: errorMessage,
        metadataJson: {
          actionId: action.id,
        },
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
    await writeGraceAuditStreamSafe({
      organizationId: params.context.organizationId,
      sessionId: params.context.sessionId,
      actorType: params.context.actorType,
      channel: params.context.channel,
      eventType: "action_execution",
      source: "grace_executor",
      status: result.success ? "success" : "error",
      toolName: action.tool,
      actionName: action.reason,
      latencyMs: Date.now() - start,
      errorText: result.error ?? null,
      metadataJson: {
        actionId: action.id,
        requiresApproval: action.requiresApproval,
        agencyTier,
        output: result.output ?? null,
      },
    });
  }

  return { results, queuedApprovals, actionOutcomes };
}
