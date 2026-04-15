"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useOrganization from "@/lib/organizations/useOrganization";
import {
  createAutomationWorkflow,
  evaluateAutomationEnrollment,
  getAutomationTemplates,
  getAutomationWorkflowAnalytics,
  getAutomationWorkflowVersions,
  getAutomationWorkflowRuns,
  getAutomationWorkflows,
  installAutomationTemplate,
  publishAutomationWorkflow,
  rollbackAutomationWorkflowVersion,
  setAutomationWorkflowStatus,
  triggerAutomationWorkflowRun,
  updateAutomationWorkflow,
} from "@/app/actions/automations";
import { getBroadcasts } from "@/app/actions/communications";
import {
  DEFAULT_AUTOMATION_COMPLIANCE_POLICY,
  type AutomationDefinition,
} from "@/lib/automations/types";
import {
  createBuilderStarterDefinition,
  normalizeAutomationDefinition,
} from "@/lib/automations/editor";
import { validateAutomationDefinition } from "@/lib/automations/validation";
import { AutomationWorkflowEditor } from "@/components/automations/AutomationWorkflowEditor";

type TemplateSummary = Awaited<ReturnType<typeof getAutomationTemplates>>[number];
type WorkflowRow = Awaited<ReturnType<typeof getAutomationWorkflows>>[number];
type WorkflowVersionRow = Awaited<ReturnType<typeof getAutomationWorkflowVersions>>[number];
type WorkflowRunRow = Awaited<ReturnType<typeof getAutomationWorkflowRuns>>[number];
type BroadcastRow = Awaited<ReturnType<typeof getBroadcasts>>[number];
type WorkflowAnalyticsSnapshot = Awaited<
  ReturnType<typeof getAutomationWorkflowAnalytics>
>;

type AutomationModeTab = "template" | "builder";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  paused: "Paused",
  archived: "Archived",
};

const STATUS_BADGES: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  published: "bg-emerald-100 text-emerald-800",
  paused: "bg-slate-200 text-slate-700",
  archived: "bg-slate-100 text-slate-500",
};

const MODE_TABS: Array<{ id: AutomationModeTab; label: string; description: string }> = [
  {
    id: "template",
    label: "Template Mode",
    description: "Install prebuilt automations with one click.",
  },
  {
    id: "builder",
    label: "Builder Mode",
    description: "Design custom journeys with waits, branches, and publish controls.",
  },
];

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function AutomationsPage() {
  const { organization } = useOrganization();
  const organizationId = organization?.id;

  const [activeTab, setActiveTab] = useState<AutomationModeTab>("template");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [workflowVersions, setWorkflowVersions] = useState<WorkflowVersionRow[]>([]);
  const [runFeed, setRunFeed] = useState<WorkflowRunRow[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [workflowAnalytics, setWorkflowAnalytics] =
    useState<WorkflowAnalyticsSnapshot | null>(null);

  const [selectedBuilderWorkflowId, setSelectedBuilderWorkflowId] = useState<string | null>(
    null
  );
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftTriggerEvent, setDraftTriggerEvent] = useState("");
  const [testContactId, setTestContactId] = useState("");
  const [enrollmentPreview, setEnrollmentPreview] = useState<{
    allowed: boolean;
    reason?: string;
    retryAt?: Date | string | null;
    runsToday: number;
    hasOptOut: boolean;
  } | null>(null);
  const [draftDefinition, setDraftDefinition] = useState<AutomationDefinition>(
    createBuilderStarterDefinition()
  );
  const [draftPolicy, setDraftPolicy] = useState(DEFAULT_AUTOMATION_COMPLIANCE_POLICY);
  const builderEditorRef = useRef<HTMLDivElement | null>(null);

  const refreshData = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const [templateRows, workflowRows, runRows, broadcastRows, analyticsSnapshot] =
        await Promise.all([
        getAutomationTemplates(),
        getAutomationWorkflows(organizationId),
        getAutomationWorkflowRuns({ organizationId, limit: 20 }),
        getBroadcasts(organizationId),
        getAutomationWorkflowAnalytics({
          organizationId,
          days: 30,
          limitWorkflows: 50,
        }),
      ]);
      setTemplates(templateRows);
      setWorkflows(workflowRows);
      setRunFeed(runRows);
      setBroadcasts(broadcastRows);
      setWorkflowAnalytics(analyticsSnapshot);
    } catch (error) {
      console.error("Failed to load automations:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load automations");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const refreshBuilderVersions = useCallback(
    async (workflowId: string | null, limit = 15) => {
      if (!organizationId || !workflowId) {
        setWorkflowVersions([]);
        return;
      }

      try {
        const versions = await getAutomationWorkflowVersions({
          organizationId,
          workflowId,
          limit,
        });
        setWorkflowVersions(versions);
      } catch (error) {
        console.error("Failed to load workflow versions:", error);
        toast.error(error instanceof Error ? error.message : "Failed to load workflow versions");
      }
    },
    [organizationId]
  );

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    void refreshBuilderVersions(selectedBuilderWorkflowId);
  }, [selectedBuilderWorkflowId, refreshBuilderVersions]);

  const templateWorkflows = useMemo(
    () => workflows.filter((workflow) => workflow.mode === "template" && workflow.status !== "archived"),
    [workflows]
  );
  const builderWorkflows = useMemo(
    () => workflows.filter((workflow) => workflow.mode === "builder" && workflow.status !== "archived"),
    [workflows]
  );

  const selectedBuilderWorkflow = useMemo(
    () => builderWorkflows.find((workflow) => workflow.id === selectedBuilderWorkflowId) ?? null,
    [builderWorkflows, selectedBuilderWorkflowId]
  );

  const installedTemplateKeys = useMemo(
    () => new Set(templateWorkflows.map((workflow) => workflow.templateKey).filter(Boolean)),
    [templateWorkflows]
  );

  const builderValidationErrors = useMemo(
    () => validateAutomationDefinition(draftDefinition),
    [draftDefinition]
  );

  useEffect(() => {
    if (!builderWorkflows.length) {
      setSelectedBuilderWorkflowId(null);
      return;
    }

    if (!selectedBuilderWorkflowId) {
      setSelectedBuilderWorkflowId(builderWorkflows[0].id);
      return;
    }

    if (!builderWorkflows.some((workflow) => workflow.id === selectedBuilderWorkflowId)) {
      setSelectedBuilderWorkflowId(builderWorkflows[0].id);
    }
  }, [builderWorkflows, selectedBuilderWorkflowId]);

  useEffect(() => {
    if (!selectedBuilderWorkflow) {
      setDraftName("");
      setDraftDescription("");
      setDraftTriggerEvent("");
      setDraftDefinition(createBuilderStarterDefinition());
      setDraftPolicy(DEFAULT_AUTOMATION_COMPLIANCE_POLICY);
      return;
    }

    setDraftName(selectedBuilderWorkflow.name);
    setDraftDescription(selectedBuilderWorkflow.description ?? "");
    setDraftTriggerEvent(selectedBuilderWorkflow.triggerEvent ?? "");
    setDraftDefinition(normalizeAutomationDefinition(selectedBuilderWorkflow.definitionJson));
    setDraftPolicy({
      quietHoursEnabled: Boolean(selectedBuilderWorkflow.quietHoursEnabled),
      quietHoursStart: selectedBuilderWorkflow.quietHoursStart ?? "21:00",
      quietHoursEnd: selectedBuilderWorkflow.quietHoursEnd ?? "08:00",
      dailySendCap: Number(selectedBuilderWorkflow.dailySendCap ?? 250),
      respectOptOut: Boolean(selectedBuilderWorkflow.respectOptOut),
      enrollmentMode: selectedBuilderWorkflow.enrollmentMode ?? "once_per_contact",
      reentryCooldownMinutes: Number(selectedBuilderWorkflow.reentryCooldownMinutes ?? 10080),
    });
    setEnrollmentPreview(null);
  }, [selectedBuilderWorkflow]);

  useEffect(() => {
    if (activeTab !== "builder" || !selectedBuilderWorkflow) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      builderEditorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, selectedBuilderWorkflow]);

  const handleInstallTemplate = useCallback(
    async (templateKey: string) => {
      if (!organizationId) return;
      setBusyKey(`install:${templateKey}`);
      try {
        const result = await installAutomationTemplate({ organizationId, templateKey });
        if (result.alreadyInstalled) {
          toast.message("Template already installed", {
            description: "A runnable workflow already exists for this template.",
          });
        } else {
          toast.success("Template installed", {
            description: `${result.workflow.name} is now published and ready to run.`,
          });
        }
        await refreshData();
      } catch (error) {
        console.error("Failed to install template:", error);
        toast.error(error instanceof Error ? error.message : "Failed to install template");
      } finally {
        setBusyKey(null);
      }
    },
    [organizationId, refreshData]
  );

  const handleCreateBuilderWorkflow = useCallback(async () => {
    if (!organizationId) return;
    setBusyKey("create-builder");

    const nextNumber = builderWorkflows.length + 1;
    const name = `Custom Workflow ${nextNumber}`;

    try {
      const created = await createAutomationWorkflow({
        organizationId,
        name,
        description: "Custom builder workflow",
        mode: "builder",
        definition: createBuilderStarterDefinition(),
      });
      toast.success("Builder workflow created", {
        description: "Start editing steps, then publish when validation is clean.",
      });
      await refreshData();
      setSelectedBuilderWorkflowId(created.id);
      setActiveTab("builder");
    } catch (error) {
      console.error("Failed to create workflow:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create workflow");
    } finally {
      setBusyKey(null);
    }
  }, [organizationId, builderWorkflows.length, refreshData]);

  const runEnrollmentCheck = useCallback(async () => {
    if (!organizationId || !selectedBuilderWorkflowId) return;
    setBusyKey("check-enrollment");
    try {
      const result = await evaluateAutomationEnrollment({
        organizationId,
        workflowId: selectedBuilderWorkflowId,
        contactId: testContactId.trim() || undefined,
      });
      setEnrollmentPreview({
        allowed: result.allowed,
        reason: result.reason,
        retryAt: result.retryAt ?? null,
        runsToday: result.runsToday,
        hasOptOut: result.hasOptOut,
      });
      if (result.allowed) {
        toast.success("Enrollment check passed");
      } else {
        toast.message("Enrollment blocked", {
          description: result.reason ?? "Workflow rules blocked this enrollment.",
        });
      }
    } catch (error) {
      console.error("Failed to evaluate enrollment:", error);
      toast.error(error instanceof Error ? error.message : "Failed to evaluate enrollment");
    } finally {
      setBusyKey(null);
    }
  }, [organizationId, selectedBuilderWorkflowId, testContactId]);

  const triggerWorkflowRun = useCallback(async () => {
    if (!organizationId || !selectedBuilderWorkflowId) return;
    setBusyKey("run-workflow");
    try {
      const result = await triggerAutomationWorkflowRun({
        organizationId,
        workflowId: selectedBuilderWorkflowId,
        contactId: testContactId.trim() || undefined,
        allowDraft: true,
        metadata: { source: "builder_ui_test_run" },
      });

      if (result.skipped) {
        toast.message("Workflow run skipped", {
          description: result.reason ?? "Policy rules skipped this run.",
        });
      } else {
        toast.success(`Workflow run ${result.run.status}`);
      }

      await refreshData();
    } catch (error) {
      console.error("Failed to trigger workflow:", error);
      toast.error(error instanceof Error ? error.message : "Failed to trigger workflow");
    } finally {
      setBusyKey(null);
    }
  }, [organizationId, selectedBuilderWorkflowId, testContactId, refreshData]);

  const saveBuilderDraft = useCallback(async () => {
    if (!organizationId || !selectedBuilderWorkflowId) return;
    setBusyKey("save-builder");

    try {
      const updated = await updateAutomationWorkflow({
        organizationId,
        workflowId: selectedBuilderWorkflowId,
        name: draftName,
        description: draftDescription || null,
        triggerEvent: draftTriggerEvent || null,
        definition: draftDefinition,
        policy: draftPolicy,
      });

      if ((updated.validationErrors as string[]).length > 0) {
        toast.message("Draft saved with validation warnings", {
          description: "Resolve validation errors before publishing.",
        });
      } else {
        toast.success("Draft saved");
      }

      await refreshData();
      await refreshBuilderVersions(selectedBuilderWorkflowId);
    } catch (error) {
      console.error("Failed to save builder workflow:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save workflow draft");
    } finally {
      setBusyKey(null);
    }
  }, [
    organizationId,
    selectedBuilderWorkflowId,
    draftName,
    draftDescription,
    draftTriggerEvent,
    draftDefinition,
    draftPolicy,
    refreshData,
    refreshBuilderVersions,
  ]);

  const publishBuilder = useCallback(async () => {
    if (!organizationId || !selectedBuilderWorkflowId) return;

    if (builderValidationErrors.length > 0) {
      toast.error("Workflow is not publishable", {
        description: "Resolve validation errors before publishing.",
      });
      return;
    }

    setBusyKey("publish-builder");
    try {
      await updateAutomationWorkflow({
        organizationId,
        workflowId: selectedBuilderWorkflowId,
        name: draftName,
        description: draftDescription || null,
        triggerEvent: draftTriggerEvent || null,
        definition: draftDefinition,
        policy: draftPolicy,
      });

      await publishAutomationWorkflow({
        organizationId,
        workflowId: selectedBuilderWorkflowId,
      });

      toast.success("Workflow published");
      await refreshData();
      await refreshBuilderVersions(selectedBuilderWorkflowId);
    } catch (error) {
      console.error("Failed to publish workflow:", error);
      toast.error(error instanceof Error ? error.message : "Failed to publish workflow");
    } finally {
      setBusyKey(null);
    }
  }, [
    organizationId,
    selectedBuilderWorkflowId,
    builderValidationErrors.length,
    draftName,
    draftDescription,
    draftTriggerEvent,
    draftDefinition,
    draftPolicy,
    refreshData,
    refreshBuilderVersions,
  ]);

  const updateWorkflowStatus = useCallback(
    async (workflowId: string, status: "draft" | "published" | "paused" | "archived") => {
      if (!organizationId) return;
      setBusyKey(`status:${workflowId}:${status}`);
      try {
        await setAutomationWorkflowStatus({ organizationId, workflowId, status });
        toast.success(`Workflow ${STATUS_LABELS[status]?.toLowerCase() ?? status}`);
        await refreshData();
      } catch (error) {
        console.error("Failed to update workflow status:", error);
        toast.error(error instanceof Error ? error.message : "Failed to update status");
      } finally {
        setBusyKey(null);
      }
    },
    [organizationId, refreshData]
  );

  const rollbackBuilderVersion = useCallback(
    async (versionId: string, versionNumber: number) => {
      if (!organizationId || !selectedBuilderWorkflowId) return;

      setBusyKey(`rollback:${versionId}`);
      try {
        await rollbackAutomationWorkflowVersion({
          organizationId,
          workflowId: selectedBuilderWorkflowId,
          versionId,
        });
        toast.success(`Restored version v${versionNumber} as draft`);
        await refreshData();
        await refreshBuilderVersions(selectedBuilderWorkflowId);
      } catch (error) {
        console.error("Failed to rollback workflow version:", error);
        toast.error(error instanceof Error ? error.message : "Failed to rollback version");
      } finally {
        setBusyKey(null);
      }
    },
    [organizationId, selectedBuilderWorkflowId, refreshData, refreshBuilderVersions]
  );

  if (!organizationId) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Select an organization to manage automations.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Automations</h1>
        <p className="text-sm text-slate-600 max-w-3xl">
          Sequence platform for launch workflows. Install built-in templates or design custom
          journeys with validation, publish controls, and test runs.
        </p>
      </header>

      <section className="flex flex-wrap gap-3">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`rounded-lg border px-4 py-2 text-left transition ${
              activeTab === tab.id
                ? "border-lime-500 bg-lime-50 text-lime-900"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <p className="text-sm font-semibold">{tab.label}</p>
            <p className="text-xs text-slate-500">{tab.description}</p>
          </button>
        ))}

        <button
          type="button"
          className="ml-auto rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          onClick={handleCreateBuilderWorkflow}
          disabled={busyKey === "create-builder"}
        >
          {busyKey === "create-builder" ? "Creating..." : "New Builder Workflow"}
        </button>
      </section>

      <section className="rounded-xl border border-sky-200 bg-sky-50 p-4">
        <p className="text-sm font-semibold text-sky-900">How to build a workflow here</p>
        <div className="mt-2 grid gap-2 text-xs text-sky-900 md:grid-cols-3">
          <div className="rounded-lg border border-sky-100 bg-white/80 px-3 py-2">
            Open <span className="font-semibold">Builder Mode</span> to create workflows from
            scratch.
          </div>
          <div className="rounded-lg border border-sky-100 bg-white/80 px-3 py-2">
            Click <span className="font-semibold">New Builder Workflow</span>, then choose a
            trigger and add steps in order.
          </div>
          <div className="rounded-lg border border-sky-100 bg-white/80 px-3 py-2">
            Save the draft, then publish and use the test runner at the bottom to execute it.
          </div>
        </div>
      </section>

      {workflowAnalytics ? (
        <section className="grid gap-3 md:grid-cols-4">
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Runs (30d)</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {workflowAnalytics.totals.totalRuns}
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Reply Rate</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {workflowAnalytics.totals.replyRatePercent}%
            </p>
            <p className="text-xs text-slate-500">
              {workflowAnalytics.totals.replyCount} reply signals
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Completion Rate</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {workflowAnalytics.totals.completionRatePercent}%
            </p>
            <p className="text-xs text-slate-500">
              {workflowAnalytics.totals.completionCount} completed runs
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Conversion Rate</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {workflowAnalytics.totals.conversionRatePercent}%
            </p>
            <p className="text-xs text-slate-500">
              {workflowAnalytics.totals.conversionCount} conversion signals
            </p>
          </article>
        </section>
      ) : null}

      {workflowAnalytics && workflowAnalytics.workflows.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Workflow Analytics (30d)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Reply/completion/conversion rates by workflow.
          </p>
          <div className="mt-3 space-y-2">
            {workflowAnalytics.workflows.slice(0, 8).map((row) => (
              <div
                key={row.workflow.id}
                className="grid gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs md:grid-cols-6"
              >
                <div className="md:col-span-2">
                  <p className="font-semibold text-slate-800">{row.workflow.name}</p>
                  <p className="text-slate-500">
                    {row.workflow.status} • {row.workflow.mode}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Runs</p>
                  <p className="font-semibold text-slate-800">{row.analytics.totalRuns}</p>
                </div>
                <div>
                  <p className="text-slate-500">Reply</p>
                  <p className="font-semibold text-slate-800">
                    {row.analytics.replyRatePercent}%
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Completion</p>
                  <p className="font-semibold text-slate-800">
                    {row.analytics.completionRatePercent}%
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Conversion</p>
                  <p className="font-semibold text-slate-800">
                    {row.analytics.conversionRatePercent}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Loading automation workspace...
        </div>
      ) : activeTab === "template" ? (
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-900">Automation Library</h2>
              <p className="mt-1 text-xs text-slate-500">
                One-click install creates a runnable, published workflow using safe defaults.
              </p>
              <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Need something custom instead of a starter? Switch to
                <span className="font-semibold text-slate-900"> Builder Mode</span> and use
                <span className="font-semibold text-slate-900"> New Builder Workflow</span>.
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {templates.map((template) => {
                const isInstalled = installedTemplateKeys.has(template.key);
                const actionBusy = busyKey === `install:${template.key}`;

                return (
                  <article key={template.key} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        {template.category}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {template.source === "managed" ? "Managed" : "System"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {STATUS_LABELS[template.status] ?? template.status}
                        </span>
                      </div>
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-slate-900">{template.name}</h3>
                    <p className="mt-2 text-xs text-slate-600">{template.description}</p>

                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                      <p>
                        <span className="font-medium text-slate-700">Trigger:</span> {template.triggerEvent}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Steps:</span> {template.nodeCount}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Channels:</span>{" "}
                        {template.recommendedChannels.join(", ")}
                      </p>
                    </div>

                    <button
                      type="button"
                      className={`mt-4 w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        isInstalled
                          ? "bg-slate-100 text-slate-500"
                          : "bg-lime-600 text-white hover:bg-lime-500"
                      }`}
                      onClick={() => handleInstallTemplate(template.key)}
                      disabled={actionBusy || isInstalled}
                    >
                      {actionBusy ? "Installing..." : isInstalled ? "Installed" : "Install"}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Installed Template Workflows</h2>
            <p className="mt-1 text-xs text-slate-500">Published template instances for this organization.</p>

            {templateWorkflows.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-4 text-xs text-slate-500">
                No templates installed yet.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {templateWorkflows.map((workflow) => {
                  const pauseBusy = busyKey === `status:${workflow.id}:paused`;
                  const publishBusy = busyKey === `status:${workflow.id}:published`;

                  return (
                    <div key={workflow.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{workflow.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Trigger: {workflow.triggerEvent ?? "manual"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            STATUS_BADGES[workflow.status] ?? "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {STATUS_LABELS[workflow.status] ?? workflow.status}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>Updated {formatDateTime(workflow.updatedAt)}</span>
                        <span>•</span>
                        <span>
                          Runs: {workflow.runStats.completed + workflow.runStats.failed + workflow.runStats.running}
                        </span>
                      </div>

                      <div className="mt-3 flex gap-2">
                        {workflow.status === "published" ? (
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={() => updateWorkflowStatus(workflow.id, "paused")}
                            disabled={pauseBusy}
                          >
                            {pauseBusy ? "Pausing..." : "Pause"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="rounded-md border border-lime-600 px-3 py-1.5 text-xs font-semibold text-lime-700 hover:bg-lime-50"
                            onClick={() => updateWorkflowStatus(workflow.id, "published")}
                            disabled={publishBusy}
                          >
                            {publishBusy ? "Publishing..." : "Publish"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Builder Workflows</h2>
            <p className="mt-1 text-xs text-slate-500">
              Build custom follow-up journeys and publish after validation.
            </p>

            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              onClick={handleCreateBuilderWorkflow}
              disabled={busyKey === "create-builder"}
            >
              {busyKey === "create-builder" ? "Creating..." : "Create Custom Workflow"}
            </button>

            <div className="mt-4 space-y-2">
              {builderWorkflows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500 space-y-2">
                  <p className="font-semibold text-slate-700">No builder workflows yet.</p>
                  <p>Start with a blank custom workflow, then set the trigger and add steps.</p>
                </div>
              ) : (
                builderWorkflows.map((workflow) => {
                  const isSelected = selectedBuilderWorkflowId === workflow.id;

                  return (
                    <button
                      key={workflow.id}
                      type="button"
                      className={`w-full rounded-lg border px-3 py-2 text-left ${
                        isSelected
                          ? "border-lime-500 bg-lime-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                      onClick={() => setSelectedBuilderWorkflowId(workflow.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{workflow.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {STATUS_LABELS[workflow.status] ?? workflow.status}
                          </p>
                        </div>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {isSelected ? "Editing" : "Open Editor"}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {builderWorkflows.length > 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Select a workflow to edit it. On smaller screens, the editor opens below this list.
              </div>
            ) : null}
          </aside>

          <div className="space-y-4">
            {!selectedBuilderWorkflow ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
                <p className="font-semibold text-slate-800">Create your first custom workflow</p>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  <p>1. Click <span className="font-semibold text-slate-900">Create Custom Workflow</span>.</p>
                  <p>2. Choose a common trigger or enter your own event key.</p>
                  <p>3. Add messages, waits, conditions, tasks, and a stop step.</p>
                  <p>4. Save, publish, and use the test runner to execute it.</p>
                </div>
                <button
                  type="button"
                  className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  onClick={handleCreateBuilderWorkflow}
                  disabled={busyKey === "create-builder"}
                >
                  {busyKey === "create-builder" ? "Creating..." : "Create Custom Workflow"}
                </button>
              </div>
            ) : (
              <>
                <div ref={builderEditorRef} className="space-y-4">
                  <div className="rounded-xl border border-lime-200 bg-lime-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-lime-950">
                          Editing: {selectedBuilderWorkflow.name}
                        </p>
                        <p className="mt-1 text-xs text-lime-900">
                          Update the trigger, edit the outline steps below, then save or publish.
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          STATUS_BADGES[selectedBuilderWorkflow.status] ??
                          "bg-white text-slate-700"
                        }`}
                      >
                        {STATUS_LABELS[selectedBuilderWorkflow.status] ??
                          selectedBuilderWorkflow.status}
                      </span>
                    </div>
                  </div>

                  <AutomationWorkflowEditor
                    editorId={selectedBuilderWorkflow.id}
                    name={draftName}
                    description={draftDescription}
                    triggerEvent={draftTriggerEvent}
                    definition={draftDefinition}
                    validationErrors={builderValidationErrors}
                    onNameChange={setDraftName}
                    onDescriptionChange={setDraftDescription}
                    onTriggerEventChange={setDraftTriggerEvent}
                    onDefinitionChange={setDraftDefinition}
                    policy={draftPolicy}
                    onPolicyChange={setDraftPolicy}
                    broadcastOptions={broadcasts.map((broadcast) => ({
                      id: broadcast.id,
                      title: broadcast.title,
                    }))}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={saveBuilderDraft}
                    disabled={busyKey === "save-builder"}
                  >
                    {busyKey === "save-builder" ? "Saving..." : "Save Draft"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-lime-600 px-3 py-2 text-xs font-semibold text-white hover:bg-lime-500 disabled:bg-lime-300"
                    onClick={publishBuilder}
                    disabled={busyKey === "publish-builder" || builderValidationErrors.length > 0}
                  >
                    {busyKey === "publish-builder" ? "Publishing..." : "Publish"}
                  </button>
                  {selectedBuilderWorkflow.status === "published" ? (
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={() => updateWorkflowStatus(selectedBuilderWorkflow.id, "paused")}
                    >
                      Pause
                    </button>
                  ) : null}
                </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-700">Version History</p>
                      <span className="text-[11px] text-slate-500">
                        {workflowVersions.length} snapshots
                      </span>
                    </div>

                    {workflowVersions.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No published snapshots yet. Publish this workflow to create version history.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {workflowVersions.map((version) => {
                          const rollbackBusy = busyKey === `rollback:${version.id}`;

                          return (
                            <div
                              key={version.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
                            >
                              <div className="text-xs text-slate-600">
                                <p className="font-semibold text-slate-800">
                                  v{version.versionNumber}
                                </p>
                                <p>Published {formatDateTime(version.createdAt)}</p>
                                <p className="truncate">
                                  Trigger: {version.triggerEvent ?? "manual"}
                                </p>
                              </div>

                              <button
                                type="button"
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                onClick={() =>
                                  rollbackBuilderVersion(version.id, version.versionNumber)
                                }
                                disabled={rollbackBusy}
                              >
                                {rollbackBusy ? "Restoring..." : "Restore as Draft"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                    <p className="text-xs font-semibold text-slate-700">
                      Enrollment + Broadcast Test Runner
                    </p>
                    <label className="block space-y-1 text-xs text-slate-600">
                      Contact ID (optional)
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                        value={testContactId}
                        onChange={(event) => setTestContactId(event.target.value)}
                        placeholder="church_contact.id"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white"
                        onClick={runEnrollmentCheck}
                        disabled={busyKey === "check-enrollment"}
                      >
                        {busyKey === "check-enrollment" ? "Checking..." : "Check Enrollment"}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-lime-600 bg-white px-3 py-1.5 text-xs font-semibold text-lime-700 hover:bg-lime-50"
                        onClick={triggerWorkflowRun}
                        disabled={busyKey === "run-workflow"}
                      >
                        {busyKey === "run-workflow" ? "Running..." : "Run Workflow"}
                      </button>
                    </div>
                    {enrollmentPreview ? (
                      <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                        <p>
                          <span className="font-semibold text-slate-800">Allowed:</span>{" "}
                          {enrollmentPreview.allowed ? "Yes" : "No"}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-800">Reason:</span>{" "}
                          {enrollmentPreview.reason ?? "eligible"}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-800">Runs today:</span>{" "}
                          {enrollmentPreview.runsToday}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-800">Opt-out:</span>{" "}
                          {enrollmentPreview.hasOptOut ? "Yes" : "No"}
                        </p>
                        <p>
                          <span className="font-semibold text-slate-800">Retry at:</span>{" "}
                          {formatDateTime(enrollmentPreview.retryAt)}
                        </p>
                      </div>
                    ) : null}
                  </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Run Log Feed</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Per-person workflow run log foundation for execution tracking.
                  </p>

                  {runFeed.length === 0 ? (
                    <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                      No workflow runs logged yet.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {runFeed.slice(0, 10).map((row) => (
                        <div
                          key={row.run.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs"
                        >
                          <div>
                            <p className="font-semibold text-slate-800">{row.workflow.name}</p>
                            <p className="text-slate-500">
                              {row.run.status} • entered {formatDateTime(row.run.enteredAt)}
                            </p>
                          </div>
                          {row.run.lastError ? (
                            <span className="max-w-xs truncate text-red-600">{row.run.lastError}</span>
                          ) : (
                            <span className="text-slate-400">ok</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
