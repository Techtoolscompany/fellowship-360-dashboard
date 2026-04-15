export type GraceChannel =
  | "voice"
  | "voice_internal"
  | "voice_public"
  | "sms"
  | "sms_public"
  | "web"
  | "web_public"
  | "in_app";

export type GraceActorType = "staff" | "public" | "system";
export type GraceOriginSurface = "onboarding";
export type GraceProactiveMode = "off" | "quiet" | "normal";

/**
 * Agency tiers control how Grace handles actions:
 * - autonomous: Grace executes immediately (routine ops like visitor follow-ups, thank-you texts)
 * - suggest: Grace proposes and waits for staff confirmation (re-engagement, pastoral outreach)
 * - always_ask: Hard-blocked until explicit staff approval (broadcasts, deletions, bulk actions)
 */
export type AgencyTier = "autonomous" | "suggest" | "always_ask";

export type GraceMatchTier = "high" | "medium" | "low";

export type GraceIntent =
  | "info_request"
  | "prayer_request"
  | "appointment_request"
  | "follow_up_request"
  | "contact_request"
  | "report_request"
  | "emergency"
  | "unknown";

export const GRACE_WORKFLOW_KEYS = [
  "volunteer_staffing",
  "guest_followup",
  "prayer_care",
  "legacy_goal",
] as const;

export type GraceWorkflowKey = (typeof GRACE_WORKFLOW_KEYS)[number];
export type GraceWorkflowDecisionType =
  | "respond_only"
  | "start_workflow"
  | "continue_workflow"
  | "handoff";
export type GraceWorkflowApprovalMode = "confirm_once" | "approval_required" | "none";
export type GraceWorkflowTriggerSource =
  | "staff_prompt"
  | "event_trigger"
  | "system_resume"
  | "manual_override"
  | "legacy";
export type GraceWorkflowSubjectEntityType =
  | "service_run"
  | "pipeline_item"
  | "prayer_request"
  | "contact"
  | "batch";

export interface SlotState {
  name?: string;
  phone?: string;
  email?: string;
  requestText?: string;
  urgency?: "normal" | "urgent" | "critical";
  preferredTime?: string;
  appointmentTitle?: string;
  stageName?: string;
  note?: string;
  matchedContactId?: string;
  matchTier?: GraceMatchTier;
  [key: string]: unknown;
}

export interface GraceWorkflowDecision {
  decisionType: GraceWorkflowDecisionType;
  workflowKey?: GraceWorkflowKey;
  workflowVersion?: number;
  workflowInput?: Record<string, unknown>;
  missingInputs?: string[];
  kickoffSummary?: string;
  nextBestAction?: string;
  approvalMode?: GraceWorkflowApprovalMode;
  confidence?: number;
}

export interface GraceWorkflowStartSummary {
  status: "pending_confirmation" | "started" | "reused" | "cancelled" | "failed";
  workflowKey?: GraceWorkflowKey;
  goalIds?: string[];
  createdCount?: number;
  reusedCount?: number;
  failedCount?: number;
  summary?: string;
}

export interface GraceWorkflowEvent {
  eventType: string;
  organizationId: string;
  workflowId?: string;
  channel?: GraceChannel | "system";
  contactId?: string | null;
  entityType?: GraceWorkflowSubjectEntityType | null;
  entityId?: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface OrgPolicyOverride {
  approvalsEnabled: boolean;
  highRiskTools: string[];
  allowedPublicTools: string[];
  autoEscalateOnEmergency?: boolean;
}

export interface GraceSessionContext {
  organizationId: string;
  sessionId: string;
  channel: GraceChannel;
  actorType: GraceActorType;
  userId?: string;
  contactId?: string | null;
  originSurface?: GraceOriginSurface;
  matchConfidence?: GraceMatchTier | null;
  policy?: OrgPolicyOverride;
  providerContext?: {
    orgSlug?: string;
    provider?: string;
  };
}

export interface ToolRequest {
  name: string;
  input: Record<string, unknown>;
  idempotencyKey: string;
}

export interface ToolResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
}

export interface ProposedAction {
  id: string;
  tool: string;
  input: Record<string, unknown>;
  reason: string;
  requiresApproval: boolean;
}

export type GraceActionOutcomeStatus = "executed" | "queued" | "failed" | "retried" | "suggested";

export interface GraceActionOutcome {
  actionId: string;
  tool: string;
  reason: string;
  requiresApproval: boolean;
  status: GraceActionOutcomeStatus;
  occurredAt: string;
  approvalId?: string;
  output?: Record<string, unknown>;
  error?: string;
}

/**
 * A single step in Grace's reasoning loop.
 * Each iteration produces a brief rationale, optional tool calls, and a decision to continue or stop.
 */
export interface ReasoningStep {
  iteration: number;
  reasoning: string;
  toolsCalled: Array<{ tool: string; input: Record<string, unknown>; result: ToolResult }>;
  durationMs: number;
}

export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}

export interface ApprovalDecision {
  actionId: string;
  approved: boolean;
  note?: string;
}

export interface GraceRouterInput {
  message: string;
  state: SlotState;
  context: GraceSessionContext;
}

export interface GraceRouterOutput {
  response: string;
  intent: GraceIntent;
  state: SlotState;
  proposedActions: ProposedAction[];
  actionOutcomes: GraceActionOutcome[];
  workflowDecision?: GraceWorkflowDecision | null;
  workflowStart?: GraceWorkflowStartSummary | null;
  availabilityStatus?: "provider_missing" | "llm_unavailable";
  availabilityMessage?: string | null;
  /** Brief operator-facing rationale from the agentic loop */
  reasoning?: string;
  /** Step-by-step trace of the agentic loop iterations */
  reasoningSteps?: ReasoningStep[];
  /** Number of reasoning iterations Grace performed */
  iterationCount?: number;
}
