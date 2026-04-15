"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2, RefreshCw, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import useOrganization from "@/lib/organizations/useOrganization";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraceWorkflowLane } from "@/components/grace/GraceWorkflowLane";
import {
  createServiceRun,
  generateServiceRunAssignmentsFromTemplate,
  generateServiceRunRecap,
  getGraceGoals,
  getServiceRunAssignments,
  getServiceRunRecaps,
  getServiceRuns,
  getServiceTemplateAssignmentPreview,
  getServiceTemplates,
  sendServiceAssignmentOffers,
  updateServiceAssignmentStatus,
} from "@/app/actions/operations";
import {
  buildServiceRunRoleMatrix,
  getNextUpcomingServiceRun,
  getPreferredServiceRunId,
  summarizeRoleMatrix,
} from "@/lib/grace/service-planning";
import {
  buildGraceWorkflowCardView,
  type GraceWorkflowCardView,
} from "@/lib/grace/workflow-summary";

type ServiceTemplateBundle = Awaited<ReturnType<typeof getServiceTemplates>>[number];
type ServiceRunRow = Awaited<ReturnType<typeof getServiceRuns>>[number];
type ServiceRunAssignmentRow = Awaited<ReturnType<typeof getServiceRunAssignments>>[number];
type ServiceGoalRow = Awaited<ReturnType<typeof getGraceGoals>>[number];
type AssignmentPreviewData = Awaited<ReturnType<typeof getServiceTemplateAssignmentPreview>>;
type ServiceRunRecap = Awaited<ReturnType<typeof getServiceRunRecaps>>[number] | null;
type ServiceRunStatus = ServiceRunRow["run"]["status"];
type ServiceAssignmentStatus = ServiceRunAssignmentRow["assignment"]["status"];
type GraceGoalStatus = ServiceGoalRow["goal"]["status"];
type RoleAssignmentType = NonNullable<ServiceTemplateBundle["roleSlots"][number]["assignmentType"]>;
type ServiceRunMatrixRow = ReturnType<typeof buildServiceRunRoleMatrix>[number];
type WorkflowCardView = GraceWorkflowCardView;

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

const SERVICE_ASSIGNMENT_STATUS_LABELS: Record<ServiceAssignmentStatus, string> = {
  proposed: "Proposed",
  offered: "Offered",
  confirmed: "Confirmed",
  declined: "Declined",
  needs_replacement: "Needs replacement",
  checked_in: "Checked in",
  checked_out: "Checked out",
  no_show: "No-show",
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

function getNextSundayMorning() {
  const date = new Date();
  const dayOfWeek = date.getDay();
  const daysUntilSunday = (7 - dayOfWeek) % 7 || 7;
  date.setDate(date.getDate() + daysUntilSunday);
  date.setHours(9, 0, 0, 0);
  return date;
}

function formatDateTimeLocalInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
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

function fmtCompactCountdown(targetAt: Date, nowMs: number) {
  const deltaMs = targetAt.getTime() - nowMs;
  const absMinutes = Math.max(0, Math.round(Math.abs(deltaMs) / 60_000));

  if (absMinutes <= 1) {
    return deltaMs >= 0 ? "now" : "just now";
  }

  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  const durationLabel =
    hours > 0 ? `${hours}h${minutes > 0 ? ` ${minutes}m` : ""}` : `${minutes}m`;

  return deltaMs >= 0 ? `in ${durationLabel}` : `${durationLabel} ago`;
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

function getServiceAssigneeLabel(row: ServiceRunAssignmentRow) {
  if (row.staff) return row.staff.name || row.staff.email;
  if (row.contact) return `${row.contact.firstName} ${row.contact.lastName}`.trim();
  return "";
}

function buildPendingAssignmentWorkflowCard(row: ServiceRunAssignmentRow): WorkflowCardView {
  return {
    ...buildGraceWorkflowCardView({
      id: row.assignment.id,
      goalType: "service_staffing",
      status: "waiting",
      sourceChannel: "in_app",
      objectiveText: row.assignment.roleName,
      serviceRunId: row.assignment.serviceRunId,
      contextJson: {
        workflowKey: "volunteer_staffing",
        workflowVersion: "v1",
        triggerSource: "in_app",
        triggerChannel: "in_app",
        subjectEntityType: "service_assignment",
        subjectEntityId: row.assignment.id,
        subjectContactId: row.contact?.id ?? null,
        correlationKey: `volunteer_staffing:${row.assignment.id}`,
        policyMode: "standard",
      },
      createdAt: row.assignment.createdAt ?? new Date(),
      updatedAt: row.assignment.updatedAt ?? row.assignment.createdAt ?? new Date(),
      nextRunAt: row.assignment.updatedAt ?? row.assignment.createdAt ?? null,
      startedAt: row.assignment.createdAt ?? null,
      completedAt: null,
      resultJson: null,
      errorText: null,
    }),
    status: "waiting",
    statusLabel: "Waiting on reply",
    statusTone: "amber",
    headline: row.assignment.roleName,
    summary: `${getServiceAssigneeLabel(row) || "Unassigned"} · ${row.assignment.status.replaceAll("_", " ")}`,
    meta: [
      `Role: ${row.assignment.roleName}`,
      row.assignment.volunteerId || row.assignment.staffUserId ? "Assigned" : "Unassigned",
    ],
    stepSummary: "Awaiting a volunteer response",
    stepTimeline: [],
  };
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
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function getServiceSectionTabClass(section: "overview" | "plan" | "run") {
  const base =
    "workspace-tab border border-transparent shadow-none transition-all duration-200";

  if (section === "overview") {
    return `${base} hover:bg-sky-50 hover:text-sky-900 data-[state=active]:border-sky-200 data-[state=active]:bg-sky-50 data-[state=active]:text-sky-900 dark:hover:bg-sky-500/10 dark:hover:text-sky-100 dark:data-[state=active]:border-sky-500/30 dark:data-[state=active]:bg-sky-500/15 dark:data-[state=active]:text-sky-50`;
  }

  if (section === "plan") {
    return `${base} hover:bg-lime-50 hover:text-lime-900 data-[state=active]:border-lime-200 data-[state=active]:bg-lime-50 data-[state=active]:text-lime-900 dark:hover:bg-lime-500/10 dark:hover:text-lime-100 dark:data-[state=active]:border-lime-500/30 dark:data-[state=active]:bg-lime-500/15 dark:data-[state=active]:text-lime-50`;
  }

  return `${base} hover:bg-amber-50 hover:text-amber-900 data-[state=active]:border-amber-200 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-900 dark:hover:bg-amber-500/10 dark:hover:text-amber-100 dark:data-[state=active]:border-amber-500/30 dark:data-[state=active]:bg-amber-500/15 dark:data-[state=active]:text-amber-50`;
}

type ServicesWorkspaceProps = {
  embedded?: boolean;
};

export function ServicesWorkspace({ embedded = false }: ServicesWorkspaceProps) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [activeSection, setActiveSection] = useState<"overview" | "plan" | "run">("overview");
  const [loading, setLoading] = useState(true);
  const [servicePlanningSetupRequired, setServicePlanningSetupRequired] = useState<string | null>(
    null
  );

  const [serviceTemplates, setServiceTemplates] = useState<ServiceTemplateBundle[]>([]);
  const [serviceRuns, setServiceRuns] = useState<ServiceRunRow[]>([]);
  const [serviceGoals, setServiceGoals] = useState<ServiceGoalRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedServiceRunId, setSelectedServiceRunId] = useState<string | null>(null);
  const [serviceRunAssignments, setServiceRunAssignments] = useState<ServiceRunAssignmentRow[]>([]);
  const [serviceRunAssignmentsLoading, setServiceRunAssignmentsLoading] = useState(false);
  const [serviceRunRecap, setServiceRunRecap] = useState<ServiceRunRecap>(null);
  const [serviceRunRecapLoading, setServiceRunRecapLoading] = useState(false);

  const [assignmentServiceAt, setAssignmentServiceAt] = useState(() =>
    formatDateTimeLocalInput(getNextSundayMorning())
  );
  const [assignmentDurationMinutes, setAssignmentDurationMinutes] = useState("90");
  const [includeUnavailableCandidates, setIncludeUnavailableCandidates] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentPreview, setAssignmentPreview] = useState<AssignmentPreviewData | null>(null);

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
  const [serviceGoalStarting, setServiceGoalStarting] = useState(false);
  const [assignmentStatusSavingId, setAssignmentStatusSavingId] = useState<string | null>(null);
  const [runBoardNowMs, setRunBoardNowMs] = useState(() => Date.now());

  const loadWorkspace = useCallback(
    async (preferredRunId?: string | null) => {
      if (!orgId) return;
      setLoading(true);
      try {
        const [templates, runs, goals] = await Promise.all([
          getServiceTemplates(orgId),
          getServiceRuns(orgId),
          getGraceGoals(orgId, { goalType: "service_staffing" }),
        ]);
        setServicePlanningSetupRequired(null);
        setServiceTemplates(templates);
        setServiceRuns(runs);
        setServiceGoals(goals);
        setSelectedTemplateId((current) => {
          if (current && templates.some((item) => item.template.id === current)) {
            return current;
          }
          const nextFromRun =
            preferredRunId &&
            runs.find((row) => row.run.id === preferredRunId)?.run.templateId;
          return nextFromRun ?? templates[0]?.template.id ?? null;
        });
        setSelectedServiceRunId((current) =>
          getPreferredServiceRunId(runs, preferredRunId ?? current)
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load services workspace";
        if (isServicePlanningSchemaMissing(message)) {
          setServicePlanningSetupRequired(
            "Service planning tables are not initialized yet. Apply migrations and refresh."
          );
          setServiceTemplates([]);
          setServiceRuns([]);
          setServiceGoals([]);
          setSelectedTemplateId(null);
          setSelectedServiceRunId(null);
        } else {
          console.error("Failed to load services workspace:", error);
          toast.error(message);
        }
      } finally {
        setLoading(false);
      }
    },
    [orgId]
  );

  const loadAssignments = useCallback(async (serviceRunId: string) => {
    setServiceRunAssignmentsLoading(true);
    try {
      const rows = await getServiceRunAssignments(serviceRunId);
      setServiceRunAssignments(rows);
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

  const loadRecap = useCallback(async (serviceRunId: string) => {
    setServiceRunRecapLoading(true);
    try {
      const recaps = await getServiceRunRecaps({ serviceRunId, limit: 1 });
      setServiceRunRecap(recaps[0] ?? null);
    } catch (error) {
      console.error("Failed to load service recap:", error);
      setServiceRunRecap(null);
    } finally {
      setServiceRunRecapLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!selectedServiceRunId) {
      setServiceRunAssignments([]);
      setServiceRunRecap(null);
      return;
    }
    void loadAssignments(selectedServiceRunId);
    void loadRecap(selectedServiceRunId);
  }, [loadAssignments, loadRecap, selectedServiceRunId]);

  useEffect(() => {
    if (activeSection !== "run" || !selectedServiceRunId) {
      return;
    }
    setRunBoardNowMs(Date.now());
    const timer = window.setInterval(() => {
      setRunBoardNowMs(Date.now());
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [activeSection, selectedServiceRunId]);

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

  const nextServiceRun = useMemo(() => getNextUpcomingServiceRun(serviceRuns), [serviceRuns]);
  const summaryRun = selectedServiceRun ?? nextServiceRun;

  const serviceRunRoleMatrix = useMemo<ServiceRunMatrixRow[]>(() => {
    if (!selectedServiceRunTemplate) return [];
    return buildServiceRunRoleMatrix(
      selectedServiceRunTemplate.roleSlots,
      serviceRunAssignments,
      SERVICE_ASSIGNMENT_AT_RISK_STATUSES
    );
  }, [selectedServiceRunTemplate, serviceRunAssignments]);

  const serviceRunCoverageSummary = useMemo(
    () => summarizeRoleMatrix(serviceRunRoleMatrix),
    [serviceRunRoleMatrix]
  );

  const openRoles = useMemo(
    () =>
      serviceRunRoleMatrix
        .filter((row) => row.seatsOpen > 0)
        .sort((a, b) => Number(b.isRequired) - Number(a.isRequired) || b.seatsOpen - a.seatsOpen),
    [serviceRunRoleMatrix]
  );

  const serviceAssignmentStats = useMemo(() => {
    const totals = {
      total: serviceRunAssignments.length,
      offered: 0,
      confirmed: 0,
      unassigned: 0,
    };

    for (const row of serviceRunAssignments) {
      const status = row.assignment.status;
      if (status === "offered") totals.offered += 1;
      if (status === "confirmed" || status === "checked_in" || status === "checked_out") {
        totals.confirmed += 1;
      }
      if (!row.assignment.volunteerId && !row.assignment.staffUserId) {
        totals.unassigned += 1;
      }
    }

    return totals;
  }, [serviceRunAssignments]);

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
        .sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.sortOrder - b.sortOrder)
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
        title: "Volunteer call time",
        detail: "Teams arrive, check in, and get ready.",
        startAt: new Date(serviceAt.getTime() - 45 * 60_000),
        durationMinutes: 15,
        ownerLabel: "Operations",
        coverageLabel: fallbackCoverageLabel,
        coverageTone: fallbackCoverageTone,
      },
      {
        id: "team-huddle",
        title: "Team huddle",
        detail: "Leads align the run sheet and cover any last-minute needs.",
        startAt: new Date(serviceAt.getTime() - 15 * 60_000),
        durationMinutes: 10,
        ownerLabel: "Department leads",
        coverageLabel: fallbackCoverageLabel,
        coverageTone: fallbackCoverageTone,
      },
      {
        id: "service-window",
        title: "Service window",
        detail: "Main service delivery and guest coverage.",
        startAt: serviceAt,
        durationMinutes: serviceDurationMinutes,
        ownerLabel: "All ministry teams",
        coverageLabel: fallbackCoverageLabel,
        coverageTone: fallbackCoverageTone,
      },
      {
        id: "post-service",
        title: "Post-service reset",
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

  const runOfServiceTimelineWithState = useMemo(
    () =>
      runOfServiceOverview
        .slice()
        .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
        .map((step) => {
          const durationMinutes = Math.max(5, step.durationMinutes ?? 15);
          const startMs = step.startAt.getTime();
          const endMs = startMs + durationMinutes * 60_000;
          const isCurrent = runBoardNowMs >= startMs && runBoardNowMs < endMs;
          const isUpcoming = runBoardNowMs < startMs;
          return {
            ...step,
            durationMinutes,
            startMs,
            endMs,
            isCurrent,
            isUpcoming,
          };
        }),
    [runBoardNowMs, runOfServiceOverview]
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

  const selectedRunGoals = useMemo(
    () =>
      selectedServiceRunId
        ? serviceGoals.filter((row) => row.goal.serviceRunId === selectedServiceRunId)
        : serviceGoals,
    [selectedServiceRunId, serviceGoals]
  );

  const selectedRunWorkflowCards = useMemo<WorkflowCardView[]>(
    () =>
      selectedRunGoals
        .filter((row) => ["queued", "in_progress", "waiting"].includes(row.goal.status))
        .map((row) => buildGraceWorkflowCardView(row.goal))
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [selectedRunGoals]
  );

  const selectedRunWaitingReplyCards = useMemo<WorkflowCardView[]>(
    () =>
      serviceRunAssignments
        .filter((row) => row.assignment.status === "proposed" || row.assignment.status === "offered")
        .map((row) => buildPendingAssignmentWorkflowCard(row))
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [serviceRunAssignments]
  );

  const selectedRunCompletedWorkflowCards = useMemo<WorkflowCardView[]>(
    () =>
      selectedRunGoals
        .filter((row) => row.goal.status === "completed")
        .map((row) => buildGraceWorkflowCardView(row.goal))
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [selectedRunGoals]
  );

  const handleRunAssignmentPreview = useCallback(async () => {
    if (!selectedServiceTemplate) {
      toast.error("Choose a service template first");
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
      const preview = await getServiceTemplateAssignmentPreview({
        templateId: selectedServiceTemplate.template.id,
        serviceAt,
        serviceDurationMinutes: Math.floor(duration),
        includeUnavailable: includeUnavailableCandidates,
      });
      setAssignmentPreview(preview);
      toast.success("Preview ready");
    } catch (error) {
      console.error("Failed to generate assignment preview:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to generate assignment preview"
      );
    } finally {
      setAssignmentLoading(false);
    }
  }, [
    assignmentDurationMinutes,
    assignmentServiceAt,
    includeUnavailableCandidates,
    selectedServiceTemplate,
  ]);

  const handleCreateServiceRun = useCallback(async () => {
    if (servicePlanningSetupRequired) {
      toast.error(servicePlanningSetupRequired);
      return;
    }
    if (!orgId || !selectedServiceTemplate) {
      toast.error("Choose a role template first");
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
      const created = await createServiceRun({
        organizationId: orgId,
        templateId: selectedServiceTemplate.template.id,
        name: newServiceRunName.trim() || undefined,
        serviceAt,
        durationMinutes: Math.floor(duration),
      });

      if (newServiceRunGenerateAssignments) {
        await generateServiceRunAssignmentsFromTemplate({
          serviceRunId: created.id,
          overwriteExisting: false,
        });
      }

      setNewServiceRunName("");
      await loadWorkspace(created.id);
      toast.success("Service added");
      setActiveSection("overview");
    } catch (error) {
      console.error("Failed to create service run:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create service");
    } finally {
      setServiceRunCreating(false);
    }
  }, [
    loadWorkspace,
    newServiceRunAt,
    newServiceRunDurationMinutes,
    newServiceRunGenerateAssignments,
    newServiceRunName,
    orgId,
    selectedServiceTemplate,
    servicePlanningSetupRequired,
  ]);

  const handleGenerateAssignmentsForRun = useCallback(async () => {
    if (!selectedServiceRunId) {
      toast.error("Choose a service first");
      return;
    }

    setServiceRunGenerateSaving(true);
    try {
      const created = await generateServiceRunAssignmentsFromTemplate({
        serviceRunId: selectedServiceRunId,
        overwriteExisting: true,
      });
      await loadAssignments(selectedServiceRunId);
      toast.success(`Reset ${created.length} service seats`);
    } catch (error) {
      console.error("Failed to generate service assignments:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reset service seats"
      );
    } finally {
      setServiceRunGenerateSaving(false);
    }
  }, [loadAssignments, selectedServiceRunId]);

  const handleSendOffersForRun = useCallback(async () => {
    if (!selectedServiceRunId) {
      toast.error("Choose a service first");
      return;
    }

    setServiceRunOffersSending(true);
    try {
      const result = await sendServiceAssignmentOffers({ serviceRunId: selectedServiceRunId });
      await loadAssignments(selectedServiceRunId);
      toast.success(
        `Offers sent: ${result.sent}/${result.attempted} (skipped ${result.skipped}, failed ${result.failed})`
      );
    } catch (error) {
      console.error("Failed to send service offers:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send offers");
    } finally {
      setServiceRunOffersSending(false);
    }
  }, [loadAssignments, selectedServiceRunId]);

  const handleGenerateServiceRunRecap = useCallback(async () => {
    if (!selectedServiceRunId) {
      toast.error("Choose a service first");
      return;
    }

    setServiceRunRecapGenerating(true);
    try {
      const result = await generateServiceRunRecap({ serviceRunId: selectedServiceRunId });
      setServiceRunRecap(result.recap);
      toast.success(result.generated ? "Recap generated" : "Recap already available");
    } catch (error) {
      console.error("Failed to generate recap:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate recap");
    } finally {
      setServiceRunRecapGenerating(false);
    }
  }, [selectedServiceRunId]);

  const handleUpdateAssignmentStatus = useCallback(
    async (assignmentId: string, status: ServiceAssignmentStatus) => {
      setAssignmentStatusSavingId(`${assignmentId}:${status}`);
      try {
        await updateServiceAssignmentStatus({ assignmentId, status });
        if (selectedServiceRunId) {
          await loadAssignments(selectedServiceRunId);
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
    [loadAssignments, selectedServiceRunId]
  );

  const handleStartAutostaffGoal = useCallback(async () => {
    if (!selectedServiceRunId) {
      toast.error("Choose a service first");
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
        dispatched?: boolean;
      };

      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "Failed to start autostaff");
      }

      await loadWorkspace(selectedServiceRunId);
      if (payload.dispatched === false) {
        toast.info(payload.message || "Autostaff was saved, but the background runner is unavailable.");
      } else {
        toast.success(
          payload.created === false
            ? "Autostaff is already running for this service"
            : "Autostaff started"
        );
      }
    } catch (error) {
      console.error("Failed to start autostaff:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start autostaff");
    } finally {
      setServiceGoalStarting(false);
    }
  }, [loadWorkspace, selectedServiceRunId]);

  const handleExportServiceRunPayroll = useCallback(async () => {
    if (!selectedServiceRunId) {
      toast.error("Choose a service first");
      return;
    }

    setServiceRunPayrollExporting(true);
    try {
      const response = await fetch(
        `/api/app/organizations/current/service-runs/payroll-ledger/export?serviceRunId=${encodeURIComponent(
          selectedServiceRunId
        )}&includeOpen=false&markExported=true`
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message || "Failed to export payroll CSV");
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileNameMatch = disposition.match(/filename="([^"]+)"/i);
      const fileName = fileNameMatch?.[1] || "payroll-ledger.csv";

      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);

      toast.success("Payroll CSV exported");
    } catch (error) {
      console.error("Failed to export payroll CSV:", error);
      toast.error(error instanceof Error ? error.message : "Failed to export payroll CSV");
    } finally {
      setServiceRunPayrollExporting(false);
    }
  }, [selectedServiceRunId]);

  if (!orgId) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-lime-500" />
      </div>
    );
  }

  const coverageLabel = selectedServiceRun
    ? `${serviceRunCoverageSummary.coveragePercent}%`
    : summaryRun
      ? "Loading"
      : "—";
  const openPositionsLabel = selectedServiceRun
    ? serviceRunCoverageSummary.seatsOpen
    : "—";

  return (
    <div className={embedded ? "flex flex-col gap-5" : "workspace-page"}>
      {embedded ? (
        <section className="workspace-surface p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Services
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Keep the next service staffed and on track
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Coverage, volunteer follow-up, and the day-of-service flow stay here inside Grace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/app/volunteers">Volunteers</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/app/settings/role-matrix">Role Matrix</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/app/settings/scheduling-matrix">Scheduling Matrix</Link>
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <StatCard
              label="Next service"
              value={
                summaryRun ? fmtDurationFromNow(summaryRun.run.serviceAt) : loading ? "…" : "None"
              }
              detail={
                summaryRun
                  ? `${summaryRun.run.name} · ${fmtDateTime(summaryRun.run.serviceAt)}`
                  : "Create a service to get planning started"
              }
            />
            <StatCard
              label="Coverage"
              value={loading ? "…" : coverageLabel}
              detail={
                selectedServiceRun
                  ? "For the service you have selected"
                  : "Choose a service to see coverage"
              }
            />
            <StatCard
              label="Open positions"
              value={loading ? "…" : openPositionsLabel}
              detail={
                selectedServiceRun
                  ? "Seats that still need someone"
                  : "Choose a service to see open roles"
              }
            />
          </div>
        </section>
      ) : (
        <section className="workspace-hero-light">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Services
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Plan the next service without hunting through five screens
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Keep one place for coverage, planning, and the day-of-service follow-through.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/app/settings/role-matrix">Role Matrix</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/app/settings/scheduling-matrix">Scheduling Matrix</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/app/volunteers">Volunteers</Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="workspace-hero-metric-light">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Next service
              </p>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                {summaryRun ? fmtDurationFromNow(summaryRun.run.serviceAt) : loading ? "…" : "None"}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {summaryRun
                  ? `${summaryRun.run.name} · ${fmtDateTime(summaryRun.run.serviceAt)}`
                  : "Create a service to get planning started"}
              </p>
            </div>
            <div className="workspace-hero-metric-light">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Coverage
              </p>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                {loading ? "…" : coverageLabel}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {selectedServiceRun
                  ? "For the service you have selected"
                  : "Choose a service to see coverage"}
              </p>
            </div>
            <div className="workspace-hero-metric-light">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Open positions
              </p>
              <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                {loading ? "…" : openPositionsLabel}
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {selectedServiceRun
                  ? "Seats that still need someone"
                  : "Choose a service to see open roles"}
              </p>
            </div>
          </div>
        </section>
      )}

      {servicePlanningSetupRequired ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">Setup required</p>
          <p className="mt-1">{servicePlanningSetupRequired}</p>
        </section>
      ) : null}

      <Tabs value={activeSection} onValueChange={(value) => setActiveSection(value as "overview" | "plan" | "run")} className="space-y-4">
        <TabsList className="workspace-tabs h-auto w-fit border border-slate-200 bg-white/90 p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <TabsTrigger value="overview" className={getServiceSectionTabClass("overview")}>
            Overview
          </TabsTrigger>
          <TabsTrigger value="plan" className={getServiceSectionTabClass("plan")}>
            Plan
          </TabsTrigger>
          <TabsTrigger value="run" className={getServiceSectionTabClass("run")}>
            Run
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  Service summary
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Stay with the next thing that needs attention, not every option at once.
                </p>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedServiceRunId ?? ""}
                  onChange={(event) => setSelectedServiceRunId(event.target.value || null)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {serviceRuns.length === 0 ? (
                    <option value="">No services yet</option>
                  ) : (
                    serviceRuns.map((row) => (
                      <option key={row.run.id} value={row.run.id}>
                        {row.run.name} · {fmtDateTime(row.run.serviceAt)}
                      </option>
                    ))
                  )}
                </select>
                <Button variant="outline" size="icon" onClick={() => void loadWorkspace(selectedServiceRunId)}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {!selectedServiceRun ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700">
                No service is selected yet. Add one in the Plan tab.
              </div>
            ) : (
              <div className="mt-5 grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-slate-900 dark:text-white">
                          {selectedServiceRun.run.name}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {fmtDateTime(selectedServiceRun.run.serviceAt)} · {selectedServiceRun.run.durationMinutes} min
                          {selectedServiceRun.template?.name ? ` · ${selectedServiceRun.template.name}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={getServiceRunBadgeClass(selectedServiceRun.run.status)}
                      >
                        {SERVICE_RUN_STATUS_LABELS[selectedServiceRun.run.status]}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <StatCard
                      label="Coverage"
                      value={`${serviceRunCoverageSummary.coveragePercent}%`}
                      detail={`${serviceRunCoverageSummary.seatsFilled}/${serviceRunCoverageSummary.seatsNeeded} seats filled`}
                    />
                    <StatCard
                      label="Open roles"
                      value={serviceRunCoverageSummary.seatsOpen}
                      detail="Seats that still need someone"
                    />
                    <StatCard
                      label="Confirmed"
                      value={serviceRunRoleMatrix.reduce((sum, row) => sum + row.seatsConfirmed, 0)}
                      detail="People who already said yes"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Needs attention
                  </p>
                  {openRoles.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">Every listed role is covered right now.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {openRoles.slice(0, 5).map((roleRow) => (
                        <div
                          key={roleRow.roleSlotId}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {roleRow.roleName}
                            </p>
                            <span className="text-xs text-slate-500">
                              {roleRow.seatsFilled}/{roleRow.seatsNeeded}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={() => setActiveSection("plan")}>Plan coverage</Button>
                    <Button variant="outline" onClick={() => setActiveSection("run")}>
                      Open run view
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  Grace workflow control panel
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Grace owns the staffing workflow. Manual actions stay below as overrides.
                </p>
              </div>
              <Button
                onClick={() => void handleStartAutostaffGoal()}
                disabled={!selectedServiceRunId || serviceGoalStarting}
              >
                {serviceGoalStarting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Ask Grace to staff this service
              </Button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Seats to fill"
                value={serviceAssignmentStats.unassigned}
                detail="Open seats in the selected service"
              />
              <StatCard
                label="Offers sent"
                value={serviceAssignmentStats.offered}
                detail="People waiting to answer"
              />
              <StatCard
                label="Confirmed"
                value={serviceAssignmentStats.confirmed}
                detail="People already locked in"
              />
              <StatCard
                label="Active Grace goals"
                value={selectedRunGoals.length}
                detail="Autostaff or staffing follow-up in motion"
              />
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              <GraceWorkflowLane
                title="Active staffing workflows"
                description="Grace-owned actions already in progress for this service."
                items={selectedRunWorkflowCards}
                emptyMessage="Grace is not actively staffing this service yet."
                accent="cyan"
                compact
              />
              <GraceWorkflowLane
                title="Waiting on replies"
                description="Offers and replies that still need a response."
                items={selectedRunWaitingReplyCards}
                emptyMessage="No offers are waiting on a reply right now."
                accent="amber"
                compact
              />
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Manual override
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Keep these controls around for edge cases, but they are secondary now.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleGenerateAssignmentsForRun()}
                    disabled={!selectedServiceRunId || serviceRunGenerateSaving}
                  >
                    {serviceRunGenerateSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Reset seats
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleSendOffersForRun()}
                    disabled={!selectedServiceRunId || serviceRunOffersSending}
                  >
                    {serviceRunOffersSending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send offers
                  </Button>
                  <Button variant="outline" onClick={() => setActiveSection("run")}>
                    Open run view
                  </Button>
                </div>
              </div>
            </div>

            {selectedRunCompletedWorkflowCards.length > 0 ? (
              <div className="mt-6">
                <GraceWorkflowLane
                  title="Completed staffing snapshots"
                  description="Recently finished Grace staffing runs."
                  items={selectedRunCompletedWorkflowCards}
                  emptyMessage="Completed staffing snapshots will appear here."
                  accent="emerald"
                  compact
                />
              </div>
            ) : null}
          </section>
        </TabsContent>

        <TabsContent value="plan" className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  Coverage preview
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  See where coverage is likely to land before you send offers.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <select
                value={selectedTemplateId ?? ""}
                onChange={(event) => setSelectedTemplateId(event.target.value || null)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {serviceTemplates.length === 0 ? (
                  <option value="">No role templates yet</option>
                ) : (
                  serviceTemplates.map((template) => (
                    <option key={template.template.id} value={template.template.id}>
                      {template.template.name}
                    </option>
                  ))
                )}
              </select>
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
              <Button
                onClick={() => void handleRunAssignmentPreview()}
                disabled={assignmentLoading || !selectedServiceTemplate}
              >
                {assignmentLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Run preview
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Include unavailable people
                </p>
                <p className="text-xs text-slate-500">
                  Show conflicts and blocked options too
                </p>
              </div>
              <Switch
                checked={includeUnavailableCandidates}
                onCheckedChange={setIncludeUnavailableCandidates}
                disabled={assignmentLoading}
              />
            </div>

            {!assignmentPreview ? (
              <p className="mt-4 text-sm text-slate-500">
                Run a preview to see recommended people and uncovered roles.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Required seats"
                    value={assignmentPreview.summary.requiredSeats}
                    detail="Roles that need a person assigned"
                  />
                  <StatCard
                    label="Recommended"
                    value={assignmentPreview.summary.recommendedSeats}
                    detail="Seats with someone Grace would start with"
                  />
                  <StatCard
                    label="Still uncovered"
                    value={assignmentPreview.summary.unfilledRequiredSeats}
                    detail="Required seats still without a match"
                  />
                  <StatCard
                    label="Roles without coverage"
                    value={assignmentPreview.summary.requiredRolesWithoutCoverage}
                    detail="Required roles with no available recommendation"
                  />
                </div>

                <div className="space-y-3">
                  {assignmentPreview.roleRecommendations.map((recommendation) => (
                    <div
                      key={recommendation.roleSlot.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {recommendation.roleSlot.roleName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {recommendation.requiredCount} seat{recommendation.requiredCount === 1 ? "" : "s"} needed
                            {recommendation.unfilledSeats > 0 ? ` · ${recommendation.unfilledSeats} still open` : ""}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {recommendation.roleSlot.assignmentType === "paid_staff"
                            ? "Paid staff"
                            : recommendation.roleSlot.assignmentType === "volunteer"
                              ? "Volunteer"
                              : "Either"}
                        </Badge>
                      </div>

                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        {recommendation.suggestions.slice(0, 4).map((candidate) => (
                          <div
                            key={`${recommendation.roleSlot.id}-${candidate.assigneeType}-${candidate.assigneeId}`}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {candidate.displayName}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {candidate.primaryRole}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={
                                  candidate.available
                                    ? "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                                    : "border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
                                }
                              >
                                {candidate.available ? `Score ${candidate.score}` : "Blocked"}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {candidate.conflictReason
                                ? candidate.conflictReason
                                : candidate.reasons[0] || "Available"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                Add the next service
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Create the next service and decide whether seats should be generated right away.
              </p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <select
                value={selectedTemplateId ?? ""}
                onChange={(event) => setSelectedTemplateId(event.target.value || null)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {serviceTemplates.length === 0 ? (
                  <option value="">No role templates yet</option>
                ) : (
                  serviceTemplates.map((template) => (
                    <option key={template.template.id} value={template.template.id}>
                      {template.template.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/40 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  checked={newServiceRunGenerateAssignments}
                  onCheckedChange={setNewServiceRunGenerateAssignments}
                  disabled={serviceRunCreating}
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Create seats right away
                  </p>
                  <p className="text-xs text-slate-500">
                    Start with the role template immediately after the service is created
                  </p>
                </div>
              </div>
              <Button
                onClick={() => void handleCreateServiceRun()}
                disabled={
                  serviceRunCreating ||
                  Boolean(servicePlanningSetupRequired) ||
                  !selectedServiceTemplate ||
                  !newServiceRunAt
                }
              >
                {serviceRunCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarDays className="mr-2 h-4 w-4" />}
                Add service
              </Button>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="run" className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  Run of service
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Watch the current service, mark statuses, and keep the day moving.
                </p>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedServiceRunId ?? ""}
                  onChange={(event) => setSelectedServiceRunId(event.target.value || null)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {serviceRuns.length === 0 ? (
                    <option value="">No services yet</option>
                  ) : (
                    serviceRuns.map((row) => (
                      <option key={row.run.id} value={row.run.id}>
                        {row.run.name} · {fmtDateTime(row.run.serviceAt)}
                      </option>
                    ))
                  )}
                </select>
                <Button variant="outline" size="icon" onClick={() => void loadWorkspace(selectedServiceRunId)}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {!selectedServiceRun ? (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700">
                Choose a service to see the run view.
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {selectedServiceRun.run.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {fmtDateTime(selectedServiceRun.run.serviceAt)} · {selectedServiceRun.run.durationMinutes} min
                      {selectedServiceRun.template?.name ? ` · ${selectedServiceRun.template.name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={getServiceRunBadgeClass(selectedServiceRun.run.status)}
                    >
                      {SERVICE_RUN_STATUS_LABELS[selectedServiceRun.run.status]}
                    </Badge>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {serviceAssignmentStats.confirmed}/{serviceAssignmentStats.total} confirmed
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Countdown
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                      {runBoardCountdownLabel}
                    </p>
                    {spotlightRunStep ? (
                      <>
                        <p className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                          {spotlightRunStep.title}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {fmtDateTime(spotlightRunStep.startAt)} · {spotlightRunStep.durationMinutes} min · {spotlightRunStep.ownerLabel}
                        </p>
                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                          {spotlightRunStep.detail}
                        </p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Coverage
                        </p>
                        <p className="text-sm text-slate-700 dark:text-slate-200">
                          {spotlightRunStep.coverageLabel}
                        </p>
                        {followingRunStep ? (
                          <p className="mt-3 text-xs text-slate-500">
                            Next: <span className="font-semibold text-slate-700 dark:text-slate-200">{followingRunStep.title}</span> · {fmtDateTime(followingRunStep.startAt)}
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

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => void handleGenerateAssignmentsForRun()}
                    disabled={!selectedServiceRunId || serviceRunGenerateSaving}
                  >
                    {serviceRunGenerateSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Reset seats
                  </Button>
                  <Button
                    onClick={() => void handleSendOffersForRun()}
                    disabled={!selectedServiceRunId || serviceRunOffersSending}
                  >
                    {serviceRunOffersSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Send offers
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleGenerateServiceRunRecap()}
                    disabled={!selectedServiceRunId || serviceRunRecapGenerating}
                  >
                    {serviceRunRecapGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Generate recap
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handleExportServiceRunPayroll()}
                    disabled={!selectedServiceRunId || serviceRunPayrollExporting}
                  >
                    {serviceRunPayrollExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Export payroll CSV
                  </Button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Post-service recap
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (selectedServiceRunId) {
                          void loadRecap(selectedServiceRunId);
                        }
                      }}
                      disabled={!selectedServiceRunId || serviceRunRecapLoading}
                    >
                      {serviceRunRecapLoading ? "Refreshing..." : "Refresh"}
                    </Button>
                  </div>
                  {serviceRunRecapLoading ? (
                    <div className="py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    </div>
                  ) : serviceRunRecap ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {serviceRunRecap.summary}
                      </p>
                      {serviceRunRecap.details ? (
                        <p className="whitespace-pre-line text-xs text-slate-600 dark:text-slate-300">
                          {serviceRunRecap.details}
                        </p>
                      ) : null}
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        Generated {fmtDateTime(serviceRunRecap.createdAt)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      No recap yet. Generate one after service or refresh if one already exists.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Role assignments
                    </p>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/app/settings/scheduling-matrix">Staff this service</Link>
                    </Button>
                  </div>

                  {serviceRunAssignmentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : serviceRunAssignments.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">
                      No seats have been generated yet for this service.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {serviceRunAssignments.map((row) => {
                        const hasAssignee = Boolean(
                          row.assignment.volunteerId || row.assignment.staffUserId
                        );
                        const canCheckIn =
                          hasAssignee &&
                          ["proposed", "offered", "confirmed"].includes(row.assignment.status);
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
                          <div key={row.assignment.id} className="flex items-center gap-3 px-4 py-3">
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
                              {canCheckIn ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 rounded-lg px-2 text-[11px]"
                                  disabled={Boolean(isStatusSaving)}
                                  onClick={() =>
                                    void handleUpdateAssignmentStatus(
                                      row.assignment.id,
                                      "checked_in"
                                    )
                                  }
                                >
                                  {isStatusSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Check in"}
                                </Button>
                              ) : null}
                              {canCheckOut ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 rounded-lg px-2 text-[11px]"
                                  disabled={Boolean(isStatusSaving)}
                                  onClick={() =>
                                    void handleUpdateAssignmentStatus(
                                      row.assignment.id,
                                      "checked_out"
                                    )
                                  }
                                >
                                  {isStatusSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Check out"}
                                </Button>
                              ) : null}
                              {canNoShow ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 rounded-lg px-2 text-[11px] text-rose-600 hover:text-rose-700"
                                  disabled={Boolean(isStatusSaving)}
                                  onClick={() =>
                                    void handleUpdateAssignmentStatus(row.assignment.id, "no_show")
                                  }
                                >
                                  No-show
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ServicesPage() {
  return <ServicesWorkspace />;
}
