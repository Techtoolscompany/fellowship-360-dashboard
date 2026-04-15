import type {
  GraceWorkflowApprovalMode,
  GraceWorkflowKey,
  GraceWorkflowSubjectEntityType,
} from "../types";

type GraceGoalType = "service_staffing" | "communications_followup" | "operations" | "custom";

export type GraceWorkflowDefinition = {
  key: GraceWorkflowKey;
  version: number;
  title: string;
  goalType: GraceGoalType;
  subjectEntityType: GraceWorkflowSubjectEntityType;
  approvalMode: GraceWorkflowApprovalMode;
  description: string;
};

export const GRACE_WORKFLOW_DEFINITIONS: Record<GraceWorkflowKey, GraceWorkflowDefinition> = {
  volunteer_staffing: {
    key: "volunteer_staffing",
    version: 1,
    title: "Volunteer Staffing",
    goalType: "service_staffing",
    subjectEntityType: "service_run",
    approvalMode: "confirm_once",
    description: "Fill open service roles, watch replies, and escalate remaining gaps.",
  },
  guest_followup: {
    key: "guest_followup",
    version: 1,
    title: "Guest Follow-up",
    goalType: "communications_followup",
    subjectEntityType: "pipeline_item",
    approvalMode: "confirm_once",
    description: "Reach out to first-time guests and move them toward a booked next step.",
  },
  prayer_care: {
    key: "prayer_care",
    version: 1,
    title: "Prayer Care",
    goalType: "operations",
    subjectEntityType: "prayer_request",
    approvalMode: "confirm_once",
    description: "Follow up on prayer needs, enforce escalation rules, and hand off when needed.",
  },
  legacy_goal: {
    key: "legacy_goal",
    version: 1,
    title: "Legacy Goal",
    goalType: "custom",
    subjectEntityType: "batch",
    approvalMode: "none",
    description: "Legacy Grace goal record preserved for backward compatibility.",
  },
};

export function isGraceWorkflowKey(value: unknown): value is GraceWorkflowKey {
  return typeof value === "string" && value in GRACE_WORKFLOW_DEFINITIONS;
}

export function getGraceWorkflowDefinition(workflowKey: GraceWorkflowKey) {
  return GRACE_WORKFLOW_DEFINITIONS[workflowKey];
}
