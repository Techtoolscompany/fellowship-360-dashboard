"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Loader2,
  Mic,
  MessageCircle,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Users2,
} from "lucide-react";
import { toast } from "sonner";
import useOrganization from "@/lib/organizations/useOrganization";
import { AgentAudioVisualizerAura } from "@/components/agents-ui/agent-audio-visualizer-aura";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GraceVoiceAssistant } from "@/components/grace-voice/GraceVoiceAssistant";
import { MinistryBriefItem, TopMetric } from "./components/metrics";
import { getGraceDashboardData } from "@/app/actions/dashboard";
import {
  getConversations,
  getConversationStats,
  getConversationMessages,
  addMessage,
  updateConversationStatus,
  getPhoneCalls,
} from "@/app/actions/communications";
import { getAppointments, updateAppointment } from "@/app/actions/operations";
import { getPipelineData, updateItemStage } from "@/app/actions/pipeline";
import { createEvent, getEvents } from "@/app/actions/calendar";
import {
  createGraceKnowledge,
  getGraceApprovals,
  getGraceCalls,
  getGraceDailyBriefing,
  getGraceFollowupProposals,
  getGraceKnowledge,
  getGraceProviderConfigs,
  getGraceSessions,
  getGraceToolAudit,
  sendCopilotMessage,
  updateGraceApproval,
  updateGraceFollowupProposalStatus,
} from "@/app/actions/grace";
import { getGraceSettings } from "@/app/actions/grace-settings";
import type { GraceActionOutcome } from "@/lib/grace/types";
import {
  buildServiceRunRoleMatrix,
  getNextUpcomingServiceRun,
  getPreferredServiceRunId,
  summarizeRoleMatrix,
} from "@/lib/grace/service-planning";

type GraceTab =
  | "command"
  | "center"
  | "inbox"
  | "visitors"
  | "calendar"
  | "operations";

type ConversationRow = Awaited<ReturnType<typeof getConversations>>[number];
type PhoneCallRow = Awaited<ReturnType<typeof getPhoneCalls>>[number];
type AppointmentRow = Awaited<ReturnType<typeof getAppointments>>[number];
type PipelineData = Awaited<ReturnType<typeof getPipelineData>>;
type PipelineStageRow = PipelineData["stages"][number];
type PipelineItemRow = PipelineData["items"][number];
type CalendarEventRow = Awaited<ReturnType<typeof getEvents>>[number];
type CalendarSurfaceItem = {
  id: string;
  title: string;
  startDate: string | Date;
  location: string | null;
  source: "event" | "appointment";
  appointmentId?: string;
  appointmentStatus?: AppointmentRow["appointment"]["status"];
  contactName?: string;
};
type MessageRow = Awaited<ReturnType<typeof getConversationMessages>>[number];
type SessionRow = Awaited<ReturnType<typeof getGraceSessions>>[number];
type GraceCallRow = Awaited<ReturnType<typeof getGraceCalls>>[number];
type ApprovalRow = Awaited<ReturnType<typeof getGraceApprovals>>[number];
type FollowupProposalRow = Awaited<ReturnType<typeof getGraceFollowupProposals>>[number];
type ToolAuditRow = Awaited<ReturnType<typeof getGraceToolAudit>>[number];
type KnowledgeRow = Awaited<ReturnType<typeof getGraceKnowledge>>[number];
type ProviderConfigRow = Awaited<ReturnType<typeof getGraceProviderConfigs>>[number];
type GraceSettingsRow = Awaited<ReturnType<typeof getGraceSettings>>;
type GraceDailyBriefingRow = Exclude<Awaited<ReturnType<typeof getGraceDailyBriefing>>, null>;

type ServiceTemplateType = "sunday_am" | "midweek" | "special_event" | "custom";
type RoleAssignmentType = "paid_staff" | "volunteer" | "either";

type ServiceTemplateRecord = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  serviceType: ServiceTemplateType;
  isActive: boolean;
  serviceStartTime: string | null;
  ownerUserId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type ServiceTemplateRoleSlotRecord = {
  id: string;
  templateId: string;
  roleName: string;
  assignmentType: RoleAssignmentType;
  isEnabled: boolean;
  requiredCount: number;
  isRequired: boolean;
  notes: string | null;
  sortOrder: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type ServiceTemplateTimelineStepRecord = {
  id: string;
  templateId: string;
  title: string;
  description: string | null;
  offsetMinutes: number;
  durationMinutes: number | null;
  ownerRoleSlotId: string | null;
  ownerUserId: string | null;
  sortOrder: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type ServiceTemplateBundle = {
  template: ServiceTemplateRecord;
  roleSlots: ServiceTemplateRoleSlotRecord[];
  timelineSteps: ServiceTemplateTimelineStepRecord[];
};

type ServiceTemplateRoleDraft = {
  roleName: string;
  assignmentType: RoleAssignmentType;
  requiredCount: string;
  isRequired: boolean;
  notes: string;
};

type AssignmentPreviewSuggestion = {
  assigneeType: "paid_staff" | "volunteer";
  assigneeId: string;
  displayName: string;
  primaryRole: string;
  score: number;
  available: boolean;
  conflictReason?: string;
  reasons: string[];
  recentLoad: number;
};

type AssignmentPreviewRoleRecommendation = {
  roleSlot: ServiceTemplateRoleSlotRecord;
  requiredCount: number;
  suggestions: AssignmentPreviewSuggestion[];
  recommended: AssignmentPreviewSuggestion[];
  unfilledSeats: number;
};

type AssignmentPreviewData = {
  template: ServiceTemplateRecord;
  serviceAt: string | Date;
  serviceDurationMinutes: number;
  generatedAt: string | Date;
  summary: {
    roleSlots: number;
    requiredSeats: number;
    optionalSeats: number;
    totalSeats: number;
    recommendedSeats: number;
    unfilledRequiredSeats: number;
    requiredRolesWithoutCoverage: number;
  };
  roleRecommendations: AssignmentPreviewRoleRecommendation[];
};

type ServiceRunStatus = "planned" | "in_progress" | "completed" | "cancelled";
type ServiceAssignmentStatus =
  | "proposed"
  | "offered"
  | "confirmed"
  | "declined"
  | "needs_replacement"
  | "checked_in"
  | "checked_out"
  | "no_show"
  | "cancelled";
type GraceGoalStatus =
  | "queued"
  | "in_progress"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "escalated";
type GraceGoalType =
  | "service_staffing"
  | "communications_followup"
  | "operations"
  | "custom";

type ServiceRunRecord = {
  id: string;
  organizationId: string;
  templateId: string | null;
  name: string;
  serviceAt: string | Date;
  durationMinutes: number;
  status: ServiceRunStatus;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type ServiceRunListRow = {
  run: ServiceRunRecord;
  template: ServiceTemplateRecord | null;
};

type ServiceRunAssignmentRecord = {
  id: string;
  organizationId: string;
  serviceRunId: string;
  templateId: string | null;
  roleSlotId: string | null;
  roleName: string;
  assignmentType: RoleAssignmentType;
  volunteerId: string | null;
  staffUserId: string | null;
  status: ServiceAssignmentStatus;
  offeredAt: string | Date | null;
  respondedAt: string | Date | null;
  responseChannel: string | null;
  responseText: string | null;
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type ServiceRunAssignmentRow = {
  assignment: ServiceRunAssignmentRecord;
  volunteer: {
    id: string;
    contactId: string;
    role: string | null;
    status: string;
    totalHours: number | null;
  } | null;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  } | null;
  staff: {
    id: string;
    name: string | null;
    email: string;
  } | null;
};

type ServiceRunMatrixRow = {
  roleSlotId: string;
  roleName: string;
  assignmentType: RoleAssignmentType;
  isRequired: boolean;
  seatsNeeded: number;
  seatsFilled: number;
  seatsConfirmed: number;
  seatsOpen: number;
  seatsAtRisk: number;
  coveragePercent: number;
};

type RunOfServiceOverviewStep = {
  id: string;
  title: string;
  detail: string;
  startAt: Date;
  durationMinutes: number | null;
  ownerLabel: string;
  coverageLabel: string;
  coverageTone: "healthy" | "attention" | "neutral";
};

type GraceGoalRecord = {
  id: string;
  organizationId: string;
  goalType: GraceGoalType;
  status: GraceGoalStatus;
  sourceChannel: string;
  objectiveText: string;
  serviceRunId: string | null;
  requestedByUserId: string | null;
  contextJson: Record<string, unknown> | null;
  resultJson: Record<string, unknown> | null;
  errorText: string | null;
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  nextRunAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

type GraceGoalRow = {
  goal: GraceGoalRecord;
  serviceRun: ServiceRunRecord | null;
};

const SERVICE_TEMPLATE_TYPE_LABELS: Record<ServiceTemplateType, string> = {
  sunday_am: "Sunday AM",
  midweek: "Midweek",
  special_event: "Special Event",
  custom: "Custom",
};

const SERVICE_TEMPLATE_TYPES: ServiceTemplateType[] = [
  "sunday_am",
  "midweek",
  "special_event",
  "custom",
];

const ROLE_ASSIGNMENT_LABELS: Record<RoleAssignmentType, string> = {
  paid_staff: "Paid Staff",
  volunteer: "Volunteer",
  either: "Either",
};

const ROLE_ASSIGNMENT_TYPES: RoleAssignmentType[] = [
  "paid_staff",
  "volunteer",
  "either",
];

const SERVICE_RUN_STATUS_LABELS: Record<ServiceRunStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const SERVICE_ASSIGNMENT_STATUS_LABELS: Record<ServiceAssignmentStatus, string> = {
  proposed: "Proposed",
  offered: "Offered",
  confirmed: "Confirmed",
  declined: "Declined",
  needs_replacement: "Needs Replacement",
  checked_in: "Checked In",
  checked_out: "Checked Out",
  no_show: "No Show",
  cancelled: "Cancelled",
};

const SERVICE_ASSIGNMENT_AT_RISK_STATUSES: ServiceAssignmentStatus[] = [
  "declined",
  "needs_replacement",
  "no_show",
  "cancelled",
];

const GRACE_GOAL_STATUS_LABELS: Record<GraceGoalStatus, string> = {
  queued: "Queued",
  in_progress: "In Progress",
  waiting: "Waiting",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  escalated: "Escalated",
};

type PositionPack = {
  id: string;
  label: string;
  description: string;
  roles: Array<{
    roleName: string;
    assignmentType: RoleAssignmentType;
    requiredCount: number;
    isRequired: boolean;
    notes?: string;
  }>;
};

const POSITION_PACKS: PositionPack[] = [
  {
    id: "worship-team",
    label: "Worship Team",
    description: "Core band and production positions for Sunday worship.",
    roles: [
      { roleName: "Worship Leader", assignmentType: "paid_staff", requiredCount: 1, isRequired: true },
      { roleName: "Drums", assignmentType: "volunteer", requiredCount: 1, isRequired: true },
      { roleName: "Bass", assignmentType: "volunteer", requiredCount: 1, isRequired: true },
      { roleName: "Electric Guitar", assignmentType: "volunteer", requiredCount: 1, isRequired: false },
      { roleName: "Keys", assignmentType: "volunteer", requiredCount: 1, isRequired: false },
      { roleName: "Vocalist", assignmentType: "volunteer", requiredCount: 2, isRequired: true },
      { roleName: "Audio Engineer", assignmentType: "volunteer", requiredCount: 1, isRequired: true },
      { roleName: "ProPresenter", assignmentType: "volunteer", requiredCount: 1, isRequired: true },
    ],
  },
  {
    id: "guest-services",
    label: "Guest Services",
    description: "Front-door and hospitality coverage.",
    roles: [
      { roleName: "Guest Services Lead", assignmentType: "either", requiredCount: 1, isRequired: true },
      { roleName: "Greeter", assignmentType: "volunteer", requiredCount: 3, isRequired: true },
      { roleName: "Parking Team", assignmentType: "volunteer", requiredCount: 2, isRequired: true },
      { roleName: "Connections Desk", assignmentType: "volunteer", requiredCount: 2, isRequired: true },
      { roleName: "Usher", assignmentType: "volunteer", requiredCount: 3, isRequired: false },
    ],
  },
  {
    id: "kids-ministry",
    label: "Kids Ministry",
    description: "Child ministry classrooms and check-in staffing.",
    roles: [
      { roleName: "Kids Director", assignmentType: "paid_staff", requiredCount: 1, isRequired: true },
      { roleName: "Check-In Host", assignmentType: "volunteer", requiredCount: 2, isRequired: true },
      { roleName: "Nursery Lead", assignmentType: "volunteer", requiredCount: 1, isRequired: true },
      { roleName: "Elementary Teacher", assignmentType: "volunteer", requiredCount: 3, isRequired: true },
      { roleName: "Safety Hall Monitor", assignmentType: "volunteer", requiredCount: 1, isRequired: true },
    ],
  },
];

const TAB_ORDER: GraceTab[] = [
  "command",
  "center",
  "inbox",
  "visitors",
  "calendar",
  "operations",
];

function normalizeTab(value: string | null): GraceTab {
  if (!value) return "command";
  if (value === "appointments") return "command";
  if (value === "conversations" || value === "calls") return "inbox";
  return TAB_ORDER.includes(value as GraceTab) ? (value as GraceTab) : "command";
}

function fmtDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function fmtDurationFromNow(value: Date | string | null | undefined) {
  if (!value) return "now";
  const target = new Date(value).getTime();
  const deltaMs = target - Date.now();
  const absHours = Math.round(Math.abs(deltaMs) / 3_600_000);
  if (absHours < 1) return deltaMs >= 0 ? "within the hour" : "less than 1 hour ago";
  if (deltaMs >= 0) return `in ${absHours} hour${absHours === 1 ? "" : "s"}`;
  return `${absHours} hour${absHours === 1 ? "" : "s"} ago`;
}

function formatDateTimeLocalInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getNextSundayMorning() {
  const date = new Date();
  const dayOfWeek = date.getDay();
  const daysUntilSunday = (7 - dayOfWeek) % 7 || 7;
  date.setDate(date.getDate() + daysUntilSunday);
  date.setHours(9, 0, 0, 0);
  return date;
}

function isServicePlanningSchemaMissing(message: string | null | undefined) {
  if (!message) return false;
  return (
    /relation\s+"service_(template|run|assignment|template_role_slot|template_timeline_step)"\s+does not exist/i.test(
      message
    ) ||
    /relation\s+"grace_goal"\s+does not exist/i.test(message) ||
    /service planning tables are not initialized/i.test(message)
  );
}

function formatJsonPreview(value: unknown, maxLength = 200) {
  if (value === null || value === undefined) return "No payload";
  try {
    const json = JSON.stringify(value);
    return json.length > maxLength ? `${json.slice(0, maxLength)}...` : json;
  } catch {
    return "Unable to render payload";
  }
}

function getOutcomeBadgeClass(status: GraceActionOutcome["status"]) {
  if (status === "failed") return "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300";
  if (status === "queued") return "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300";
  if (status === "retried") return "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300";
  return "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300";
}

function getServiceRunBadgeClass(status: ServiceRunStatus) {
  if (status === "cancelled") {
    return "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300";
  }
  if (status === "completed") {
    return "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300";
  }
  if (status === "in_progress") {
    return "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300";
  }
  return "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300";
}

function getServiceAssignmentBadgeClass(status: ServiceAssignmentStatus) {
  if (status === "confirmed" || status === "checked_in" || status === "checked_out") {
    return "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300";
  }
  if (status === "offered" || status === "proposed" || status === "needs_replacement") {
    return "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300";
  }
  if (status === "declined" || status === "no_show" || status === "cancelled") {
    return "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300";
  }
  return "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300";
}

function getGraceGoalBadgeClass(status: GraceGoalStatus) {
  if (status === "completed") {
    return "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300";
  }
  if (status === "queued" || status === "waiting" || status === "in_progress") {
    return "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300";
  }
  if (status === "failed" || status === "escalated" || status === "cancelled") {
    return "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300";
  }
  return "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300";
}

function isProviderConfigValid(row: ProviderConfigRow) {
  const validation = (row as { validation?: { isValid?: boolean } }).validation;
  if (validation && validation.isValid === false) {
    return false;
  }
  return true;
}

function getServiceAssigneeLabel(row: ServiceRunAssignmentRow) {
  if (row.staff) return row.staff.name || row.staff.email;
  if (row.contact) return `${row.contact.firstName} ${row.contact.lastName}`;
  if (row.volunteer) return "Volunteer assigned";
  return "Unassigned";
}

function getContactDisplayName(
  row:
    | ConversationRow
    | PhoneCallRow
    | AppointmentRow
) {
  if ("appointment" in row) {
    if (row.contact) return `${row.contact.firstName} ${row.contact.lastName}`;
    return row.appointment.title || "Unknown contact";
  }

  if (row.contact) return `${row.contact.firstName} ${row.contact.lastName}`;
  return row.conversation.subject || "Unknown contact";
}

function getPipelineContactDisplayName(row: PipelineItemRow) {
  if (row.contact) {
    return `${row.contact.firstName} ${row.contact.lastName}`;
  }
  return "Unknown visitor";
}

export default function GraceWorkspacePage() {
  const { organization } = useOrganization();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const orgId = organization?.id;

  const [activeTab, setActiveTab] = useState<GraceTab>("command");

  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);
  const [conversationStats, setConversationStats] = useState<any>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [phoneCalls, setPhoneCalls] = useState<PhoneCallRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [graceCalls, setGraceCalls] = useState<GraceCallRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [followupProposals, setFollowupProposals] = useState<FollowupProposalRow[]>([]);
  const [dailyBriefing, setDailyBriefing] = useState<GraceDailyBriefingRow | null>(null);
  const [toolAuditRows, setToolAuditRows] = useState<ToolAuditRow[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeRow[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfigRow[]>([]);
  const [graceSettings, setGraceSettings] = useState<GraceSettingsRow>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageRow[]>([]);
  const [pipelineItems, setPipelineItems] = useState<PipelineItemRow[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRow[]>([]);
  const [movingVisitorId, setMovingVisitorId] = useState<string | null>(null);
  const [calendarTitle, setCalendarTitle] = useState("");
  const [calendarStartsAt, setCalendarStartsAt] = useState(() =>
    formatDateTimeLocalInput(new Date(Date.now() + 3_600_000))
  );
  const [calendarLocation, setCalendarLocation] = useState("");
  const [calendarCreating, setCalendarCreating] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);

  const [kbTitle, setKbTitle] = useState("");
  const [kbContent, setKbContent] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);

  const [serviceTemplates, setServiceTemplates] = useState<ServiceTemplateBundle[]>([]);
  const [serviceTemplatesLoading, setServiceTemplatesLoading] = useState(false);
  const [servicePlanningSetupRequired, setServicePlanningSetupRequired] =
    useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateType, setNewTemplateType] = useState<ServiceTemplateType>("sunday_am");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, ServiceTemplateRoleDraft>>({});
  const [roleSavingId, setRoleSavingId] = useState<string | null>(null);
  const [roleDeletingId, setRoleDeletingId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleAssignmentType, setNewRoleAssignmentType] =
    useState<RoleAssignmentType>("volunteer");
  const [newRoleRequiredCount, setNewRoleRequiredCount] = useState("1");
  const [newRoleRequired, setNewRoleRequired] = useState(true);
  const [newRoleNotes, setNewRoleNotes] = useState("");
  const [newRoleSaving, setNewRoleSaving] = useState(false);
  const [assignmentServiceAt, setAssignmentServiceAt] = useState(() =>
    formatDateTimeLocalInput(getNextSundayMorning())
  );
  const [assignmentDurationMinutes, setAssignmentDurationMinutes] = useState("90");
  const [includeUnavailableCandidates, setIncludeUnavailableCandidates] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentPreview, setAssignmentPreview] = useState<AssignmentPreviewData | null>(null);
  const [positionPackSaving, setPositionPackSaving] = useState<string | null>(null);
  const [serviceRuns, setServiceRuns] = useState<ServiceRunListRow[]>([]);
  const [serviceRunsLoading, setServiceRunsLoading] = useState(false);
  const [selectedServiceRunId, setSelectedServiceRunId] = useState<string | null>(null);
  const [serviceRunAssignments, setServiceRunAssignments] = useState<ServiceRunAssignmentRow[]>(
    []
  );
  const [serviceRunAssignmentsByRunId, setServiceRunAssignmentsByRunId] = useState<
    Record<string, ServiceRunAssignmentRow[]>
  >({});
  const [serviceRunAssignmentsLoading, setServiceRunAssignmentsLoading] = useState(false);
  const [serviceStaffingGoals, setServiceStaffingGoals] = useState<GraceGoalRow[]>([]);
  const [serviceGoalsLoading, setServiceGoalsLoading] = useState(false);
  const [newServiceRunName, setNewServiceRunName] = useState("");
  const [newServiceRunAt, setNewServiceRunAt] = useState(() =>
    formatDateTimeLocalInput(getNextSundayMorning())
  );
  const [newServiceRunDurationMinutes, setNewServiceRunDurationMinutes] = useState("90");
  const [newServiceRunGenerateAssignments, setNewServiceRunGenerateAssignments] =
    useState(true);
  const [serviceRunCreating, setServiceRunCreating] = useState(false);
  const [serviceRunGenerateSaving, setServiceRunGenerateSaving] = useState(false);
  const [serviceRunOffersSending, setServiceRunOffersSending] = useState(false);
  const [serviceGoalStarting, setServiceGoalStarting] = useState(false);
  const [proposalDecisionId, setProposalDecisionId] = useState<string | null>(null);

  // Grace Command Bar state
  const [graceCommandInput, setGraceCommandInput] = useState("");
  const [graceCommandSending, setGraceCommandSending] = useState(false);
  const [graceCommandThreadId, setGraceCommandThreadId] = useState<string | null>(null);
  const [graceCommandThread, setGraceCommandThread] = useState<Array<{
    role: "user" | "grace";
    content: string;
    outcomes?: GraceActionOutcome[];
  }>>([]);

  const fetchWorkspace = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [
        dashboardData,
        convRows,
        convStats,
        callRows,
        appointmentRows,
        sessionRows,
        graceCallRows,
        approvalRows,
        followupProposalRows,
        dailyBriefingRow,
        toolAudit,
        knowledgeRows,
        providerRows,
        settingsRow,
        pipelineData,
        eventRows,
      ] = await Promise.all([
        getGraceDashboardData(orgId),
        getConversations(orgId),
        getConversationStats(orgId),
        getPhoneCalls(orgId),
        getAppointments(orgId),
        getGraceSessions(orgId),
        getGraceCalls(orgId),
        getGraceApprovals(orgId),
        getGraceFollowupProposals(orgId),
        getGraceDailyBriefing(orgId),
        getGraceToolAudit(orgId),
        getGraceKnowledge(orgId),
        getGraceProviderConfigs(orgId),
        getGraceSettings(orgId),
        getPipelineData(orgId),
        getEvents(orgId),
      ]);

      setDashboard(dashboardData);
      setConversations(convRows);
      setConversationStats(convStats);
      setPhoneCalls(callRows);
      setAppointments(appointmentRows);
      setSessions(sessionRows);
      setGraceCalls(graceCallRows);
      setApprovals(approvalRows);
      setFollowupProposals(followupProposalRows);
      setDailyBriefing(dailyBriefingRow);
      setToolAuditRows(toolAudit);
      setKnowledge(knowledgeRows);
      setProviderConfigs(providerRows);
      setGraceSettings(settingsRow);
      setPipelineStages(pipelineData.stages);
      setPipelineItems(pipelineData.items);
      setCalendarEvents(eventRows);

      if (!selectedConversationId && convRows[0]?.conversation?.id) {
        setSelectedConversationId(convRows[0].conversation.id);
      }
    } catch (error) {
      console.error("Failed to load Grace workspace:", error);
      toast.error("Failed to load Grace workspace");
    } finally {
      setLoading(false);
    }
  }, [orgId, selectedConversationId]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  useEffect(() => {
    setActiveTab(normalizeTab(searchParams.get("tab")));
  }, [searchParams]);

  const switchTab = useCallback(
    (tab: GraceTab) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "command") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const fetchServiceTemplates = useCallback(async () => {
    if (!orgId) return;

    setServiceTemplatesLoading(true);
    try {
      const response = await fetch("/api/app/organizations/current/service-templates", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        setupRequired?: boolean;
        serviceTemplates?: ServiceTemplateBundle[];
      };

      if (payload.setupRequired) {
        setServicePlanningSetupRequired(
          payload.message ||
            "Service planning tables are not initialized yet. Apply migrations and refresh."
        );
        setServiceTemplates([]);
        setSelectedTemplateId(null);
        return;
      }

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "Failed to load service templates");
      }

      const templates = payload.serviceTemplates ?? [];
      setServicePlanningSetupRequired(null);
      setServiceTemplates(templates);
      setSelectedTemplateId((current) => {
        if (current && templates.some((item) => item.template.id === current)) {
          return current;
        }
        return templates[0]?.template.id ?? null;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load service templates";

      if (isServicePlanningSchemaMissing(message)) {
        setServicePlanningSetupRequired(
          "Service planning tables are not initialized yet. Apply migrations and refresh."
        );
        setServiceTemplates([]);
        setSelectedTemplateId(null);
        return;
      }

      console.error("Failed to load service templates:", error);
      toast.error(message);
    } finally {
      setServiceTemplatesLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchServiceTemplates();
  }, [fetchServiceTemplates]);

  const fetchServiceRuns = useCallback(async () => {
    if (!orgId) return;
    setServiceRunsLoading(true);
    try {
      const response = await fetch("/api/app/organizations/current/service-runs", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        serviceRuns?: ServiceRunListRow[];
      };

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "Failed to load service runs");
      }

      const runs = payload.serviceRuns ?? [];
      setServiceRuns(runs);
      setSelectedServiceRunId((current) => getPreferredServiceRunId(runs, current));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load service runs";

      if (isServicePlanningSchemaMissing(message)) {
        setServicePlanningSetupRequired(
          "Service planning tables are not initialized yet. Apply migrations and refresh."
        );
        setServiceRuns([]);
        setSelectedServiceRunId(null);
        return;
      }

      console.error("Failed to load service runs:", error);
      toast.error(message);
    } finally {
      setServiceRunsLoading(false);
    }
  }, [orgId]);

  const fetchServiceRunAssignments = useCallback(
    async (serviceRunId: string, options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      if (!silent) {
        setServiceRunAssignmentsLoading(true);
      }

      try {
        const response = await fetch(
          `/api/app/organizations/current/service-runs/${serviceRunId}/assignments`,
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          message?: string;
          assignments?: ServiceRunAssignmentRow[];
        };

        if (!response.ok || payload.success === false) {
          throw new Error(payload.message || "Failed to load service assignments");
        }

        const assignments = payload.assignments ?? [];
        setServiceRunAssignmentsByRunId((previous) => ({
          ...previous,
          [serviceRunId]: assignments,
        }));
        if (serviceRunId === selectedServiceRunId) {
          setServiceRunAssignments(assignments);
        }
      } catch (error) {
        console.error("Failed to load service assignments:", error);
        if (!silent) {
          toast.error(
            error instanceof Error ? error.message : "Failed to load service assignments"
          );
        }
        if (serviceRunId === selectedServiceRunId) {
          setServiceRunAssignments([]);
        }
      } finally {
        if (!silent) {
          setServiceRunAssignmentsLoading(false);
        }
      }
    },
    [selectedServiceRunId]
  );

  const fetchServiceStaffingGoals = useCallback(async () => {
    if (!orgId) return;
    setServiceGoalsLoading(true);
    try {
      const response = await fetch(
        "/api/app/organizations/current/grace/goals?goalType=service_staffing",
        {
          cache: "no-store",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        goals?: GraceGoalRow[];
      };

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "Failed to load Grace staffing goals");
      }

      setServiceStaffingGoals(payload.goals ?? []);
    } catch (error) {
      console.error("Failed to load Grace staffing goals:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load Grace staffing goals"
      );
      setServiceStaffingGoals([]);
    } finally {
      setServiceGoalsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchServiceRuns();
    fetchServiceStaffingGoals();
  }, [fetchServiceRuns, fetchServiceStaffingGoals]);

  useEffect(() => {
    if (!selectedServiceRunId) {
      setServiceRunAssignments([]);
      return;
    }
    const cachedAssignmentsForRun =
      serviceRunAssignmentsByRunId[selectedServiceRunId];
    if (cachedAssignmentsForRun) {
      setServiceRunAssignments(cachedAssignmentsForRun);
      return;
    }
    fetchServiceRunAssignments(selectedServiceRunId);
  }, [
    fetchServiceRunAssignments,
    selectedServiceRunId,
    serviceRunAssignmentsByRunId,
  ]);

  useEffect(() => {
    if (!selectedServiceRunId) return;

    const intervalId = window.setInterval(() => {
      fetchServiceRunAssignments(selectedServiceRunId, { silent: true });
    }, 30_000);

    return () => window.clearInterval(intervalId);
  }, [fetchServiceRunAssignments, selectedServiceRunId]);

  const selectedServiceTemplate = useMemo(
    () => serviceTemplates.find((item) => item.template.id === selectedTemplateId) ?? null,
    [serviceTemplates, selectedTemplateId]
  );

  const selectedServiceRun = useMemo(
    () => serviceRuns.find((item) => item.run.id === selectedServiceRunId) ?? null,
    [serviceRuns, selectedServiceRunId]
  );

  const selectedServiceRunTemplate = useMemo(() => {
    if (!selectedServiceRun?.run.templateId) return null;
    return (
      serviceTemplates.find(
        (templateBundle) => templateBundle.template.id === selectedServiceRun.run.templateId
      ) ?? null
    );
  }, [selectedServiceRun, serviceTemplates]);

  const nextUpcomingServiceRun = useMemo(
    () => getNextUpcomingServiceRun(serviceRuns),
    [serviceRuns]
  );

  const commandServiceRun = useMemo(
    () => nextUpcomingServiceRun ?? selectedServiceRun,
    [nextUpcomingServiceRun, selectedServiceRun]
  );

  const commandServiceRunTemplate = useMemo(() => {
    if (!commandServiceRun?.run.templateId) return null;
    return (
      serviceTemplates.find(
        (templateBundle) => templateBundle.template.id === commandServiceRun.run.templateId
      ) ?? null
    );
  }, [commandServiceRun, serviceTemplates]);

  const commandServiceRunAssignments = useMemo(() => {
    if (!commandServiceRun) return [];
    if (commandServiceRun.run.id === selectedServiceRunId) {
      return serviceRunAssignments;
    }
    return serviceRunAssignmentsByRunId[commandServiceRun.run.id] ?? [];
  }, [
    commandServiceRun,
    selectedServiceRunId,
    serviceRunAssignments,
    serviceRunAssignmentsByRunId,
  ]);

  const commandServiceAssignmentsLoaded = useMemo(() => {
    if (!commandServiceRun) return false;
    return Boolean(
      serviceRunAssignmentsByRunId[commandServiceRun.run.id] ||
        commandServiceRun.run.id === selectedServiceRunId
    );
  }, [commandServiceRun, selectedServiceRunId, serviceRunAssignmentsByRunId]);

  const commandServiceRunAssignmentsCached = commandServiceRun
    ? serviceRunAssignmentsByRunId[commandServiceRun.run.id]
    : undefined;

  useEffect(() => {
    if (!commandServiceRun) return;
    if (commandServiceRunAssignmentsCached) return;
    fetchServiceRunAssignments(commandServiceRun.run.id, { silent: true });
  }, [
    commandServiceRun,
    commandServiceRunAssignmentsCached,
    fetchServiceRunAssignments,
  ]);

  useEffect(() => {
    if (!selectedServiceTemplate) {
      setRoleDrafts({});
      return;
    }

    const nextDrafts: Record<string, ServiceTemplateRoleDraft> = {};
    for (const roleSlot of selectedServiceTemplate.roleSlots) {
      nextDrafts[roleSlot.id] = {
        roleName: roleSlot.roleName,
        assignmentType: roleSlot.assignmentType,
        requiredCount: String(roleSlot.requiredCount),
        isRequired: roleSlot.isRequired,
        notes: roleSlot.notes ?? "",
      };
    }
    setRoleDrafts(nextDrafts);
  }, [selectedServiceTemplate]);

  useEffect(() => {
    setAssignmentPreview(null);
  }, [selectedTemplateId]);

  const roleMatrixStats = useMemo(() => {
    if (!selectedServiceTemplate) {
      return {
        roleSlots: 0,
        requiredSeats: 0,
        paidStaffSeats: 0,
        volunteerSeats: 0,
        eitherSeats: 0,
      };
    }

    const enabledRoleSlots = selectedServiceTemplate.roleSlots.filter(
      (roleSlot) => roleSlot.isEnabled
    );

    return enabledRoleSlots.reduce(
      (acc, roleSlot) => {
        const seats = roleSlot.requiredCount;
        acc.roleSlots += 1;
        if (roleSlot.isRequired) {
          acc.requiredSeats += seats;
        }

        if (roleSlot.assignmentType === "paid_staff") {
          acc.paidStaffSeats += seats;
        } else if (roleSlot.assignmentType === "volunteer") {
          acc.volunteerSeats += seats;
        } else {
          acc.eitherSeats += seats;
        }
        return acc;
      },
      {
        roleSlots: 0,
        requiredSeats: 0,
        paidStaffSeats: 0,
        volunteerSeats: 0,
        eitherSeats: 0,
      }
    );
  }, [selectedServiceTemplate]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const loadMessages = async () => {
      setMessagesLoading(true);
      try {
        const rows = await getConversationMessages(selectedConversationId);
        setMessages(rows);
      } catch (error) {
        console.error("Failed to load conversation messages:", error);
        toast.error("Failed to load conversation thread");
      } finally {
        setMessagesLoading(false);
      }
    };

    loadMessages();
  }, [selectedConversationId]);

  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
  const waitingConversations = Number(conversationStats?.waiting ?? 0);

  const activeConversation = useMemo(
    () => conversations.find((row) => row.conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const nowMs = Date.now();
  const fortyEightHoursMs = nowMs + 48 * 60 * 60 * 1000;
  const followupRows = useMemo(
    () =>
      conversations.filter(
        (row) => row.conversation.status === "open" || row.conversation.status === "waiting"
      ),
    [conversations]
  );

  const staleFollowups = useMemo(
    () =>
      followupRows.filter((row) => {
        const lastTouched = row.conversation.lastMessageAt || row.conversation.updatedAt || row.conversation.createdAt;
        return new Date(lastTouched).getTime() <= nowMs - 24 * 60 * 60 * 1000;
      }),
    [followupRows, nowMs]
  );

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((row) => {
          const status = row.appointment.status;
          if (
            status === "cancelled" ||
            status === "completed" ||
            status === "no_show"
          ) {
            return false;
          }
          return new Date(row.appointment.dateTime).getTime() >= nowMs;
        })
        .sort(
          (a, b) =>
            new Date(a.appointment.dateTime).getTime() -
            new Date(b.appointment.dateTime).getTime()
        ),
    [appointments, nowMs]
  );

  const upcomingPastoralAppointments = useMemo(
    () =>
      upcomingAppointments.filter(
        (row) => new Date(row.appointment.dateTime).getTime() <= fortyEightHoursMs
      ),
    [fortyEightHoursMs, upcomingAppointments]
  );

  const visitorsByStage = useMemo(() => {
    return pipelineStages.map((stage) => ({
      stage,
      items: pipelineItems
        .filter((row) => row.item.stageId === stage.id)
        .sort((a, b) => a.item.order - b.item.order),
    }));
  }, [pipelineItems, pipelineStages]);

  const firstTimeStage = useMemo(
    () =>
      pipelineStages.find((stage) =>
        /first|visitor/i.test(stage.name)
      ),
    [pipelineStages]
  );

  const firstTimeVisitorCount = useMemo(() => {
    if (!firstTimeStage) return 0;
    return pipelineItems.filter((row) => row.item.stageId === firstTimeStage.id).length;
  }, [firstTimeStage, pipelineItems]);

  const appointmentCalendarItems = useMemo<CalendarSurfaceItem[]>(
    () =>
      appointments
        .filter(
          (row) =>
            row.appointment.status === "scheduled" ||
            row.appointment.status === "confirmed"
        )
        .map((row) => ({
          id: `appointment-${row.appointment.id}`,
          title: row.appointment.title,
          startDate: row.appointment.dateTime,
          location: null,
          source: "appointment",
          appointmentId: row.appointment.id,
          appointmentStatus: row.appointment.status,
          contactName: row.contact
            ? `${row.contact.firstName} ${row.contact.lastName}`
            : undefined,
        })),
    [appointments]
  );

  const calendarSurfaceItems = useMemo<CalendarSurfaceItem[]>(
    () =>
      [
        ...calendarEvents.map((event) => ({
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          location: event.location,
          source: "event" as const,
        })),
        ...appointmentCalendarItems,
      ].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      ),
    [appointmentCalendarItems, calendarEvents]
  );

  const upcomingCalendarEvents = useMemo(
    () =>
      calendarSurfaceItems.filter(
        (event) => new Date(event.startDate).getTime() >= nowMs
      ),
    [calendarSurfaceItems, nowMs]
  );

  const calendarEventsNext7Days = useMemo(
    () =>
      upcomingCalendarEvents.filter(
        (event) =>
          new Date(event.startDate).getTime() <= nowMs + 7 * 24 * 60 * 60 * 1000
      ).length,
    [nowMs, upcomingCalendarEvents]
  );

  const calendarMonthLabel = useMemo(
    () =>
      calendarViewDate.toLocaleString("default", {
        month: "long",
        year: "numeric",
      }),
    [calendarViewDate]
  );

  const calendarGridCells = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: Array<{ day: number | null; events: CalendarSurfaceItem[] }> = [];

    for (let index = 0; index < firstDay; index += 1) {
      cells.push({ day: null, events: [] });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const eventsForDay = calendarSurfaceItems.filter((event) => {
        const eventDate = new Date(event.startDate);
        return (
          eventDate.getFullYear() === year &&
          eventDate.getMonth() === month &&
          eventDate.getDate() === day
        );
      });

      cells.push({
        day,
        events: eventsForDay.sort(
          (a, b) =>
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        ),
      });
    }

    return cells;
  }, [calendarSurfaceItems, calendarViewDate]);

  const setupChecklist = useMemo(() => {
    const activeProviderRows = providerConfigs.filter(
      (row) => row.isActive && row.mode !== "disabled"
    );
    const activeChannelSet = new Set(activeProviderRows.map((row) => row.channel));
    const geminiReady = activeProviderRows.some(
      (row) => row.provider === "gemini" && isProviderConfigValid(row)
    );
    const smsReady = activeProviderRows.some(
      (row) => row.channel === "sms" && isProviderConfigValid(row)
    );
    const voiceReplyReady = activeProviderRows.some(
      (row) =>
        (row.provider === "elevenlabs" || row.channel === "voice") &&
        isProviderConfigValid(row)
    );

    const profileReady =
      Boolean(graceSettings?.churchName?.trim()) && Boolean(graceSettings?.churchCity?.trim());
    const contactsReady = Number(dashboard?.kpi?.totalContacts ?? 0) >= 25;
    const channelsReady = geminiReady && smsReady;
    const knowledgeReady = knowledge.length >= 3;
    const liveTrafficReady =
      sessions.length > 0 || conversations.length > 0 || appointments.length > 0;

    const channelDetail = channelsReady
      ? `${activeChannelSet.size} active channels with AI + SMS ready`
      : !geminiReady
        ? "Configure Gemini provider for Grace command and voice runtime"
        : "Configure SMS provider for assignment offers and member follow-up";

    return [
      {
        id: "profile",
        title: "Church profile is configured",
        detail: profileReady
          ? `${graceSettings?.churchName || "Church"} profile loaded`
          : "Add church city and profile context for accurate responses",
        done: profileReady,
      },
      {
        id: "contacts",
        title: "People data is imported",
        detail: `${Number(dashboard?.kpi?.totalContacts ?? 0)} contacts available`,
        done: contactsReady,
      },
      {
        id: "channels",
        title: "Provider stack is launch-ready",
        detail: channelDetail,
        done: channelsReady,
      },
      {
        id: "voice",
        title: "Voice response stack is configured",
        detail: voiceReplyReady
          ? "Voice response provider ready"
          : "Optional but recommended: configure ElevenLabs for spoken replies",
        done: voiceReplyReady,
      },
      {
        id: "knowledge",
        title: "Grace knowledge is seeded",
        detail: `${knowledge.length} knowledge entr${
          knowledge.length === 1 ? "y" : "ies"
        }`,
        done: knowledgeReady,
      },
      {
        id: "traffic",
        title: "Real ministry traffic is flowing",
        detail: `${sessions.length} sessions, ${conversations.length} conversations`,
        done: liveTrafficReady,
      },
    ];
  }, [
    appointments.length,
    conversations.length,
    dashboard?.kpi?.totalContacts,
    graceSettings?.churchCity,
    graceSettings?.churchName,
    knowledge.length,
    providerConfigs,
    sessions.length,
  ]);

  const setupCompleted = setupChecklist.filter((item) => item.done).length;
  const setupProgress = Math.round((setupCompleted / setupChecklist.length) * 100);

  const executionOutcomes = useMemo<GraceActionOutcome[]>(() => {
    const queuedOutcomes: GraceActionOutcome[] = approvals
      .filter((approval) => approval.status === "pending")
      .map((approval) => {
        const action = (approval.proposedAction ?? {}) as Record<string, unknown>;
        const actionId = typeof action.id === "string" ? action.id : approval.id;
        const tool = typeof action.tool === "string" ? action.tool : "unknown.tool";
        const reason =
          typeof action.reason === "string" ? action.reason : "Awaiting human approval before execution.";
        const requiresApproval =
          typeof action.requiresApproval === "boolean" ? action.requiresApproval : true;
        return {
          actionId,
          tool,
          reason,
          requiresApproval,
          status: "queued",
          approvalId: approval.id,
          output: { approvalQueued: true, approvalId: approval.id },
          occurredAt: new Date(approval.createdAt).toISOString(),
        };
      });

    const auditOutcomes: GraceActionOutcome[] = toolAuditRows.map((row) => {
      const output = row.outputJson ?? undefined;
      const retried =
        output && typeof output.retried === "boolean"
          ? output.retried
          : Boolean(
              output &&
                typeof output.retryCount === "number" &&
                output.retryCount > 1
            );

      const errorMessage =
        row.status === "error"
          ? output && typeof output.error === "string"
            ? output.error
            : "Execution failed"
          : undefined;

      return {
        actionId: row.idempotencyKey || row.id,
        tool: row.toolName,
        reason: "Executed by Grace runtime",
        requiresApproval: false,
        status: row.status === "error" ? "failed" : retried ? "retried" : "executed",
        output,
        error: errorMessage,
        occurredAt: new Date(row.createdAt).toISOString(),
      };
    });

    return [...queuedOutcomes, ...auditOutcomes]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 30);
  }, [approvals, toolAuditRows]);

  const sequenceRuns = useMemo(() => {
    return followupProposals.slice(0, 30).map((proposal) => {
      const metadata =
        proposal.metadataJson && typeof proposal.metadataJson === "object"
          ? (proposal.metadataJson as Record<string, unknown>)
          : null;
      const sequenceName =
        metadata && typeof metadata.sequence === "string"
          ? metadata.sequence
          : "manual_follow_up";
      const stepName = metadata && typeof metadata.step === "string" ? metadata.step : null;

      return {
        id: proposal.id,
        sequenceName,
        stepName,
        status: proposal.status,
        messageText: proposal.messageText,
        reason: proposal.reason,
        createdAt: proposal.createdAt,
        channel: proposal.proposedChannel || proposal.channel,
      };
    });
  }, [followupProposals]);

  const sequenceStats = useMemo(() => {
    const totals = {
      sent: 0,
      pending: 0,
      rejected: 0,
      approved: 0,
    };
    for (const proposal of followupProposals) {
      if (proposal.status === "sent") totals.sent += 1;
      if (proposal.status === "pending") totals.pending += 1;
      if (proposal.status === "rejected") totals.rejected += 1;
      if (proposal.status === "approved") totals.approved += 1;
    }
    return totals;
  }, [followupProposals]);

  const pendingProposalQueue = useMemo(
    () =>
      followupProposals
        .filter((proposal) => proposal.status === "pending")
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 20),
    [followupProposals]
  );

  const serviceAssignmentStats = useMemo(() => {
    const totals = {
      total: serviceRunAssignments.length,
      proposed: 0,
      offered: 0,
      confirmed: 0,
      declined: 0,
      unassigned: 0,
    };

    for (const row of serviceRunAssignments) {
      const status = row.assignment.status;
      if (status === "proposed") totals.proposed += 1;
      if (status === "offered") totals.offered += 1;
      if (status === "confirmed") totals.confirmed += 1;
      if (status === "declined" || status === "needs_replacement") totals.declined += 1;
      if (!row.assignment.volunteerId && !row.assignment.staffUserId) {
        totals.unassigned += 1;
      }
    }

    return totals;
  }, [serviceRunAssignments]);

  const serviceRunRoleMatrix = useMemo<ServiceRunMatrixRow[]>(() => {
    if (!selectedServiceRunTemplate) return [];
    return buildServiceRunRoleMatrix(
      selectedServiceRunTemplate.roleSlots,
      serviceRunAssignments,
      SERVICE_ASSIGNMENT_AT_RISK_STATUSES
    );
  }, [selectedServiceRunTemplate, serviceRunAssignments]);

  const serviceRunCoverageSummary = useMemo(() => {
    return summarizeRoleMatrix(serviceRunRoleMatrix);
  }, [serviceRunRoleMatrix]);

  const commandServiceRoleMatrix = useMemo(() => {
    if (!commandServiceRunTemplate) return [];
    return buildServiceRunRoleMatrix(
      commandServiceRunTemplate.roleSlots,
      commandServiceRunAssignments,
      SERVICE_ASSIGNMENT_AT_RISK_STATUSES
    );
  }, [commandServiceRunAssignments, commandServiceRunTemplate]);

  const commandServiceCoverageSummary = useMemo(
    () => summarizeRoleMatrix(commandServiceRoleMatrix),
    [commandServiceRoleMatrix]
  );

  const commandServiceOpenRoles = useMemo(
    () =>
      commandServiceRoleMatrix
        .filter((row) => row.seatsOpen > 0)
        .sort((a, b) => Number(b.isRequired) - Number(a.isRequired) || b.seatsOpen - a.seatsOpen),
    [commandServiceRoleMatrix]
  );

  const runOfServiceOverview = useMemo<RunOfServiceOverviewStep[]>(() => {
    if (!selectedServiceRun) return [];

    const serviceAt = new Date(selectedServiceRun.run.serviceAt);
    const serviceDurationMinutes = Math.max(selectedServiceRun.run.durationMinutes, 30);
    const roleBySlotId = new Map(
      serviceRunRoleMatrix.map((row) => [row.roleSlotId, row] as const)
    );

    const getCoverageForRole = (role: ServiceRunMatrixRow | undefined) => {
      if (!role) {
        return { label: "Owner not mapped", tone: "neutral" as const };
      }
      if (role.seatsOpen > 0) {
        return {
          label: `${role.seatsOpen} open seat${role.seatsOpen === 1 ? "" : "s"}`,
          tone: "attention" as const,
        };
      }
      return {
        label: role.seatsConfirmed > 0 ? "Ready (confirmed)" : "Ready",
        tone: "healthy" as const,
      };
    };

    if (selectedServiceRunTemplate && selectedServiceRunTemplate.timelineSteps.length > 0) {
      return selectedServiceRunTemplate.timelineSteps
        .slice()
        .sort(
          (a, b) => a.offsetMinutes - b.offsetMinutes || a.sortOrder - b.sortOrder
        )
        .map((step) => {
          const ownerRole = step.ownerRoleSlotId
            ? roleBySlotId.get(step.ownerRoleSlotId)
            : undefined;
          const coverage = getCoverageForRole(ownerRole);

          return {
            id: step.id,
            title: step.title,
            detail: step.description ?? "Template timeline step",
            startAt: new Date(serviceAt.getTime() + step.offsetMinutes * 60_000),
            durationMinutes: step.durationMinutes ?? null,
            ownerLabel: ownerRole?.roleName ?? "Operations lead",
            coverageLabel: coverage.label,
            coverageTone: coverage.tone,
          };
        });
    }

    const fallbackCoverageTone =
      serviceRunCoverageSummary.seatsOpen > 0 ? ("attention" as const) : ("healthy" as const);
    const fallbackCoverageLabel =
      serviceRunCoverageSummary.seatsOpen > 0
        ? `${serviceRunCoverageSummary.seatsOpen} open seats`
        : "All seats covered";

    return [
      {
        id: "volunteer-call",
        title: "Volunteer Call Time",
        detail: "Teams arrive, check in, and prep stations.",
        startAt: new Date(serviceAt.getTime() - 45 * 60_000),
        durationMinutes: 15,
        ownerLabel: "Operations",
        coverageLabel: fallbackCoverageLabel,
        coverageTone: fallbackCoverageTone,
      },
      {
        id: "team-huddle",
        title: "Team Huddle",
        detail: "Leads align run sheet, safety, and contingencies.",
        startAt: new Date(serviceAt.getTime() - 15 * 60_000),
        durationMinutes: 10,
        ownerLabel: "Department leads",
        coverageLabel: fallbackCoverageLabel,
        coverageTone: fallbackCoverageTone,
      },
      {
        id: "service-window",
        title: "Service Window",
        detail: "Main service delivery and guest coverage.",
        startAt: serviceAt,
        durationMinutes: serviceDurationMinutes,
        ownerLabel: "All ministry teams",
        coverageLabel: fallbackCoverageLabel,
        coverageTone: fallbackCoverageTone,
      },
      {
        id: "post-service",
        title: "Post-Service Reset",
        detail: "Room reset, debrief, and follow-up logging.",
        startAt: new Date(serviceAt.getTime() + serviceDurationMinutes * 60_000),
        durationMinutes: 20,
        ownerLabel: "Operations",
        coverageLabel: fallbackCoverageLabel,
        coverageTone: fallbackCoverageTone,
      },
    ];
  }, [
    selectedServiceRun,
    selectedServiceRunTemplate,
    serviceRunCoverageSummary.seatsOpen,
    serviceRunRoleMatrix,
  ]);

  const selectedRunGoals = useMemo(() => {
    if (!selectedServiceRunId) return serviceStaffingGoals;
    return serviceStaffingGoals.filter(
      (row) => row.goal.serviceRunId === selectedServiceRunId
    );
  }, [selectedServiceRunId, serviceStaffingGoals]);

  type NextAction = {
    id: string;
    title: string;
    reason: string;
    impact: string;
    risk: "high" | "medium" | "low";
    cta: string;
    tab?: GraceTab;
    path?: string;
    conversationId?: string;
  };

  const nextActions = useMemo<NextAction[]>(() => {
    const actions: Array<NextAction & { priority: number }> = [];
    const firstPendingApproval = approvals.find((row) => row.status === "pending");
    const firstServiceGap = commandServiceOpenRoles[0];
    const firstStaleFollowup = staleFollowups[0];
    const nextAppointment = upcomingPastoralAppointments[0];
    const nextCalendarEvent = upcomingCalendarEvents[0];
    const profileMissing = !setupChecklist.find((item) => item.id === "profile")?.done;
    const contactsMissing = !setupChecklist.find((item) => item.id === "contacts")?.done;

    if (firstPendingApproval) {
      actions.push({
        id: `approval-${firstPendingApproval.id}`,
        title: `Review ${pendingApprovals} pending Grace approval${pendingApprovals === 1 ? "" : "s"}`,
        reason: "Grace is waiting on human authorization before executing high-risk actions.",
        impact: "Unblocks pastoral follow-up and outbound communication safely.",
        risk: "high",
        cta: "Open Approval Queue",
        tab: "center",
        priority: 100,
      });
    }

    if (commandServiceRun && firstServiceGap) {
      actions.push({
        id: `service-gap-${commandServiceRun.run.id}-${firstServiceGap.roleSlotId}`,
        title: `Fill ${firstServiceGap.roleName} for ${commandServiceRun.run.name}`,
        reason: `${firstServiceGap.seatsOpen} open seat${firstServiceGap.seatsOpen === 1 ? "" : "s"} · ${commandServiceCoverageSummary.coveragePercent}% staffed overall.`,
        impact: "Protects service execution quality and avoids last-minute swaps.",
        risk: firstServiceGap.isRequired ? "high" : "medium",
        cta: "Open Service Staffing",
        tab: "operations",
        priority: 96,
      });
    }

    if (!commandServiceRun && serviceTemplates.length > 0) {
      actions.push({
        id: "service-run-missing",
        title: "Create the next service run",
        reason: "Templates exist, but no upcoming service run is scheduled.",
        impact: "Restores staffing workflow, offer sends, and run-of-service tracking.",
        risk: "high",
        cta: "Open Service Planner",
        tab: "operations",
        priority: 94,
      });
    }

    if (firstStaleFollowup) {
      actions.push({
        id: `followup-${firstStaleFollowup.conversation.id}`,
        title: `Respond to ${getContactDisplayName(firstStaleFollowup)}`,
        reason: `Follow-up has been waiting ${fmtDurationFromNow(
          firstStaleFollowup.conversation.lastMessageAt || firstStaleFollowup.conversation.updatedAt
        )}.`,
        impact: "Improves care response speed for members and guests.",
        risk: "medium",
        cta: "Open Thread",
        tab: "inbox",
        conversationId: firstStaleFollowup.conversation.id,
        priority: 90,
      });
    }

    if (nextAppointment) {
      actions.push({
        id: `appointment-${nextAppointment.appointment.id}`,
        title: `Confirm ${getContactDisplayName(nextAppointment)} appointment`,
        reason: `${fmtDateTime(nextAppointment.appointment.dateTime)} (${fmtDurationFromNow(
          nextAppointment.appointment.dateTime
        )}).`,
        impact: "Prevents no-shows and protects pastoral care continuity.",
        risk: "medium",
        cta: "Open Command Overview",
        tab: "command",
        priority: 80,
      });
    }

    if (firstTimeVisitorCount > 0) {
      actions.push({
        id: "visitors-first-time",
        title: `Triage ${firstTimeVisitorCount} first-time visitor${
          firstTimeVisitorCount === 1 ? "" : "s"
        }`,
        reason: "Visitor pipeline requires next-step assignment and follow-up ownership.",
        impact: "Prevents visitor drop-off and keeps Grace follow-up sequences current.",
        risk: "medium",
        cta: "Open Visitor Kanban",
        tab: "visitors",
        priority: 78,
      });
    }

    if (nextCalendarEvent) {
      actions.push({
        id: `calendar-${nextCalendarEvent.id}`,
        title: `Prepare Grace workflow for ${nextCalendarEvent.title}`,
        reason: `${fmtDateTime(nextCalendarEvent.startDate)} is next on the ministry calendar.`,
        impact: "Aligns reminders, staffing, and communication before the event window.",
        risk: "low",
        cta: "Open Calendar",
        tab: "calendar",
        priority: 74,
      });
    }

    if (profileMissing || contactsMissing) {
      actions.push({
        id: "setup",
        title: "Complete Grace launch setup",
        reason: profileMissing
          ? "Grace profile details are incomplete."
          : "People records are below launch-ready threshold.",
        impact: "Makes Grace responses church-specific and reduces manual agency setup.",
        risk: "low",
        cta: "Open Setup",
        path: "/app/get-started",
        priority: 70,
      });
    }

    return actions.sort((a, b) => b.priority - a.priority).slice(0, 4);
  }, [
    approvals,
    commandServiceCoverageSummary.coveragePercent,
    commandServiceOpenRoles,
    commandServiceRun,
    pendingApprovals,
    serviceTemplates.length,
    staleFollowups,
    upcomingPastoralAppointments,
    firstTimeVisitorCount,
    upcomingCalendarEvents,
    setupChecklist,
  ]);

  const commandNextServiceLabel = commandServiceRun
    ? fmtDurationFromNow(commandServiceRun.run.serviceAt)
    : "not scheduled";
  const commandCoverageLabel = commandServiceRun
    ? commandServiceAssignmentsLoaded
      ? `${commandServiceCoverageSummary.coveragePercent}%`
      : "syncing"
    : "--";

  const auraState = sending ? "speaking" : loading ? "thinking" : "listening";

  const workspaceTabs = useMemo(
    () => [
      {
        value: "command" as GraceTab,
        label: "Overview",
        detail: "Grace command",
        icon: "robot_2",
        badge: `${setupProgress}%`,
      },
      {
        value: "center" as GraceTab,
        label: "Approvals",
        detail: "Human in the loop",
        icon: "shield_person",
        badge: pendingApprovals > 0 ? String(pendingApprovals) : null,
      },
      {
        value: "inbox" as GraceTab,
        label: "Inbox",
        detail: "Calls, SMS, email",
        icon: "inbox",
        badge:
          waitingConversations + graceCalls.length + followupProposals.length > 0
            ? String(waitingConversations + graceCalls.length + followupProposals.length)
            : null,
      },
      {
        value: "visitors" as GraceTab,
        label: "Guests",
        detail: "Visitor journey",
        icon: "groups",
        badge: firstTimeVisitorCount > 0 ? String(firstTimeVisitorCount) : null,
      },
      {
        value: "calendar" as GraceTab,
        label: "Schedule",
        detail: "Services + events",
        icon: "event",
        badge: calendarEventsNext7Days > 0 ? String(calendarEventsNext7Days) : null,
      },
      {
        value: "operations" as GraceTab,
        label: "Service Plans",
        detail: "Teams + run sheets",
        icon: "deployed_code",
        badge:
          serviceAssignmentStats.unassigned > 0
            ? `${serviceAssignmentStats.unassigned} gaps`
            : null,
      },
    ],
    [
      calendarEventsNext7Days,
      firstTimeVisitorCount,
      followupProposals.length,
      graceCalls.length,
      pendingApprovals,
      serviceAssignmentStats.unassigned,
      setupProgress,
      waitingConversations,
    ]
  );

  const handleSend = async () => {
    if (!selectedConversationId || !composerText.trim()) return;
    const content = composerText.trim();
    setComposerText("");
    setSending(true);

    try {
      await addMessage({
        conversationId: selectedConversationId,
        content,
        direction: "outbound",
        senderType: "human",
      });
      const refreshed = await getConversationMessages(selectedConversationId);
      setMessages(refreshed);
      await fetchWorkspace();
      toast.success("Message sent");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
      setComposerText(content);
    } finally {
      setSending(false);
    }
  };

  const handleResolveConversation = async (id: string) => {
    try {
      await updateConversationStatus(id, "resolved");
      await fetchWorkspace();
      toast.success("Conversation resolved");
    } catch (error) {
      console.error("Failed to resolve conversation:", error);
      toast.error("Failed to resolve conversation");
    }
  };

  const handleCancelAppointment = async (id: string) => {
    try {
      await updateAppointment(id, { status: "cancelled" });
      await fetchWorkspace();
      toast.success("Appointment canceled");
    } catch (error) {
      console.error("Failed to cancel appointment:", error);
      toast.error("Failed to cancel appointment");
    }
  };

  const triggerGraceFromContext = useCallback(
    async (message: string) => {
      if (!orgId) return;
      try {
        await sendCopilotMessage({
          organizationId: orgId,
          message,
        });
        await fetchWorkspace();
      } catch (error) {
        console.error("Failed to trigger Grace context action:", error);
      }
    },
    [fetchWorkspace, orgId]
  );

  const handleGraceCommand = useCallback(async () => {
    const msg = graceCommandInput.trim();
    if (!msg || !orgId || graceCommandSending) return;
    setGraceCommandInput("");
    setGraceCommandSending(true);
    setGraceCommandThread((prev) => [...prev, { role: "user", content: msg }]);
    try {
      const result = await sendCopilotMessage({
        organizationId: orgId,
        message: msg,
        sessionId: graceCommandThreadId ?? undefined,
      });
      setGraceCommandThreadId(result.sessionId);
      setGraceCommandThread((prev) => [
        ...prev,
        {
          role: "grace",
          content: result.response,
          outcomes: result.actionOutcomes ?? [],
        },
      ]);
      await fetchWorkspace();
    } catch {
      toast.error("Grace failed to respond");
    } finally {
      setGraceCommandSending(false);
    }
  }, [graceCommandInput, orgId, graceCommandSending, graceCommandThreadId, fetchWorkspace]);

  const handleMoveVisitorStage = useCallback(
    async (itemId: string, stageId: string) => {
      if (!orgId) return;
      const row = pipelineItems.find((entry) => entry.item.id === itemId);
      const targetStage = pipelineStages.find((stage) => stage.id === stageId);
      if (!row || !targetStage) return;

      setMovingVisitorId(itemId);
      try {
        await updateItemStage(itemId, stageId, 0);
        await fetchWorkspace();
        toast.success(`${getPipelineContactDisplayName(row)} moved to ${targetStage.name}`);

        const contactName = getPipelineContactDisplayName(row);
        await triggerGraceFromContext(
          `Visitor pipeline update: ${contactName} was moved to "${targetStage.name}". Determine and queue the next best follow-up action for staff.`
        );
      } catch (error) {
        console.error("Failed to move visitor stage:", error);
        toast.error("Failed to update visitor stage");
      } finally {
        setMovingVisitorId(null);
      }
    },
    [fetchWorkspace, orgId, pipelineItems, pipelineStages, triggerGraceFromContext]
  );

  const handleCreateCalendarEvent = useCallback(async () => {
    if (!orgId) return;
    const title = calendarTitle.trim();
    if (!title) {
      toast.error("Event title is required");
      return;
    }
    const startsAt = new Date(calendarStartsAt);
    if (Number.isNaN(startsAt.getTime())) {
      toast.error("Select a valid start date and time");
      return;
    }

    setCalendarCreating(true);
    try {
      const created = await createEvent({
        organizationId: orgId,
        title,
        startDate: startsAt,
        location: calendarLocation.trim() || undefined,
      });
      setCalendarTitle("");
      setCalendarLocation("");
      setCalendarStartsAt(formatDateTimeLocalInput(new Date(Date.now() + 3_600_000)));
      await fetchWorkspace();
      toast.success("Event scheduled");

      await triggerGraceFromContext(
        `Calendar update: "${created.title}" is scheduled for ${fmtDateTime(
          created.startDate
        )}${created.location ? ` at ${created.location}` : ""}. Prepare communication and staffing follow-up recommendations.`
      );
    } catch (error) {
      console.error("Failed to create calendar event:", error);
      toast.error("Failed to create event");
    } finally {
      setCalendarCreating(false);
    }
  }, [calendarLocation, calendarStartsAt, calendarTitle, fetchWorkspace, orgId, triggerGraceFromContext]);

  const handleAskGraceForEvent = useCallback(
    async (event: CalendarSurfaceItem) => {
      const message =
        event.source === "appointment"
          ? `Prepare pastoral appointment follow-up for "${event.title}" on ${fmtDateTime(
              event.startDate
            )}${event.contactName ? ` with ${event.contactName}` : ""}. Recommend reminders, confirmations, and escalation notes for staff.`
          : `Prepare ministry follow-up for event "${event.title}" on ${fmtDateTime(
              event.startDate
            )}. Recommend communications, staffing checks, and reminders.`;
      await triggerGraceFromContext(message);
      switchTab("center");
      toast.success(
        event.source === "appointment"
          ? "Grace queued appointment planning context"
          : "Grace queued event planning context"
      );
    },
    [switchTab, triggerGraceFromContext]
  );

  const handleApproveAndExecute = async (approval: ApprovalRow) => {
    try {
      const response = await fetch("/api/grace/actions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: approval.sessionId,
          actionIds: [approval.id],
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        failed?: Array<{ error?: string }>;
      };
      if (!response.ok) throw new Error(payload.error || "Failed to execute approval");

      const failedMessages = payload.failed
        ?.map((item) => item.error)
        .filter((value): value is string => Boolean(value));
      if (failedMessages && failedMessages.length > 0) {
        toast.error(`Approved, but execution failed: ${failedMessages.join("; ")}`);
      } else {
        toast.success("Action approved and executed");
      }
      await fetchWorkspace();
    } catch (error) {
      console.error("Failed to approve action:", error);
      toast.error(error instanceof Error ? error.message : "Failed to approve action");
    }
  };

  const handleRejectApproval = async (approval: ApprovalRow) => {
    if (!orgId) return;
    try {
      await updateGraceApproval({
        organizationId: orgId,
        approvalId: approval.id,
        status: "rejected",
      });
      toast.success("Action rejected");
      await fetchWorkspace();
    } catch (error) {
      console.error("Failed to reject action:", error);
      toast.error("Failed to reject action");
    }
  };

  const handleProposalDecision = useCallback(
    async (proposalId: string, status: "approved" | "rejected") => {
      if (!orgId) return;

      setProposalDecisionId(proposalId);
      try {
        await updateGraceFollowupProposalStatus({
          organizationId: orgId,
          proposalId,
          status,
        });
        toast.success(status === "approved" ? "Proposal approved" : "Proposal dismissed");
        await fetchWorkspace();
      } catch (error) {
        console.error("Failed to update follow-up proposal:", error);
        toast.error(error instanceof Error ? error.message : "Failed to update proposal");
      } finally {
        setProposalDecisionId(null);
      }
    },
    [fetchWorkspace, orgId]
  );

  const handleAddKnowledge = async () => {
    if (!orgId || !kbTitle.trim() || !kbContent.trim()) return;
    try {
      await createGraceKnowledge({
        organizationId: orgId,
        title: kbTitle.trim(),
        content: kbContent.trim(),
      });
      setKbTitle("");
      setKbContent("");
      toast.success("Knowledge entry added");
      await fetchWorkspace();
    } catch (error) {
      console.error("Failed to add knowledge:", error);
      toast.error("Failed to add knowledge entry");
    }
  };

  const handleCreateServiceTemplate = async () => {
    if (servicePlanningSetupRequired) {
      toast.error(servicePlanningSetupRequired);
      return;
    }
    if (!newTemplateName.trim()) return;
    setTemplateSaving(true);
    try {
      const response = await fetch("/api/app/organizations/current/service-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTemplateName.trim(),
          serviceType: newTemplateType,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        setupRequired?: boolean;
      };

      if (payload.setupRequired) {
        setServicePlanningSetupRequired(
          payload.message ||
            "Service planning tables are not initialized yet. Apply migrations and refresh."
        );
        throw new Error(payload.message || "Service planning setup is required");
      }

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "Failed to create service template");
      }

      setNewTemplateName("");
      await fetchServiceTemplates();
      toast.success("Service template created");
    } catch (error) {
      console.error("Failed to create service template:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create service template"
      );
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteSelectedServiceTemplate = async () => {
    if (!selectedServiceTemplate) return;
    setTemplateSaving(true);
    try {
      const response = await fetch(
        `/api/app/organizations/current/service-templates/${selectedServiceTemplate.template.id}`,
        {
          method: "DELETE",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "Failed to delete service template");
      }

      await fetchServiceTemplates();
      toast.success("Service template deleted");
    } catch (error) {
      console.error("Failed to delete service template:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete service template"
      );
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleRoleDraftChange = useCallback(
    (slotId: string, patch: Partial<ServiceTemplateRoleDraft>) => {
      setRoleDrafts((current) => ({
        ...current,
        [slotId]: {
          roleName: current[slotId]?.roleName ?? "",
          assignmentType: current[slotId]?.assignmentType ?? "volunteer",
          requiredCount: current[slotId]?.requiredCount ?? "1",
          isRequired: current[slotId]?.isRequired ?? true,
          notes: current[slotId]?.notes ?? "",
          ...patch,
        },
      }));
    },
    []
  );

  const handleSaveRoleSlot = async (slotId: string) => {
    if (!selectedServiceTemplate) return;

    const draft = roleDrafts[slotId];
    if (!draft || !draft.roleName.trim()) {
      toast.error("Role name is required");
      return;
    }

    const parsedRequiredCount = Number(draft.requiredCount);
    if (!Number.isFinite(parsedRequiredCount) || parsedRequiredCount < 1) {
      toast.error("Required count must be at least 1");
      return;
    }

    setRoleSavingId(slotId);
    try {
      const response = await fetch(
        `/api/app/organizations/current/service-templates/${selectedServiceTemplate.template.id}/role-slots/${slotId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roleName: draft.roleName.trim(),
            assignmentType: draft.assignmentType,
            requiredCount: Math.floor(parsedRequiredCount),
            isRequired: draft.isRequired,
            notes: draft.notes.trim() ? draft.notes.trim() : null,
          }),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "Failed to save role requirements");
      }

      await fetchServiceTemplates();
      toast.success("Role requirements saved");
    } catch (error) {
      console.error("Failed to save role slot:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save role requirements"
      );
    } finally {
      setRoleSavingId(null);
    }
  };

  const handleDeleteRoleSlot = async (slotId: string) => {
    if (!selectedServiceTemplate) return;
    setRoleDeletingId(slotId);
    try {
      const response = await fetch(
        `/api/app/organizations/current/service-templates/${selectedServiceTemplate.template.id}/role-slots/${slotId}`,
        {
          method: "DELETE",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "Failed to delete role slot");
      }

      await fetchServiceTemplates();
      toast.success("Role slot deleted");
    } catch (error) {
      console.error("Failed to delete role slot:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete role slot");
    } finally {
      setRoleDeletingId(null);
    }
  };

  const handleAddRoleSlot = async () => {
    if (!selectedServiceTemplate) return;
    if (!newRoleName.trim()) {
      toast.error("Role name is required");
      return;
    }

    const parsedRequiredCount = Number(newRoleRequiredCount);
    if (!Number.isFinite(parsedRequiredCount) || parsedRequiredCount < 1) {
      toast.error("Required count must be at least 1");
      return;
    }

    setNewRoleSaving(true);
    try {
      const response = await fetch(
        `/api/app/organizations/current/service-templates/${selectedServiceTemplate.template.id}/role-slots`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roleName: newRoleName.trim(),
            assignmentType: newRoleAssignmentType,
            requiredCount: Math.floor(parsedRequiredCount),
            isRequired: newRoleRequired,
            notes: newRoleNotes.trim() ? newRoleNotes.trim() : undefined,
            sortOrder: selectedServiceTemplate.roleSlots.length,
          }),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
      };

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "Failed to add role slot");
      }

      setNewRoleName("");
      setNewRoleAssignmentType("volunteer");
      setNewRoleRequiredCount("1");
      setNewRoleRequired(true);
      setNewRoleNotes("");
      await fetchServiceTemplates();
      toast.success("Role slot added");
    } catch (error) {
      console.error("Failed to add role slot:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add role slot");
    } finally {
      setNewRoleSaving(false);
    }
  };

  const handleAddPositionPack = async (packId: string) => {
    if (!selectedServiceTemplate) return;
    const pack = POSITION_PACKS.find((item) => item.id === packId);
    if (!pack) return;

    setPositionPackSaving(packId);
    try {
      for (const [index, role] of pack.roles.entries()) {
        const response = await fetch(
          `/api/app/organizations/current/service-templates/${selectedServiceTemplate.template.id}/role-slots`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roleName: role.roleName,
              assignmentType: role.assignmentType,
              requiredCount: role.requiredCount,
              isRequired: role.isRequired,
              notes: role.notes,
              sortOrder: selectedServiceTemplate.roleSlots.length + index,
            }),
          }
        );
        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          message?: string;
        };

        if (!response.ok || payload.success === false) {
          throw new Error(payload.message || `Failed to add role ${role.roleName}`);
        }
      }

      await fetchServiceTemplates();
      toast.success(`${pack.label} positions added`);
    } catch (error) {
      console.error("Failed to add position pack:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add position pack");
    } finally {
      setPositionPackSaving(null);
    }
  };

  const handleRunAssignmentPreview = async () => {
    if (!selectedServiceTemplate) {
      toast.error("Select a service template first");
      return;
    }

    const serviceAt = new Date(assignmentServiceAt);
    if (Number.isNaN(serviceAt.getTime())) {
      toast.error("Choose a valid service date and time");
      return;
    }

    const duration = Number(assignmentDurationMinutes);
    if (!Number.isFinite(duration) || duration < 30) {
      toast.error("Service duration must be at least 30 minutes");
      return;
    }

    setAssignmentLoading(true);
    try {
      const params = new URLSearchParams({
        serviceAt: serviceAt.toISOString(),
        serviceDurationMinutes: String(Math.floor(duration)),
      });
      if (includeUnavailableCandidates) {
        params.set("includeUnavailable", "1");
      }

      const response = await fetch(
        `/api/app/organizations/current/service-templates/${selectedServiceTemplate.template.id}/assignment-preview?${params.toString()}`,
        {
          cache: "no-store",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        assignmentPreview?: AssignmentPreviewData;
      };

      if (!response.ok || payload.success === false || !payload.assignmentPreview) {
        throw new Error(payload.message || "Failed to generate assignment preview");
      }

      setAssignmentPreview(payload.assignmentPreview);
      toast.success("Assignment preview generated");
    } catch (error) {
      console.error("Failed to generate assignment preview:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to generate assignment preview"
      );
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleCreateServiceRun = async () => {
    if (servicePlanningSetupRequired) {
      toast.error(servicePlanningSetupRequired);
      return;
    }
    if (!selectedServiceTemplate) {
      toast.error("Select a service template first");
      return;
    }

    const serviceAt = new Date(newServiceRunAt);
    if (Number.isNaN(serviceAt.getTime())) {
      toast.error("Choose a valid service date and time");
      return;
    }

    const duration = Number(newServiceRunDurationMinutes);
    if (!Number.isFinite(duration) || duration < 30) {
      toast.error("Service duration must be at least 30 minutes");
      return;
    }

    setServiceRunCreating(true);
    try {
      const response = await fetch("/api/app/organizations/current/service-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedServiceTemplate.template.id,
          name: newServiceRunName.trim() ? newServiceRunName.trim() : undefined,
          serviceAt: serviceAt.toISOString(),
          durationMinutes: Math.floor(duration),
          generateAssignments: newServiceRunGenerateAssignments,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        serviceRun?: ServiceRunRecord;
        assignmentsGenerated?: number;
      };

      if (!response.ok || payload.success === false || !payload.serviceRun) {
        throw new Error(payload.message || "Failed to create service run");
      }

      setNewServiceRunName("");
      setSelectedServiceRunId(payload.serviceRun.id);
      await Promise.all([fetchServiceRuns(), fetchServiceStaffingGoals()]);
      await fetchServiceRunAssignments(payload.serviceRun.id);
      toast.success(
        `Service run created${newServiceRunGenerateAssignments ? ` (${payload.assignmentsGenerated ?? 0} assignments generated)` : ""}`
      );
    } catch (error) {
      console.error("Failed to create service run:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create service run");
    } finally {
      setServiceRunCreating(false);
    }
  };

  const handleGenerateAssignmentsForRun = async () => {
    if (!selectedServiceRunId) {
      toast.error("Select a service run first");
      return;
    }

    setServiceRunGenerateSaving(true);
    try {
      const response = await fetch(
        `/api/app/organizations/current/service-runs/${selectedServiceRunId}/assignments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overwriteExisting: true }),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        assignmentsGenerated?: number;
      };

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "Failed to generate service assignments");
      }

      await fetchServiceRunAssignments(selectedServiceRunId);
      toast.success(`Generated ${payload.assignmentsGenerated ?? 0} assignment seats`);
    } catch (error) {
      console.error("Failed to generate assignments:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to generate assignments"
      );
    } finally {
      setServiceRunGenerateSaving(false);
    }
  };

  const handleSendOffersForRun = async () => {
    if (!selectedServiceRunId) {
      toast.error("Select a service run first");
      return;
    }

    setServiceRunOffersSending(true);
    try {
      const response = await fetch(
        `/api/app/organizations/current/service-runs/${selectedServiceRunId}/offers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        result?: {
          attempted: number;
          sent: number;
          skipped: number;
          failed: number;
        };
      };

      if (!response.ok || payload.success === false || !payload.result) {
        throw new Error(payload.message || "Failed to send staffing offers");
      }

      await fetchServiceRunAssignments(selectedServiceRunId);
      toast.success(
        `Offers sent: ${payload.result.sent}/${payload.result.attempted} (skipped ${payload.result.skipped}, failed ${payload.result.failed})`
      );
    } catch (error) {
      console.error("Failed to send staffing offers:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send staffing offers");
    } finally {
      setServiceRunOffersSending(false);
    }
  };

  const handleStartAutostaffGoal = async () => {
    if (!selectedServiceRunId) {
      toast.error("Select a service run first");
      return;
    }

    setServiceGoalStarting(true);
    try {
      const response = await fetch("/api/app/organizations/current/grace/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceRunId: selectedServiceRunId,
          sourceChannel: "in_app",
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        created?: boolean;
      };

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "Failed to start autostaff goal");
      }

      await fetchServiceStaffingGoals();
      toast.success(
        payload.created === false
          ? "An autostaff goal is already running for this service run"
          : "Autostaff goal started"
      );
    } catch (error) {
      console.error("Failed to start autostaff goal:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start autostaff goal");
    } finally {
      setServiceGoalStarting(false);
    }
  };

  if (!orgId) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#bbff00]" />
      </div>
    );
  }

  return (
    <div className="relative -m-4 flex flex-1 flex-col overflow-y-auto bg-[#f4f6f9] pb-12 dark:bg-[#0b1119] sm:-m-8 font-display">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -top-32 right-[-10%] h-72 w-72 rounded-full bg-lime-300/30 blur-3xl dark:bg-lime-500/15" />
        <div className="absolute left-[-8%] top-[20%] h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl dark:bg-cyan-500/10" />
      </div>

      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
        <div className="relative mx-auto flex h-[92px] w-full max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined rounded-xl bg-slate-900 p-2 text-[18px] text-lime-300 dark:bg-white dark:text-slate-900">
                robot_2
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Grace Command Center
                </p>
                <h1 className="truncate text-xl font-black text-slate-900 dark:text-white">
                  Ministry Overview
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-lime-300/70 bg-lime-100/70 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-lime-800 dark:border-lime-500/40 dark:bg-lime-500/10 dark:text-lime-300 sm:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime-500 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-lime-500" />
              </span>
              System Online
            </div>

            <Button
              variant="outline"
              className="h-10 rounded-xl border-slate-300 bg-white/90 px-3 text-xs font-bold uppercase tracking-wide shadow-sm hover:-translate-y-0.5 hover:bg-white dark:border-slate-700 dark:bg-slate-900/80"
              onClick={fetchWorkspace}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              Sync
            </Button>
            <Button
              className="h-10 rounded-xl bg-slate-900 px-4 text-xs font-bold uppercase tracking-wide text-white shadow-lg shadow-slate-900/20 hover:-translate-y-0.5 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              onClick={() => setVoiceOpen(true)}
            >
              <Mic className="mr-1.5 h-4 w-4" />
              Speak
            </Button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-[1400px] space-y-8 px-4 pb-10 pt-8 sm:px-8">
        <section className="relative overflow-hidden rounded-[30px] border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-100 p-6 shadow-[0_16px_48px_-28px_rgba(15,23,42,0.55)] dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-lime-300/30 blur-3xl dark:bg-lime-500/20" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Planning + Care + Communication
              </p>
              <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white md:text-4xl">
                Grace runs the ministry flow with humans in the loop.
              </h2>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                Worship planning, team scheduling, guest follow-up, and member communication in
                one command experience.
              </p>
            </div>
            <div className="w-full max-w-sm space-y-2 rounded-2xl border border-slate-200/80 bg-white/80 p-4 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/70">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>Launch Readiness</span>
                <span>{setupProgress}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-lime-400 to-emerald-500 transition-all duration-700"
                  style={{ width: `${setupProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500">
                {setupCompleted} of {setupChecklist.length} deployment checks complete
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <TopMetric label="Next Service" value={commandNextServiceLabel} icon="event_upcoming" />
            <TopMetric label="Staffing Coverage" value={commandCoverageLabel} icon="fact_check" />
            <TopMetric
              label="Open Positions"
              value={commandServiceRun ? commandServiceCoverageSummary.seatsOpen : "--"}
              icon="groups"
            />
            <TopMetric label="Aging Follow-ups" value={staleFollowups.length} icon="mark_chat_unread" />
          </div>
        </section>

      <Tabs value={activeTab} onValueChange={(value) => switchTab(value as GraceTab)} className="space-y-6">
        <TabsList className="flex h-auto w-full justify-start gap-3 overflow-x-auto bg-transparent p-0 pb-2 scrollbar-hide">
          {workspaceTabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="group min-w-[172px] rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-lime-300 hover:shadow-md data-[state=active]:border-slate-900 data-[state=active]:bg-slate-900 data-[state=active]:text-white dark:border-slate-700 dark:bg-slate-900/80 dark:data-[state=active]:border-white dark:data-[state=active]:bg-white dark:data-[state=active]:text-slate-900"
            >
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined mt-0.5 text-[17px] text-slate-500 transition-colors group-data-[state=active]:text-lime-300 dark:text-slate-300 dark:group-data-[state=active]:text-slate-900">
                  {tab.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-black tracking-wide">{tab.label}</p>
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500 group-data-[state=active]:text-slate-300 dark:text-slate-400 dark:group-data-[state=active]:text-slate-700">
                    {tab.detail}
                  </p>
                </div>
                {tab.badge ? (
                  <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-700 group-data-[state=active]:bg-white/15 group-data-[state=active]:text-white dark:bg-slate-800 dark:text-slate-200 dark:group-data-[state=active]:bg-slate-900/15 dark:group-data-[state=active]:text-slate-900">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="command" className="mt-2 space-y-8">

          {/* Grace Command Bar — natural language control of all church data */}
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/55 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#84cc16] text-[20px]">smart_toy</span>
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white">Grace Command</p>
                  <p className="text-xs text-slate-500">Type any instruction — Grace reads all your data and acts on it</p>
                </div>
              </div>
              {graceCommandThread.length > 0 && (
                <button
                  onClick={() => { setGraceCommandThread([]); setGraceCommandThreadId(null); }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  Clear thread
                </button>
              )}
            </div>

            {graceCommandThread.length > 0 && (
              <div className="max-h-80 overflow-y-auto px-6 py-4 space-y-3 border-b border-slate-100 dark:border-slate-800">
                {graceCommandThread.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "grace" && (
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#84cc16]/15 flex items-center justify-center mt-0.5">
                        <span className="material-symbols-outlined text-[14px] text-[#84cc16]">smart_toy</span>
                      </div>
                    )}
                    <div className={`max-w-[78%] space-y-2 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                      }`}>
                        {msg.content}
                      </div>
                      {msg.outcomes && msg.outcomes.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {msg.outcomes.map((outcome, j) => (
                            <span
                              key={j}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                outcome.status === "executed"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                  : outcome.status === "queued"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                  : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                              }`}
                            >
                              <span className="material-symbols-outlined text-[11px]">
                                {outcome.status === "executed" ? "check" : outcome.status === "queued" ? "schedule" : "close"}
                              </span>
                              {outcome.tool} — {outcome.status}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {graceCommandSending && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#84cc16]/15 flex items-center justify-center mt-0.5">
                      <span className="material-symbols-outlined text-[14px] text-[#84cc16]">smart_toy</span>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                      <span className="text-xs text-slate-400">Grace is working…</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 px-6 py-4">
              <input
                type="text"
                value={graceCommandInput}
                onChange={(e) => setGraceCommandInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGraceCommand(); } }}
                placeholder="e.g. Move Sarah to member status, mark prayer request answered, cancel appointment..."
                disabled={graceCommandSending}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#84cc16] focus:outline-none focus:ring-2 focus:ring-[#84cc16]/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-white dark:placeholder:text-slate-500"
              />
              <button
                onClick={handleGraceCommand}
                disabled={graceCommandSending || !graceCommandInput.trim()}
                className="flex items-center gap-2 rounded-xl bg-[#84cc16] px-5 py-2.5 text-sm font-bold text-slate-950 shadow-md shadow-[#84cc16]/20 transition-all hover:-translate-y-0.5 hover:bg-[#9fd91c] disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {graceCommandSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[16px]">send</span>
                )}
                Send
              </button>
            </div>
          </div>

          {/* Main Command Surface & Tasks */}
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-1">
              <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-8 text-center shadow-[0_20px_60px_-30px_rgba(15,23,42,0.9)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_-28px_rgba(22,163,74,0.45)] dark:border-slate-700">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(132,204,22,0.28),transparent_52%)]"></div>
                <div className="absolute -bottom-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-lime-400/15 blur-3xl" />
                <div className="relative z-10 w-full flex flex-col items-center">
                  <AgentAudioVisualizerAura
                    size="lg"
                    state={auraState as any}
                    color="#84cc16"
                    className="h-[180px] drop-shadow-[0_0_25px_rgba(132,204,22,0.3)]"
                  />
                  <h3 className="mb-2 mt-6 text-2xl font-black tracking-tight text-white">
                    Grace is {auraState}
                  </h3>
                  <p className="mb-8 px-4 text-sm text-slate-400">
                    Your pastoral voice assistant. Tap below to speak a command or query knowledge.
                  </p>
                  <button 
                    onClick={() => setVoiceOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#84cc16] px-8 py-4 font-bold text-slate-950 shadow-xl shadow-[#84cc16]/20 transition-all hover:-translate-y-0.5 hover:bg-[#9fd91c]"
                  >
                    <span className="material-symbols-outlined text-lg">mic</span>
                    Tap to Speak
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col space-y-4 xl:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    Command Overview
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Prioritized by care urgency and service readiness.
                  </p>
                </div>
                <button className="flex items-center gap-1 text-sm font-bold text-[#84cc16] hover:text-[#84cc16]/80">
                  View All <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto">
                {nextActions.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-[#84cc16]/40 bg-[#84cc16]/5 p-8 text-center">
                    <span className="material-symbols-outlined text-4xl text-[#84cc16] mb-3">check_circle</span>
                    <p className="text-[#84cc16] font-bold text-lg mb-1">You&apos;re all caught up!</p>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">Grace has no pending blockers. Monitoring systems are active.</p>
                  </div>
                )}
                {nextActions.map((action) => (
                  <div
                    key={action.id}
                    className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-lime-300 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/55"
                  >
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-lime-400 via-emerald-400 to-cyan-400 opacity-70" />
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${
                          action.risk === 'high' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600' :
                          action.risk === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
                          'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                        }`}>
                          <span className="material-symbols-outlined text-[20px]">
                            {action.risk === 'high' ? 'warning' : action.risk === 'medium' ? 'schedule' : 'task_alt'}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-base">{action.title}</h4>
                          <p className="text-sm text-slate-500 mb-1">{action.reason}</p>
                          <p className="text-xs text-slate-400">Impact: {action.impact}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (action.path) {
                            router.push(action.path);
                            return;
                          }
                          if (action.conversationId) {
                            setSelectedConversationId(action.conversationId);
                          }
                          if (action.tab) {
                            switchTab(action.tab);
                          }
                        }}
                        className="shrink-0 rounded-xl border border-slate-200 bg-transparent px-5 py-2 text-sm font-bold text-slate-700 transition-all group-hover:-translate-y-0.5 group-hover:bg-slate-900 group-hover:text-white dark:border-slate-700 dark:text-slate-300 dark:group-hover:bg-white dark:group-hover:text-slate-900"
                      >
                        {action.cta}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/55">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    Upcoming Appointments
                  </h3>
                  <p className="text-sm text-slate-500">
                    Pastoral care schedule managed from Command.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => switchTab("calendar")}>
                  Open Calendar
                </Button>
              </div>

              {upcomingAppointments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700">
                  No upcoming appointments on the schedule.
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingAppointments.slice(0, 6).map((row) => (
                    <div
                      key={row.appointment.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                            {row.appointment.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {fmtDateTime(row.appointment.dateTime)} ·{" "}
                            {row.contact
                              ? `${row.contact.firstName} ${row.contact.lastName}`
                              : "No contact linked"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="uppercase">
                            {row.appointment.status}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelAppointment(row.appointment.id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/55">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Upcoming Service & Positions
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Track the next run with live seat coverage and open role priorities.
              </p>

              {!commandServiceRun ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-xl border border-dashed border-slate-300 px-3 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
                    No upcoming service run scheduled yet.
                  </div>
                  <Button className="w-full" onClick={() => switchTab("operations")}>
                    Create Service Run
                  </Button>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                          {commandServiceRun.run.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {fmtDateTime(commandServiceRun.run.serviceAt)} ·{" "}
                          {commandServiceRun.run.durationMinutes} min
                          {commandServiceRunTemplate
                            ? ` · ${commandServiceRunTemplate.template.name}`
                            : ""}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={getServiceRunBadgeClass(commandServiceRun.run.status)}
                      >
                        {SERVICE_RUN_STATUS_LABELS[commandServiceRun.run.status]}
                      </Badge>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <span>Service Coverage</span>
                      <span>
                        {commandServiceAssignmentsLoaded
                          ? `${commandServiceCoverageSummary.seatsFilled}/${commandServiceCoverageSummary.seatsNeeded}`
                          : "Syncing..."}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className={
                          commandServiceCoverageSummary.seatsOpen > 0
                            ? "h-full rounded-full bg-amber-500"
                            : "h-full rounded-full bg-emerald-500"
                        }
                        style={{
                          width: `${Math.max(commandServiceCoverageSummary.coveragePercent, 4)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {commandServiceCoverageSummary.seatsOpen > 0
                        ? `${commandServiceCoverageSummary.seatsOpen} open positions`
                        : "All configured positions covered"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Position Focus
                    </p>
                    {commandServiceRoleMatrix.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">
                        No template positions configured for this service run.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {(commandServiceOpenRoles.length > 0
                          ? commandServiceOpenRoles
                          : commandServiceRoleMatrix
                        )
                          .slice(0, 4)
                          .map((roleRow) => (
                            <div
                              key={`command-role-${roleRow.roleSlotId}`}
                              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/60"
                            >
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {roleRow.roleName}
                              </p>
                              <span className="text-slate-500">
                                {roleRow.seatsFilled}/{roleRow.seatsNeeded}
                                {roleRow.seatsOpen > 0 ? ` · ${roleRow.seatsOpen} open` : " · ready"}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSelectedServiceRunId(commandServiceRun.run.id);
                      switchTab("operations");
                    }}
                  >
                    Open Service Staffing
                  </Button>
                  <Button className="w-full" onClick={() => switchTab("operations")}>
                    Open Run Sheet
                  </Button>
                </div>
              )}
            </div>
          </div>


          <div className="h-8"></div>
        </TabsContent>

        <TabsContent value="center" className="space-y-8 max-w-7xl mx-auto w-full p-8 pt-0">
          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Today&apos;s Briefing</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Morning executive summary generated by Grace.
                </p>
              </div>
              <span className="material-symbols-outlined text-sky-500 bg-sky-50 dark:bg-sky-500/10 p-2 rounded-xl">
                wb_sunny
              </span>
            </div>
            <div className="p-6">
              {!dailyBriefing && (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                  <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
                    No daily briefing has been generated yet.
                  </p>
                </div>
              )}
              {dailyBriefing && (
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Generated {fmtDateTime(dailyBriefing.createdAt)}
                  </p>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/40">
                    <p className="text-base font-semibold leading-relaxed text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                      {dailyBriefing.details || dailyBriefing.summary}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 md:flex md:items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Grace Suggests Queue</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Proposed follow-ups waiting for staff review.
                </p>
              </div>
              <Badge className="mt-4 md:mt-0 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                {pendingProposalQueue.length} pending
              </Badge>
            </div>
            <div className="p-6 space-y-4">
              {pendingProposalQueue.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                  <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
                    No pending Grace suggestions right now.
                  </p>
                </div>
              )}
              {pendingProposalQueue.map((proposal) => {
                const isUpdating = proposalDecisionId === proposal.id;
                return (
                  <div
                    key={proposal.id}
                    className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            {proposal.proposedChannel || proposal.channel}
                          </span>
                          <p className="text-xs font-bold text-slate-500">
                            {fmtDateTime(proposal.createdAt)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {proposal.reason || "Follow-up suggestion"}
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          {proposal.messageText}
                        </p>
                        {proposal.recipient && (
                          <p className="text-xs text-slate-500">Recipient: {proposal.recipient}</p>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          className="bg-[#84cc16] hover:bg-[#65a30d] text-slate-950 font-bold"
                          disabled={isUpdating}
                          onClick={() => handleProposalDecision(proposal.id, "approved")}
                        >
                          {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isUpdating}
                          onClick={() => handleProposalDecision(proposal.id, "rejected")}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Human-in-the-Loop Approval Queue</h3>
                <p className="text-sm text-slate-500 mt-1">Actions blocked awaiting staff authorization.</p>
              </div>
              <span className="material-symbols-outlined text-amber-500 bg-amber-50 dark:bg-amber-500/10 p-2 rounded-xl">shield_person</span>
            </div>
            <div className="p-6 space-y-4">
              {approvals.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                   <span className="material-symbols-outlined text-slate-400 text-4xl mb-3">check_circle</span>
                   <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">No approvals currently queued.</p>
                </div>
              )}
              {approvals.map((approval) => {
                const action = (approval.proposedAction ?? {}) as Record<string, unknown>;
                const toolName = typeof action.tool === "string" ? action.tool : "unknown.tool";
                const reasonText =
                  typeof action.reason === "string" ? action.reason : "No reason provided";
                const payloadPreview = formatJsonPreview(action.input, 220);

                return (
                  <div key={approval.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 transition-all hover:border-[#84cc16]/50">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded ${
                            approval.status === "pending"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              : approval.status === "approved"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                          }`}>
                            {approval.status}
                          </span>
                          <p className="text-xs font-bold text-slate-500">{fmtDateTime(approval.createdAt)}</p>
                        </div>
                        <p className="text-lg font-bold text-slate-900 dark:text-white">{toolName}</p>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{reasonText}</p>
                        <div className="bg-white dark:bg-slate-950 rounded-xl p-3 border border-slate-200 dark:border-slate-800 overflow-x-auto">
                           <pre className="text-[11px] text-slate-500 font-mono m-0">{payloadPreview}</pre>
                        </div>
                      </div>
                      {approval.status === "pending" && (
                        <div className="flex sm:flex-col gap-2 shrink-0">
                          <button 
                            className="bg-[#84cc16] hover:bg-[#65a30d] text-slate-950 font-bold px-4 py-2 rounded-xl transition-all shadow-sm text-sm flex items-center justify-center gap-1"
                            onClick={() => handleApproveAndExecute(approval)}>
                            <span className="material-symbols-outlined text-[16px]">check</span> Approve
                          </button>
                          <button 
                            className="bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold px-4 py-2 rounded-xl transition-all text-sm flex items-center justify-center gap-1"
                            onClick={() => handleRejectApproval(approval)}>
                            <span className="material-symbols-outlined text-[16px]">close</span> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 md:flex md:items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Action Execution Outcomes</h3>
                <p className="text-sm text-slate-500 mt-1">Live visibility into what Grace queued, executed, retried, or failed.</p>
              </div>
              <span className="material-symbols-outlined text-blue-500 bg-blue-50 dark:bg-blue-500/10 p-2 rounded-xl mt-4 md:mt-0">history</span>
            </div>
            <div className="p-6 space-y-4">
              {executionOutcomes.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                   <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">No action outcomes captured yet.</p>
                </div>
              )}
              {executionOutcomes.map((outcome) => (
                <div
                  key={`${outcome.actionId}-${outcome.status}-${outcome.occurredAt}`}
                  className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded ${getOutcomeBadgeClass(outcome.status)}`}>
                        {outcome.status}
                      </span>
                      <p className="text-xs font-bold text-slate-500">{fmtDateTime(outcome.occurredAt)}</p>
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{outcome.tool}</p>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{outcome.reason}</p>
                    {outcome.approvalId && (
                      <p className="text-xs text-slate-500 mt-1">Approval Ref: <span className="font-mono">{outcome.approvalId}</span></p>
                    )}
                    {outcome.error ? (
                      <div className="bg-rose-50 dark:bg-rose-950/30 rounded-xl p-3 border border-rose-200 dark:border-rose-900/50 mt-2">
			<p className="text-xs text-rose-600 dark:text-rose-400 font-mono m-0">{outcome.error}</p>
		      </div>
                    ) : (
                      outcome.output && (
                        <div className="bg-white dark:bg-slate-950 rounded-xl p-3 border border-slate-200 dark:border-slate-800 overflow-x-auto mt-2">
                           <pre className="text-[11px] text-slate-500 font-mono m-0">Result: {formatJsonPreview(outcome.output, 220)}</pre>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 md:flex md:items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Sequence Runs & Follow-Ups</h3>
                <p className="text-sm text-slate-500 mt-1">Built-in automation activity for visitor follow-up and missed-call recovery.</p>
              </div>
              <span className="material-symbols-outlined text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 p-2 rounded-xl mt-4 md:mt-0">mark_email_read</span>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MinistryBriefItem title="Sent" value={sequenceStats.sent} detail="Auto-delivered touches" icon="check_circle" />
                <MinistryBriefItem title="Pending" value={sequenceStats.pending} detail="Needs delivery/review" icon="schedule" />
                <MinistryBriefItem title="Approved" value={sequenceStats.approved} detail="Human-approved" icon="verified_user" />
                <MinistryBriefItem title="Rejected" value={sequenceStats.rejected} detail="Blocked actions" icon="block" />
              </div>

              {sequenceRuns.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                   <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">No sequence activity captured yet.</p>
                </div>
              )}

              {sequenceRuns.length > 0 && (
                <div className="space-y-3">
                  {sequenceRuns.map((run) => (
                    <div key={run.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 transition-all">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <p className="text-base font-bold text-slate-900 dark:text-white">
                            {run.sequenceName}
                            {run.stepName ? <span className="text-slate-400 font-medium ml-2 text-sm">{run.stepName}</span> : ""}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">{run.reason || "Sequence action"}</p>
                          {run.messageText && (
                            <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 mt-2">
                               <p className="text-sm text-slate-700 dark:text-slate-300 italic">&quot;{run.messageText}&quot;</p>
                            </div>
                          )}
                          <div className="flex items-center gap-3 mt-3">
                            <div className="flex items-center gap-1 text-slate-400">
                               <span className="material-symbols-outlined text-[14px]">phone_iphone</span>
                               <span className="text-xs font-bold uppercase tracking-wider">{run.channel || "unknown"}</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-400">
                               <span className="material-symbols-outlined text-[14px]">schedule</span>
                               <span className="text-xs font-bold uppercase tracking-wider">{fmtDateTime(run.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <span className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg border ${
                            run.status === "sent"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : run.status === "pending"
                                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                : run.status === "approved"
                                  ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                  : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-400"
                          }`}>
                            {run.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Grace Voice Runtime Calls</h3>
              </div>
              <span className="material-symbols-outlined text-purple-500 bg-purple-50 dark:bg-purple-500/10 p-2 rounded-xl">record_voice_over</span>
            </div>
            <div className="p-6">
              {graceCalls.length === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                   <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">No Grace runtime calls yet.</p>
                </div>
              )}
              {graceCalls.length > 0 && (
                <div className="space-y-3">
                  {graceCalls.map((call) => (
                    <div key={call.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col md:flex-row justify-between items-start gap-4">
                      <div className="flex items-center gap-3">
                         <div className="bg-white dark:bg-slate-950 p-2 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center">
                           <span className="material-symbols-outlined text-slate-400">call</span>
                         </div>
                         <div>
                           <p className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                             {call.fromNumber || "Unknown"}
                             <span className="material-symbols-outlined text-[14px] text-slate-300">arrow_forward</span>
                             {call.toNumber || "Unknown"}
                           </p>
                           <p className="text-sm text-slate-500 mt-1 font-medium">{call.summaryText || call.transcriptText || "No transcript yet"}</p>
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Knowledge Base</h3>
                <p className="text-sm text-slate-500 mt-1">Train Grace on organizational custom context.</p>
              </div>
              <span className="material-symbols-outlined text-teal-500 bg-teal-50 dark:bg-teal-500/10 p-2 rounded-xl">menu_book</span>
            </div>
            <div className="p-6 lg:flex items-start gap-8">
              <div className="lg:w-1/3 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shrink-0">
                <h4 className="font-bold text-slate-900 dark:text-white mb-4">Add Knowledge</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Entry Title</label>
                    <Input className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" placeholder="e.g. Sunday Service Times" value={kbTitle} onChange={(e) => setKbTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Content</label>
                    <Textarea className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 resize-none" placeholder="Details Grace will access..." rows={5} value={kbContent} onChange={(e) => setKbContent(e.target.value)} />
                  </div>
                  <button 
                    className="w-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold px-4 py-2.5 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all text-sm flex justify-center items-center gap-2"
                    onClick={handleAddKnowledge}>
                    <span className="material-symbols-outlined text-[18px]">add</span> Add Entry
                  </button>
                </div>
              </div>

              <div className="lg:w-2/3 mt-6 lg:mt-0 space-y-3">
                {knowledge.length === 0 && (
                   <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed h-full">
                     <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">No knowledge entries configured.</p>
                   </div>
                )}
                {knowledge.map((entry) => (
                  <div key={entry.id} className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 group hover:border-slate-300 transition-all">
                    <div className="flex items-center gap-3 mb-2">
                       <span className="material-symbols-outlined text-[#84cc16] text-[18px]">auto_stories</span>
                       <h4 className="font-bold text-slate-900 dark:text-white">{entry.title}</h4>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-7">{entry.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="inbox" className="space-y-8 max-w-7xl mx-auto w-full p-8 pt-0">
          <div className="grid gap-4 md:grid-cols-4">
            <MinistryBriefItem
              title="Waiting Threads"
              value={waitingConversations}
              detail="SMS + Email requiring response"
              icon="forum"
            />
            <MinistryBriefItem
              title="Call Items"
              value={phoneCalls.length}
              detail="Voice interactions in queue"
              icon="phone_in_talk"
            />
            <MinistryBriefItem
              title="Grace Proposals"
              value={followupProposals.length}
              detail="AI suggested follow-up sequences"
              icon="inbox"
            />
            <MinistryBriefItem
              title="Escalations"
              value={sessions.filter((s) => s.status === "escalated").length}
              detail="Requires staff intervention"
              icon="admin_panel_settings"
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-5">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-full">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Unified Queue</h3>
                  <p className="text-sm text-slate-500 mt-1">Calls, SMS, and Email in one inbox</p>
                </div>
                <span className="material-symbols-outlined text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 p-2 rounded-xl">forum</span>
              </div>
              <div className="p-6 flex-1">
                {conversations.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">No conversations yet.</p>
                  </div>
                )}
                <ScrollArea className="h-[460px]">
                  <div className="space-y-3 pr-3">
                    {conversations.map((row) => {
                      const isActive = selectedConversationId === row.conversation.id;
                      const name = row.contact
                        ? `${row.contact.firstName} ${row.contact.lastName}`
                        : row.conversation.subject || "Unknown";

                      return (
                        <button
                          key={row.conversation.id}
                          onClick={() => setSelectedConversationId(row.conversation.id)}
                          className={`w-full rounded-2xl border p-5 text-left transition-all group ${
                            isActive
                              ? "border-[#84cc16]/50 bg-[#84cc16]/5 shadow-sm"
                              : "border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white dark:bg-slate-900/50 dark:border-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="font-bold text-slate-900 dark:text-white">{name}</p>
                            <span className="px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {row.conversation.channel === "sms"
                                ? "sms"
                                : row.conversation.channel === "email"
                                  ? "email"
                                  : "thread"}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 line-clamp-1">{row.conversation.subject || "No subject"}</p>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="lg:col-span-3 bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-full">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400">chat</span> Thread
                </h3>
                {activeConversation && activeConversation.conversation.status !== "resolved" && (
                  <button 
                    className="bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold px-4 py-2 rounded-xl transition-all shadow-sm text-sm flex items-center gap-1"
                    onClick={() => handleResolveConversation(activeConversation.conversation.id)}>
                    <span className="material-symbols-outlined text-[18px] text-[#84cc16]">check_circle</span> Mark Resolved
                  </button>
                )}
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 mb-4">
                  <strong className="text-slate-900 dark:text-white uppercase tracking-wider font-bold">Conversation stats:</strong>{" "}
                  <span className="ml-2">Open <span className="font-bold text-slate-900 dark:text-white">{Number(conversationStats?.open ?? 0)}</span></span><span className="mx-2">|</span>
                  <span>Waiting <span className="font-bold text-slate-900 dark:text-white">{Number(conversationStats?.waiting ?? 0)}</span></span><span className="mx-2">|</span>
                  <span>Resolved <span className="font-bold text-slate-900 dark:text-white">{Number(conversationStats?.resolved ?? 0)}</span></span>
                </div>

                <ScrollArea className="flex-1 min-h-[320px] rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/30 mb-4">
                  {messagesLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-[#84cc16]" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center p-8 text-center border-2 border-slate-200 dark:border-slate-800 border-dashed rounded-xl">
                      <p className="text-sm font-medium text-slate-500">No messages in this thread.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div key={message.id} className={`max-w-[85%] rounded-2xl p-4 text-sm ${
                          message.direction === "outbound"
                            ? "ml-auto bg-[#84cc16] text-slate-950 font-medium rounded-tr-sm"
                            : "bg-white border border-slate-200 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-tl-sm shadow-sm"
                        }`}>
                          <p className="leading-relaxed">{message.content}</p>
                          <p className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${message.direction === "outbound" ? "text-slate-800/70" : "text-slate-400"}`}>
                            {fmtDateTime(message.sentAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                <div className="flex gap-3 mt-auto shrink-0">
                  <Input
                    className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl h-12"
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    placeholder="Reply as Grace operator..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <button 
                    className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0 w-12 h-12 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSend} disabled={sending || !composerText.trim()}>
                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="material-symbols-outlined text-[20px]">send</span>}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Call Activity</h3>
                  <p className="text-sm text-slate-500 mt-1">Voice interactions linked to conversation threads.</p>
                </div>
                <span className="material-symbols-outlined text-green-500 bg-green-50 dark:bg-green-500/10 p-2 rounded-xl">phone_in_talk</span>
              </div>
              <div className="p-6 space-y-3">
                {phoneCalls.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">No phone calls yet.</p>
                  </div>
                )}
                {phoneCalls.slice(0, 10).map((row) => {
                  const name = row.contact
                    ? `${row.contact.firstName} ${row.contact.lastName}`
                    : row.conversation.subject || "Unknown";

                  return (
                    <div key={row.conversation.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{name}</p>
                        <p className="text-xs text-slate-500 truncate">{row.latestContent || "No call notes"}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedConversationId(row.conversation.id);
                          switchTab("inbox");
                        }}
                      >
                        Open
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Grace Session Feed</h3>
                  <p className="text-sm text-slate-500 mt-1">Inbound sessions and escalation state</p>
                </div>
                <span className="material-symbols-outlined text-rose-500 bg-rose-50 dark:bg-rose-500/10 p-2 rounded-xl">inbox</span>
              </div>
              <div className="p-6 space-y-3">
                {sessions.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">No sessions yet.</p>
                  </div>
                )}
                {sessions.slice(0, 12).map((session) => (
                  <div key={session.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wider text-slate-500">{session.channel}</p>
                      <p className="text-sm text-slate-700 dark:text-slate-300 truncate">
                        {session.finalSummary || "Session active or pending summary"}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded ${
                      session.status === "escalated"
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                        : session.status === "open"
                          ? "bg-lime-100 text-lime-700 dark:bg-lime-500/10 dark:text-lime-300"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}>
                      {session.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="visitors" className="space-y-8 max-w-7xl mx-auto w-full p-8 pt-0">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-6 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Visitor Kanban
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Move visitors through your ministry journey and let Grace trigger follow-up.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {pipelineItems.length} visitors in pipeline
                </Badge>
                <Button variant="outline" onClick={() => router.push("/app/pipeline")}>
                  Open Full Pipeline
                </Button>
              </div>
            </div>
            <div className="p-6">
              {pipelineStages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                  Visitor stages are not configured yet. Open Pipeline to create or seed stages.
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-3">
                  {visitorsByStage.map(({ stage, items }) => (
                    <div
                      key={stage.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-lime-300 dark:border-slate-800 dark:bg-slate-900/35"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {stage.name}
                        </p>
                        <Badge variant="outline">{items.length}</Badge>
                      </div>
                      <div className="space-y-3">
                        {items.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-xs text-slate-500 dark:border-slate-700">
                            No visitors in this stage.
                          </p>
                        ) : (
                          items.map((row) => (
                            <div
                              key={row.item.id}
                              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/40"
                            >
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {getPipelineContactDisplayName(row)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Priority:{" "}
                                <span className="font-semibold uppercase">{row.item.priority}</span>
                              </p>
                              {row.contact?.phone || row.contact?.email ? (
                                <p className="mt-1 text-xs text-slate-500">
                                  {row.contact?.phone || row.contact?.email}
                                </p>
                              ) : null}

                              <div className="mt-3 space-y-2">
                                <Select
                                  value={row.item.stageId}
                                  onValueChange={(value) =>
                                    handleMoveVisitorStage(row.item.id, value)
                                  }
                                  disabled={movingVisitorId === row.item.id}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Move stage" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {pipelineStages.map((pipelineStage) => (
                                      <SelectItem
                                        key={pipelineStage.id}
                                        value={pipelineStage.id}
                                      >
                                        {pipelineStage.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full border-slate-300 text-xs font-bold uppercase tracking-wide hover:border-lime-400 hover:bg-lime-50 dark:border-slate-700 dark:hover:bg-lime-500/10"
                                  onClick={async () => {
                                    await triggerGraceFromContext(
                                      `Visitor follow-up request: ${getPipelineContactDisplayName(
                                        row
                                      )} is currently in "${stage.name}". Propose and queue the next best follow-up action.`
                                    );
                                    switchTab("center");
                                    toast.success("Grace follow-up workflow queued");
                                  }}
                                >
                                  Ask Grace For Next Step
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-8 max-w-7xl mx-auto w-full p-8 pt-0">
          <div className="grid gap-4 md:grid-cols-3">
            <TopMetric
              label="Total Scheduled Items"
              value={calendarSurfaceItems.length}
              icon="event"
            />
            <TopMetric
              label="Next 7 Days"
              value={calendarEventsNext7Days}
              icon="calendar_month"
            />
            <TopMetric
              label="Next Event"
              value={upcomingCalendarEvents[0] ? fmtDurationFromNow(upcomingCalendarEvents[0].startDate) : "none"}
              icon="schedule"
            />
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-6 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Ministry Calendar
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Schedule events and let Grace orchestrate reminders, comms, and staffing prompts.
                </p>
              </div>
              <Button variant="outline" onClick={() => router.push("/app/calendar")}>
                Open Full Calendar
              </Button>
            </div>

            <div className="grid gap-6 p-6 xl:grid-cols-12">
              <div className="xl:col-span-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40 md:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="text-xl font-black text-slate-900 dark:text-white">
                    {calendarMonthLabel}
                  </h4>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCalendarViewDate(
                          (current) =>
                            new Date(current.getFullYear(), current.getMonth() - 1, 1)
                        )
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCalendarViewDate(
                          (current) =>
                            new Date(current.getFullYear(), current.getMonth() + 1, 1)
                        )
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-7 border-y border-slate-200 dark:border-slate-800">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div
                      key={day}
                      className="py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 auto-rows-[112px] md:auto-rows-[124px]">
                  {calendarGridCells.map((cell, index) => {
                    const today = new Date();
                    const isTodayCell =
                      cell.day !== null &&
                      cell.day === today.getDate() &&
                      calendarViewDate.getMonth() === today.getMonth() &&
                      calendarViewDate.getFullYear() === today.getFullYear();

                    return (
                      <div
                        key={`${cell.day ?? "empty"}-${index}`}
                        className={`relative border-b border-r border-slate-200 p-2 dark:border-slate-800 ${
                          cell.day === null
                            ? "bg-slate-50/70 dark:bg-slate-900/30"
                            : "bg-white dark:bg-slate-950/20"
                        }`}
                      >
                        {isTodayCell ? (
                          <div className="pointer-events-none absolute inset-0 border-2 border-lime-400/70" />
                        ) : null}
                        <div
                          className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            isTodayCell
                              ? "bg-lime-400 text-slate-950"
                              : "text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {cell.day}
                        </div>
                        <div className="space-y-1 overflow-y-auto pr-1">
                          {cell.events.slice(0, 2).map((event) => (
                            <button
                              key={event.id}
                              className={`w-full truncate rounded-md px-2 py-1 text-left text-[10px] font-semibold transition-colors ${
                                event.source === "appointment"
                                  ? "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25"
                                  : "bg-lime-100 text-lime-800 hover:bg-lime-200 dark:bg-lime-500/15 dark:text-lime-300 dark:hover:bg-lime-500/25"
                              }`}
                              onClick={() => handleAskGraceForEvent(event)}
                              title={event.title}
                            >
                              {event.title}
                            </button>
                          ))}
                          {cell.events.length > 2 ? (
                            <p className="px-1 text-[10px] font-semibold text-slate-500">
                              +{cell.events.length - 2} more
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4 xl:col-span-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Quick Schedule
                  </p>
                  <div className="mt-3 space-y-3">
                    <Input
                      value={calendarTitle}
                      onChange={(event) => setCalendarTitle(event.target.value)}
                      placeholder="Event title"
                    />
                    <Input
                      type="datetime-local"
                      value={calendarStartsAt}
                      onChange={(event) => setCalendarStartsAt(event.target.value)}
                    />
                    <Input
                      value={calendarLocation}
                      onChange={(event) => setCalendarLocation(event.target.value)}
                      placeholder="Location (optional)"
                    />
                    <Button
                      className="w-full"
                      onClick={handleCreateCalendarEvent}
                      disabled={calendarCreating || !calendarTitle.trim()}
                    >
                      {calendarCreating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Create Event + Trigger Grace
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Upcoming Schedule
                  </p>
                  <div className="mt-3 space-y-3">
                    {upcomingCalendarEvents.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-sm text-slate-500 dark:border-slate-700">
                        No upcoming schedule items.
                      </p>
                    ) : (
                      upcomingCalendarEvents.slice(0, 10).map((event) => (
                        <div
                          key={event.id}
                          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/40"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {event.title}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {fmtDateTime(event.startDate)}
                                {event.location ? ` · ${event.location}` : ""}
                                {event.source === "appointment" && event.contactName
                                  ? ` · ${event.contactName}`
                                  : ""}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                event.source === "appointment"
                                  ? "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
                                  : "border-lime-300 text-lime-700 dark:border-lime-700 dark:text-lime-300"
                              }
                            >
                              {event.source === "appointment" ? "Appointment" : "Event"}
                            </Badge>
                          </div>
                          <div className="mt-3 flex justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAskGraceForEvent(event)}
                            >
                              Ask Grace To Plan Follow-up
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-6 max-w-7xl mx-auto w-full p-8 pt-0">

          {/* Setup error */}
          {servicePlanningSetupRequired && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-semibold">Setup Required</p>
              <p className="mt-1">{servicePlanningSetupRequired}</p>
            </div>
          )}

          {/* Step 1: Schedule a service */}
          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Schedule a Service</h3>
              <p className="text-sm text-slate-500">Create a new service occurrence to staff.</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  placeholder="Service name (optional)"
                  value={newServiceRunName}
                  onChange={(event) => setNewServiceRunName(event.target.value)}
                  disabled={serviceRunCreating}
                />
                <Input
                  type="datetime-local"
                  value={newServiceRunAt}
                  onChange={(event) => setNewServiceRunAt(event.target.value)}
                  disabled={serviceRunCreating}
                />
                <Input
                  type="number"
                  min={30}
                  step={15}
                  placeholder="Duration (minutes)"
                  value={newServiceRunDurationMinutes}
                  onChange={(event) => setNewServiceRunDurationMinutes(event.target.value)}
                  disabled={serviceRunCreating}
                />
                <Select
                  value={selectedTemplateId ?? undefined}
                  onValueChange={setSelectedTemplateId}
                  disabled={serviceTemplatesLoading || serviceTemplates.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={serviceTemplatesLoading ? "Loading..." : "Roles template"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceTemplates.map((t) => (
                      <SelectItem key={t.template.id} value={t.template.id}>
                        {t.template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                <p className="text-sm text-slate-500">
                  {!selectedServiceTemplate ? (
                    <>
                      No roles template selected.{" "}
                      <button
                        type="button"
                        onClick={() => router.push("/app/settings/role-matrix")}
                        className="text-lime-600 underline"
                      >
                        Set up Church Roles first
                      </button>
                    </>
                  ) : (
                    <>
                      Using <span className="font-semibold text-slate-900 dark:text-white">{selectedServiceTemplate.template.name}</span>
                      {" · "}
                      {selectedServiceTemplate.roleSlots.filter((s) => s.isEnabled).length} roles
                    </>
                  )}
                </p>
                <Button
                  type="button"
                  onClick={handleCreateServiceRun}
                  disabled={
                    serviceRunCreating ||
                    Boolean(servicePlanningSetupRequired) ||
                    !selectedServiceTemplate ||
                    !newServiceRunAt
                  }
                >
                  {serviceRunCreating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CalendarDays className="mr-2 h-4 w-4" />
                  )}
                  Create Service
                </Button>
              </div>
            </div>
          </div>

          {/* Step 2 & 3: Manage a service */}
          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Manage Service</h3>
                  <p className="text-sm text-slate-500">Staff roles and track who is confirmed.</p>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={selectedServiceRunId ?? undefined}
                    onValueChange={setSelectedServiceRunId}
                    disabled={serviceRunsLoading || serviceRuns.length === 0}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue
                        placeholder={
                          serviceRunsLoading ? "Loading..." : serviceRuns.length === 0 ? "No services yet" : "Select a service"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceRuns.map((row) => (
                        <SelectItem key={row.run.id} value={row.run.id}>
                          {row.run.name} · {fmtDateTime(row.run.serviceAt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchServiceRuns}
                    disabled={serviceRunsLoading}
                  >
                    <RefreshCw className={`h-4 w-4 ${serviceRunsLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {!selectedServiceRun ? (
                <p className="text-sm text-slate-500">
                  {serviceRuns.length === 0
                    ? "Create a service above to get started."
                    : "Select a service to manage its staffing."}
                </p>
              ) : (
                <>
                  {/* Run summary */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {selectedServiceRun.run.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {fmtDateTime(selectedServiceRun.run.serviceAt)} · {selectedServiceRun.run.durationMinutes} min
                        {selectedServiceRun.template?.name ? ` · ${selectedServiceRun.template.name}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {serviceAssignmentStats.total > 0 && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {serviceAssignmentStats.total - serviceAssignmentStats.unassigned}
                          </span>
                          /{serviceAssignmentStats.total} roles filled
                          {serviceAssignmentStats.confirmed > 0 && (
                            <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                              · {serviceAssignmentStats.confirmed} confirmed
                            </span>
                          )}
                        </p>
                      )}
                      <Badge
                        variant="outline"
                        className={getServiceRunBadgeClass(selectedServiceRun.run.status)}
                      >
                        {SERVICE_RUN_STATUS_LABELS[selectedServiceRun.run.status]}
                      </Badge>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push("/app/settings/scheduling-matrix")}
                    >
                      Staff This Service
                    </Button>
                    <Button
                      type="button"
                      onClick={handleStartAutostaffGoal}
                      disabled={!selectedServiceRunId || serviceGoalStarting}
                    >
                      {serviceGoalStarting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Let Grace Handle It
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSendOffersForRun}
                      disabled={!selectedServiceRunId || serviceRunOffersSending}
                      className="text-slate-500"
                    >
                      {serviceRunOffersSending ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="mr-1 h-3.5 w-3.5" />
                      )}
                      Send SMS Offers
                    </Button>
                  </div>

                  {/* Assignment list */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Role Assignments
                      </p>
                      <button
                        type="button"
                        onClick={handleGenerateAssignmentsForRun}
                        disabled={!selectedServiceRunId || serviceRunGenerateSaving}
                        className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-30 dark:hover:text-slate-300"
                      >
                        {serviceRunGenerateSaving ? "Resetting..." : "Reset slots"}
                      </button>
                    </div>
                    {serviceRunAssignmentsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                      </div>
                    ) : serviceRunAssignments.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500">
                        No roles assigned yet. Click &ldquo;Staff This Service&rdquo; to assign people.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {serviceRunAssignments.map((row) => (
                          <div
                            key={row.assignment.id}
                            className="flex items-center gap-3 px-4 py-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                {row.assignment.roleName}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {getServiceAssigneeLabel(row) || "Unassigned"}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={getServiceAssignmentBadgeClass(row.assignment.status)}
                            >
                              {SERVICE_ASSIGNMENT_STATUS_LABELS[row.assignment.status]}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Grace autostaff goals — only shown when active */}
                  {(serviceGoalsLoading || selectedRunGoals.length > 0) && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800">
                      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Grace Autostaff
                        </p>
                      </div>
                      {serviceGoalsLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {selectedRunGoals.slice(0, 5).map((row) => (
                            <div
                              key={row.goal.id}
                              className="flex items-start gap-3 px-4 py-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {row.goal.objectiveText}
                                </p>
                                {row.goal.errorText && (
                                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                                    {row.goal.errorText}
                                  </p>
                                )}
                              </div>
                              <Badge
                                variant="outline"
                                className={getGraceGoalBadgeClass(row.goal.status)}
                              >
                                {GRACE_GOAL_STATUS_LABELS[row.goal.status]}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
      </div>

      <Dialog open={voiceOpen} onOpenChange={setVoiceOpen}>
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Grace Voice Command</DialogTitle>
          </DialogHeader>
          <div className="p-6 pt-3">
            <GraceVoiceAssistant autoStart hideTitle />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
