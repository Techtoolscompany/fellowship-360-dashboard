"use client";

import { useCallback, useEffect, useMemo, useState, type ElementType } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
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
import {
  createGraceKnowledge,
  getGraceApprovals,
  getGraceCalls,
  getGraceFollowupProposals,
  getGraceKnowledge,
  getGraceProviderConfigs,
  getGraceSessions,
  getGraceToolAudit,
  updateGraceApproval,
} from "@/app/actions/grace";
import { getGraceSettings } from "@/app/actions/grace-settings";
import type { GraceActionOutcome } from "@/lib/grace/types";

type GraceTab =
  | "command"
  | "center"
  | "inbox"
  | "conversations"
  | "calls"
  | "appointments"
  | "operations";

type ConversationRow = Awaited<ReturnType<typeof getConversations>>[number];
type PhoneCallRow = Awaited<ReturnType<typeof getPhoneCalls>>[number];
type AppointmentRow = Awaited<ReturnType<typeof getAppointments>>[number];
type MessageRow = Awaited<ReturnType<typeof getConversationMessages>>[number];
type SessionRow = Awaited<ReturnType<typeof getGraceSessions>>[number];
type GraceCallRow = Awaited<ReturnType<typeof getGraceCalls>>[number];
type ApprovalRow = Awaited<ReturnType<typeof getGraceApprovals>>[number];
type FollowupProposalRow = Awaited<ReturnType<typeof getGraceFollowupProposals>>[number];
type ToolAuditRow = Awaited<ReturnType<typeof getGraceToolAudit>>[number];
type KnowledgeRow = Awaited<ReturnType<typeof getGraceKnowledge>>[number];
type ProviderConfigRow = Awaited<ReturnType<typeof getGraceProviderConfigs>>[number];
type GraceSettingsRow = Awaited<ReturnType<typeof getGraceSettings>>;

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
  "conversations",
  "calls",
  "appointments",
  "operations",
];

function normalizeTab(value: string | null): GraceTab {
  if (!value) return "command";
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
  const [toolAuditRows, setToolAuditRows] = useState<ToolAuditRow[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeRow[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfigRow[]>([]);
  const [graceSettings, setGraceSettings] = useState<GraceSettingsRow>(null);

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
        toolAudit,
        knowledgeRows,
        providerRows,
        settingsRow,
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
        getGraceToolAudit(orgId),
        getGraceKnowledge(orgId),
        getGraceProviderConfigs(orgId),
        getGraceSettings(orgId),
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
      setToolAuditRows(toolAudit);
      setKnowledge(knowledgeRows);
      setProviderConfigs(providerRows);
      setGraceSettings(settingsRow);

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
      setSelectedServiceRunId((current) => {
        if (current && runs.some((row) => row.run.id === current)) {
          return current;
        }
        return runs[0]?.run.id ?? null;
      });
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

  const fetchServiceRunAssignments = useCallback(async (serviceRunId: string) => {
    setServiceRunAssignmentsLoading(true);
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

      setServiceRunAssignments(payload.assignments ?? []);
    } catch (error) {
      console.error("Failed to load service assignments:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load service assignments"
      );
      setServiceRunAssignments([]);
    } finally {
      setServiceRunAssignmentsLoading(false);
    }
  }, []);

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
    fetchServiceRunAssignments(selectedServiceRunId);
  }, [fetchServiceRunAssignments, selectedServiceRunId]);

  const selectedServiceTemplate = useMemo(
    () => serviceTemplates.find((item) => item.template.id === selectedTemplateId) ?? null,
    [serviceTemplates, selectedTemplateId]
  );

  const selectedServiceRun = useMemo(
    () => serviceRuns.find((item) => item.run.id === selectedServiceRunId) ?? null,
    [serviceRuns, selectedServiceRunId]
  );

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

    return selectedServiceTemplate.roleSlots.reduce(
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
  const urgentPrayerCount = Number(dashboard?.prayer?.urgent ?? 0);

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

  const upcomingPastoralAppointments = useMemo(
    () =>
      appointments.filter((row) => {
        const status = row.appointment.status;
        if (status === "cancelled" || status === "completed" || status === "no_show") return false;
        const time = new Date(row.appointment.dateTime).getTime();
        return time >= nowMs && time <= fortyEightHoursMs;
      }),
    [appointments, nowMs, fortyEightHoursMs]
  );

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
    const firstStaleFollowup = staleFollowups[0];
    const nextAppointment = upcomingPastoralAppointments[0];
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
        tab: "conversations",
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
        cta: "Review Appointments",
        tab: "appointments",
        priority: 80,
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
  }, [approvals, pendingApprovals, staleFollowups, upcomingPastoralAppointments, setupChecklist]);

  const auraState = sending ? "speaking" : loading ? "thinking" : "listening";

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
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-500">Grace AI Workspace</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">AI Church Operations Console</h1>
            <p className="mt-2 text-sm text-slate-500">
              One command surface where Grace runs operations with humans in the loop.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <TopMetric label="Follow-ups Waiting" value={waitingConversations} icon={MessageCircle} />
            <TopMetric label="Pastoral Visits (48h)" value={upcomingPastoralAppointments.length} icon={CalendarDays} />
            <TopMetric label="Pending Approvals" value={pendingApprovals} icon={Shield} />
            <TopMetric label="Urgent Prayer Needs" value={urgentPrayerCount} icon={Clock} />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => switchTab(value as GraceTab)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 gap-2 h-auto bg-transparent p-0 md:grid-cols-7">
          <TabsTrigger value="command">Command</TabsTrigger>
          <TabsTrigger value="center">Center</TabsTrigger>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="calls">Calls</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="command" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#2b8cee]" />
                  Grace Command Surface
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-950/40">
                  <AgentAudioVisualizerAura
                    size="lg"
                    state={auraState as any}
                    color="#2b8cee"
                    className="h-[180px]"
                  />
                  <p className="mt-4 text-sm font-medium text-slate-900 dark:text-white">
                    Grace Status: {auraState}
                  </p>
                  <p className="mt-1 text-center text-xs text-slate-500">
                    Voice-first command layer for pastoral operations.
                  </p>
                  <Button className="mt-4 w-full" onClick={() => setVoiceOpen(true)}>
                    <Mic className="mr-2 h-4 w-4" />
                    Speak with Grace
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Grace Next Actions</CardTitle>
                <p className="text-sm text-slate-500">
                  Prioritized by pastoral urgency for {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {nextActions.length === 0 && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
                    Grace has no immediate blockers. Continue monitoring inbox and upcoming appointments.
                  </div>
                )}
                {nextActions.map((action) => (
                  <div key={action.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{action.title}</p>
                          <Badge
                            variant="outline"
                            className={
                              action.risk === "high"
                                ? "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300"
                                : action.risk === "medium"
                                  ? "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                                  : "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                            }
                          >
                            {action.risk.toUpperCase()} RISK
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500">{action.reason}</p>
                        <p className="text-xs text-slate-500">Impact: {action.impact}</p>
                      </div>
                      <Button
                        size="sm"
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
                      >
                        {action.cta}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Ministry Brief</CardTitle>
              <p className="text-sm text-slate-500">
                The numbers that matter right now for member care and follow-up.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MinistryBriefItem
                title="Follow-ups Waiting"
                value={followupRows.length}
                detail={`${staleFollowups.length} stale for 24+ hours`}
                icon={MessageCircle}
              />
              <MinistryBriefItem
                title="Pastoral Visits (48h)"
                value={upcomingPastoralAppointments.length}
                detail={`${appointments.filter((row) => row.appointment.status === "scheduled").length} still unconfirmed`}
                icon={CalendarDays}
              />
              <MinistryBriefItem
                title="Urgent Prayer Needs"
                value={urgentPrayerCount}
                detail={`${Number(dashboard?.prayer?.pending ?? 0)} pending requests total`}
                icon={Shield}
              />
              <MinistryBriefItem
                title="Human Approvals"
                value={pendingApprovals}
                detail={`${approvals.length - pendingApprovals} already resolved`}
                icon={CheckCircle2}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Grace Launch Readiness</CardTitle>
              <p className="text-sm text-slate-500">
                Setup completion score for autonomous, church-specific operation.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-900 dark:text-white">
                    {setupCompleted}/{setupChecklist.length} setup milestones complete
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">{setupProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-[#2b8cee] transition-all"
                    style={{ width: `${setupProgress}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                {setupChecklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{item.title}</p>
                      <p className="text-xs text-slate-500">{item.detail}</p>
                    </div>
                    <Badge variant={item.done ? "default" : "outline"}>
                      {item.done ? "Done" : "Pending"}
                    </Badge>
                  </div>
                ))}
              </div>

              {setupProgress < 100 && (
                <Button variant="outline" onClick={() => router.push("/app/get-started")}>
                  Continue Setup
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="center" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Human-in-the-Loop Approval Queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {approvals.length === 0 && <p className="text-sm text-slate-500">No approvals currently queued.</p>}
              {approvals.map((approval) => {
                const action = (approval.proposedAction ?? {}) as Record<string, unknown>;
                const toolName = typeof action.tool === "string" ? action.tool : "unknown.tool";
                const reasonText =
                  typeof action.reason === "string" ? action.reason : "No reason provided";
                const payloadPreview = formatJsonPreview(action.input, 220);

                return (
                  <div key={approval.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              approval.status === "pending"
                                ? "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                                : approval.status === "approved"
                                  ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                                  : "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300"
                            }
                          >
                            {approval.status.toUpperCase()}
                          </Badge>
                          <p className="text-xs text-slate-500">{fmtDateTime(approval.createdAt)}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{toolName}</p>
                        <p className="text-xs text-slate-500">{reasonText}</p>
                        <p className="text-xs text-slate-500">Payload: {payloadPreview}</p>
                      </div>
                      {approval.status === "pending" && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleApproveAndExecute(approval)}>Approve + Execute</Button>
                          <Button size="sm" variant="outline" onClick={() => handleRejectApproval(approval)}>Reject</Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Action Execution Outcomes</CardTitle>
              <p className="text-sm text-slate-500">
                Live visibility into what Grace queued, executed, retried, or failed.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {executionOutcomes.length === 0 && (
                <p className="text-sm text-slate-500">No action outcomes captured yet.</p>
              )}
              {executionOutcomes.map((outcome) => (
                <div
                  key={`${outcome.actionId}-${outcome.status}-${outcome.occurredAt}`}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={getOutcomeBadgeClass(outcome.status)}>
                        {outcome.status.toUpperCase()}
                      </Badge>
                      <p className="text-xs text-slate-500">{fmtDateTime(outcome.occurredAt)}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{outcome.tool}</p>
                    <p className="text-xs text-slate-500">{outcome.reason}</p>
                    {outcome.approvalId && (
                      <p className="text-xs text-slate-500">Approval ID: {outcome.approvalId}</p>
                    )}
                    {outcome.error ? (
                      <p className="text-xs text-rose-600 dark:text-rose-300">{outcome.error}</p>
                    ) : (
                      outcome.output && (
                        <p className="text-xs text-slate-500">Output: {formatJsonPreview(outcome.output, 220)}</p>
                      )
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sequence Runs and Follow-Up Templates</CardTitle>
              <p className="text-sm text-slate-500">
                Built-in automation activity for visitor follow-up and missed-call recovery.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-4">
                <MinistryBriefItem
                  title="Sent"
                  value={sequenceStats.sent}
                  detail="Auto-delivered touches"
                  icon={CheckCircle2}
                />
                <MinistryBriefItem
                  title="Pending"
                  value={sequenceStats.pending}
                  detail="Needs delivery or review"
                  icon={Clock}
                />
                <MinistryBriefItem
                  title="Approved"
                  value={sequenceStats.approved}
                  detail="Human-approved actions"
                  icon={Shield}
                />
                <MinistryBriefItem
                  title="Rejected"
                  value={sequenceStats.rejected}
                  detail="Rejected follow-up actions"
                  icon={MessageCircle}
                />
              </div>

              {sequenceRuns.length === 0 && (
                <p className="text-sm text-slate-500">No sequence activity captured yet.</p>
              )}

              {sequenceRuns.map((run) => (
                <div key={run.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {run.sequenceName}
                        {run.stepName ? ` · ${run.stepName}` : ""}
                      </p>
                      <p className="text-xs text-slate-500">{run.reason || "Sequence action"}</p>
                      <p className="text-xs text-slate-500">{run.messageText}</p>
                      <p className="text-xs text-slate-500">
                        Channel: {run.channel || "unknown"} · {fmtDateTime(run.createdAt)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        run.status === "sent"
                          ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                          : run.status === "pending"
                            ? "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                            : run.status === "approved"
                              ? "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
                              : "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300"
                      }
                    >
                      {run.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Grace Voice Runtime Calls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {graceCalls.length === 0 && <p className="text-sm text-slate-500">No Grace runtime calls yet.</p>}
              {graceCalls.map((call) => (
                <div key={call.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <p className="font-medium text-slate-900 dark:text-white">
                    {call.fromNumber || "Unknown"}
                    {" -> "}
                    {call.toNumber || "Unknown"}
                  </p>
                  <p className="text-slate-500">{call.summaryText || call.transcriptText || "No transcript yet"}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <Input placeholder="Entry title" value={kbTitle} onChange={(e) => setKbTitle(e.target.value)} />
                <Textarea placeholder="Entry content" rows={4} value={kbContent} onChange={(e) => setKbContent(e.target.value)} />
                <Button onClick={handleAddKnowledge}>Add Knowledge</Button>
              </div>

              <div className="space-y-2">
                {knowledge.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <p className="font-medium text-slate-900 dark:text-white">{entry.title}</p>
                    <p className="text-sm text-slate-500">{entry.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inbox" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <MinistryBriefItem
              title="Open Sessions"
              value={sessions.filter((s) => s.status === "open").length}
              detail="Active Grace conversations"
              icon={MessageCircle}
            />
            <MinistryBriefItem
              title="Escalations"
              value={sessions.filter((s) => s.status === "escalated").length}
              detail="Requires staff intervention"
              icon={Shield}
            />
            <MinistryBriefItem
              title="Pending Approvals"
              value={pendingApprovals}
              detail="Awaiting human authorization"
              icon={Clock}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Grace Session Inbox</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sessions.length === 0 && <p className="text-sm text-slate-500">No sessions yet.</p>}
              {sessions.slice(0, 30).map((session) => (
                <div key={session.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{session.channel}</p>
                    <Badge variant="secondary">{session.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{session.finalSummary || "No summary yet"}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversations" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Conversation Threads</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {conversations.length === 0 && <p className="text-sm text-slate-500">No conversations yet.</p>}
                <ScrollArea className="h-[460px]">
                  <div className="space-y-2 pr-3">
                    {conversations.map((row) => {
                      const isActive = selectedConversationId === row.conversation.id;
                      const name = row.contact
                        ? `${row.contact.firstName} ${row.contact.lastName}`
                        : row.conversation.subject || "Unknown";

                      return (
                        <button
                          key={row.conversation.id}
                          onClick={() => setSelectedConversationId(row.conversation.id)}
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            isActive
                              ? "border-[#2b8cee] bg-[#2b8cee]/5"
                              : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
                            <Badge variant="outline">{row.conversation.channel}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{row.conversation.subject || "No subject"}</p>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Thread</span>
                  {activeConversation && activeConversation.conversation.status !== "resolved" && (
                    <Button size="sm" variant="outline" onClick={() => handleResolveConversation(activeConversation.conversation.id)}>
                      Mark Resolved
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-800">
                  <strong className="text-slate-900 dark:text-white">Conversation stats:</strong>{" "}
                  Open {Number(conversationStats?.open ?? 0)} | Waiting {Number(conversationStats?.waiting ?? 0)} | Resolved {Number(conversationStats?.resolved ?? 0)}
                </div>

                <ScrollArea className="h-[320px] rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  {messagesLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-[#2b8cee]" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-slate-500">No messages in this thread.</p>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <div key={message.id} className={`max-w-[85%] rounded-lg p-3 text-sm ${
                          message.direction === "outbound"
                            ? "ml-auto bg-[#2b8cee] text-white"
                            : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                        }`}>
                          <p>{message.content}</p>
                          <p className={`mt-1 text-[11px] ${message.direction === "outbound" ? "text-blue-100" : "text-slate-500"}`}>
                            {fmtDateTime(message.sentAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                <div className="flex gap-2">
                  <Input
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
                  <Button onClick={handleSend} disabled={sending || !composerText.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="calls" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pastoral Call Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {phoneCalls.length === 0 && <p className="text-sm text-slate-500">No phone calls yet.</p>}
                {phoneCalls.map((row) => {
                  const name = row.contact
                    ? `${row.contact.firstName} ${row.contact.lastName}`
                    : row.conversation.subject || "Unknown";

                  return (
                    <div key={row.conversation.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
                          <p className="text-xs text-slate-500">{row.contact?.phone || "No phone"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{row.latestDirection || "unknown"}</Badge>
                          <Button size="sm" variant="outline" onClick={() => {
                            setSelectedConversationId(row.conversation.id);
                            switchTab("conversations");
                          }}>
                            Open Thread
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">{row.latestContent || "No call notes"}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appointment Queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {appointments.length === 0 && <p className="text-sm text-slate-500">No appointments scheduled.</p>}
              {appointments.map((row) => (
                <div key={row.appointment.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{row.appointment.title}</p>
                      <p className="text-xs text-slate-500">
                        {row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : "No contact"} | {fmtDateTime(row.appointment.dateTime)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{row.appointment.status}</Badge>
                      {row.appointment.status !== "cancelled" && (
                        <Button size="sm" variant="outline" onClick={() => handleCancelAppointment(row.appointment.id)}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Templates</CardTitle>
              <p className="text-sm text-slate-500">
                Define repeatable run-of-service templates before assigning people.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {servicePlanningSetupRequired ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                  <p className="font-semibold">Service Planning Setup Required</p>
                  <p className="mt-1">{servicePlanningSetupRequired}</p>
                  <p className="mt-1 text-xs">
                    Run database migrations for this environment, then click Refresh.
                  </p>
                </div>
              ) : null}

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Active Template
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      value={selectedTemplateId ?? undefined}
                      onValueChange={setSelectedTemplateId}
                      disabled={serviceTemplatesLoading || serviceTemplates.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={
                            serviceTemplatesLoading
                              ? "Loading templates..."
                              : "Select a service template"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceTemplates.map((serviceTemplate) => (
                          <SelectItem
                            key={serviceTemplate.template.id}
                            value={serviceTemplate.template.id}
                          >
                            {serviceTemplate.template.name} ·{" "}
                            {
                              SERVICE_TEMPLATE_TYPE_LABELS[
                                serviceTemplate.template.serviceType
                              ]
                            }
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fetchServiceTemplates}
                      disabled={serviceTemplatesLoading}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteSelectedServiceTemplate}
                      disabled={!selectedServiceTemplate || templateSaving}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Create Template
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      placeholder="e.g. Sunday 11AM Service"
                      value={newTemplateName}
                      onChange={(event) => setNewTemplateName(event.target.value)}
                      disabled={Boolean(servicePlanningSetupRequired)}
                    />
                    <Select
                      value={newTemplateType}
                      onValueChange={(value) =>
                        setNewTemplateType(value as ServiceTemplateType)
                      }
                      disabled={Boolean(servicePlanningSetupRequired)}
                    >
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Service type" />
                      </SelectTrigger>
                      <SelectContent>
                        {SERVICE_TEMPLATE_TYPES.map((serviceTemplateType) => (
                          <SelectItem key={serviceTemplateType} value={serviceTemplateType}>
                            {SERVICE_TEMPLATE_TYPE_LABELS[serviceTemplateType]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      onClick={handleCreateServiceTemplate}
                      disabled={
                        Boolean(servicePlanningSetupRequired) ||
                        templateSaving ||
                        !newTemplateName.trim()
                      }
                    >
                      {templateSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Create
                    </Button>
                  </div>
                </div>
              </div>

              {selectedServiceTemplate ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {selectedServiceTemplate.template.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    Type:{" "}
                    {
                      SERVICE_TEMPLATE_TYPE_LABELS[
                        selectedServiceTemplate.template.serviceType
                      ]
                    }
                    {selectedServiceTemplate.template.description
                      ? ` · ${selectedServiceTemplate.template.description}`
                      : ""}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Create a template to configure staffing requirements.
                </p>
              )}
            </CardContent>
          </Card>

          {!selectedServiceTemplate ? (
            <Card>
              <CardHeader>
                <CardTitle>Role Requirement Matrix</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-500">
                  Select or create a service template to define paid staff and volunteer
                  requirements.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MinistryBriefItem
                  title="Role Slots"
                  value={roleMatrixStats.roleSlots}
                  detail="Configured service roles"
                  icon={Briefcase}
                />
                <MinistryBriefItem
                  title="Required Seats"
                  value={roleMatrixStats.requiredSeats}
                  detail="Total must-fill positions"
                  icon={Users2}
                />
                <MinistryBriefItem
                  title="Paid Staff Seats"
                  value={roleMatrixStats.paidStaffSeats}
                  detail="Assigned to paid staff"
                  icon={Shield}
                />
                <MinistryBriefItem
                  title="Volunteer Seats"
                  value={roleMatrixStats.volunteerSeats}
                  detail="Assigned to volunteers"
                  icon={CheckCircle2}
                />
                <MinistryBriefItem
                  title="Either Seats"
                  value={roleMatrixStats.eitherSeats}
                  detail="Flexible staffing slots"
                  icon={Sparkles}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Position Packs</CardTitle>
                  <p className="text-sm text-slate-500">
                    One-click church planning presets for worship, guest services, and kids.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-3 lg:grid-cols-3">
                  {POSITION_PACKS.map((pack) => (
                    <div
                      key={pack.id}
                      className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                    >
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {pack.label}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{pack.description}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {pack.roles.length} positions
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="mt-3"
                        onClick={() => handleAddPositionPack(pack.id)}
                        disabled={Boolean(positionPackSaving)}
                      >
                        {positionPackSaving === pack.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Add Pack
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Role Requirement Matrix</CardTitle>
                  <p className="text-sm text-slate-500">
                    Configure seat counts and ownership rules per role for this service.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {serviceTemplatesLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-[#2b8cee]" />
                    </div>
                  ) : null}

                  {selectedServiceTemplate.roleSlots.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No role slots yet. Add your first role below.
                    </p>
                  ) : (
                    selectedServiceTemplate.roleSlots.map((roleSlot) => {
                      const draft = roleDrafts[roleSlot.id] ?? {
                        roleName: roleSlot.roleName,
                        assignmentType: roleSlot.assignmentType,
                        requiredCount: String(roleSlot.requiredCount),
                        isRequired: roleSlot.isRequired,
                        notes: roleSlot.notes ?? "",
                      };

                      return (
                        <div
                          key={roleSlot.id}
                          className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                        >
                          <div className="grid gap-3 lg:grid-cols-5">
                            <Input
                              value={draft.roleName}
                              onChange={(event) =>
                                handleRoleDraftChange(roleSlot.id, {
                                  roleName: event.target.value,
                                })
                              }
                              placeholder="Role name"
                            />
                            <Select
                              value={draft.assignmentType}
                              onValueChange={(value) =>
                                handleRoleDraftChange(roleSlot.id, {
                                  assignmentType: value as RoleAssignmentType,
                                })
                              }
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Assignment type" />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLE_ASSIGNMENT_TYPES.map((assignmentType) => (
                                  <SelectItem key={assignmentType} value={assignmentType}>
                                    {ROLE_ASSIGNMENT_LABELS[assignmentType]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min={1}
                              value={draft.requiredCount}
                              onChange={(event) =>
                                handleRoleDraftChange(roleSlot.id, {
                                  requiredCount: event.target.value,
                                })
                              }
                              placeholder="Required count"
                            />
                            <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
                              <Switch
                                checked={draft.isRequired}
                                onCheckedChange={(checked) =>
                                  handleRoleDraftChange(roleSlot.id, {
                                    isRequired: checked,
                                  })
                                }
                              />
                              <span className="text-sm text-slate-600 dark:text-slate-300">
                                Required
                              </span>
                            </div>
                            <Input
                              value={draft.notes}
                              onChange={(event) =>
                                handleRoleDraftChange(roleSlot.id, {
                                  notes: event.target.value,
                                })
                              }
                              placeholder="Notes (optional)"
                            />
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <Badge variant="outline">
                              {ROLE_ASSIGNMENT_LABELS[draft.assignmentType]}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSaveRoleSlot(roleSlot.id)}
                                disabled={roleSavingId === roleSlot.id}
                              >
                                {roleSavingId === roleSlot.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                Save
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteRoleSlot(roleSlot.id)}
                                disabled={roleDeletingId === roleSlot.id}
                              >
                                {roleDeletingId === roleSlot.id ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="mr-2 h-4 w-4" />
                                )}
                                Delete
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  <div className="rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Add Role Slot
                    </p>
                    <div className="mt-3 grid gap-3 lg:grid-cols-5">
                      <Input
                        value={newRoleName}
                        onChange={(event) => setNewRoleName(event.target.value)}
                        placeholder="Role name"
                      />
                      <Select
                        value={newRoleAssignmentType}
                        onValueChange={(value) =>
                          setNewRoleAssignmentType(value as RoleAssignmentType)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Assignment type" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_ASSIGNMENT_TYPES.map((assignmentType) => (
                            <SelectItem key={assignmentType} value={assignmentType}>
                              {ROLE_ASSIGNMENT_LABELS[assignmentType]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        value={newRoleRequiredCount}
                        onChange={(event) =>
                          setNewRoleRequiredCount(event.target.value)
                        }
                        placeholder="Required count"
                      />
                      <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
                        <Switch
                          checked={newRoleRequired}
                          onCheckedChange={setNewRoleRequired}
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-300">
                          Required
                        </span>
                      </div>
                      <Input
                        value={newRoleNotes}
                        onChange={(event) => setNewRoleNotes(event.target.value)}
                        placeholder="Notes (optional)"
                      />
                    </div>
                    <div className="mt-3">
                      <Button
                        type="button"
                        onClick={handleAddRoleSlot}
                        disabled={newRoleSaving || !newRoleName.trim()}
                      >
                        {newRoleSaving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Add Role Slot
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Auto-Assignment Preview</CardTitle>
                  <p className="text-sm text-slate-500">
                    Generate candidate recommendations by role fit, workload, and time conflicts.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Service Date & Time
                      </p>
                      <Input
                        type="datetime-local"
                        value={assignmentServiceAt}
                        onChange={(event) => setAssignmentServiceAt(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Duration (minutes)
                      </p>
                      <Input
                        type="number"
                        min={30}
                        step={15}
                        value={assignmentDurationMinutes}
                        onChange={(event) =>
                          setAssignmentDurationMinutes(event.target.value)
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800 lg:mt-6">
                      <Switch
                        checked={includeUnavailableCandidates}
                        onCheckedChange={setIncludeUnavailableCandidates}
                      />
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        Include unavailable candidates
                      </span>
                    </div>
                    <div className="flex items-end lg:justify-end">
                      <Button
                        type="button"
                        onClick={handleRunAssignmentPreview}
                        disabled={assignmentLoading}
                        className="w-full lg:w-auto"
                      >
                        {assignmentLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        Run Assignment Engine
                      </Button>
                    </div>
                  </div>

                  {!assignmentPreview ? (
                    <p className="text-sm text-slate-500">
                      No preview generated yet. Run the assignment engine to see recommended
                      staffing coverage for each role.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <MinistryBriefItem
                          title="Required Seats"
                          value={assignmentPreview.summary.requiredSeats}
                          detail="Must-fill seats"
                          icon={Users2}
                        />
                        <MinistryBriefItem
                          title="Recommended"
                          value={assignmentPreview.summary.recommendedSeats}
                          detail="Engine-assigned seats"
                          icon={CheckCircle2}
                        />
                        <MinistryBriefItem
                          title="Unfilled Required"
                          value={assignmentPreview.summary.unfilledRequiredSeats}
                          detail="Needs manual follow-up"
                          icon={Clock}
                        />
                        <MinistryBriefItem
                          title="Required Roles Missing"
                          value={assignmentPreview.summary.requiredRolesWithoutCoverage}
                          detail="No available recommendation"
                          icon={Shield}
                        />
                      </div>

                      <p className="text-xs text-slate-500">
                        Generated {fmtDateTime(assignmentPreview.generatedAt)} for{" "}
                        {fmtDateTime(assignmentPreview.serviceAt)} ·{" "}
                        {assignmentPreview.serviceDurationMinutes} min service window
                      </p>

                      <div className="space-y-3">
                        {assignmentPreview.roleRecommendations.map((recommendation) => (
                          <div
                            key={recommendation.roleSlot.id}
                            className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {recommendation.roleSlot.roleName}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {ROLE_ASSIGNMENT_LABELS[
                                    recommendation.roleSlot.assignmentType
                                  ]} · {recommendation.requiredCount} required
                                  {recommendation.roleSlot.isRequired
                                    ? " · required role"
                                    : " · optional role"}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={
                                  recommendation.unfilledSeats > 0 &&
                                  recommendation.roleSlot.isRequired
                                    ? "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300"
                                    : "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                                }
                              >
                                {recommendation.unfilledSeats > 0
                                  ? `${recommendation.unfilledSeats} unfilled`
                                  : "covered"}
                              </Badge>
                            </div>

                            <div className="mt-3 grid gap-3 lg:grid-cols-2">
                              <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Recommended
                                </p>
                                <div className="mt-2 space-y-2">
                                  {recommendation.recommended.length === 0 ? (
                                    <p className="text-xs text-slate-500">
                                      No available candidates recommended.
                                    </p>
                                  ) : (
                                    recommendation.recommended.map((candidate) => (
                                      <div
                                        key={`${candidate.assigneeType}-${candidate.assigneeId}`}
                                        className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs dark:border-slate-800 dark:bg-slate-950/40"
                                      >
                                        <p className="font-medium text-slate-900 dark:text-white">
                                          {candidate.displayName}
                                        </p>
                                        <p className="text-slate-500">
                                          {candidate.primaryRole} · score {candidate.score}
                                        </p>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>

                              <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Candidate Pool
                                </p>
                                <div className="mt-2 space-y-2">
                                  {recommendation.suggestions.length === 0 ? (
                                    <p className="text-xs text-slate-500">
                                      No candidates available in this pool.
                                    </p>
                                  ) : (
                                    recommendation.suggestions.map((candidate) => (
                                      <div
                                        key={`pool-${candidate.assigneeType}-${candidate.assigneeId}`}
                                        className="rounded-md border border-slate-200 p-2 text-xs dark:border-slate-800"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="font-medium text-slate-900 dark:text-white">
                                            {candidate.displayName}
                                          </p>
                                          <Badge
                                            variant="outline"
                                            className={
                                              candidate.available
                                                ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                                                : "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300"
                                            }
                                          >
                                            {candidate.available ? "available" : "conflict"}
                                          </Badge>
                                        </div>
                                        <p className="text-slate-500">
                                          {candidate.assigneeType === "paid_staff"
                                            ? "Paid staff"
                                            : "Volunteer"}{" "}
                                          · {candidate.primaryRole} · load {candidate.recentLoad} ·
                                          score {candidate.score}
                                        </p>
                                        <p className="text-slate-500">
                                          {candidate.reasons.slice(0, 2).join(" · ")}
                                        </p>
                                        {candidate.conflictReason ? (
                                          <p className="text-rose-600 dark:text-rose-300">
                                            Conflict: {candidate.conflictReason}
                                          </p>
                                        ) : null}
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Service Run Launcher</CardTitle>
                  <p className="text-sm text-slate-500">
                    Create the actual service occurrence that Grace will staff and message.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-4">
                    <Input
                      placeholder="Run name (optional)"
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
                      value={newServiceRunDurationMinutes}
                      onChange={(event) =>
                        setNewServiceRunDurationMinutes(event.target.value)
                      }
                      disabled={serviceRunCreating}
                    />
                    <div className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800">
                      <Switch
                        checked={newServiceRunGenerateAssignments}
                        onCheckedChange={setNewServiceRunGenerateAssignments}
                        disabled={serviceRunCreating}
                      />
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        Generate assignments
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/40">
                    <p className="text-slate-600 dark:text-slate-300">
                      Template:{" "}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {selectedServiceTemplate
                          ? selectedServiceTemplate.template.name
                          : "Select a template first"}
                      </span>
                    </p>
                    <Button
                      type="button"
                      onClick={handleCreateServiceRun}
                      disabled={
                        serviceRunCreating ||
                        Boolean(servicePlanningSetupRequired) ||
                        !selectedServiceTemplate
                      }
                    >
                      {serviceRunCreating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CalendarDays className="mr-2 h-4 w-4" />
                      )}
                      Create Service Run
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Service Run Control</CardTitle>
                  <p className="text-sm text-slate-500">
                    Generate assignment seats, send SMS offers, and start the Grace autostaff
                    workflow.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <Select
                        value={selectedServiceRunId ?? undefined}
                        onValueChange={setSelectedServiceRunId}
                        disabled={serviceRunsLoading || serviceRuns.length === 0}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue
                            placeholder={
                              serviceRunsLoading
                                ? "Loading service runs..."
                                : "Select a service run"
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
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={fetchServiceRuns}
                      disabled={serviceRunsLoading}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Runs
                    </Button>
                  </div>

                  {selectedServiceRun ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {selectedServiceRun.run.name}
                        </p>
                        <Badge
                          variant="outline"
                          className={getServiceRunBadgeClass(selectedServiceRun.run.status)}
                        >
                          {SERVICE_RUN_STATUS_LABELS[selectedServiceRun.run.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {fmtDateTime(selectedServiceRun.run.serviceAt)} ·{" "}
                        {selectedServiceRun.run.durationMinutes} minutes · Template:{" "}
                        {selectedServiceRun.template?.name || "Custom"}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Create a service run to begin assignment and offer workflows.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGenerateAssignmentsForRun}
                      disabled={!selectedServiceRunId || serviceRunGenerateSaving}
                    >
                      {serviceRunGenerateSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Briefcase className="mr-2 h-4 w-4" />
                      )}
                      Regenerate Assignments
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendOffersForRun}
                      disabled={!selectedServiceRunId || serviceRunOffersSending}
                    >
                      {serviceRunOffersSending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Send Staffing Offers
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
                      Start Grace Autostaff
                    </Button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <MinistryBriefItem
                      title="Total Seats"
                      value={serviceAssignmentStats.total}
                      detail="Current assignment rows"
                      icon={Users2}
                    />
                    <MinistryBriefItem
                      title="Unassigned"
                      value={serviceAssignmentStats.unassigned}
                      detail="Seats missing assignee"
                      icon={Clock}
                    />
                    <MinistryBriefItem
                      title="Confirmed"
                      value={serviceAssignmentStats.confirmed}
                      detail="Confirmed responders"
                      icon={CheckCircle2}
                    />
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Assignment Queue
                    </p>
                    {serviceRunAssignmentsLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-[#2b8cee]" />
                      </div>
                    ) : serviceRunAssignments.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-500">
                        No assignments generated yet for this service run.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {serviceRunAssignments.map((row) => (
                          <div
                            key={row.assignment.id}
                            className="rounded-md border border-slate-200 p-2 text-xs dark:border-slate-800"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {row.assignment.roleName}
                              </p>
                              <Badge
                                variant="outline"
                                className={getServiceAssignmentBadgeClass(
                                  row.assignment.status
                                )}
                              >
                                {
                                  SERVICE_ASSIGNMENT_STATUS_LABELS[
                                    row.assignment.status
                                  ]
                                }
                              </Badge>
                            </div>
                            <p className="text-slate-500">
                              {ROLE_ASSIGNMENT_LABELS[row.assignment.assignmentType]} ·{" "}
                              {getServiceAssigneeLabel(row)}
                            </p>
                            {row.assignment.responseText ? (
                              <p className="text-slate-500">
                                Response: {row.assignment.responseText}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Autostaff Goals</CardTitle>
                  <p className="text-sm text-slate-500">
                    Grace workflow state for the selected run, including waits, escalations, and
                    failures.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {serviceGoalsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-[#2b8cee]" />
                    </div>
                  ) : selectedRunGoals.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No autostaff goals found for this run yet.
                    </p>
                  ) : (
                    selectedRunGoals.slice(0, 8).map((row) => (
                      <div
                        key={row.goal.id}
                        className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {row.goal.objectiveText}
                          </p>
                          <Badge
                            variant="outline"
                            className={getGraceGoalBadgeClass(row.goal.status)}
                          >
                            {GRACE_GOAL_STATUS_LABELS[row.goal.status]}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.serviceRun?.name || "Service run"} · created{" "}
                          {fmtDateTime(row.goal.createdAt)}
                        </p>
                        {row.goal.errorText ? (
                          <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                            {row.goal.errorText}
                          </p>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

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

function TopMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ElementType;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function MinistryBriefItem({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: ElementType;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{title}</p>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
