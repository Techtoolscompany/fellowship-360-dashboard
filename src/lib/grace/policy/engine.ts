import type { GraceSessionContext, PolicyDecision } from "../types";
import { allowedByChannel, highRiskTools } from "./rules";

const BULK_TARGET_KEYS = [
  "contactIds",
  "recipientIds",
  "recipients",
  "emails",
  "phones",
  "assignmentIds",
  "volunteerIds",
  "ids",
  "to",
] as const;

const GROUP_SELECTOR_KEYS = [
  "groupId",
  "groupIds",
  "audienceId",
  "audienceIds",
  "segmentId",
  "segmentIds",
  "listId",
  "listIds",
  "filterId",
  "filterIds",
] as const;

function normalizeText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function countExplicitTargets(input: Record<string, unknown>) {
  let maxCount = 0;

  for (const key of BULK_TARGET_KEYS) {
    const value = input[key];
    if (Array.isArray(value)) {
      maxCount = Math.max(maxCount, value.filter((entry) => normalizeText(entry).length > 0).length);
      continue;
    }

    if (typeof value === "string") {
      const normalized = value.trim();
      if (!normalized) continue;
      const pieces = normalized
        .split(/[\n,;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
      maxCount = Math.max(maxCount, pieces.length || 1);
    }
  }

  return maxCount;
}

function hasExplicitGroupSelector(input: Record<string, unknown>) {
  return GROUP_SELECTOR_KEYS.some((key) => {
    const value = input[key];
    if (Array.isArray(value)) return value.some((entry) => normalizeText(entry).length > 0);
    return normalizeText(value).length > 0;
  });
}

export function evaluatePolicy(
  context: GraceSessionContext,
  toolName: string,
  input: Record<string, unknown> = {}
): PolicyDecision {
  // Public org allowlists can expand the static public-safe tool set.
  if (context.actorType === "public" && context.policy?.allowedPublicTools.length) {
    const allowed = context.policy.allowedPublicTools.includes(toolName);
    if (!allowed) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: `Tool ${toolName} is not in the org's allowedPublicTools`,
      };
    }
  }

  const allowed = allowedByChannel[context.channel]?.has(toolName) ?? false;
  if (!allowed) {
    return {
      allowed: false,
      requiresApproval: false,
      reason: `Tool ${toolName} is not allowed on channel ${context.channel}`,
    };
  }

  const orgHighRisk =
    context.policy?.approvalsEnabled !== false &&
    Boolean(context.policy?.highRiskTools?.includes(toolName));
  const explicitTargetCount = countExplicitTargets(input);
  const bulkTargeting = explicitTargetCount >= 10 || hasExplicitGroupSelector(input);
  const requiresApproval = highRiskTools.has(toolName) || bulkTargeting || orgHighRisk;

  return {
    allowed: true,
    requiresApproval,
    reason:
      !requiresApproval
        ? undefined
        : highRiskTools.has(toolName)
          ? "invariant_high_risk_tool"
          : bulkTargeting
            ? "explicit_bulk_targeting"
            : "org_policy_high_risk",
  };
}
