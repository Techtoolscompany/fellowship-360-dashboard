import { db } from "@/db";
import { graceToolAudit } from "@/db/schema/grace-tool-audit";
import type { GraceSessionContext, ProposedAction, ToolResult } from "../types";
import { evaluatePolicy } from "../policy/engine";
import { queueApproval } from "../policy/approvals";
import { findGraceTool } from "../tools/registry";

async function writeAudit(params: {
  organizationId: string;
  sessionId: string;
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
    toolName: params.toolName,
    inputJson: params.input,
    outputJson: params.output,
    status: params.status,
    idempotencyKey: params.idempotencyKey,
    latencyMs: params.latencyMs,
  });
}

export async function executePlannedActions(params: {
  actions: ProposedAction[];
  context: GraceSessionContext;
  skipApprovals?: boolean;
}): Promise<{ results: ToolResult[]; queuedApprovals: string[] }> {
  const results: ToolResult[] = [];
  const queuedApprovals: string[] = [];

  for (const action of params.actions) {
    const policy = evaluatePolicy(params.context, action.tool);
    if (!policy.allowed) {
      results.push({ success: false, error: policy.reason });
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
      results.push({ success: true, output: { approvalQueued: true, approvalId: approval.id } });
      continue;
    }

    const tool = findGraceTool(action.tool);
    if (!tool) {
      results.push({ success: false, error: `Tool not found: ${action.tool}` });
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
      toolName: action.tool,
      input: action.input,
      output: result.output ?? { error: result.error ?? "unknown" },
      status: result.success ? "success" : "error",
      idempotencyKey,
      latencyMs: Date.now() - start,
    });

    results.push(result);
  }

  return { results, queuedApprovals };
}
