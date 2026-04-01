export const AUTOMATION_NODE_TYPES = [
  "trigger",
  "delay",
  "condition",
  "action",
  "stop",
] as const;

export type AutomationNodeType = (typeof AUTOMATION_NODE_TYPES)[number];

export const AUTOMATION_ENROLLMENT_MODES = [
  "every_trigger",
  "once_per_contact",
  "cooldown",
] as const;

export type AutomationEnrollmentMode =
  (typeof AUTOMATION_ENROLLMENT_MODES)[number];

export const AUTOMATION_MODES = ["template", "builder"] as const;
export type AutomationMode = (typeof AUTOMATION_MODES)[number];

export const AUTOMATION_STATUSES = [
  "draft",
  "published",
  "paused",
  "archived",
] as const;
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

export type AutomationNode = {
  id: string;
  type: AutomationNodeType;
  label: string;
  description?: string | null;
  config?: Record<string, unknown>;
  nextIds?: string[];
};

export type AutomationDefinition = {
  version: number;
  startNodeId?: string | null;
  nodes: AutomationNode[];
};

export type AutomationCompliancePolicy = {
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  dailySendCap: number;
  respectOptOut: boolean;
  enrollmentMode: AutomationEnrollmentMode;
  reentryCooldownMinutes: number;
};

export const DEFAULT_AUTOMATION_COMPLIANCE_POLICY: AutomationCompliancePolicy = {
  quietHoursEnabled: true,
  quietHoursStart: "21:00",
  quietHoursEnd: "08:00",
  dailySendCap: 250,
  respectOptOut: true,
  enrollmentMode: "once_per_contact",
  reentryCooldownMinutes: 10080,
};

export type AutomationTemplate = {
  key: string;
  name: string;
  description: string;
  category: "Follow-Up" | "Care" | "Appointments" | "Service Ops";
  triggerEvent: string;
  mode: "template";
  recommendedChannels: Array<"sms" | "email" | "voice">;
  definition: AutomationDefinition;
};
