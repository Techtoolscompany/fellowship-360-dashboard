export type GraceChannel = "voice" | "sms" | "web" | "in_app";

export type GraceIntent =
  | "info_request"
  | "prayer_request"
  | "appointment_request"
  | "follow_up_request"
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
  [key: string]: unknown;
}

export interface GraceSessionContext {
  organizationId: string;
  sessionId: string;
  channel: GraceChannel;
  userId?: string;
  contactId?: string | null;
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
}
