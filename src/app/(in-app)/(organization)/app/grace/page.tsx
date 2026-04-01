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
  markConversationWaiting,
  resolveConversation,
  archiveConversation,
  reopenConversation,
  getPhoneCalls,
} from "@/app/actions/communications";
import { getAppointments, updateAppointment } from "@/app/actions/operations";
import { getPipelineData, updateItemStage } from "@/app/actions/pipeline";
import { createEvent, getEvents } from "@/app/actions/calendar";
import {
  createGraceKnowledge,
  deleteGraceKnowledge,
  getGraceApprovals,
  getGraceCalls,
  getGraceDailyBriefing,
  getGraceFollowupProposals,
  getGraceKnowledge,
  getGraceKnowledgeVersions,
  getGraceProviderConfigs,
  getGraceSessions,
  getGraceToolAudit,
  sendCopilotMessage,
  updateGraceApproval,
  updateGraceFollowupProposalStatus,
  updateGraceKnowledge,
} from "@/app/actions/grace";
import { getGraceSettings } from "@/app/actions/grace-settings";
import type { GraceActionOutcome } from "@/lib/grace/types";
import { PipelineBoard } from "@/components/features/PipelineBoard";
import {
  buildServiceRunRoleMatrix,
  getNextUpcomingServiceRun,
  getPreferredServiceRunId,
  summarizeRoleMatrix,
} from "@/lib/grace/service-planning";
import {
  APPROVAL_QUEUE_SLA_MINUTES,
  RUNTIME_FAILURE_ALERT_THRESHOLD_PERCENT,
  computeApprovalQueueHealth,
  computeRuntimeHealth,
} from "@/lib/grace/ops-health";

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
type ExecuteApprovalPayload = {
  error?: string;
  failed?: Array<{ error?: string }>;
  mfaRequired?: boolean;
  maskedDestination?: string;
  expiresAt?: string;
};
type ApprovalMfaChallenge = {
  approvalId: string;
  sessionId: string;
  toolName: string;
  maskedDestination?: string;
  expiresAt?: string;
};
type FollowupProposalRow = Awaited<ReturnType<typeof getGraceFollowupProposals>>[number];
type ToolAuditRow = Awaited<ReturnType<typeof getGraceToolAudit>>[number];
type KnowledgeRow = Awaited<ReturnType<typeof getGraceKnowledge>>[number];
type KnowledgeVersionRow = Awaited<ReturnType<typeof getGraceKnowledgeVersions>>[number];
type ProviderConfigRow = Awaited<ReturnType<typeof getGraceProviderConfigs>>[number];
type GraceSettingsRow = Awaited<ReturnType<typeof getGraceSettings>>;
type GraceDailyBriefingRow = Exclude<Awaited<ReturnType<typeof getGraceDailyBriefing>>, null>;
type WorkspaceTopMetric = {
  label: string;
  value: number | string;
  icon: string;
};

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

function fmtCompactCountdown(targetAt: Date, nowMs: number) {
  const deltaMs = targetAt.getTime() - nowMs;
  const absMinutes = Math.max(0, Math.round(Math.abs(deltaMs) / 60_000));

  if (absMinutes <= 1) {
    return deltaMs >= 0 ? "now" : "just now";
  }

  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  const durationLabel =
    hours > 0
      ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ""}`
      : `${minutes}m`;

  return deltaMs >= 0 ? `in ${durationLabel}` : `${durationLabel} ago`;
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
  const [conversationStatusSaving, setConversationStatusSaving] = useState(false);

  const [kbTitle, setKbTitle] = useState("");
  const [kbContent, setKbContent] = useState("");
  const [kbVisibility, setKbVisibility] = useState<"public" | "internal">("internal");
  const [kbUseForGrace, setKbUseForGrace] = useState(true);
  const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null);
  const [knowledgeMutatingId, setKnowledgeMutatingId] = useState<string | null>(null);
  const [knowledgeHistoryOpenId, setKnowledgeHistoryOpenId] = useState<string | null>(null);
  const [knowledgeHistoryLoadingId, setKnowledgeHistoryLoadingId] = useState<string | null>(
    null
  );
  const [knowledgeVersionsByEntryId, setKnowledgeVersionsByEntryId] = useState<
    Record<string, KnowledgeVersionRow[]>
  >({});
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
  const [serviceRunPayrollExporting, setServiceRunPayrollExporting] = useState(false);
  const [serviceRunRecapGenerating, setServiceRunRecapGenerating] = useState(false);
  const [serviceRunRecapLoading, setServiceRunRecapLoading] = useState(false);
  const [serviceRunRecapsByRunId, setServiceRunRecapsByRunId] = useState<
    Record<
      string,
      {
        id: string;
        summary: string;
        details: string | null;
        createdAt: string | Date;
      } | null
    >
  >({});
  const [serviceGoalStarting, setServiceGoalStarting] = useState(false);
  const [assignmentStatusSavingId, setAssignmentStatusSavingId] = useState<string | null>(null);
  const [runBoardNowMs, setRunBoardNowMs] = useState(() => Date.now());
  const [proposalDecisionId, setProposalDecisionId] = useState<string | null>(null);
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null);
  const [approvalMfaChallenge, setApprovalMfaChallenge] =
    useState<ApprovalMfaChallenge | null>(null);
  const [approvalMfaOpen, setApprovalMfaOpen] = useState(false);
  const [approvalMfaCode, setApprovalMfaCode] = useState("");
  const [approvalMfaSubmitting, setApprovalMfaSubmitting] = useState(false);

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

      setSelectedConversationId((current) => {
        if (current && convRows.some((row) => row.conversation.id === current)) {
          return current;
        }
        return convRows[0]?.conversation?.id ?? null;
      });
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

  useEffect(() => {
    const voiceParam = searchParams.get("voice");
    if (voiceParam !== "1" && voiceParam !== "true") {
      return;
    }

    setVoiceOpen(true);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("voice");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const requestedConversationId = searchParams.get("conversationId");
    if (requestedConversationId) {
      setSelectedConversationId(requestedConversationId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab !== "operations" || !selectedServiceRunId) {
      return;
    }
    setRunBoardNowMs(Date.now());
    const timer = window.setInterval(() => {
      setRunBoardNowMs(Date.now());
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [activeTab, selectedServiceRunId]);

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

  const fetchServiceRunRecap = useCallback(
    async (serviceRunId: string, options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      if (!silent) {
        setServiceRunRecapLoading(true);
      }

      try {
        const response = await fetch(
          `/api/app/organizations/current/service-runs/${serviceRunId}/recap?limit=1`,
          { cache: "no-store" }
        );
        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          message?: string;
          recaps?: Array<{
            id: string;
            summary: string;
            details: string | null;
            createdAt: string | Date;
          }>;
        };

        if (!response.ok || payload.success === false) {
          throw new Error(payload.message || "Failed to load service recap");
        }

        const latestRecap = payload.recaps?.[0] ?? null;
        setServiceRunRecapsByRunId((current) => ({
          ...current,
          [serviceRunId]: latestRecap,
        }));
      } catch (error) {
        if (!silent) {
          console.error("Failed to load service recap:", error);
          toast.error(
            error instanceof Error ? error.message : "Failed to load service recap"
          );
        }
      } finally {
        if (!silent) {
          setServiceRunRecapLoading(false);
        }
      }
    },
    []
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
    if (Object.prototype.hasOwnProperty.call(serviceRunRecapsByRunId, selectedServiceRunId)) {
      return;
    }
    fetchServiceRunRecap(selectedServiceRunId);
  }, [fetchServiceRunRecap, selectedServiceRunId, serviceRunRecapsByRunId]);

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

  const selectedServiceRunRecap = useMemo(() => {
    if (!selectedServiceRunId) return null;
    return serviceRunRecapsByRunId[selectedServiceRunId] ?? null;
  }, [selectedServiceRunId, serviceRunRecapsByRunId]);

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
  const activeConversationStatus = activeConversation?.conversation.status ?? null;
  const canReplyToActiveConversation =
    activeConversationStatus === "open" || activeConversationStatus === "waiting";

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

  const approvalQueueHealth = useMemo(
    () => computeApprovalQueueHealth(approvals),
    [approvals]
  );

  const runtimeHealth = useMemo(
    () => computeRuntimeHealth(toolAuditRows),
    [toolAuditRows]
  );

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

  const runOfServiceTimeline = useMemo(
    () =>
      runOfServiceOverview
        .slice()
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime()),
    [runOfServiceOverview]
  );

  const runOfServiceTimelineWithState = useMemo(
    () =>
      runOfServiceTimeline.map((step) => {
        const durationMinutes = Math.max(5, step.durationMinutes ?? 15);
        const startMs = step.startAt.getTime();
        const endMs = startMs + durationMinutes * 60_000;
        const isCurrent = runBoardNowMs >= startMs && runBoardNowMs < endMs;
        const isPast = runBoardNowMs >= endMs;
        const isUpcoming = runBoardNowMs < startMs;
        return {
          ...step,
          durationMinutes,
          startMs,
          endMs,
          isCurrent,
          isPast,
          isUpcoming,
        };
      }),
    [runBoardNowMs, runOfServiceTimeline]
  );

  const activeRunStep = useMemo(
    () => runOfServiceTimelineWithState.find((step) => step.isCurrent) ?? null,
    [runOfServiceTimelineWithState]
  );

  const nextRunStep = useMemo(
    () => runOfServiceTimelineWithState.find((step) => step.isUpcoming) ?? null,
    [runOfServiceTimelineWithState]
  );

  const spotlightRunStep =
    activeRunStep ??
    nextRunStep ??
    (runOfServiceTimelineWithState.length > 0
      ? runOfServiceTimelineWithState[runOfServiceTimelineWithState.length - 1]
      : null);

  const followingRunStep = useMemo(() => {
    if (!spotlightRunStep) return null;
    const spotlightIndex = runOfServiceTimelineWithState.findIndex(
      (step) => step.id === spotlightRunStep.id
    );
    if (spotlightIndex < 0) return null;
    return runOfServiceTimelineWithState[spotlightIndex + 1] ?? null;
  }, [runOfServiceTimelineWithState, spotlightRunStep]);

  const runOfServiceProgress = useMemo(() => {
    if (runOfServiceTimelineWithState.length === 0) return null;
    const firstStep = runOfServiceTimelineWithState[0];
    const lastStep = runOfServiceTimelineWithState[runOfServiceTimelineWithState.length - 1];
    const totalMs = Math.max(1, lastStep.endMs - firstStep.startMs);
    const elapsedMs = Math.min(Math.max(runBoardNowMs - firstStep.startMs, 0), totalMs);
    const progressPercent = Math.round((elapsedMs / totalMs) * 100);
    return {
      startMs: firstStep.startMs,
      endMs: lastStep.endMs,
      progressPercent,
    };
  }, [runBoardNowMs, runOfServiceTimelineWithState]);

  const activeRunStepProgressPercent = useMemo(() => {
    if (!activeRunStep) return null;
    const totalMs = Math.max(1, activeRunStep.endMs - activeRunStep.startMs);
    const elapsedMs = Math.min(
      Math.max(runBoardNowMs - activeRunStep.startMs, 0),
      totalMs
    );
    return Math.round((elapsedMs / totalMs) * 100);
  }, [activeRunStep, runBoardNowMs]);

  const runBoardCountdownLabel = useMemo(() => {
    if (!spotlightRunStep) return "No run steps available";
    if (activeRunStep) {
      return `Ends ${fmtCompactCountdown(new Date(activeRunStep.endMs), runBoardNowMs)}`;
    }
    if (nextRunStep) {
      return `Starts ${fmtCompactCountdown(new Date(nextRunStep.startMs), runBoardNowMs)}`;
    }
    return "Run sheet complete";
  }, [activeRunStep, nextRunStep, runBoardNowMs, spotlightRunStep]);

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
        label: "Calendar",
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

  const tabTopMetrics = useMemo<WorkspaceTopMetric[]>(() => {
    if (activeTab === "center") {
      const queuedOutcomes = executionOutcomes.filter(
        (outcome) => outcome.status === "queued"
      ).length;

      return [
        {
          label: "Pending Approvals",
          value: pendingApprovals,
          icon: "shield_person",
        },
        {
          label: `Over SLA (${APPROVAL_QUEUE_SLA_MINUTES}m)`,
          value: approvalQueueHealth.overduePendingCount,
          icon: "timer_off",
        },
        {
          label: "Queued Actions",
          value: queuedOutcomes,
          icon: "schedule",
        },
        {
          label: "Failure Rate (24h)",
          value: `${runtimeHealth.failureRatePercent.toFixed(1)}%`,
          icon: "query_stats",
        },
      ];
    }

    if (activeTab === "inbox") {
      return [
        {
          label: "Waiting Threads",
          value: waitingConversations,
          icon: "forum",
        },
        {
          label: "Call Items",
          value: phoneCalls.length,
          icon: "phone_in_talk",
        },
        {
          label: "Grace Proposals",
          value: followupProposals.length,
          icon: "inbox",
        },
        {
          label: "Escalations",
          value: sessions.filter((session) => session.status === "escalated").length,
          icon: "admin_panel_settings",
        },
      ];
    }

    if (activeTab === "visitors") {
      return [
        {
          label: "Visitors In Pipeline",
          value: pipelineItems.length,
          icon: "groups",
        },
        {
          label: "First-Time Guests",
          value: firstTimeVisitorCount,
          icon: "person_add",
        },
        {
          label: "Pipeline Stages",
          value: pipelineStages.length,
          icon: "view_column",
        },
        {
          label: "Follow-Up Suggestions",
          value: pendingProposalQueue.length,
          icon: "mark_chat_unread",
        },
      ];
    }

    if (activeTab === "calendar") {
      return [
        {
          label: "Total Scheduled Items",
          value: calendarSurfaceItems.length,
          icon: "event",
        },
        {
          label: "Next 7 Days",
          value: calendarEventsNext7Days,
          icon: "calendar_month",
        },
        {
          label: "Next Event",
          value: upcomingCalendarEvents[0]
            ? fmtDurationFromNow(upcomingCalendarEvents[0].startDate)
            : "none",
          icon: "schedule",
        },
        {
          label: "Pastoral Appointments",
          value: upcomingPastoralAppointments.length,
          icon: "event_upcoming",
        },
      ];
    }

    if (activeTab === "operations") {
      return [
        {
          label: "Coverage",
          value: selectedServiceRun
            ? `${serviceRunCoverageSummary.coveragePercent}%`
            : commandCoverageLabel,
          icon: "fact_check",
        },
        {
          label: "Seats Needed",
          value: selectedServiceRun
            ? serviceRunCoverageSummary.seatsNeeded
            : commandServiceCoverageSummary.seatsNeeded,
          icon: "groups",
        },
        {
          label: "Open Positions",
          value: selectedServiceRun
            ? serviceRunCoverageSummary.seatsOpen
            : commandServiceCoverageSummary.seatsOpen,
          icon: "person_off",
        },
        {
          label: "At Risk",
          value: selectedServiceRun
            ? serviceRunCoverageSummary.seatsAtRisk
            : commandServiceCoverageSummary.seatsAtRisk,
          icon: "warning",
        },
      ];
    }

    return [
      {
        label: "Next Service",
        value: commandNextServiceLabel,
        icon: "event_upcoming",
      },
      {
        label: "Staffing Coverage",
        value: commandCoverageLabel,
        icon: "fact_check",
      },
      {
        label: "Open Positions",
        value: commandServiceRun ? commandServiceCoverageSummary.seatsOpen : "--",
        icon: "groups",
      },
      {
        label: "Aging Follow-ups",
        value: staleFollowups.length,
        icon: "mark_chat_unread",
      },
    ];
  }, [
    activeTab,
    approvalQueueHealth.overduePendingCount,
    calendarEventsNext7Days,
    calendarSurfaceItems.length,
    commandCoverageLabel,
    commandNextServiceLabel,
    commandServiceCoverageSummary.seatsAtRisk,
    commandServiceCoverageSummary.seatsNeeded,
    commandServiceCoverageSummary.seatsOpen,
    commandServiceRun,
    executionOutcomes,
    firstTimeVisitorCount,
    followupProposals.length,
    pendingApprovals,
    pendingProposalQueue.length,
    phoneCalls.length,
    pipelineItems.length,
    pipelineStages.length,
    selectedServiceRun,
    serviceRunCoverageSummary.coveragePercent,
    serviceRunCoverageSummary.seatsAtRisk,
    serviceRunCoverageSummary.seatsNeeded,
    serviceRunCoverageSummary.seatsOpen,
    sessions,
    staleFollowups.length,
    runtimeHealth.failureRatePercent,
    upcomingCalendarEvents,
    upcomingPastoralAppointments.length,
    waitingConversations,
  ]);

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

  const handleSetConversationStatus = async (
    id: string,
    nextStatus: "waiting" | "resolved" | "archived" | "open"
  ) => {
    setConversationStatusSaving(true);
    try {
      if (nextStatus === "waiting") {
        await markConversationWaiting(id);
      } else if (nextStatus === "resolved") {
        await resolveConversation(id);
      } else if (nextStatus === "archived") {
        await archiveConversation(id);
      } else {
        await reopenConversation(id);
      }
      await fetchWorkspace();
      if (nextStatus === "waiting") toast.success("Conversation marked waiting");
      if (nextStatus === "resolved") toast.success("Conversation resolved");
      if (nextStatus === "archived") toast.success("Conversation archived");
      if (nextStatus === "open") toast.success("Conversation reopened");
    } catch (error) {
      console.error("Failed to update conversation status:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update conversation status"
      );
    } finally {
      setConversationStatusSaving(false);
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

  const executeApprovalAction = useCallback(
    async (approval: ApprovalRow, mfaCode?: string) => {
      const response = await fetch("/api/grace/actions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: approval.sessionId,
          actionIds: [approval.id],
          ...(mfaCode ? { mfaCode } : {}),
        }),
      });

      const payload = (await response.json()) as ExecuteApprovalPayload;
      return { ok: response.ok, payload };
    },
    []
  );

  const handleApprovalExecutionOutcome = useCallback(
    async (payload: ExecuteApprovalPayload) => {
      const failedMessages = payload.failed
        ?.map((item) => item.error)
        .filter((value): value is string => Boolean(value));

      if (failedMessages && failedMessages.length > 0) {
        toast.error(`Approved, but execution failed: ${failedMessages.join("; ")}`);
      } else {
        toast.success("Action approved and executed");
      }

      await fetchWorkspace();
    },
    [fetchWorkspace]
  );

  const closeApprovalMfaDialog = useCallback(() => {
    setApprovalMfaOpen(false);
    setApprovalMfaChallenge(null);
    setApprovalMfaCode("");
    setApprovalMfaSubmitting(false);
  }, []);

  const handleApproveAndExecute = useCallback(
    async (approval: ApprovalRow) => {
      if (approvalActionId === approval.id || approvalMfaSubmitting) return;

      setApprovalActionId(approval.id);
      try {
        const { ok, payload } = await executeApprovalAction(approval);

        if (ok) {
          await handleApprovalExecutionOutcome(payload);
          return;
        }

        if (!payload.mfaRequired) {
          throw new Error(payload.error || "Failed to execute approval");
        }

        const action = (approval.proposedAction ?? {}) as Record<string, unknown>;
        const toolName = typeof action.tool === "string" ? action.tool : "requested action";

        setApprovalMfaChallenge({
          approvalId: approval.id,
          sessionId: approval.sessionId,
          toolName,
          maskedDestination: payload.maskedDestination,
          expiresAt: payload.expiresAt,
        });
        setApprovalMfaCode("");
        setApprovalMfaOpen(true);
        toast.info("Verification required before this action can run.");
      } catch (error) {
        console.error("Failed to approve action:", error);
        toast.error(error instanceof Error ? error.message : "Failed to approve action");
      } finally {
        setApprovalActionId(null);
      }
    },
    [
      approvalActionId,
      approvalMfaSubmitting,
      executeApprovalAction,
      handleApprovalExecutionOutcome,
    ]
  );

  const handleSubmitApprovalMfa = useCallback(async () => {
    if (!approvalMfaChallenge) return;
    if (!approvalMfaCode.trim()) {
      toast.error("Verification code is required.");
      return;
    }

    const approval = approvals.find((row) => row.id === approvalMfaChallenge.approvalId);
    if (!approval) {
      toast.error("Approval item no longer available.");
      closeApprovalMfaDialog();
      return;
    }

    setApprovalMfaSubmitting(true);
    try {
      const { ok, payload } = await executeApprovalAction(approval, approvalMfaCode.trim());

      if (!ok) {
        if (payload.mfaRequired) {
          setApprovalMfaChallenge((current) =>
            current
              ? {
                  ...current,
                  maskedDestination:
                    payload.maskedDestination ?? current.maskedDestination,
                  expiresAt: payload.expiresAt ?? current.expiresAt,
                }
              : current
          );
          toast.error(payload.error || "Invalid or expired verification code.");
          return;
        }

        throw new Error(payload.error || "Failed to execute approval");
      }

      closeApprovalMfaDialog();
      await handleApprovalExecutionOutcome(payload);
    } catch (error) {
      console.error("Failed to verify approval code:", error);
      toast.error(error instanceof Error ? error.message : "Failed to verify code");
    } finally {
      setApprovalMfaSubmitting(false);
    }
  }, [
    approvalMfaChallenge,
    approvalMfaCode,
    approvals,
    closeApprovalMfaDialog,
    executeApprovalAction,
    handleApprovalExecutionOutcome,
  ]);

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

  const resetKnowledgeComposer = () => {
    setKbTitle("");
    setKbContent("");
    setKbVisibility("internal");
    setKbUseForGrace(true);
    setEditingKnowledgeId(null);
  };

  const handleSubmitKnowledge = async () => {
    if (!orgId || !kbTitle.trim() || !kbContent.trim()) return;
    try {
      setKnowledgeMutatingId(editingKnowledgeId ?? "new");
      if (editingKnowledgeId) {
        await updateGraceKnowledge({
          organizationId: orgId,
          knowledgeId: editingKnowledgeId,
          title: kbTitle.trim(),
          content: kbContent.trim(),
          visibility: kbVisibility,
          useForGrace: kbUseForGrace,
        });
        toast.success("Knowledge entry updated");
      } else {
        await createGraceKnowledge({
          organizationId: orgId,
          title: kbTitle.trim(),
          content: kbContent.trim(),
          visibility: kbVisibility,
          useForGrace: kbUseForGrace,
        });
        toast.success("Knowledge entry added");
      }

      resetKnowledgeComposer();
      await fetchWorkspace();
    } catch (error) {
      console.error("Failed to save knowledge:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save knowledge entry");
    } finally {
      setKnowledgeMutatingId(null);
    }
  };

  const handleEditKnowledge = (entry: KnowledgeRow) => {
    setEditingKnowledgeId(entry.id);
    setKbTitle(entry.title);
    setKbContent(entry.content);
    setKbVisibility(entry.visibility ?? "internal");
    setKbUseForGrace(Boolean(entry.useForGrace));
  };

  const handleDeleteKnowledge = async (entry: KnowledgeRow) => {
    if (!orgId) return;
    const confirmed = window.confirm(
      `Delete knowledge entry "${entry.title}"? Version history will be retained.`
    );
    if (!confirmed) return;

    try {
      setKnowledgeMutatingId(entry.id);
      await deleteGraceKnowledge({
        organizationId: orgId,
        knowledgeId: entry.id,
      });
      toast.success("Knowledge entry deleted");
      if (editingKnowledgeId === entry.id) {
        resetKnowledgeComposer();
      }
      if (knowledgeHistoryOpenId === entry.id) {
        setKnowledgeHistoryOpenId(null);
      }
      await fetchWorkspace();
    } catch (error) {
      console.error("Failed to delete knowledge:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete knowledge entry");
    } finally {
      setKnowledgeMutatingId(null);
    }
  };

  const handleToggleKnowledgeHistory = async (entryId: string) => {
    if (!orgId) return;
    if (knowledgeHistoryOpenId === entryId) {
      setKnowledgeHistoryOpenId(null);
      return;
    }

    setKnowledgeHistoryOpenId(entryId);
    if (knowledgeVersionsByEntryId[entryId]) {
      return;
    }

    try {
      setKnowledgeHistoryLoadingId(entryId);
      const versions = await getGraceKnowledgeVersions({
        organizationId: orgId,
        knowledgeId: entryId,
        limit: 12,
      });
      setKnowledgeVersionsByEntryId((current) => ({
        ...current,
        [entryId]: versions,
      }));
    } catch (error) {
      console.error("Failed to load knowledge versions:", error);
      toast.error("Failed to load knowledge version history");
    } finally {
      setKnowledgeHistoryLoadingId(null);
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

  const handleExportServiceRunPayroll = async () => {
    if (!selectedServiceRunId) {
      toast.error("Select a service run first");
      return;
    }

    setServiceRunPayrollExporting(true);
    try {
      const response = await fetch(
        `/api/app/organizations/current/service-runs/payroll-ledger/export?serviceRunId=${encodeURIComponent(
          selectedServiceRunId
        )}&includeOpen=false&markExported=true`,
        {
          method: "GET",
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(payload.message || "Failed to export payroll ledger");
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/i);
      const fileName = fileNameMatch?.[1] || "payroll-ledger.csv";
      const exportedCount = Number(response.headers.get("X-Exported-Count") ?? "0");

      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);

      toast.success(`Payroll ledger exported (${exportedCount} rows)`);
      await fetchServiceRunAssignments(selectedServiceRunId, { silent: true });
    } catch (error) {
      console.error("Failed to export payroll ledger:", error);
      toast.error(error instanceof Error ? error.message : "Failed to export payroll ledger");
    } finally {
      setServiceRunPayrollExporting(false);
    }
  };

  const handleGenerateServiceRunRecap = async () => {
    if (!selectedServiceRunId) {
      toast.error("Select a service run first");
      return;
    }

    setServiceRunRecapGenerating(true);
    try {
      const response = await fetch(
        `/api/app/organizations/current/service-runs/${selectedServiceRunId}/recap`,
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
          generated: boolean;
          recap: {
            id: string;
            summary: string;
            details: string | null;
            createdAt: string | Date;
          };
        };
      };

      if (!response.ok || payload.success === false || !payload.result?.recap) {
        throw new Error(payload.message || "Failed to generate service recap");
      }

      setServiceRunRecapsByRunId((current) => ({
        ...current,
        [selectedServiceRunId]: payload.result?.recap ?? null,
      }));
      toast.success(
        payload.result.generated
          ? "Service recap generated"
          : "Service recap already available"
      );
    } catch (error) {
      console.error("Failed to generate service recap:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate service recap");
    } finally {
      setServiceRunRecapGenerating(false);
    }
  };

  const handleUpdateAssignmentStatus = useCallback(
    async (assignmentId: string, status: ServiceAssignmentStatus) => {
      setAssignmentStatusSavingId(`${assignmentId}:${status}`);
      try {
        const response = await fetch(
          `/api/app/organizations/current/service-assignments/${assignmentId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          }
        );
        const payload = (await response.json().catch(() => ({}))) as {
          success?: boolean;
          message?: string;
        };

        if (!response.ok || payload.success === false) {
          throw new Error(payload.message || "Failed to update assignment status");
        }

        if (selectedServiceRunId) {
          await fetchServiceRunAssignments(selectedServiceRunId);
        }
        toast.success(`Assignment marked ${SERVICE_ASSIGNMENT_STATUS_LABELS[status]}`);
      } catch (error) {
        console.error("Failed to update assignment status:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to update assignment status"
        );
      } finally {
        setAssignmentStatusSavingId(null);
      }
    },
    [fetchServiceRunAssignments, selectedServiceRunId]
  );

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
            {tabTopMetrics.map((metric) => (
              <TopMetric
                key={`${activeTab}-${metric.label}`}
                label={metric.label}
                value={metric.value}
                icon={metric.icon}
              />
            ))}
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
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Approval SLA & Runtime Health
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  QA launch monitors for approval queue latency and tool runtime failures.
                </p>
              </div>
              <Badge
                className={
                  approvalQueueHealth.hasSlaBreach || runtimeHealth.alerting
                    ? "mt-4 md:mt-0 border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                    : "mt-4 md:mt-0 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                }
              >
                {approvalQueueHealth.hasSlaBreach || runtimeHealth.alerting ? "Action Needed" : "Healthy"}
              </Badge>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MinistryBriefItem
                  title="Pending Approvals"
                  value={approvalQueueHealth.pendingCount}
                  detail={`${approvalQueueHealth.avgPendingAgeMinutes}m avg age`}
                  icon="shield_person"
                />
                <MinistryBriefItem
                  title={`Over SLA (${APPROVAL_QUEUE_SLA_MINUTES}m)`}
                  value={approvalQueueHealth.overduePendingCount}
                  detail={`${approvalQueueHealth.oldestPendingAgeMinutes}m oldest`}
                  icon="timer_off"
                />
                <MinistryBriefItem
                  title="Decisions (7d)"
                  value={approvalQueueHealth.decidedLast7Days}
                  detail={`${approvalQueueHealth.avgDecisionMinutes}m avg decision`}
                  icon="done_all"
                />
                <MinistryBriefItem
                  title="Runtime Failure Rate (24h)"
                  value={`${runtimeHealth.failureRatePercent.toFixed(1)}%`}
                  detail={`${runtimeHealth.last24hFailures}/${runtimeHealth.last24hRuns} failed`}
                  icon="monitor_heart"
                />
              </div>

              {(approvalQueueHealth.hasSlaBreach || runtimeHealth.alerting) && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4 dark:border-rose-800 dark:bg-rose-950/20">
                  <p className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                    Launch Alert
                  </p>
                  <p className="mt-1 text-sm text-rose-700 dark:text-rose-200">
                    {approvalQueueHealth.hasSlaBreach
                      ? `${approvalQueueHealth.overduePendingCount} approval${approvalQueueHealth.overduePendingCount === 1 ? "" : "s"} exceeded the ${APPROVAL_QUEUE_SLA_MINUTES} minute SLA. `
                      : ""}
                    {runtimeHealth.alerting
                      ? `Runtime failure rate is ${runtimeHealth.failureRatePercent.toFixed(1)}% in the last 24 hours.`
                      : ""}
                  </p>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Top Failed Tools (24h)</p>
                  {runtimeHealth.topFailedTools.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">No failed tool runs in the last 24 hours.</p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {runtimeHealth.topFailedTools.map((row) => (
                        <div key={row.tool} className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-600 dark:text-slate-300">
                            {row.tool}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">{row.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">Failure By Channel (24h)</p>
                  {runtimeHealth.failureByChannel.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">No channel failures in the last 24 hours.</p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {runtimeHealth.failureByChannel.map((row) => (
                        <div key={row.channel} className="flex items-center justify-between text-xs">
                          <span className="font-semibold uppercase text-slate-600 dark:text-slate-300">
                            {row.channel}
                          </span>
                          <span className="font-bold text-slate-900 dark:text-white">{row.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
                const isApprovalProcessing =
                  approvalActionId === approval.id ||
                  (approvalMfaSubmitting &&
                    approvalMfaChallenge?.approvalId === approval.id);

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
                          <Button
                            type="button"
                            className="bg-[#84cc16] hover:bg-[#65a30d] text-slate-950 font-bold px-4 py-2 rounded-xl transition-all shadow-sm text-sm flex items-center justify-center gap-1"
                            disabled={isApprovalProcessing}
                            onClick={() => void handleApproveAndExecute(approval)}
                          >
                            {isApprovalProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[16px]">check</span>
                            )}
                            Approve
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold px-4 py-2 rounded-xl transition-all text-sm flex items-center justify-center gap-1"
                            disabled={isApprovalProcessing}
                            onClick={() => handleRejectApproval(approval)}
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                            Reject
                          </Button>
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
                  {graceCalls.map((row) => {
                    const call = row.call;
                    const contactName = row.contact
                      ? `${row.contact.firstName} ${row.contact.lastName}`.trim()
                      : "Unknown caller";
                    const escalationOpen =
                      row.latestHandoffStatus === "open" ||
                      (row.latestHandoffStatus == null && row.session?.status === "escalated");

                    return (
                      <div
                        key={call.id}
                        className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col md:flex-row justify-between items-start gap-4"
                      >
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
                            <p className="text-xs text-slate-500 mt-0.5 font-semibold">
                              {contactName}
                            </p>
                            <p className="text-sm text-slate-500 mt-1 font-medium">
                              {call.summaryText || call.transcriptText || "No transcript yet"}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-2 font-semibold uppercase tracking-wide">
                              {fmtDateTime(call.createdAt)}
                              {typeof call.durationSec === "number" ? ` · ${call.durationSec}s` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {call.outcome && (
                            <Badge variant="outline" className="border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300">
                              {call.outcome.replace(/_/g, " ")}
                            </Badge>
                          )}
                          {escalationOpen && (
                            <Badge
                              variant="outline"
                              className="border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300"
                            >
                              Escalated
                            </Badge>
                          )}
                          {row.linkedConversationId && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedConversationId(row.linkedConversationId);
                                switchTab("inbox");
                              }}
                            >
                              Open Thread
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
                <h4 className="font-bold text-slate-900 dark:text-white mb-4">
                  {editingKnowledgeId ? "Edit Knowledge" : "Add Knowledge"}
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Entry Title</label>
                    <Input className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800" placeholder="e.g. Sunday Service Times" value={kbTitle} onChange={(e) => setKbTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Content</label>
                    <Textarea className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 resize-none" placeholder="Details Grace will access..." rows={5} value={kbContent} onChange={(e) => setKbContent(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                      Visibility
                    </label>
                    <Select
                      value={kbVisibility}
                      onValueChange={(value) =>
                        setKbVisibility(value === "public" ? "public" : "internal")
                      }
                    >
                      <SelectTrigger className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Internal</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Use for Grace
                      </p>
                      <p className="text-xs text-slate-500">Include in retrieval context</p>
                    </div>
                    <Switch checked={kbUseForGrace} onCheckedChange={setKbUseForGrace} />
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold px-4 py-2.5 rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-all text-sm flex justify-center items-center gap-2 disabled:opacity-60"
                      onClick={handleSubmitKnowledge}
                      disabled={Boolean(knowledgeMutatingId)}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {editingKnowledgeId ? "save" : "add"}
                      </span>
                      {editingKnowledgeId ? "Save Changes" : "Add Entry"}
                    </button>
                    {editingKnowledgeId ? (
                      <button
                        className="bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold px-4 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-all text-sm"
                        onClick={resetKnowledgeComposer}
                        disabled={Boolean(knowledgeMutatingId)}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="lg:w-2/3 mt-6 lg:mt-0 space-y-3">
                {knowledge.length === 0 && (
                   <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed h-full">
                     <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">No knowledge entries configured.</p>
                   </div>
                )}
                {knowledge.map((entry) => {
                  const historyOpen = knowledgeHistoryOpenId === entry.id;
                  const historyLoading = knowledgeHistoryLoadingId === entry.id;
                  const versions = knowledgeVersionsByEntryId[entry.id] ?? [];
                  const mutating = knowledgeMutatingId === entry.id;

                  return (
                    <div key={entry.id} className="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 group hover:border-slate-300 transition-all">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-[#84cc16] text-[18px]">auto_stories</span>
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white">{entry.title}</h4>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge variant="outline">{entry.visibility}</Badge>
                              <Badge variant="outline">
                                {entry.useForGrace ? "Grace enabled" : "Grace excluded"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditKnowledge(entry)}
                            disabled={Boolean(knowledgeMutatingId)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleToggleKnowledgeHistory(entry.id)}
                            disabled={historyLoading}
                          >
                            {historyLoading ? "Loading..." : historyOpen ? "Hide History" : "History"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-rose-700 border-rose-200 hover:bg-rose-50 dark:text-rose-300 dark:border-rose-800"
                            onClick={() => void handleDeleteKnowledge(entry)}
                            disabled={mutating || Boolean(knowledgeMutatingId)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-7">{entry.content}</p>
                      <p className="text-[11px] text-slate-400 mt-2 pl-7 font-semibold uppercase tracking-wide">
                        Updated {fmtDateTime(entry.updatedAt)}
                      </p>
                      {historyOpen ? (
                        <div className="mt-3 ml-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                            Version History
                          </p>
                          {versions.length === 0 ? (
                            <p className="text-xs text-slate-500">No versions recorded yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {versions.map((version) => (
                                <div
                                  key={version.id}
                                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                      v{version.versionNumber} · {version.changeType}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                      {fmtDateTime(version.createdAt)}
                                    </p>
                                  </div>
                                  {version.changeSummary ? (
                                    <p className="text-xs text-slate-500 mt-1">{version.changeSummary}</p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="inbox" className="space-y-8 max-w-7xl mx-auto w-full p-8 pt-0">
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
                {activeConversation && (
                  <div className="flex items-center gap-2">
                    {activeConversation.conversation.status === "open" && (
                      <button
                        className="bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold px-3 py-2 rounded-xl transition-all shadow-sm text-xs"
                        onClick={() =>
                          handleSetConversationStatus(
                            activeConversation.conversation.id,
                            "waiting"
                          )
                        }
                        disabled={conversationStatusSaving}
                      >
                        Mark Waiting
                      </button>
                    )}
                    {(activeConversation.conversation.status === "open" ||
                      activeConversation.conversation.status === "waiting") && (
                      <button
                        className="bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold px-3 py-2 rounded-xl transition-all shadow-sm text-xs"
                        onClick={() =>
                          handleSetConversationStatus(
                            activeConversation.conversation.id,
                            "resolved"
                          )
                        }
                        disabled={conversationStatusSaving}
                      >
                        Resolve
                      </button>
                    )}
                    {activeConversation.conversation.status !== "archived" ? (
                      <button
                        className="bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold px-3 py-2 rounded-xl transition-all shadow-sm text-xs"
                        onClick={() =>
                          handleSetConversationStatus(
                            activeConversation.conversation.id,
                            "archived"
                          )
                        }
                        disabled={conversationStatusSaving}
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        className="bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold px-3 py-2 rounded-xl transition-all shadow-sm text-xs"
                        onClick={() =>
                          handleSetConversationStatus(activeConversation.conversation.id, "open")
                        }
                        disabled={conversationStatusSaving}
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 mb-4">
                  <strong className="text-slate-900 dark:text-white uppercase tracking-wider font-bold">Conversation stats:</strong>{" "}
                  <span className="ml-2">Open <span className="font-bold text-slate-900 dark:text-white">{Number(conversationStats?.open ?? 0)}</span></span><span className="mx-2">|</span>
                  <span>Waiting <span className="font-bold text-slate-900 dark:text-white">{Number(conversationStats?.waiting ?? 0)}</span></span><span className="mx-2">|</span>
                  <span>Resolved <span className="font-bold text-slate-900 dark:text-white">{Number(conversationStats?.resolved ?? 0)}</span></span><span className="mx-2">|</span>
                  <span>Archived <span className="font-bold text-slate-900 dark:text-white">{Number(conversationStats?.archived ?? 0)}</span></span>
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
                    placeholder={
                      canReplyToActiveConversation
                        ? "Reply as Grace operator..."
                        : "Reopen the conversation to send a reply"
                    }
                    disabled={!canReplyToActiveConversation}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <button 
                    className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0 w-12 h-12 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSend}
                    disabled={sending || !composerText.trim() || !canReplyToActiveConversation}
                  >
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
                <Button variant="outline" onClick={() => switchTab("visitors")}>
                  Open Full Pipeline
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-x-auto p-6 flex gap-6 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 min-h-[500px]">
              {pipelineStages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 w-full flex items-center justify-center">
                  Visitor stages are not configured yet. Open Pipeline to create or seed stages.
                </div>
              ) : (
                <PipelineBoard
                  stages={pipelineStages}
                  items={pipelineItems}
                  searchQuery=""
                  handleDelete={async (id) => {
                    import("@/app/actions/pipeline").then(async ({ deletePipelineItem }) => {
                      if (!confirm("Remove this visitor from the pipeline?")) return;
                      await deletePipelineItem(id);
                      await fetchWorkspace();
                      toast.success("Visitor removed");
                    });
                  }}
                  handleMoveStage={handleMoveVisitorStage}
                  onDragEndOptimistic={async (result: import("@hello-pangea/dnd").DropResult) => {
                    const { source, destination, draggableId } = result;
                    if (!destination) return;
                    if (source.droppableId === destination.droppableId && source.index === destination.index) return;
                    
                    const newItems = [...pipelineItems];
                    const itemIndex = newItems.findIndex(i => i.item.id === draggableId);
                    if (itemIndex > -1) {
                      newItems[itemIndex] = {
                        ...newItems[itemIndex],
                        item: {
                          ...newItems[itemIndex].item,
                          stageId: destination.droppableId,
                          order: destination.index
                        }
                      };
                      setPipelineItems(newItems);
                    }
                    
                    await handleMoveVisitorStage(draggableId, destination.droppableId);
                  }}
                />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-8 max-w-7xl mx-auto w-full p-8 pt-0">
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
              <Button variant="outline" onClick={() => switchTab("calendar")}>
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

          {/* Step 0: Preview assignment coverage and conflicts */}
          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Assignment Preview & Conflict Radar
                </h3>
                <p className="text-sm text-slate-500">
                  Score candidates by role fit, availability, and schedule conflicts before offers.
                </p>
              </div>
              {selectedServiceRun ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAssignmentServiceAt(
                      formatDateTimeLocalInput(new Date(selectedServiceRun.run.serviceAt))
                    );
                    setAssignmentDurationMinutes(
                      String(selectedServiceRun.run.durationMinutes)
                    );
                  }}
                >
                  Use Selected Service Time
                </Button>
              ) : null}
            </div>

            <div className="p-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input
                  type="datetime-local"
                  value={assignmentServiceAt}
                  onChange={(event) => setAssignmentServiceAt(event.target.value)}
                  disabled={assignmentLoading}
                />
                <Input
                  type="number"
                  min={30}
                  step={15}
                  placeholder="Duration (minutes)"
                  value={assignmentDurationMinutes}
                  onChange={(event) => setAssignmentDurationMinutes(event.target.value)}
                  disabled={assignmentLoading}
                />
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/40">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Include unavailable
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Show blocked candidates and conflict reasons
                    </p>
                  </div>
                  <Switch
                    checked={includeUnavailableCandidates}
                    onCheckedChange={setIncludeUnavailableCandidates}
                    disabled={assignmentLoading}
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleRunAssignmentPreview}
                  disabled={assignmentLoading || !selectedServiceTemplate}
                >
                  {assignmentLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Run Preview
                </Button>
              </div>

              {!selectedServiceTemplate ? (
                <p className="text-sm text-slate-500">
                  Select a roles template in &ldquo;Schedule a Service&rdquo; to run preview.
                </p>
              ) : null}

              {assignmentPreview ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Coverage
                      </p>
                      <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                        {assignmentPreview.summary.recommendedSeats}/{assignmentPreview.summary.totalSeats}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Unfilled Required
                      </p>
                      <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                        {assignmentPreview.summary.unfilledRequiredSeats}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Required Roles At Risk
                      </p>
                      <p className="mt-1 text-xl font-black text-slate-900 dark:text-white">
                        {assignmentPreview.summary.requiredRolesWithoutCoverage}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Generated
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {fmtDateTime(assignmentPreview.generatedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {assignmentPreview.roleRecommendations.map((recommendation) => {
                      const conflictCandidates = recommendation.suggestions
                        .filter((candidate) => !candidate.available && candidate.conflictReason)
                        .slice(0, 3);

                      return (
                        <div
                          key={recommendation.roleSlot.id}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {recommendation.roleSlot.roleName}
                              </p>
                              <p className="text-xs text-slate-500">
                                {ROLE_ASSIGNMENT_LABELS[recommendation.roleSlot.assignmentType]} ·{" "}
                                {recommendation.requiredCount} required
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={
                                  recommendation.unfilledSeats > 0
                                    ? "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                                    : "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                                }
                              >
                                {recommendation.unfilledSeats > 0
                                  ? `${recommendation.unfilledSeats} unfilled`
                                  : "covered"}
                              </Badge>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 lg:grid-cols-2">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Recommended
                              </p>
                              {recommendation.recommended.length === 0 ? (
                                <p className="mt-1 text-xs text-slate-500">
                                  No available candidates for this seat.
                                </p>
                              ) : (
                                <div className="mt-1 space-y-1">
                                  {recommendation.recommended.map((candidate) => (
                                    <div
                                      key={`${recommendation.roleSlot.id}-${candidate.assigneeType}-${candidate.assigneeId}`}
                                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-900/70"
                                    >
                                      <span className="truncate text-slate-700 dark:text-slate-200">
                                        {candidate.displayName}
                                      </span>
                                      <span className="font-semibold text-slate-500">
                                        {candidate.score}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Conflicts
                              </p>
                              {conflictCandidates.length === 0 ? (
                                <p className="mt-1 text-xs text-slate-500">
                                  No scheduling conflicts detected in the top candidates.
                                </p>
                              ) : (
                                <div className="mt-1 space-y-1">
                                  {conflictCandidates.map((candidate) => (
                                    <div
                                      key={`${recommendation.roleSlot.id}-${candidate.assigneeType}-${candidate.assigneeId}-conflict`}
                                      className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
                                    >
                                      <p className="font-semibold">{candidate.displayName}</p>
                                      <p>{candidate.conflictReason}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Run preview to inspect coverage gaps and scheduling conflicts before offers.
                </p>
              )}
            </div>
          </div>

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

                  {/* Run-of-service board */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Run-of-Service Board
                        </p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {spotlightRunStep?.title ?? "No live steps configured"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          activeRunStep
                            ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                            : nextRunStep
                              ? "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
                              : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                        }
                      >
                        {activeRunStep ? "Live" : nextRunStep ? "Up Next" : "Complete"}
                      </Badge>
                    </div>
                    {runOfServiceTimelineWithState.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-slate-500">
                        No run sheet configured yet. Add timeline steps to your roles template.
                      </p>
                    ) : (
                      <div className="grid gap-4 p-4 lg:grid-cols-[1.2fr,1fr]">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Countdown
                          </p>
                          <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                            {runBoardCountdownLabel}
                          </p>
                          {runOfServiceProgress ? (
                            <div className="mt-3 space-y-1.5">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Run Progress · {runOfServiceProgress.progressPercent}%
                              </p>
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all"
                                  style={{ width: `${runOfServiceProgress.progressPercent}%` }}
                                />
                              </div>
                            </div>
                          ) : null}
                          {spotlightRunStep ? (
                            <>
                              <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                                {spotlightRunStep.title}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {fmtDateTime(spotlightRunStep.startAt)} · {spotlightRunStep.durationMinutes} min ·{" "}
                                {spotlightRunStep.ownerLabel}
                              </p>
                              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Coverage
                              </p>
                              <p className="text-sm text-slate-700 dark:text-slate-300">
                                {spotlightRunStep.coverageLabel}
                              </p>
                              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                                {spotlightRunStep.detail}
                              </p>
                              {activeRunStepProgressPercent !== null ? (
                                <div className="mt-3 space-y-1.5">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    Current Step · {activeRunStepProgressPercent}%
                                  </p>
                                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                                    <div
                                      className="h-full rounded-full bg-blue-500 transition-all"
                                      style={{ width: `${activeRunStepProgressPercent}%` }}
                                    />
                                  </div>
                                </div>
                              ) : null}
                              {followingRunStep ? (
                                <p className="mt-3 text-xs text-slate-500">
                                  Next step:{" "}
                                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                                    {followingRunStep.title}
                                  </span>{" "}
                                  · {fmtDateTime(followingRunStep.startAt)}
                                </p>
                              ) : null}
                            </>
                          ) : null}
                        </div>

                        <div className="space-y-2">
                          {runOfServiceTimelineWithState.map((step) => (
                            <div
                              key={step.id}
                              className={`rounded-xl border px-3 py-2.5 ${
                                step.isCurrent
                                  ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/20"
                                  : step.isUpcoming
                                    ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20"
                                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/30"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                                    {step.title}
                                  </p>
                                  <p className="mt-0.5 truncate text-xs text-slate-500">
                                    {fmtDateTime(step.startAt)} · {step.durationMinutes} min · {step.ownerLabel}
                                  </p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={
                                    step.coverageTone === "attention"
                                      ? "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                                      : step.coverageTone === "healthy"
                                        ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                                        : "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300"
                                  }
                                >
                                  {step.coverageLabel}
                                </Badge>
                              </div>
                              <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                {step.isCurrent
                                  ? `Live · ends ${fmtCompactCountdown(new Date(step.endMs), runBoardNowMs)}`
                                  : step.isUpcoming
                                    ? `Starts ${fmtCompactCountdown(new Date(step.startMs), runBoardNowMs)}`
                                    : `Finished ${fmtCompactCountdown(new Date(step.endMs), runBoardNowMs)}`}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerateServiceRunRecap}
                      disabled={!selectedServiceRunId || serviceRunRecapGenerating}
                      className="text-slate-500"
                    >
                      {serviceRunRecapGenerating ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 h-3.5 w-3.5" />
                      )}
                      Generate Recap
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleExportServiceRunPayroll}
                      disabled={!selectedServiceRunId || serviceRunPayrollExporting}
                      className="text-slate-500"
                    >
                      {serviceRunPayrollExporting ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined mr-1 text-[14px]">download</span>
                      )}
                      Export Payroll CSV
                    </Button>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Post-Service Recap
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          selectedServiceRunId
                            ? fetchServiceRunRecap(selectedServiceRunId)
                            : undefined
                        }
                        className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-40"
                        disabled={!selectedServiceRunId || serviceRunRecapLoading}
                      >
                        {serviceRunRecapLoading ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>
                    {serviceRunRecapLoading ? (
                      <div className="py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                      </div>
                    ) : selectedServiceRunRecap ? (
                      <div className="mt-2 space-y-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {selectedServiceRunRecap.summary}
                        </p>
                        {selectedServiceRunRecap.details ? (
                          <p className="whitespace-pre-line text-xs text-slate-600 dark:text-slate-300">
                            {selectedServiceRunRecap.details}
                          </p>
                        ) : null}
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">
                          Generated {fmtDateTime(selectedServiceRunRecap.createdAt)}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        No recap generated yet. Grace can auto-generate one after service end, or
                        you can generate it now.
                      </p>
                    )}
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
                        {serviceRunAssignments.map((row) => {
                          const hasAssignee = Boolean(
                            row.assignment.volunteerId || row.assignment.staffUserId
                          );
                          const canCheckIn =
                            hasAssignee &&
                            ["proposed", "offered", "confirmed"].includes(
                              row.assignment.status
                            );
                          const canCheckOut = row.assignment.status === "checked_in";
                          const canNoShow =
                            hasAssignee &&
                            ["proposed", "offered", "confirmed", "needs_replacement", "checked_in"].includes(
                              row.assignment.status
                            );
                          const isStatusSaving = assignmentStatusSavingId?.startsWith(
                            `${row.assignment.id}:`
                          );

                          return (
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
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="outline"
                                  className={getServiceAssignmentBadgeClass(row.assignment.status)}
                                >
                                  {SERVICE_ASSIGNMENT_STATUS_LABELS[row.assignment.status]}
                                </Badge>
                                {canCheckIn && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 rounded-lg px-2 text-[11px]"
                                    disabled={Boolean(isStatusSaving)}
                                    onClick={() =>
                                      handleUpdateAssignmentStatus(
                                        row.assignment.id,
                                        "checked_in"
                                      )
                                    }
                                  >
                                    {isStatusSaving ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      "Check in"
                                    )}
                                  </Button>
                                )}
                                {canCheckOut && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 rounded-lg px-2 text-[11px]"
                                    disabled={Boolean(isStatusSaving)}
                                    onClick={() =>
                                      handleUpdateAssignmentStatus(
                                        row.assignment.id,
                                        "checked_out"
                                      )
                                    }
                                  >
                                    {isStatusSaving ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      "Check out"
                                    )}
                                  </Button>
                                )}
                                {canNoShow && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 rounded-lg px-2 text-[11px] text-rose-600 hover:text-rose-700"
                                    disabled={Boolean(isStatusSaving)}
                                    onClick={() =>
                                      handleUpdateAssignmentStatus(
                                        row.assignment.id,
                                        "no_show"
                                      )
                                    }
                                  >
                                    No-show
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
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

      <Dialog
        open={approvalMfaOpen}
        onOpenChange={(open) => {
          if (!open && !approvalMfaSubmitting) {
            closeApprovalMfaDialog();
            return;
          }
          setApprovalMfaOpen(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approval Verification Required</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Enter the code sent by SMS to complete approval for{" "}
              <span className="font-semibold">
                {approvalMfaChallenge?.toolName ?? "this action"}
              </span>
              .
            </p>
            {approvalMfaChallenge?.maskedDestination ? (
              <p className="text-xs text-slate-500">
                Destination: {approvalMfaChallenge.maskedDestination}
              </p>
            ) : null}
            {approvalMfaChallenge?.expiresAt ? (
              <p className="text-xs text-slate-500">
                Expires: {fmtDateTime(approvalMfaChallenge.expiresAt)}
              </p>
            ) : null}
            <Input
              autoFocus
              value={approvalMfaCode}
              onChange={(event) => setApprovalMfaCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSubmitApprovalMfa();
                }
              }}
              placeholder="Enter verification code"
              disabled={approvalMfaSubmitting}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={approvalMfaSubmitting}
                onClick={closeApprovalMfaDialog}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={approvalMfaSubmitting || !approvalMfaCode.trim()}
                onClick={() => void handleSubmitApprovalMfa()}
              >
                {approvalMfaSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying
                  </>
                ) : (
                  "Verify & Approve"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
