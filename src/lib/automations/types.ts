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

export const AUTOMATION_TEMPLATE_CATEGORIES = [
  "Follow-Up",
  "Care",
  "Appointments",
  "Service Ops",
] as const;

export type AutomationTemplateCategory =
  (typeof AUTOMATION_TEMPLATE_CATEGORIES)[number];

export const AUTOMATION_RECOMMENDED_CHANNELS = ["sms", "email", "voice"] as const;
export type AutomationRecommendedChannel =
  (typeof AUTOMATION_RECOMMENDED_CHANNELS)[number];

export const AUTOMATION_STATUSES = [
  "draft",
  "published",
  "paused",
  "archived",
] as const;
export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

export const AUTOMATION_TRIGGER_PRESETS = [
  {
    value: "contacts.created.v1",
    label: "New contact created",
    description: "Start a workflow when a new visitor or contact is added.",
  },
  {
    value: "contacts.member.created.v1",
    label: "Member created or promoted",
    description: "Run a welcome or onboarding journey for new members or leaders.",
  },
  {
    value: "appointments.scheduled.v1",
    label: "Appointment scheduled",
    description: "Send reminders, prep notes, or no-show recovery follow-up.",
  },
  {
    value: "volunteers.created.v1",
    label: "Volunteer added",
    description: "Kick off volunteer onboarding, training, or leader follow-up.",
  },
  {
    value: "grace.guest.first-time-appointment.requested.v1",
    label: "First-time guest appointment requested",
    description: "Follow up when Grace identifies a first-time guest appointment opportunity.",
  },
  {
    value: "grace.call.missed.v1",
    label: "Missed call captured",
    description: "Recover missed calls with immediate outreach and follow-up tasks.",
  },
  {
    value: "grace.prayer-request.followup.requested.v1",
    label: "Prayer request follow-up requested",
    description: "Acknowledge and escalate prayer care workflows.",
  },
  {
    value: "ministry.ops.daily.v1",
    label: "Daily scheduled trigger",
    description: "Run a workflow once per day using the automation scheduler.",
  },
  {
    value: "ministry.ops.weekly.v1",
    label: "Weekly scheduled trigger",
    description: "Run a workflow once per week using the automation scheduler.",
  },
] as const;

export type AutomationTriggerPreset =
  (typeof AUTOMATION_TRIGGER_PRESETS)[number];

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
  category: AutomationTemplateCategory;
  triggerEvent: string;
  mode: "template";
  recommendedChannels: AutomationRecommendedChannel[];
  definition: AutomationDefinition;
};

export type AutomationTemplateSource = "system" | "managed";

export type AutomationLibraryTemplate = AutomationTemplate & {
  source: AutomationTemplateSource;
  status: AutomationStatus;
  updatedAt?: Date | string | null;
  publishedAt?: Date | string | null;
};
