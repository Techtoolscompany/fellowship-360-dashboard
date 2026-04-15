"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Mic, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import useOrganization from "@/lib/organizations/useOrganization";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GraceElevenLabsAssistant } from "@/components/grace-voice/GraceElevenLabsAssistant";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getGraceDashboardData, getStaffCareQueue } from "@/app/actions/dashboard";
import {
  addMessage,
  archiveConversation,
  getConversationMessages,
  getConversationStats,
  getConversations,
  getPhoneCalls,
  markConversationWaiting,
  reopenConversation,
  resolveConversation,
} from "@/app/actions/communications";
import {
  generateServiceRunAssignmentsFromTemplate,
  getAppointments,
  getGraceGoals,
  getServiceRunAssignments,
  getServiceRuns,
  getServiceTemplates,
  sendServiceAssignmentOffers,
  startServiceRunAutostaffGoal,
} from "@/app/actions/operations";
import {
  getGraceActivityFeed,
  getGraceApprovals,
  getGraceDailyBriefing,
  getGraceFollowupProposals,
  getGraceProviderConfigs,
  getGraceSessions,
  sendCopilotMessage,
  updateGraceApproval,
  updateGraceFollowupProposalStatus,
} from "@/app/actions/grace";
import { getGraceSettings } from "@/app/actions/grace-settings";
import { getPrayerRequests } from "@/app/actions/prayer";
import { getPipelineData, updateItemStage } from "@/app/actions/pipeline";
import { PipelineBoard } from "@/components/features/PipelineBoard";
import { GraceWorkflowLane } from "@/components/grace/GraceWorkflowLane";
import {
  buildServiceRunRoleMatrix,
  getNextUpcomingServiceRun,
  summarizeRoleMatrix,
} from "@/lib/grace/service-planning";
import {
  buildGraceWorkflowCardView,
  type GraceWorkflowCardView,
} from "@/lib/grace/workflow-summary";

type GraceTab = "home" | "care" | "guests" | "services" | "workflow";
type DashboardData = Awaited<ReturnType<typeof getGraceDashboardData>>;
type StaffCareQueueSnapshot = Awaited<ReturnType<typeof getStaffCareQueue>>;
type ConversationRow = Awaited<ReturnType<typeof getConversations>>[number];
type MessageRow = Awaited<ReturnType<typeof getConversationMessages>>[number];
type AppointmentRow = Awaited<ReturnType<typeof getAppointments>>[number];
type PhoneCallRow = Awaited<ReturnType<typeof getPhoneCalls>>[number];
type SessionRow = Awaited<ReturnType<typeof getGraceSessions>>[number];
type GraceActivityRow = Awaited<ReturnType<typeof getGraceActivityFeed>>[number];
type ApprovalRow = Awaited<ReturnType<typeof getGraceApprovals>>[number];
type FollowupProposalRow = Awaited<ReturnType<typeof getGraceFollowupProposals>>[number];
type ProviderConfigRow = Awaited<ReturnType<typeof getGraceProviderConfigs>>[number];
type GraceSettingsRow = Awaited<ReturnType<typeof getGraceSettings>>;
type GraceDailyBriefingRow = Exclude<Awaited<ReturnType<typeof getGraceDailyBriefing>>, null>;
type PrayerRequestRow = Awaited<ReturnType<typeof getPrayerRequests>>[number];
type PipelineData = Awaited<ReturnType<typeof getPipelineData>>;
type PipelineStageRow = PipelineData["stages"][number];
type PipelineItemRow = PipelineData["items"][number];
type ServiceTemplateBundle = Awaited<ReturnType<typeof getServiceTemplates>>[number];
type ServiceRunRow = Awaited<ReturnType<typeof getServiceRuns>>[number];
type ServiceRunAssignmentRow = Awaited<ReturnType<typeof getServiceRunAssignments>>[number];
type ServiceGoalRow = Awaited<ReturnType<typeof getGraceGoals>>[number];
type ServiceRunStatus = ServiceRunRow["run"]["status"];
type ServiceAssignmentStatus = ServiceRunAssignmentRow["assignment"]["status"];
type GraceGoalStatus = ServiceGoalRow["goal"]["status"];
type ServiceRunMatrixRow = ReturnType<typeof buildServiceRunRoleMatrix>[number];
type WorkflowCardView = GraceWorkflowCardView;

type ApprovalMfaChallenge = {
  approvalId: string;
  sessionId: string;
  toolName: string;
  maskedDestination?: string;
  expiresAt?: string;
};

type ExecuteApprovalPayload = {
  error?: string;
  failed?: Array<{ error?: string }>;
  mfaRequired?: boolean;
  maskedDestination?: string;
  expiresAt?: string;
};

type NextAction = {
  id: string;
  title: string;
  detail: string;
  cta: string;
  path?: string;
  tab?: GraceTab;
  conversationId?: string;
};

type ReviewHistoryItem = {
  id: string;
  title: string;
  detail: string;
  status: string;
  createdAt: string | Date;
  kind: "approval" | "followup";
};

const SERVICE_ASSIGNMENT_AT_RISK_STATUSES: ServiceAssignmentStatus[] = [
  "declined",
  "needs_replacement",
  "no_show",
  "cancelled",
];

const SERVICE_RUN_STATUS_LABELS: Record<ServiceRunStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const GRACE_GOAL_STATUS_LABELS: Record<GraceGoalStatus, string> = {
  queued: "Queued",
  in_progress: "In progress",
  waiting: "Waiting",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  escalated: "Escalated",
};

function normalizeGraceTab(value: string | null): GraceTab {
  if (!value || value === "command") return "home";
  if (value === "center" || value === "review") return "workflow";
  if (value === "inbox" || value === "conversations" || value === "calls") return "care";
  if (value === "visitors") return "guests";
  if (value === "operations") return "services";
  if (
    value === "home" ||
    value === "care" ||
    value === "guests" ||
    value === "services" ||
    value === "workflow"
  ) {
    return value;
  }
  return "home";
}

function fmtDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
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

function getContactDisplayName(row: ConversationRow | AppointmentRow) {
  if ("contact" in row && row.contact) {
    return `${row.contact.firstName} ${row.contact.lastName}`.trim();
  }
  if ("conversation" in row) {
    return row.conversation.subject || "Unknown contact";
  }
  return row.appointment.title;
}

function getPipelineContactDisplayName(row: PipelineItemRow) {
  if (row.contact) {
    return `${row.contact.firstName} ${row.contact.lastName}`.trim();
  }
  return "Unknown guest";
}

function isProviderConfigValid(row: ProviderConfigRow) {
  const validation = (row as { validation?: { isValid?: boolean } }).validation;
  if (validation && validation.isValid === false) {
    return false;
  }
  return true;
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

function getGraceGoalBadgeClass(status: GraceGoalStatus) {
  if (status === "completed") {
    return "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300";
  }
  if (status === "queued" || status === "waiting" || status === "in_progress") {
    return "border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-300";
  }
  if (status === "failed" || status === "escalated" || status === "cancelled") {
    return "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300";
  }
  return "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300";
}

function getGraceActivityBadgeClass(status: GraceActivityRow["status"]) {
  if (status === "error" || status === "blocked") {
    return "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300";
  }
  if (status === "queued") {
    return "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300";
  }
  if (status === "skipped") {
    return "border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300";
  }
  return "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300";
}

function getGraceActivityLabel(row: GraceActivityRow) {
  const metadata = (row.metadataJson ?? {}) as Record<string, unknown>;
  if (metadata.activityType === "suggestion_created") {
    return "Suggested";
  }
  if (row.status === "queued") return "Queued";
  if (row.status === "blocked") return "Blocked";
  if (row.status === "error") return "Failed";
  return "Completed";
}

function getGraceActivityTitle(row: GraceActivityRow) {
  const metadata = (row.metadataJson ?? {}) as Record<string, unknown>;
  if (metadata.activityType === "suggestion_created") {
    return "Grace created a suggestion";
  }
  if (typeof row.toolName === "string" && row.toolName.trim().length > 0) {
    return row.toolName;
  }
  if (typeof row.actionName === "string" && row.actionName.trim().length > 0) {
    return row.actionName;
  }
  return "Grace activity";
}

function getGraceActivityDetail(row: GraceActivityRow) {
  const metadata = (row.metadataJson ?? {}) as Record<string, unknown>;
  const summary =
    typeof metadata.summary === "string"
      ? metadata.summary
      : typeof metadata.suggestedMessage === "string"
        ? metadata.suggestedMessage
        : typeof row.actionName === "string" && row.actionName.trim().length > 0
          ? row.actionName
          : null;

  if (summary) return summary;
  if (row.errorText) return row.errorText;
  if (row.status === "queued") return "Grace queued this action for human approval.";
  if (row.status === "blocked") return "Grace blocked this action because policy did not allow it.";
  return "Grace completed a workflow action.";
}

function getServiceAssignmentDisplayName(row: ServiceRunAssignmentRow) {
  if (row.staff) return row.staff.name || row.staff.email;
  if (row.contact) return `${row.contact.firstName} ${row.contact.lastName}`.trim();
  return "Unassigned";
}

function getGraceTabClass(tab: GraceTab) {
  const base =
    "workspace-tab border border-transparent shadow-none transition-all duration-200";

  if (tab === "home") {
    return `${base} hover:bg-lime-50 hover:text-lime-900 data-[state=active]:border-lime-200 data-[state=active]:bg-lime-50 data-[state=active]:text-lime-900 dark:hover:bg-lime-500/10 dark:hover:text-lime-100 dark:data-[state=active]:border-lime-500/30 dark:data-[state=active]:bg-lime-500/15 dark:data-[state=active]:text-lime-50`;
  }

  if (tab === "care") {
    return `${base} hover:bg-sky-50 hover:text-sky-900 data-[state=active]:border-sky-200 data-[state=active]:bg-sky-50 data-[state=active]:text-sky-900 dark:hover:bg-sky-500/10 dark:hover:text-sky-100 dark:data-[state=active]:border-sky-500/30 dark:data-[state=active]:bg-sky-500/15 dark:data-[state=active]:text-sky-50`;
  }

  if (tab === "guests") {
    return `${base} hover:bg-amber-50 hover:text-amber-900 data-[state=active]:border-amber-200 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-900 dark:hover:bg-amber-500/10 dark:hover:text-amber-100 dark:data-[state=active]:border-amber-500/30 dark:data-[state=active]:bg-amber-500/15 dark:data-[state=active]:text-amber-50`;
  }

  if (tab === "services") {
    return `${base} hover:bg-cyan-50 hover:text-cyan-900 data-[state=active]:border-cyan-200 data-[state=active]:bg-cyan-50 data-[state=active]:text-cyan-900 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-100 dark:data-[state=active]:border-cyan-500/30 dark:data-[state=active]:bg-cyan-500/15 dark:data-[state=active]:text-cyan-50`;
  }

  return `${base} hover:bg-rose-50 hover:text-rose-900 data-[state=active]:border-rose-200 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-900 dark:hover:bg-rose-500/10 dark:hover:text-rose-100 dark:data-[state=active]:border-rose-500/30 dark:data-[state=active]:bg-rose-500/15 dark:data-[state=active]:text-rose-50`;
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="workspace-stat-card">
      <div className="relative">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>
        <p className="mt-3 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          {value}
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return <div className="workspace-empty">{message}</div>;
}

function buildApprovalWorkflowCard(row: ApprovalRow): WorkflowCardView {
  const action = (row.proposedAction ?? {}) as Record<string, unknown>;
  const toolName = typeof action.tool === "string" ? action.tool : "approval";
  const reason = typeof action.reason === "string" ? action.reason : "Waiting on staff review";

  return {
    id: `approval:${row.id}`,
    workflowKey: "operations",
    workflowLabel: "Approval queue",
    workflowVersion: "v1",
    status: "waiting",
    statusLabel: "Waiting on approval",
    statusTone: "amber",
    headline: toolName,
    summary: reason,
    meta: [
      `Session: ${row.sessionId.slice(0, 8)}`,
      `Requested: ${fmtDateTime(row.createdAt)}`,
    ],
    objectiveText: reason,
    triggerSource: "in_app",
    triggerChannel: "in_app",
    subjectEntityType: "approval",
    subjectEntityId: row.id,
    subjectContactId: null,
    correlationKey: `approval:${row.id}`,
    policyMode: "standard",
    nextCheckpointAt: row.createdAt,
    startedAt: row.createdAt,
    completedAt: null,
    createdAt: row.createdAt,
    updatedAt: (row as { updatedAt?: string | Date }).updatedAt ?? row.createdAt,
    stepSummary: "Pending staff review",
    stepTimeline: [],
  };
}

function buildFollowupProposalWorkflowCard(row: FollowupProposalRow): WorkflowCardView {
  return {
    id: `followup:${row.id}`,
    workflowKey: "guest_followup",
    workflowLabel: "Guest follow-up",
    workflowVersion: "v1",
    status: "waiting",
    statusLabel: "Waiting on reply",
    statusTone: "cyan",
    headline: row.reason || "Guest follow-up",
    summary: row.messageText,
    meta: [
      `Channel: ${row.proposedChannel || row.channel}`,
      row.recipient ? `Recipient: ${row.recipient}` : "No recipient yet",
    ].filter(Boolean) as string[],
    objectiveText: row.reason || row.messageText,
    triggerSource: row.channel,
    triggerChannel: row.proposedChannel || row.channel,
    subjectEntityType: "conversation",
    subjectEntityId: row.id,
    subjectContactId: row.contactId ?? null,
    correlationKey: `guest_followup:${row.id}`,
    policyMode: "standard",
    nextCheckpointAt: row.createdAt,
    startedAt: row.createdAt,
    completedAt: null,
    createdAt: row.createdAt,
    updatedAt: (row as { updatedAt?: string | Date }).updatedAt ?? row.createdAt,
    stepSummary: row.status === "pending" ? "Awaiting approval or reply" : row.status,
    stepTimeline: [],
  };
}

function buildPrayerRequestWorkflowCard(row: PrayerRequestRow): WorkflowCardView {
  return {
    id: `prayer:${row.id}`,
    workflowKey: "prayer_care",
    workflowLabel: "Prayer care",
    workflowVersion: "v1",
    status: row.status === "new" ? "queued" : row.status === "answered" ? "completed" : "in_progress",
    statusLabel:
      row.status === "new"
        ? "Queued"
        : row.status === "answered"
          ? "Completed"
          : "In progress",
    statusTone: row.urgency === "critical" ? "rose" : row.urgency === "urgent" ? "amber" : "cyan",
    headline: row.contactName || "Prayer request",
    summary: row.content,
    meta: [`Urgency: ${row.urgency}`, `Status: ${row.status}`, row.assignedTeam ? `Team: ${row.assignedTeam}` : "Team: unassigned"].filter(Boolean) as string[],
    objectiveText: row.content,
    triggerSource: "prayer",
    triggerChannel: "in_app",
    subjectEntityType: "prayer_request",
    subjectEntityId: row.id,
    subjectContactId: row.contactId ?? null,
    correlationKey: `prayer_care:${row.id}`,
    policyMode: "standard",
    nextCheckpointAt: row.createdAt,
    startedAt: row.createdAt,
    completedAt: row.status === "answered" ? row.updatedAt : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    stepSummary: row.response ? "Answered" : "Awaiting follow-up",
    stepTimeline: [],
  };
}

function buildAssignmentEscalationWorkflowCard(row: ServiceRunAssignmentRow): WorkflowCardView {
  return {
    id: `assignment:${row.assignment.id}`,
    workflowKey: "volunteer_staffing",
    workflowLabel: "Volunteer staffing",
    workflowVersion: "v1",
    status: "escalated",
    statusLabel: "Needs replacement",
    statusTone: "rose",
    headline: row.assignment.roleName,
    summary: `${getServiceAssignmentDisplayName(row) || "Unassigned"} needs attention`,
    meta: [
      `Status: ${row.assignment.status.replaceAll("_", " ")}`,
      row.assignment.volunteerId || row.assignment.staffUserId ? "Assigned" : "Unassigned",
    ],
    objectiveText: row.assignment.roleName,
    triggerSource: "service",
    triggerChannel: "in_app",
    subjectEntityType: "service_assignment",
    subjectEntityId: row.assignment.id,
    subjectContactId: row.contact?.id ?? null,
    correlationKey: `volunteer_staffing:${row.assignment.id}`,
    policyMode: "standard",
    nextCheckpointAt: row.assignment.updatedAt ?? row.assignment.createdAt ?? null,
    startedAt: row.assignment.createdAt ?? null,
    completedAt: null,
    createdAt: row.assignment.createdAt ?? new Date(),
    updatedAt: row.assignment.updatedAt ?? row.assignment.createdAt ?? new Date(),
    stepSummary: "Needs a replacement or manual follow-up",
    stepTimeline: [],
  };
}

function buildConversationEscalationWorkflowCard(row: ConversationRow): WorkflowCardView {
  const displayName = getContactDisplayName(row);
  return {
    id: `conversation:${row.conversation.id}`,
    workflowKey: "guest_followup",
    workflowLabel: "Guest follow-up",
    workflowVersion: "v1",
    status: "escalated",
    statusLabel: "Needs reply",
    statusTone: "rose",
    headline: displayName,
    summary: row.conversation.subject || "Conversation waiting on staff",
    meta: [
      `Last touched: ${fmtDurationFromNow(row.conversation.lastMessageAt || row.conversation.updatedAt)}`,
      `Status: ${row.conversation.status}`,
    ],
    objectiveText: row.conversation.subject || displayName,
    triggerSource: "in_app",
    triggerChannel: row.conversation.channel,
    subjectEntityType: "conversation",
    subjectEntityId: row.conversation.id,
    subjectContactId: row.contact?.id ?? null,
    correlationKey: `conversation:${row.conversation.id}`,
    policyMode: "standard",
    nextCheckpointAt: row.conversation.lastMessageAt ?? row.conversation.updatedAt ?? null,
    startedAt: row.conversation.createdAt,
    completedAt: null,
    createdAt: row.conversation.createdAt,
    updatedAt: row.conversation.updatedAt,
    stepSummary: "Waiting on staff or guest reply",
    stepTimeline: [],
  };
}

function buildPendingAssignmentWorkflowCard(row: ServiceRunAssignmentRow): WorkflowCardView {
  return {
    id: `assignment-pending:${row.assignment.id}`,
    workflowKey: "volunteer_staffing",
    workflowLabel: "Volunteer staffing",
    workflowVersion: "v1",
    status: "waiting",
    statusLabel: "Waiting on reply",
    statusTone: "amber",
    headline: row.assignment.roleName,
    summary: getServiceAssignmentDisplayName(row) || "Waiting for a reply",
    meta: [
      `Status: ${row.assignment.status.replaceAll("_", " ")}`,
      row.assignment.volunteerId || row.assignment.staffUserId ? "Assigned" : "Unassigned",
    ],
    objectiveText: row.assignment.roleName,
    triggerSource: "service",
    triggerChannel: "in_app",
    subjectEntityType: "service_assignment",
    subjectEntityId: row.assignment.id,
    subjectContactId: row.contact?.id ?? null,
    correlationKey: `volunteer_staffing:${row.assignment.id}`,
    policyMode: "standard",
    nextCheckpointAt: row.assignment.updatedAt ?? row.assignment.createdAt ?? null,
    startedAt: row.assignment.createdAt ?? null,
    completedAt: null,
    createdAt: row.assignment.createdAt ?? new Date(),
    updatedAt: row.assignment.updatedAt ?? row.assignment.createdAt ?? new Date(),
    stepSummary: "Grace is waiting on a volunteer reply",
    stepTimeline: [],
  };
}

function buildCompletedWorkflowCard(item: ReviewHistoryItem): WorkflowCardView {
  const workflowKey =
    item.kind === "approval"
      ? "operations"
      : item.detail.toLowerCase().includes("prayer")
        ? "prayer_care"
        : "guest_followup";
  const statusTone =
    item.status === "approved" || item.status === "sent" ? "emerald" : "slate";

  return {
    id: `completed:${item.id}`,
    workflowKey,
    workflowLabel:
      workflowKey === "prayer_care"
        ? "Prayer care"
        : workflowKey === "guest_followup"
          ? "Guest follow-up"
          : "Workflow review",
    workflowVersion: "v1",
    status: "completed",
    statusLabel: "Completed",
    statusTone,
    headline: item.title,
    summary: item.detail,
    meta: [
      `Status: ${item.status}`,
      `Handled: ${fmtDateTime(item.createdAt)}`,
    ],
    objectiveText: item.title,
    triggerSource: "in_app",
    triggerChannel: "in_app",
    subjectEntityType: item.kind,
    subjectEntityId: item.id,
    subjectContactId: null,
    correlationKey: `completed:${item.id}`,
    policyMode: "standard",
    nextCheckpointAt: null,
    startedAt: item.createdAt,
    completedAt: item.createdAt,
    createdAt: item.createdAt,
    updatedAt: item.createdAt,
    stepSummary: `Closed with ${item.status}`,
    stepTimeline: [],
  };
}

export default function GraceWorkspacePage() {
  const { organization } = useOrganization();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const orgId = organization?.id;

  const [activeTab, setActiveTab] = useState<GraceTab>("home");
  const [loading, setLoading] = useState(true);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [careQueue, setCareQueue] = useState<StaffCareQueueSnapshot | null>(null);
  const [conversationStats, setConversationStats] = useState<any>(null);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [phoneCalls, setPhoneCalls] = useState<PhoneCallRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [activityFeed, setActivityFeed] = useState<GraceActivityRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [followupProposals, setFollowupProposals] = useState<FollowupProposalRow[]>([]);
  const [dailyBriefing, setDailyBriefing] = useState<GraceDailyBriefingRow | null>(null);
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfigRow[]>([]);
  const [graceSettings, setGraceSettings] = useState<GraceSettingsRow>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageRow[]>([]);
  const [pipelineItems, setPipelineItems] = useState<PipelineItemRow[]>([]);
  const [serviceRuns, setServiceRuns] = useState<ServiceRunRow[]>([]);
  const [serviceTemplates, setServiceTemplates] = useState<ServiceTemplateBundle[]>([]);
  const [serviceGoals, setServiceGoals] = useState<ServiceGoalRow[]>([]);
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequestRow[]>([]);
  const [nextServiceAssignments, setNextServiceAssignments] = useState<ServiceRunAssignmentRow[]>(
    []
  );
  const [nextServiceAssignmentsLoading, setNextServiceAssignmentsLoading] = useState(false);
  const [serviceAutomationAction, setServiceAutomationAction] = useState<
    "build" | "autostaff" | "offers" | null
  >(null);

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationStatusSaving, setConversationStatusSaving] = useState(false);

  const assistantSectionRef = useRef<HTMLElement | null>(null);
  const [voiceStartSignal, setVoiceStartSignal] = useState(0);

  const [proposalDecisionId, setProposalDecisionId] = useState<string | null>(null);
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null);
  const [approvalMfaChallenge, setApprovalMfaChallenge] =
    useState<ApprovalMfaChallenge | null>(null);
  const [approvalMfaOpen, setApprovalMfaOpen] = useState(false);
  const [approvalMfaCode, setApprovalMfaCode] = useState("");
  const [approvalMfaSubmitting, setApprovalMfaSubmitting] = useState(false);

  const fetchWorkspace = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [
        dashboardData,
        careQueueData,
        convRows,
        convStats,
        callRows,
        appointmentRows,
        sessionRows,
        activityRows,
        approvalRows,
        followupProposalRows,
        dailyBriefingRow,
        providerRows,
        settingsRow,
        prayerRows,
        pipelineData,
        runs,
        templates,
        goals,
      ] = await Promise.all([
        getGraceDashboardData(orgId),
        getStaffCareQueue(orgId),
        getConversations(orgId),
        getConversationStats(orgId),
        getPhoneCalls(orgId),
        getAppointments(orgId),
        getGraceSessions(orgId),
        getGraceActivityFeed(orgId),
        getGraceApprovals(orgId),
        getGraceFollowupProposals(orgId),
        getGraceDailyBriefing(orgId),
        getGraceProviderConfigs(orgId),
        getGraceSettings(orgId),
        getPrayerRequests(orgId),
        getPipelineData(orgId),
        getServiceRuns(orgId),
        getServiceTemplates(orgId),
        getGraceGoals(orgId, { goalType: "service_staffing" }),
      ]);

      setDashboard(dashboardData);
      setCareQueue(careQueueData);
      setConversations(convRows);
      setConversationStats(convStats);
      setPhoneCalls(callRows);
      setAppointments(appointmentRows);
      setSessions(sessionRows);
      setActivityFeed(activityRows);
      setApprovals(approvalRows);
      setFollowupProposals(followupProposalRows);
      setDailyBriefing(dailyBriefingRow);
      setProviderConfigs(providerRows);
      setGraceSettings(settingsRow);
      setPipelineStages(pipelineData.stages);
      setPipelineItems(pipelineData.items);
      setServiceRuns(runs);
      setServiceTemplates(templates);
      setServiceGoals(goals);
      setPrayerRequests(prayerRows);

      setSelectedConversationId((current) => {
        if (current && convRows.some((row) => row.conversation.id === current)) {
          return current;
        }
        return convRows[0]?.conversation.id ?? null;
      });
    } catch (error) {
      console.error("Failed to load Grace workspace:", error);
      toast.error("Failed to load Grace workspace");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchWorkspace();
  }, [fetchWorkspace]);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "calendar" || requestedTab === "appointments") {
      router.replace("/app/calendar");
      return;
    }
    setActiveTab(normalizeGraceTab(requestedTab));
  }, [router, searchParams]);

  useEffect(() => {
    const voiceParam = searchParams.get("voice");
    if (voiceParam !== "1" && voiceParam !== "true") {
      return;
    }

    setActiveTab("home");
    setVoiceStartSignal((current) => current + 1);

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

  const switchTab = useCallback(
    (tab: GraceTab) => {
      setActiveTab(tab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleStartVoiceOrb = useCallback(() => {
    setActiveTab("home");
    setVoiceStartSignal((current) => current + 1);

    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "home");
    params.delete("voice");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (voiceStartSignal === 0) return;

    const frame = window.requestAnimationFrame(() => {
      assistantSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [voiceStartSignal]);

  useEffect(() => {
    if (!selectedConversationId) return;
    const loadMessages = async () => {
      setMessagesLoading(true);
      try {
        const rows = await getConversationMessages(selectedConversationId);
        setMessages(rows);
      } catch (error) {
        console.error("Failed to load conversation messages:", error);
        toast.error("Failed to load conversation");
      } finally {
        setMessagesLoading(false);
      }
    };

    void loadMessages();
  }, [selectedConversationId]);

  const nextServiceRun = useMemo(() => getNextUpcomingServiceRun(serviceRuns), [serviceRuns]);
  const nextServiceRunTemplate = useMemo(() => {
    if (!nextServiceRun?.run.templateId) return null;
    return (
      serviceTemplates.find(
        (templateBundle) => templateBundle.template.id === nextServiceRun.run.templateId
      ) ?? null
    );
  }, [nextServiceRun, serviceTemplates]);

  useEffect(() => {
    if (!nextServiceRun) {
      setNextServiceAssignments([]);
      return;
    }

    let cancelled = false;
    const loadAssignments = async () => {
      setNextServiceAssignmentsLoading(true);
      try {
        const rows = await getServiceRunAssignments(nextServiceRun.run.id);
        if (!cancelled) {
          setNextServiceAssignments(rows);
        }
      } catch (error) {
        console.error("Failed to load next service assignments:", error);
        if (!cancelled) {
          setNextServiceAssignments([]);
        }
      } finally {
        if (!cancelled) {
          setNextServiceAssignmentsLoading(false);
        }
      }
    };

    void loadAssignments();
    return () => {
      cancelled = true;
    };
  }, [nextServiceRun]);

  const nextServiceRoleMatrix = useMemo<ServiceRunMatrixRow[]>(() => {
    if (!nextServiceRunTemplate) return [];
    return buildServiceRunRoleMatrix(
      nextServiceRunTemplate.roleSlots,
      nextServiceAssignments,
      SERVICE_ASSIGNMENT_AT_RISK_STATUSES
    );
  }, [nextServiceAssignments, nextServiceRunTemplate]);

  const nextServiceCoverageSummary = useMemo(
    () => summarizeRoleMatrix(nextServiceRoleMatrix),
    [nextServiceRoleMatrix]
  );

  const nextServiceOpenRoles = useMemo(
    () =>
      nextServiceRoleMatrix
        .filter((row) => row.seatsOpen > 0)
        .sort((a, b) => Number(b.isRequired) - Number(a.isRequired) || b.seatsOpen - a.seatsOpen)
        .slice(0, 4),
    [nextServiceRoleMatrix]
  );

  const nextServicePendingOffers = useMemo(
    () =>
      nextServiceAssignments.filter(
        (row) => row.assignment.status === "proposed" || row.assignment.status === "offered"
      ),
    [nextServiceAssignments]
  );

  const nextServiceAtRiskAssignments = useMemo(
    () =>
      nextServiceAssignments.filter((row) =>
        SERVICE_ASSIGNMENT_AT_RISK_STATUSES.includes(row.assignment.status)
      ),
    [nextServiceAssignments]
  );

  const nextServiceConfirmedCount = useMemo(
    () =>
      nextServiceAssignments.filter((row) =>
        ["confirmed", "checked_in", "checked_out"].includes(row.assignment.status)
      ).length,
    [nextServiceAssignments]
  );

  const nextServiceGeneratedSeats = nextServiceAssignments.length;

  const nextServiceActiveGoals = useMemo(() => {
    if (!nextServiceRun) return [];
    return serviceGoals.filter(
      (row) =>
        row.goal.serviceRunId === nextServiceRun.run.id &&
        ["queued", "waiting", "in_progress"].includes(row.goal.status)
    );
  }, [nextServiceRun, serviceGoals]);

  const pendingApprovals = approvals.filter((row) => row.status === "pending").length;
  const pendingProposalQueue = useMemo(
    () =>
      followupProposals
        .filter((proposal) => proposal.status === "pending")
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [followupProposals]
  );
  const needsReviewCount = pendingApprovals + pendingProposalQueue.length;
  const waitingConversations = Number(conversationStats?.waiting ?? 0);
  const careQueueItems = careQueue?.items ?? [];
  const careQueueCounts = careQueue?.counts ?? {
    total: 0,
    overdue: 0,
    urgent: 0,
    high: 0,
  };

  const activeConversation = useMemo(
    () => conversations.find((row) => row.conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );
  const activeConversationStatus = activeConversation?.conversation.status ?? null;
  const canReplyToActiveConversation =
    activeConversationStatus === "open" || activeConversationStatus === "waiting";

  const nowMs = Date.now();
  const staleFollowups = useMemo(
    () =>
      conversations.filter((row) => {
        if (
          row.conversation.status !== "open" &&
          row.conversation.status !== "waiting"
        ) {
          return false;
        }
        const lastTouched =
          row.conversation.lastMessageAt ||
          row.conversation.updatedAt ||
          row.conversation.createdAt;
        return new Date(lastTouched).getTime() <= nowMs - 24 * 60 * 60 * 1000;
      }),
    [conversations, nowMs]
  );

  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter((row) => {
          const status = row.appointment.status;
          if (status === "cancelled" || status === "completed" || status === "no_show") {
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

  const upcomingServiceRuns = useMemo(
    () =>
      serviceRuns
        .filter((row) => new Date(row.run.serviceAt).getTime() >= nowMs)
        .sort(
          (a, b) =>
            new Date(a.run.serviceAt).getTime() - new Date(b.run.serviceAt).getTime()
        )
        .slice(0, 3),
    [nowMs, serviceRuns]
  );

  const pipelineVisitorsCount = pipelineItems.length;
  const firstTimeStage = useMemo(
    () => pipelineStages.find((stage) => /first|visitor|guest/i.test(stage.name)),
    [pipelineStages]
  );
  const firstTimeVisitorCount = useMemo(() => {
    if (!firstTimeStage) return 0;
    return pipelineItems.filter((row) => row.item.stageId === firstTimeStage.id).length;
  }, [firstTimeStage, pipelineItems]);

  const activeProviderRows = useMemo(
    () =>
      providerConfigs.filter((row) => row.isActive && row.mode !== "disabled" && isProviderConfigValid(row)),
    [providerConfigs]
  );
  const profileReady =
    Boolean(graceSettings?.churchName?.trim()) && Boolean(graceSettings?.churchCity?.trim());
  const contactsReady = Number(dashboard?.kpi?.totalContacts ?? 0) >= 25;
  const geminiReady = activeProviderRows.some((row) => row.provider === "gemini");
  const smsReady = activeProviderRows.some((row) => row.channel === "sms");
  const liveTrafficReady =
    sessions.length > 0 || conversations.length > 0 || appointments.length > 0;
  const setupChecklist = [
    {
      id: "profile",
      title: "Church profile is filled out",
      detail: profileReady ? "Grace knows your church name and city." : "Add your church profile in Grace settings.",
      done: profileReady,
    },
    {
      id: "people",
      title: "People records are loaded",
      detail: `${Number(dashboard?.kpi?.totalContacts ?? 0)} contacts ready`,
      done: contactsReady,
    },
    {
      id: "channels",
      title: "Core channels are connected",
      detail: geminiReady && smsReady ? "AI and SMS are ready." : "Finish AI and SMS setup.",
      done: geminiReady && smsReady,
    },
    {
      id: "traffic",
      title: "Real activity is flowing",
      detail: `${sessions.length} sessions and ${conversations.length} conversations`,
      done: liveTrafficReady,
    },
  ];
  const setupCompleted = setupChecklist.filter((item) => item.done).length;
  const setupProgress = Math.round((setupCompleted / setupChecklist.length) * 100);

  const nextActions = useMemo<NextAction[]>(() => {
    const items: Array<NextAction & { priority: number }> = [];
    const firstPendingApproval = approvals.find((row) => row.status === "pending");
    const firstPendingSuggestion = pendingProposalQueue[0];
    const firstStaleFollowup = staleFollowups[0];

    if (firstPendingApproval || firstPendingSuggestion) {
      items.push({
        id: "workflow",
        title: `You have ${needsReviewCount} workflow item${needsReviewCount === 1 ? "" : "s"} waiting on a person`,
        detail: "Grace is waiting on a person before it can move forward.",
        cta: "Open workflow",
        tab: "workflow",
        priority: 100,
      });
    }

    if (nextServiceRun && nextServiceOpenRoles.length > 0) {
      items.push({
        id: `service-${nextServiceRun.run.id}`,
        title: `Finish coverage for ${nextServiceRun.run.name}`,
        detail: `${nextServiceCoverageSummary.seatsOpen} seat${nextServiceCoverageSummary.seatsOpen === 1 ? "" : "s"} still need someone.`,
        cta: "Open Grace services",
        tab: "services",
        priority: 92,
      });
    }

    if (!nextServiceRun && serviceTemplates.length > 0) {
      items.push({
        id: "service-create",
        title: "Add the next service",
        detail: "Your templates are ready, but no service is scheduled yet.",
        cta: "Open Grace services",
        tab: "services",
        priority: 90,
      });
    }

    if (firstStaleFollowup) {
      items.push({
        id: `care-${firstStaleFollowup.conversation.id}`,
        title: `Reply to ${getContactDisplayName(firstStaleFollowup)}`,
        detail: `This conversation has been waiting ${fmtDurationFromNow(
          firstStaleFollowup.conversation.lastMessageAt ||
            firstStaleFollowup.conversation.updatedAt
        )}.`,
        cta: "Open care",
        tab: "care",
        conversationId: firstStaleFollowup.conversation.id,
        priority: 88,
      });
    }

    if (firstTimeVisitorCount > 0) {
      items.push({
        id: "guests",
        title: `Follow up with ${firstTimeVisitorCount} newer guest${firstTimeVisitorCount === 1 ? "" : "s"}`,
        detail: "Make sure the next step is clear and owned.",
        cta: "Open guests",
        tab: "guests",
        priority: 82,
      });
    }

    if (setupProgress < 100) {
      items.push({
        id: "setup",
        title: "Finish Grace setup",
        detail: `${setupCompleted} of ${setupChecklist.length} readiness steps are complete.`,
        cta: "Open setup",
        path: "/app/get-started/concierge",
        priority: 70,
      });
    }

    return items.sort((a, b) => b.priority - a.priority).slice(0, 3);
  }, [
    approvals,
    firstTimeVisitorCount,
    needsReviewCount,
    nextServiceCoverageSummary.seatsOpen,
    nextServiceOpenRoles.length,
    nextServiceRun,
    pendingProposalQueue,
    serviceTemplates.length,
    setupChecklist.length,
    setupCompleted,
    setupProgress,
    staleFollowups,
  ]);

  const reviewHistoryItems = useMemo<ReviewHistoryItem[]>(() => {
    const approvalItems: ReviewHistoryItem[] = approvals
      .filter((row) => row.status !== "pending")
      .map((row) => {
        const action = (row.proposedAction ?? {}) as Record<string, unknown>;
        return {
          id: `approval-${row.id}`,
          title: typeof action.tool === "string" ? action.tool : "Approval item",
          detail:
            typeof action.reason === "string"
              ? action.reason
              : "Grace requested review on an action.",
          status: row.status,
          createdAt:
            ((row as { updatedAt?: string | Date }).updatedAt as string | Date | undefined) ??
            row.createdAt,
          kind: "approval",
        };
      });

    const followupItems: ReviewHistoryItem[] = followupProposals
      .filter((proposal) => proposal.status !== "pending")
      .map((proposal) => ({
        id: `followup-${proposal.id}`,
        title: proposal.reason || "Follow-up step",
        detail: proposal.messageText,
        status: proposal.status,
        createdAt:
          ((proposal as { updatedAt?: string | Date }).updatedAt as string | Date | undefined) ??
          proposal.createdAt,
        kind: "followup",
      }));

    return [...approvalItems, ...followupItems]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 5);
  }, [approvals, followupProposals]);

  const activeWorkflowCards = useMemo<WorkflowCardView[]>(() => {
    const staffingCards = nextServiceActiveGoals.map((row) => buildGraceWorkflowCardView(row.goal));
    const prayerCards = prayerRequests
      .filter((row) => row.status !== "answered" && row.status !== "archived")
      .map((row) => buildPrayerRequestWorkflowCard(row));

    return [...staffingCards, ...prayerCards]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 6);
  }, [nextServiceActiveGoals, prayerRequests]);

  const waitingReplyCards = useMemo<WorkflowCardView[]>(() => {
    const guestReplyCards = pendingProposalQueue
      .filter((proposal) => proposal.status === "pending")
      .map((proposal) => buildFollowupProposalWorkflowCard(proposal));
    const staffingReplyCards = nextServicePendingOffers.map((row) =>
      buildPendingAssignmentWorkflowCard(row)
    );

    return [...guestReplyCards, ...staffingReplyCards]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 6);
  }, [nextServicePendingOffers, pendingProposalQueue]);

  const waitingApprovalCards = useMemo<WorkflowCardView[]>(() => {
    return approvals
      .filter((row) => row.status === "pending")
      .map((row) => buildApprovalWorkflowCard(row))
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 6);
  }, [approvals]);

  const escalationCards = useMemo<WorkflowCardView[]>(() => {
    const conversationCards = staleFollowups.map((row) => buildConversationEscalationWorkflowCard(row));
    const assignmentCards = nextServiceAtRiskAssignments.map((row) =>
      buildAssignmentEscalationWorkflowCard(row)
    );
    const urgentPrayerCards = prayerRequests
      .filter((row) => row.status !== "answered" && row.status !== "archived" && row.urgency !== "normal")
      .map((row) => ({
        ...buildPrayerRequestWorkflowCard(row),
        status: "escalated" as const,
        statusLabel: "Escalated",
        statusTone: "rose" as const,
        summary: `${row.content} · ${row.urgency} priority`,
        stepSummary: "Needs human follow-up",
      }));

    return [...conversationCards, ...assignmentCards, ...urgentPrayerCards]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 6);
  }, [nextServiceAtRiskAssignments, prayerRequests, staleFollowups]);

  const completedWorkflowCards = useMemo<WorkflowCardView[]>(() => {
    return [...reviewHistoryItems.map((item) => buildCompletedWorkflowCard(item)), ...serviceGoals
      .filter((row) => row.goal.status === "completed")
      .map((row) => buildGraceWorkflowCardView(row.goal))]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 6);
  }, [reviewHistoryItems, serviceGoals]);

  const workflowInboxCount =
    activeWorkflowCards.length +
    waitingApprovalCards.length +
    waitingReplyCards.length +
    escalationCards.length;

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

  const handleBuildNextServiceSeats = useCallback(async () => {
    if (!nextServiceRun) {
      toast.error("No upcoming service is selected");
      return;
    }

    setServiceAutomationAction("build");
    try {
      const created = await generateServiceRunAssignmentsFromTemplate({
        serviceRunId: nextServiceRun.run.id,
        overwriteExisting: false,
      });
      await fetchWorkspace();
      toast.success(
        created.length > 0
          ? `Added ${created.length} service seat${created.length === 1 ? "" : "s"}`
          : "Service seats are already in place"
      );
    } catch (error) {
      console.error("Failed to build next service seats:", error);
      toast.error(error instanceof Error ? error.message : "Failed to build service seats");
    } finally {
      setServiceAutomationAction(null);
    }
  }, [fetchWorkspace, nextServiceRun]);

  const handleStartNextServiceAutostaff = useCallback(async () => {
    if (!nextServiceRun) {
      toast.error("No upcoming service is selected");
      return;
    }

    setServiceAutomationAction("autostaff");
    try {
      const result = await startServiceRunAutostaffGoal({
        serviceRunId: nextServiceRun.run.id,
        sourceChannel: "in_app",
      });
      await fetchWorkspace();
      if (result.dispatched === false && "message" in result && result.message) {
        toast.info(result.message);
      } else {
        toast.success(result.created === false ? "Autostaff is already running" : "Autostaff started");
      }
    } catch (error) {
      console.error("Failed to start next service autostaff:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start autostaff");
    } finally {
      setServiceAutomationAction(null);
    }
  }, [fetchWorkspace, nextServiceRun]);

  const handleSendNextServiceOffers = useCallback(async () => {
    if (!nextServiceRun) {
      toast.error("No upcoming service is selected");
      return;
    }

    setServiceAutomationAction("offers");
    try {
      const result = await sendServiceAssignmentOffers({ serviceRunId: nextServiceRun.run.id });
      await fetchWorkspace();
      toast.success(
        `Offers sent: ${result.sent}/${result.attempted} (skipped ${result.skipped}, failed ${result.failed})`
      );
    } catch (error) {
      console.error("Failed to send next service offers:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send offers");
    } finally {
      setServiceAutomationAction(null);
    }
  }, [fetchWorkspace, nextServiceRun]);

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
      toast.success("Reply sent");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send reply");
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
      toast.success(
        nextStatus === "waiting"
          ? "Marked waiting"
          : nextStatus === "resolved"
            ? "Conversation resolved"
            : nextStatus === "archived"
              ? "Conversation archived"
              : "Conversation reopened"
      );
    } catch (error) {
      console.error("Failed to update conversation status:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update conversation status"
      );
    } finally {
      setConversationStatusSaving(false);
    }
  };

  const handleMoveVisitorStage = useCallback(
    async (itemId: string, stageId: string) => {
      if (!orgId) return;
      const row = pipelineItems.find((entry) => entry.item.id === itemId);
      const targetStage = pipelineStages.find((stage) => stage.id === stageId);
      if (!row || !targetStage) return;

      try {
        await updateItemStage(itemId, stageId, 0);
        await fetchWorkspace();
        toast.success(`${getPipelineContactDisplayName(row)} moved to ${targetStage.name}`);

        await triggerGraceFromContext(
          `Guest follow-up update: ${getPipelineContactDisplayName(
            row
          )} was moved to "${targetStage.name}". Suggest the best next follow-up for staff.`
        );
      } catch (error) {
        console.error("Failed to move guest stage:", error);
        toast.error("Failed to update guest stage");
      }
    },
    [fetchWorkspace, orgId, pipelineItems, pipelineStages, triggerGraceFromContext]
  );

  const executeApprovalAction = useCallback(async (approval: ApprovalRow, mfaCode?: string) => {
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
  }, []);

  const closeApprovalMfaDialog = useCallback(() => {
    setApprovalMfaOpen(false);
    setApprovalMfaChallenge(null);
    setApprovalMfaCode("");
    setApprovalMfaSubmitting(false);
  }, []);

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
        toast.info("A verification code is required before this can run.");
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
      toast.error("Approval item is no longer available.");
      closeApprovalMfaDialog();
      return;
    }

    setApprovalMfaSubmitting(true);
    try {
      const { ok, payload } = await executeApprovalAction(approval, approvalMfaCode.trim());

      if (!ok) {
        if (payload.mfaRequired) {
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
      toast.success("Request declined");
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
        toast.success(status === "approved" ? "Follow-up approved" : "Follow-up dismissed");
        await fetchWorkspace();
      } catch (error) {
        console.error("Failed to update follow-up proposal:", error);
        toast.error(error instanceof Error ? error.message : "Failed to update follow-up");
      } finally {
        setProposalDecisionId(null);
      }
    },
    [fetchWorkspace, orgId]
  );

  if (!orgId) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-lime-500" />
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <section className="workspace-hero-dark">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-lime-200/80">
              Grace
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
              Stay close to the people and work that need you today
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Keep the day simple: what needs care, what needs review, and what comes next.
            </p>
          </div>
          <div className="flex w-full max-w-xl flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="workspace-hero-metric">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Care
                </p>
                <p className="mt-2 text-2xl font-black text-white">{careQueueCounts.total}</p>
                <p className="mt-1 text-xs text-slate-400">People still waiting on you</p>
              </div>
              <div className="workspace-hero-metric">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Services
                </p>
                <p className="mt-2 text-2xl font-black text-white">
                  {nextServiceRun ? `${nextServiceCoverageSummary.coveragePercent}%` : "—"}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {nextServiceRun
                    ? `${nextServiceCoverageSummary.seatsOpen} seats still open`
                    : "No upcoming service yet"}
                </p>
              </div>
              <div className="workspace-hero-metric">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Workflow
                </p>
                <p className="mt-2 text-2xl font-black text-white">{workflowInboxCount}</p>
                <p className="mt-1 text-xs text-slate-400">Workflow items across Grace</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-white/15 bg-white/8 text-white hover:bg-white/12 hover:text-white"
                onClick={handleStartVoiceOrb}
              >
                <Mic className="mr-2 h-4 w-4" />
                Start voice
              </Button>
              <Button
                variant="outline"
                className="border-white/15 bg-white/8 text-white hover:bg-white/12 hover:text-white"
                onClick={() => router.push("/app/settings/grace")}
              >
                Grace settings
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={(value) => switchTab(value as GraceTab)} className="space-y-5">
        <TabsList className="workspace-tabs h-auto w-full max-w-4xl justify-start border border-slate-200 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          {[
            { value: "home", label: "Home", badge: null },
            { value: "care", label: "Care", badge: careQueueCounts.total > 0 ? String(careQueueCounts.total) : null },
            { value: "guests", label: "Guests", badge: firstTimeVisitorCount > 0 ? String(firstTimeVisitorCount) : null },
            {
              value: "services",
              label: "Services",
              badge:
                nextServiceRun && nextServiceCoverageSummary.seatsOpen > 0
                  ? String(nextServiceCoverageSummary.seatsOpen)
                  : null,
            },
            { value: "workflow", label: "Workflow", badge: workflowInboxCount > 0 ? String(workflowInboxCount) : null },
          ].map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className={getGraceTabClass(tab.value as GraceTab)}>
              <span>{tab.label}</span>
              {tab.badge ? (
                <span className="workspace-tab-count">
                  {tab.badge}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="home" className="space-y-6">
          <section ref={assistantSectionRef} className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Ask Grace
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Grace wakes in voice mode first. Open the conversation when you want the full thread.
                </p>
              </div>
              <Button variant="outline" onClick={handleStartVoiceOrb}>
                <Mic className="mr-2 h-4 w-4" />
                Wake Grace
              </Button>
            </div>
            <GraceElevenLabsAssistant
              hideTitle
              startSignal={voiceStartSignal}
              onActionComplete={fetchWorkspace}
            />
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Next service"
              value={nextServiceRun ? fmtDurationFromNow(nextServiceRun.run.serviceAt) : "None"}
              detail={
                nextServiceRun
                  ? `${nextServiceRun.run.name} · ${fmtDateTime(nextServiceRun.run.serviceAt)}`
                  : "No upcoming service is scheduled"
              }
            />
            <StatCard
              label="People to follow up with"
              value={careQueueCounts.total}
              detail={
                careQueueCounts.overdue > 0
                  ? `${careQueueCounts.overdue} overdue right now`
                  : "Nothing overdue right now"
              }
            />
            <StatCard
              label="Needs review"
              value={needsReviewCount}
              detail={
                needsReviewCount > 0
                  ? "Grace is waiting for a person"
                  : "No review items waiting"
              }
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="workspace-surface p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Top priorities
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Start with the few things most likely to unblock today.
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {nextActions.length === 0 ? (
                  <EmptyCard message="You are caught up right now." />
                ) : (
                  nextActions.map((action) => (
                    <div
                      key={action.id}
                      className="workspace-panel px-4 py-4"
                    >
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {action.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">{action.detail}</p>
                      <Button
                        variant="ghost"
                        className="mt-3 px-0 text-sm text-lime-700 hover:text-lime-800"
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
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="workspace-surface p-6">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Today with Grace</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                A short briefing to help you start the day with context.
              </p>
              {!dailyBriefing ? (
                <div className="mt-4">
                  <EmptyCard message="A daily briefing has not been generated yet." />
                </div>
              ) : (
                <div className="workspace-panel mt-4 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Generated {fmtDateTime(dailyBriefing.createdAt)}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    {dailyBriefing.details || dailyBriefing.summary}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="workspace-surface p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Services & volunteers
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Keep staffing, upcoming services, and volunteer needs in view.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => router.push("/app/services")}>
                    Open services
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/app/volunteers")}>
                    Open volunteers
                  </Button>
                  <Button variant="outline" onClick={() => router.push("/app/calendar")}>
                    Open calendar
                  </Button>
                </div>
              </div>

              {!nextServiceRun ? (
                <div className="mt-4">
                  <EmptyCard message="No upcoming service is scheduled yet." />
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="workspace-panel px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {nextServiceRun.run.name}
                          </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {fmtDateTime(nextServiceRun.run.serviceAt)} · {nextServiceRun.run.durationMinutes} min
                          {nextServiceRun.template?.name ? ` · ${nextServiceRun.template.name}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={getServiceRunBadgeClass(nextServiceRun.run.status)}
                      >
                        {SERVICE_RUN_STATUS_LABELS[nextServiceRun.run.status]}
                      </Badge>
                    </div>
                  </div>

                  <div className="workspace-panel px-4 py-4">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <span>Coverage</span>
                      <span>
                        {nextServiceAssignmentsLoading
                          ? "Loading"
                          : `${nextServiceCoverageSummary.seatsFilled}/${nextServiceCoverageSummary.seatsNeeded}`}
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className={
                          nextServiceCoverageSummary.seatsOpen > 0
                            ? "h-full rounded-full bg-amber-500"
                            : "h-full rounded-full bg-emerald-500"
                        }
                        style={{
                          width: `${Math.max(nextServiceCoverageSummary.coveragePercent, 4)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      {nextServiceCoverageSummary.seatsOpen > 0
                        ? `${nextServiceCoverageSummary.seatsOpen} seat${nextServiceCoverageSummary.seatsOpen === 1 ? "" : "s"} still need someone`
                        : "Every listed seat is covered"}
                    </p>
                  </div>

                  {upcomingServiceRuns.length > 1 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Coming up after that
                      </p>
                      {upcomingServiceRuns.slice(1).map((row) => (
                        <div
                          key={row.run.id}
                          className="workspace-panel px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {row.run.name}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {fmtDateTime(row.run.serviceAt)}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={getServiceRunBadgeClass(row.run.status)}
                            >
                              {SERVICE_RUN_STATUS_LABELS[row.run.status]}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {nextServiceOpenRoles.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Roles still open
                      </p>
                      {nextServiceOpenRoles.map((role) => (
                        <div
                          key={role.roleSlotId}
                          className="workspace-panel px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {role.roleName}
                            </p>
                            <span className="text-xs text-slate-500">
                              {role.seatsFilled}/{role.seatsNeeded}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="workspace-surface p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">
                    Appointments coming up
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Keep the next few pastoral conversations and follow-ups visible.
                  </p>
                </div>
                <Button variant="outline" onClick={() => router.push("/app/calendar")}>
                  Open calendar
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {upcomingAppointments.length === 0 ? (
                  <EmptyCard message="No upcoming appointments are on the calendar." />
                ) : (
                  upcomingAppointments.slice(0, 4).map((row) => (
                    <div
                      key={row.appointment.id}
                      className="workspace-panel px-4 py-4"
                    >
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {row.appointment.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {fmtDateTime(row.appointment.dateTime)} · {getContactDisplayName(row)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="care" className="space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="People waiting"
              value={careQueueCounts.total}
              detail="Everything that still needs a person"
            />
            <StatCard
              label="Overdue"
              value={careQueueCounts.overdue}
              detail="Items that are already late"
            />
            <StatCard
              label="Urgent"
              value={careQueueCounts.urgent}
              detail="The highest-priority care items"
            />
          </section>

          <section className="workspace-surface p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  People to follow up with
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  A shorter care queue to help you decide what to touch first.
                </p>
              </div>
            </div>
            <div className="mt-4">
              {careQueueItems.length === 0 ? (
                <EmptyCard message="No active care items right now." />
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {careQueueItems.slice(0, 6).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.source === "conversation") {
                          const conversationId = item.id.replace("conversation:", "");
                          setSelectedConversationId(conversationId);
                          switchTab("care");
                          return;
                        }
                        router.push(item.href);
                      }}
                      className="workspace-panel p-4 text-left transition-colors hover:border-lime-300 hover:bg-white dark:hover:bg-slate-900"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {String(item.source).replaceAll("_", " ")}
                        </span>
                        <Badge variant="outline">{item.priority}</Badge>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                        <span>{item.contactName || "No linked contact"}</span>
                        <span>{item.dueAt ? fmtDateTime(item.dueAt) : "No due date"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-5">
            <div className="workspace-surface lg:col-span-2">
              <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Conversations
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Calls, texts, and messages in one place.
                </p>
              </div>
              <div className="p-6">
                {conversations.length === 0 ? (
                  <EmptyCard message="No conversations yet." />
                ) : (
                  <ScrollArea className="h-[460px] pr-3">
                    <div className="space-y-3">
                      {conversations.map((row) => {
                        const isActive = selectedConversationId === row.conversation.id;
                        return (
                          <button
                            key={row.conversation.id}
                            onClick={() => setSelectedConversationId(row.conversation.id)}
                            className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                              isActive
                                ? "border-lime-300 bg-lime-50 dark:bg-lime-500/10"
                                : "border-slate-200 bg-slate-50 hover:bg-white dark:border-slate-800 dark:bg-slate-950/40 dark:hover:bg-slate-900"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {getContactDisplayName(row)}
                              </p>
                              <Badge variant="outline">
                                {row.conversation.channel === "sms"
                                  ? "SMS"
                                  : row.conversation.channel === "email"
                                    ? "Email"
                                    : "Thread"}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {row.conversation.subject || "No subject"}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>

            <div className="workspace-surface lg:col-span-3">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Conversation thread
                </h2>
                {activeConversation ? (
                  <div className="flex flex-wrap gap-2">
                    {activeConversation.conversation.status === "open" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void handleSetConversationStatus(
                            activeConversation.conversation.id,
                            "waiting"
                          )
                        }
                        disabled={conversationStatusSaving}
                      >
                        Mark waiting
                      </Button>
                    ) : null}
                    {(activeConversation.conversation.status === "open" ||
                      activeConversation.conversation.status === "waiting") ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void handleSetConversationStatus(
                            activeConversation.conversation.id,
                            "resolved"
                          )
                        }
                        disabled={conversationStatusSaving}
                      >
                        Resolve
                      </Button>
                    ) : null}
                    {activeConversation.conversation.status !== "archived" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void handleSetConversationStatus(
                            activeConversation.conversation.id,
                            "archived"
                          )
                        }
                        disabled={conversationStatusSaving}
                      >
                        Archive
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void handleSetConversationStatus(
                            activeConversation.conversation.id,
                            "open"
                          )
                        }
                        disabled={conversationStatusSaving}
                      >
                        Reopen
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="space-y-4 p-6">
                <div className="workspace-panel px-4 py-3 text-xs text-slate-500">
                  Open <span className="font-semibold text-slate-900 dark:text-white">{Number(conversationStats?.open ?? 0)}</span>
                  <span className="mx-2">·</span>
                  Waiting <span className="font-semibold text-slate-900 dark:text-white">{waitingConversations}</span>
                  <span className="mx-2">·</span>
                  Resolved <span className="font-semibold text-slate-900 dark:text-white">{Number(conversationStats?.resolved ?? 0)}</span>
                </div>

                <ScrollArea className="workspace-panel h-[340px] p-4">
                  {messagesLoading ? (
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-lime-500" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-sm text-slate-500">No messages in this thread.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`max-w-[85%] rounded-2xl p-4 text-sm ${
                            message.direction === "outbound"
                              ? "ml-auto bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                              : "bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                          }`}
                        >
                          <p className="leading-relaxed">{message.content}</p>
                          <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                            {fmtDateTime(message.sentAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>

                <div className="flex gap-3">
                  <Input
                    className="h-12"
                    value={composerText}
                    onChange={(event) => setComposerText(event.target.value)}
                    placeholder={
                      canReplyToActiveConversation
                        ? "Write a reply..."
                        : "Reopen the conversation to send a reply"
                    }
                    disabled={!canReplyToActiveConversation}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <Button
                    className="h-12 shrink-0"
                    onClick={() => void handleSend()}
                    disabled={sending || !composerText.trim() || !canReplyToActiveConversation}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="workspace-surface p-6">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Recent calls</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Phone activity connected to the care queue.
              </p>
              <div className="mt-4 space-y-3">
                {phoneCalls.length === 0 ? (
                  <EmptyCard message="No phone calls yet." />
                ) : (
                  phoneCalls.slice(0, 6).map((row) => (
                    <div
                      key={row.conversation.id}
                      className="workspace-panel px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {row.contact
                              ? `${row.contact.firstName} ${row.contact.lastName}`.trim()
                              : row.conversation.subject || "Unknown contact"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {row.latestContent || "No call notes"}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedConversationId(row.conversation.id);
                            switchTab("care");
                          }}
                        >
                          Open
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="workspace-surface p-6">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Recent sessions</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Inbound Grace sessions and where they landed.
              </p>
              <div className="mt-4 space-y-3">
                {sessions.length === 0 ? (
                  <EmptyCard message="No sessions yet." />
                ) : (
                  sessions.slice(0, 6).map((session) => (
                    <div
                      key={session.id}
                      className="workspace-panel px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {session.channel}
                          </p>
                          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                            {session.finalSummary || "Session is still in progress"}
                          </p>
                        </div>
                        <Badge variant="outline">{session.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="guests" className="space-y-6">
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Guests in follow-up"
              value={pipelineVisitorsCount}
              detail="Everyone currently in the guest journey"
            />
            <StatCard
              label="Newer guests"
              value={firstTimeVisitorCount}
              detail="People still near the start of the journey"
            />
            <StatCard
              label="Suggestions waiting"
              value={pendingProposalQueue.length}
              detail="Guest follow-up steps Grace has queued for review"
            />
          </section>

          <section className="workspace-surface">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-6 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Guest follow-up
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Move people forward and let Grace keep the next step close at hand.
                </p>
              </div>
            </div>
            <div className="flex-1 overflow-x-auto p-6">
              {pipelineStages.length === 0 ? (
                <EmptyCard message="Guest stages are not set up yet." />
              ) : (
                <PipelineBoard
                  stages={pipelineStages}
                  items={pipelineItems}
                  searchQuery=""
                  handleDelete={async (id) => {
                    const mod = await import("@/app/actions/pipeline");
                    if (!confirm("Remove this guest from the pipeline?")) return;
                    await mod.deletePipelineItem(id);
                    await fetchWorkspace();
                    toast.success("Guest removed");
                  }}
                  handleMoveStage={handleMoveVisitorStage}
                  onDragEndOptimistic={async (result: import("@hello-pangea/dnd").DropResult) => {
                    const { source, destination, draggableId } = result;
                    if (!destination) return;
                    if (
                      source.droppableId === destination.droppableId &&
                      source.index === destination.index
                    ) {
                      return;
                    }

                    const newItems = [...pipelineItems];
                    const itemIndex = newItems.findIndex((item) => item.item.id === draggableId);
                    if (itemIndex > -1) {
                      newItems[itemIndex] = {
                        ...newItems[itemIndex],
                        item: {
                          ...newItems[itemIndex].item,
                          stageId: destination.droppableId,
                          order: destination.index,
                        },
                      };
                      setPipelineItems(newItems);
                    }

                    await handleMoveVisitorStage(draggableId, destination.droppableId);
                  }}
                />
              )}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <section className="workspace-surface p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
                  Services
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Keep the next service covered and moving
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  This is Grace&apos;s service watch: what&apos;s coming up, what&apos;s still missing, and what she can kick off right now.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => router.push("/app/services")}>
                  Open full services
                </Button>
                <Button variant="outline" onClick={() => router.push("/app/volunteers")}>
                  Open volunteers
                </Button>
                <Button variant="outline" onClick={() => router.push("/app/calendar")}>
                  Open calendar
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Next service"
                value={nextServiceRun ? fmtDurationFromNow(nextServiceRun.run.serviceAt) : "None"}
                detail={
                  nextServiceRun
                    ? `${nextServiceRun.run.name} · ${fmtDateTime(nextServiceRun.run.serviceAt)}`
                    : "No upcoming service is scheduled"
                }
              />
              <StatCard
                label="Seats still open"
                value={nextServiceRun ? nextServiceCoverageSummary.seatsOpen : "—"}
                detail={
                  nextServiceRun
                    ? `${nextServiceCoverageSummary.seatsFilled}/${nextServiceCoverageSummary.seatsNeeded} seats filled`
                    : "Create a service to start staffing"
                }
              />
              <StatCard
                label="Waiting on replies"
                value={nextServicePendingOffers.length}
                detail={
                  nextServicePendingOffers.length > 0
                    ? "People still deciding on coverage"
                    : "No unanswered offers right now"
                }
              />
              <StatCard
                label="Grace automations"
                value={nextServiceActiveGoals.length}
                detail={
                  nextServiceActiveGoals.length > 0
                    ? "Staffing workflows already in motion"
                    : "Nothing running right now"
                }
              />
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
            <div className="workspace-surface p-6">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">What&apos;s upcoming</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Keep the next few services visible without opening the full planner.
              </p>

              <div className="mt-4 space-y-3">
                {upcomingServiceRuns.length === 0 ? (
                  <EmptyCard message="No upcoming services are scheduled yet." />
                ) : (
                  upcomingServiceRuns.map((row, index) => (
                    <div
                      key={row.run.id}
                      className={index === 0 ? "workspace-panel-soft px-5 py-5" : "workspace-panel px-4 py-4"}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            {index === 0 ? (
                              <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-900 dark:bg-cyan-500/15 dark:text-cyan-100">
                                Next up
                              </span>
                            ) : null}
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {row.run.name}
                            </p>
                          </div>
                          <p className="mt-2 text-sm text-slate-500">
                            {fmtDateTime(row.run.serviceAt)} · {row.run.durationMinutes} min
                            {row.template?.name ? ` · ${row.template.name}` : ""}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={getServiceRunBadgeClass(row.run.status)}
                        >
                          {SERVICE_RUN_STATUS_LABELS[row.run.status]}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="workspace-surface p-6">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">What&apos;s missing</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Focus on the gaps that could keep the next service from feeling settled.
              </p>

              {!nextServiceRun ? (
                <div className="mt-4">
                  <EmptyCard message="Once a service is on the calendar, Grace will keep the gaps in front of you here." />
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="workspace-panel px-4 py-4">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <span>Coverage for {nextServiceRun.run.name}</span>
                      <span>
                        {nextServiceAssignmentsLoading
                          ? "Loading"
                          : `${nextServiceCoverageSummary.coveragePercent}%`}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className={
                          nextServiceCoverageSummary.seatsOpen > 0
                            ? "h-full rounded-full bg-cyan-500"
                            : "h-full rounded-full bg-emerald-500"
                        }
                        style={{ width: `${Math.max(nextServiceCoverageSummary.coveragePercent, 4)}%` }}
                      />
                    </div>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                      {nextServiceCoverageSummary.seatsOpen > 0
                        ? `${nextServiceCoverageSummary.seatsOpen} seat${nextServiceCoverageSummary.seatsOpen === 1 ? "" : "s"} still need someone`
                        : "Every listed seat is covered right now"}
                    </p>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="workspace-panel px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Open roles
                      </p>
                      {nextServiceOpenRoles.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">No open roles right now.</p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {nextServiceOpenRoles.map((role) => (
                            <div
                              key={role.roleSlotId}
                              className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {role.roleName}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {role.isRequired ? "Required role" : "Nice to fill"}
                                  </p>
                                </div>
                                <span className="text-xs text-slate-500">
                                  {role.seatsFilled}/{role.seatsNeeded}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="workspace-panel px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Waiting on replies
                      </p>
                      {nextServicePendingOffers.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">No pending volunteer replies right now.</p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {nextServicePendingOffers.slice(0, 4).map((row) => (
                            <div
                              key={row.assignment.id}
                              className="rounded-xl border border-white/70 bg-white/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60"
                            >
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {row.assignment.roleName}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {getServiceAssignmentDisplayName(row)} · {row.assignment.status.replaceAll("_", " ")}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {nextServiceAtRiskAssignments.length > 0 ? (
                    <div className="workspace-panel px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Needs replacement
                      </p>
                      <div className="mt-3 grid gap-2">
                        {nextServiceAtRiskAssignments.slice(0, 4).map((row) => (
                          <div
                            key={row.assignment.id}
                            className="rounded-xl border border-rose-200 bg-rose-50/70 px-3 py-2 dark:border-rose-900/60 dark:bg-rose-950/20"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {row.assignment.roleName}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {getServiceAssignmentDisplayName(row)}
                                </p>
                              </div>
                              <Badge variant="outline" className="border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300">
                                {row.assignment.status.replaceAll("_", " ")}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="workspace-surface p-6">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Let Grace handle the next step</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Kick off staffing automation without opening the full planning workspace.
              </p>

              {!nextServiceRun ? (
                <div className="mt-4">
                  <EmptyCard message="Schedule a service first, then Grace can help fill it and follow up with people." />
                </div>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="workspace-panel px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Build seats
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Generate assignment slots from the service template if they are not in place yet.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      disabled={serviceAutomationAction !== null || nextServiceGeneratedSeats > 0}
                      onClick={() => void handleBuildNextServiceSeats()}
                    >
                      {serviceAutomationAction === "build" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {nextServiceGeneratedSeats > 0 ? "Seats already built" : "Build seats"}
                    </Button>
                  </div>

                  <div className="workspace-panel px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Start autostaff
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Let Grace start working the open roles and replacements for this service.
                    </p>
                    <Button
                      className="mt-4 bg-cyan-600 text-white hover:bg-cyan-700"
                      disabled={
                        serviceAutomationAction !== null ||
                        nextServiceActiveGoals.length > 0 ||
                        nextServiceOpenRoles.length === 0
                      }
                      onClick={() => void handleStartNextServiceAutostaff()}
                    >
                      {serviceAutomationAction === "autostaff" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      {nextServiceActiveGoals.length > 0 ? "Already running" : "Start autostaff"}
                    </Button>
                  </div>

                  <div className="workspace-panel px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Send offers
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Message the people Grace has already queued for this service.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      disabled={serviceAutomationAction !== null || nextServicePendingOffers.length === 0}
                      onClick={() => void handleSendNextServiceOffers()}
                    >
                      {serviceAutomationAction === "offers" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {nextServicePendingOffers.length > 0
                        ? `Send ${nextServicePendingOffers.length} offer${nextServicePendingOffers.length === 1 ? "" : "s"}`
                        : "No offers waiting"}
                    </Button>
                  </div>

                  <div className="workspace-panel px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Open the full planner
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Jump into templates, coverage planning, and run-of-service details.
                    </p>
                    <Button variant="outline" className="mt-4" onClick={() => router.push("/app/services")}>
                      Open services
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="workspace-surface p-6">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Automations in motion</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                See whether Grace is already working the next service before you fire off anything else.
              </p>

              <div className="mt-4 space-y-3">
                {nextServiceActiveGoals.length === 0 ? (
                  <EmptyCard message="Grace is not currently running any service staffing automations." />
                ) : (
                  nextServiceActiveGoals.map((row) => (
                    <div
                      key={row.goal.id}
                      className="workspace-panel px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {row.goal.objectiveText}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Started {fmtDateTime(row.goal.startedAt || row.goal.createdAt)}
                          </p>
                          {row.goal.errorText ? (
                            <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
                              {row.goal.errorText}
                            </p>
                          ) : null}
                        </div>
                        <Badge
                          variant="outline"
                          className={getGraceGoalBadgeClass(row.goal.status)}
                        >
                          {GRACE_GOAL_STATUS_LABELS[row.goal.status]}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {nextServiceRun ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Current next service
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {nextServiceRun.run.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {fmtDateTime(nextServiceRun.run.serviceAt)}
                  </p>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl border border-white/80 bg-white/80 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-lg font-black text-slate-900 dark:text-white">
                        {nextServiceCoverageSummary.seatsOpen}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Open
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white/80 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-lg font-black text-slate-900 dark:text-white">
                        {nextServicePendingOffers.length}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Waiting
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white/80 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-lg font-black text-slate-900 dark:text-white">
                        {nextServiceConfirmedCount}
                      </p>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Confirmed
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="workflow" className="space-y-6">
          <section className="space-y-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Workflow inbox
              </p>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Grace runs the workflows, the page shows the state
              </h2>
              <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-400">
                Active work, approvals, pending replies, escalations, and completed snapshots stay visible in one place.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <GraceWorkflowLane
                title="Active workflows"
                description="What Grace is actively working on right now."
                items={activeWorkflowCards}
                emptyMessage="No active workflow is running right now."
                accent="cyan"
                compact
              />
              <GraceWorkflowLane
                title="Waiting approvals"
                description="Actions Grace is holding until a person says yes."
                items={waitingApprovalCards}
                emptyMessage="Nothing is waiting on approval."
                accent="amber"
                compact
              />
              <GraceWorkflowLane
                title="Waiting replies"
                description="Workflows paused on a volunteer, guest, or staff response."
                items={waitingReplyCards}
                emptyMessage="No workflows are waiting on a reply."
                accent="slate"
                compact
              />
              <GraceWorkflowLane
                title="Escalations"
                description="Items Grace has flagged because they need a human next."
                items={escalationCards}
                emptyMessage="No escalations are active right now."
                accent="rose"
                compact
              />
            </div>

            <GraceWorkflowLane
              title="Completed snapshots"
              description="Recently finished items and closed decisions."
              items={completedWorkflowCards}
              emptyMessage="Completed workflow snapshots will appear here."
              accent="emerald"
              compact
            />
          </section>

          <section className="workspace-surface p-6">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Needs your review
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              These are the Grace items that still need a person before anything else happens.
            </p>
          </section>

          <section className="workspace-surface">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Grace activity
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                The audit-backed timeline of what Grace already did, suggested, queued, or failed.
              </p>
            </div>
            <div className="space-y-3 p-6">
              {activityFeed.length === 0 ? (
                <EmptyCard message="Grace activity will appear here once work starts running." />
              ) : (
                activityFeed.map((row) => {
                  const metadata = (row.metadataJson ?? {}) as Record<string, unknown>;
                  const metaParts = [
                    typeof metadata.category === "string" ? metadata.category.replaceAll("_", " ") : null,
                    typeof metadata.tier === "string" ? metadata.tier.replaceAll("_", " ") : null,
                    row.channel,
                  ].filter(Boolean);

                  return (
                    <div
                      key={row.id}
                      className="workspace-panel px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={getGraceActivityBadgeClass(row.status)}
                            >
                              {getGraceActivityLabel(row)}
                            </Badge>
                            <p className="text-xs text-slate-500">{fmtDateTime(row.createdAt)}</p>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                            {getGraceActivityTitle(row)}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {getGraceActivityDetail(row)}
                          </p>
                          {metaParts.length > 0 ? (
                            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              {metaParts.join(" · ")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="workspace-surface">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Approval requests
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Higher-risk actions Grace is holding until a person says yes.
              </p>
            </div>
            <div className="space-y-4 p-6">
              {approvals.length === 0 ? (
                <EmptyCard message="No approvals are waiting right now." />
              ) : (
                approvals
                  .filter((approval) => approval.status === "pending")
                  .map((approval) => {
                    const action = (approval.proposedAction ?? {}) as Record<string, unknown>;
                    const toolName = typeof action.tool === "string" ? action.tool : "Grace action";
                    const reasonText =
                      typeof action.reason === "string"
                        ? action.reason
                        : "Grace is asking for approval before it acts.";
                    const isApprovalProcessing =
                      approvalActionId === approval.id ||
                      (approvalMfaSubmitting &&
                        approvalMfaChallenge?.approvalId === approval.id);

                    return (
                      <div
                        key={approval.id}
                        className="workspace-panel p-5"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Pending</Badge>
                              <p className="text-xs text-slate-500">{fmtDateTime(approval.createdAt)}</p>
                            </div>
                            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                              {toolName}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">{reasonText}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => void handleApproveAndExecute(approval)}
                              disabled={isApprovalProcessing}
                            >
                              {isApprovalProcessing ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => void handleRejectApproval(approval)}
                              disabled={isApprovalProcessing}
                            >
                              Decline
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </section>

          <section className="workspace-surface">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                Grace suggestions
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Follow-up ideas waiting for a quick staff decision.
              </p>
            </div>
            <div className="space-y-4 p-6">
              {pendingProposalQueue.length === 0 ? (
                <EmptyCard message="No Grace suggestions are waiting right now." />
              ) : (
                pendingProposalQueue.map((proposal) => {
                  const isUpdating = proposalDecisionId === proposal.id;
                  return (
                    <div
                      key={proposal.id}
                      className="workspace-panel p-5"
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{proposal.proposedChannel || proposal.channel}</Badge>
                            <p className="text-xs text-slate-500">{fmtDateTime(proposal.createdAt)}</p>
                          </div>
                          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                            {proposal.reason || "Follow-up suggestion"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">{proposal.messageText}</p>
                          {proposal.recipient ? (
                            <p className="mt-2 text-xs text-slate-500">Recipient: {proposal.recipient}</p>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => void handleProposalDecision(proposal.id, "approved")}
                            disabled={isUpdating}
                          >
                            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => void handleProposalDecision(proposal.id, "rejected")}
                            disabled={isUpdating}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="workspace-surface p-6">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">
              Recently handled
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              A short look at the most recent review decisions.
            </p>
            <div className="mt-4 space-y-3">
              {reviewHistoryItems.length === 0 ? (
                <EmptyCard message="Nothing has been handled yet." />
              ) : (
                reviewHistoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="workspace-panel px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{item.status}</Badge>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {item.kind} · {fmtDateTime(item.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <Dialog open={approvalMfaOpen} onOpenChange={(open) => !open && closeApprovalMfaDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enter verification code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Grace needs one more check before it can run{" "}
              <span className="font-semibold text-slate-900 dark:text-white">
                {approvalMfaChallenge?.toolName ?? "this action"}
              </span>
              .
            </p>
            <Input
              placeholder="6-digit code"
              value={approvalMfaCode}
              onChange={(event) => setApprovalMfaCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSubmitApprovalMfa();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeApprovalMfaDialog}>
                Cancel
              </Button>
              <Button onClick={() => void handleSubmitApprovalMfa()} disabled={approvalMfaSubmitting}>
                {approvalMfaSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Verify
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
