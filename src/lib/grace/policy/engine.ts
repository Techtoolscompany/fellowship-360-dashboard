import type { GraceSessionContext, PolicyDecision } from "../types";
import { allowedByChannel, highRiskTools } from "./rules";

export function evaluatePolicy(
  context: GraceSessionContext,
  toolName: string
): PolicyDecision {
  // For public actors, org policy takes precedence over static channel rules.
  // allowedPublicTools is the source of truth when the org has configured it.
  if (context.actorType === "public" && context.policy?.allowedPublicTools.length) {
    const allowed = context.policy.allowedPublicTools.includes(toolName);
    if (!allowed) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Tool ${toolName} is not in the org's allowedPublicTools`,
      };
    }
    const orgHighRisk = context.policy.highRiskTools ?? [];
    const requiresApproval =
      !context.policy.approvalsEnabled ? false : (orgHighRisk.includes(toolName) || highRiskTools.has(toolName));
    return { allowed: true, requiresApproval };
  }

  // Fall back to static channel-based rules
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
