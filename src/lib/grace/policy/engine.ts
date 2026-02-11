import type { GraceSessionContext, PolicyDecision } from "../types";
import { allowedByChannel, highRiskTools } from "./rules";

export function evaluatePolicy(
  context: GraceSessionContext,
  toolName: string
): PolicyDecision {
  const allowed = allowedByChannel[context.channel]?.has(toolName) ?? false;
  if (!allowed) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: `Tool ${toolName} is not allowed on channel ${context.channel}`,
    };
  }

  const requiresApproval = highRiskTools.has(toolName);
  return { allowed: true, requiresApproval };
}
