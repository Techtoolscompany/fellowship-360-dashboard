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

export interface OrgPolicyOverride {
  approvalsEnabled: boolean;
  highRiskTools: string[];
  allowedPublicTools: string[];
}

export interface GraceSessionContext {
  organizationId: string;
  sessionId: string;
  channel: GraceChannel;
  actorType: GraceActorType;
  userId?: string;
  contactId?: string | null;
  originSurface?: string;
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

export type GraceActionOutcomeStatus = "executed" | "queued" | "failed" | "retried";

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
}
