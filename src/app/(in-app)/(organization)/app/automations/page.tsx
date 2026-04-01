"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  AUTOMATION_NODE_TYPES,
  DEFAULT_AUTOMATION_COMPLIANCE_POLICY,
  type AutomationDefinition,
  type AutomationNode,
  type AutomationNodeType,
} from "@/lib/automations/types";
import { createBuilderStarterDefinition } from "@/lib/automations/templates";
import { validateAutomationDefinition } from "@/lib/automations/validation";

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
    description: "Design custom trigger-delay-condition-action-stop flows.",
  },
];

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function normalizeDefinition(value: unknown): AutomationDefinition {
  const fallback = createBuilderStarterDefinition();
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const raw = value as Partial<AutomationDefinition>;
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) {
    return fallback;
  }

  const nodes: AutomationNode[] = raw.nodes
    .filter((node): node is AutomationNode => {
      return Boolean(node && typeof node === "object" && node.id && node.type && node.label);
    })
    .map((node) => ({
      id: node.id,
      type: AUTOMATION_NODE_TYPES.includes(node.type) ? node.type : "action",
      label: node.label,
      description: node.description ?? null,
      config: node.config ?? {},
      nextIds: Array.isArray(node.nextIds)
        ? Array.from(new Set(node.nextIds.filter((nextId) => typeof nextId === "string")))
        : [],
    }));

  if (nodes.length === 0) {
    return fallback;
  }

  const triggerNode = nodes.find((node) => node.type === "trigger");
  return {
    version: Number(raw.version ?? 1),
    startNodeId: raw.startNodeId ?? triggerNode?.id ?? nodes[0]?.id,
    nodes,
  };
}

function nextNodeId(type: AutomationNodeType) {
  return `${type}_${Math.random().toString(36).slice(2, 9)}`;
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
    setDraftDefinition(normalizeDefinition(selectedBuilderWorkflow.definitionJson));
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
        description: "Start editing nodes, then publish when validation is clean.",
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

  const updateNode = useCallback((nodeId: string, patch: Partial<AutomationNode>) => {
    setDraftDefinition((current) => ({
      ...current,
      nodes: current.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              ...patch,
            }
          : node
      ),
    }));
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setDraftDefinition((current) => {
      const remaining = current.nodes.filter((node) => node.id !== nodeId);
      const patched = remaining.map((node) => ({
        ...node,
        nextIds: (node.nextIds ?? []).filter((nextId) => nextId !== nodeId),
      }));
      const fallbackStart = patched.find((node) => node.type === "trigger")?.id ?? patched[0]?.id;
      return {
        ...current,
        startNodeId: current.startNodeId === nodeId ? fallbackStart : current.startNodeId,
        nodes: patched,
      };
    });
  }, []);

  const addNode = useCallback((type: AutomationNodeType) => {
    const node: AutomationNode = {
      id: nextNodeId(type),
      type,
      label:
        type === "trigger"
          ? "New trigger"
          : type === "delay"
            ? "Delay"
            : type === "condition"
              ? "Condition"
              : type === "action"
                ? "Action"
                : "Stop",
      nextIds: [],
      config: {},
    };

    setDraftDefinition((current) => {
      const hasTrigger = current.nodes.some((existing) => existing.type === "trigger");
      if (type === "trigger" && hasTrigger) {
        toast.error("Only one trigger node is allowed");
        return current;
      }

      const nodes = [...current.nodes, node];
      return {
        ...current,
        startNodeId: current.startNodeId ?? (type === "trigger" ? node.id : current.startNodeId),
        nodes,
      };
    });
  }, []);

  const updateNodeConfig = useCallback(
    (node: AutomationNode, patch: Record<string, unknown>) => {
      const nextConfig = {
        ...(node.config ?? {}),
        ...patch,
      };
      updateNode(node.id, { config: nextConfig });
    },
    [updateNode]
  );

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
          node flows with validation and publish controls.
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
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {templates.map((template) => {
                const isInstalled = installedTemplateKeys.has(template.key);
                const actionBusy = busyKey === `install:${template.key}`;

                return (
                  <article key={template.key} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase text-slate-500">{template.category}</p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-900">{template.name}</h3>
                    <p className="mt-2 text-xs text-slate-600">{template.description}</p>

                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                      <p>
                        <span className="font-medium text-slate-700">Trigger:</span> {template.triggerEvent}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Nodes:</span> {template.nodeCount}
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
              Build custom node graphs and publish after validation.
            </p>

            <div className="mt-4 space-y-2">
              {builderWorkflows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                  No builder workflows yet.
                </div>
              ) : (
                builderWorkflows.map((workflow) => (
                  <button
                    key={workflow.id}
                    type="button"
                    className={`w-full rounded-lg border px-3 py-2 text-left ${
                      selectedBuilderWorkflowId === workflow.id
                        ? "border-lime-500 bg-lime-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    onClick={() => setSelectedBuilderWorkflowId(workflow.id)}
                  >
                    <p className="text-sm font-semibold text-slate-900">{workflow.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {STATUS_LABELS[workflow.status] ?? workflow.status}
                    </p>
                  </button>
                ))
              )}
            </div>
          </aside>

          <div className="space-y-4">
            {!selectedBuilderWorkflow ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500">
                Create a builder workflow to start editing nodes.
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-1 text-xs text-slate-600">
                      Workflow name
                      <input
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                      />
                    </label>
                    <label className="space-y-1 text-xs text-slate-600">
                      Trigger event key
                      <input
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        value={draftTriggerEvent}
                        onChange={(event) => setDraftTriggerEvent(event.target.value)}
                        placeholder="example: contacts.created.v1"
                      />
                    </label>
                  </div>

                  <label className="space-y-1 text-xs text-slate-600 block">
                    Description
                    <textarea
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={draftDescription}
                      onChange={(event) => setDraftDescription(event.target.value)}
                      rows={2}
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-7">
                    <label className="text-xs text-slate-600 space-y-1">
                      Enrollment mode
                      <select
                        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                        value={draftPolicy.enrollmentMode}
                        onChange={(event) =>
                          setDraftPolicy((current) => ({
                            ...current,
                            enrollmentMode: event.target.value as
                              | "every_trigger"
                              | "once_per_contact"
                              | "cooldown",
                          }))
                        }
                      >
                        <option value="every_trigger">Every trigger</option>
                        <option value="once_per_contact">Once per contact</option>
                        <option value="cooldown">Cooldown re-entry</option>
                      </select>
                    </label>
                    <label className="text-xs text-slate-600 space-y-1">
                      Cooldown (minutes)
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                        type="number"
                        min={1}
                        value={draftPolicy.reentryCooldownMinutes}
                        onChange={(event) =>
                          setDraftPolicy((current) => ({
                            ...current,
                            reentryCooldownMinutes: Number(event.target.value || 1),
                          }))
                        }
                      />
                    </label>
                    <label className="text-xs text-slate-600 space-y-1">
                      Quiet hours
                      <select
                        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                        value={draftPolicy.quietHoursEnabled ? "on" : "off"}
                        onChange={(event) =>
                          setDraftPolicy((current) => ({
                            ...current,
                            quietHoursEnabled: event.target.value === "on",
                          }))
                        }
                      >
                        <option value="on">Enabled</option>
                        <option value="off">Disabled</option>
                      </select>
                    </label>
                    <label className="text-xs text-slate-600 space-y-1">
                      Quiet start
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                        value={draftPolicy.quietHoursStart}
                        onChange={(event) =>
                          setDraftPolicy((current) => ({
                            ...current,
                            quietHoursStart: event.target.value,
                          }))
                        }
                        placeholder="21:00"
                      />
                    </label>
                    <label className="text-xs text-slate-600 space-y-1">
                      Quiet end
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                        value={draftPolicy.quietHoursEnd}
                        onChange={(event) =>
                          setDraftPolicy((current) => ({
                            ...current,
                            quietHoursEnd: event.target.value,
                          }))
                        }
                        placeholder="08:00"
                      />
                    </label>
                    <label className="text-xs text-slate-600 space-y-1">
                      Daily send cap
                      <input
                        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                        type="number"
                        min={1}
                        value={draftPolicy.dailySendCap}
                        onChange={(event) =>
                          setDraftPolicy((current) => ({
                            ...current,
                            dailySendCap: Number(event.target.value || 1),
                          }))
                        }
                      />
                    </label>
                    <label className="text-xs text-slate-600 space-y-1">
                      Respect opt-out
                      <select
                        className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                        value={draftPolicy.respectOptOut ? "yes" : "no"}
                        onChange={(event) =>
                          setDraftPolicy((current) => ({
                            ...current,
                            respectOptOut: event.target.value === "yes",
                          }))
                        }
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">Node Editor</h3>
                    <div className="flex flex-wrap gap-2">
                      {AUTOMATION_NODE_TYPES.map((nodeType) => (
                        <button
                          key={nodeType}
                          type="button"
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() => addNode(nodeType)}
                        >
                          + {nodeType}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {draftDefinition.nodes.map((node) => {
                      const actionType = String(
                        (node.config as Record<string, unknown> | undefined)?.actionType ??
                          "generic"
                      );
                      const selectedBroadcastId = String(
                        (node.config as Record<string, unknown> | undefined)?.broadcastId ?? ""
                      );
                      return (
                      <article key={node.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-slate-700">
                            {node.type}
                          </span>
                          <button
                            type="button"
                            className="text-xs font-semibold text-red-600 disabled:text-slate-400"
                            onClick={() => deleteNode(node.id)}
                            disabled={node.type === "trigger" && draftDefinition.nodes.filter((item) => item.type === "trigger").length === 1}
                          >
                            Remove
                          </button>
                        </div>

                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <label className="space-y-1 text-xs text-slate-600">
                            Label
                            <input
                              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                              value={node.label}
                              onChange={(event) =>
                                updateNode(node.id, {
                                  label: event.target.value,
                                })
                              }
                            />
                          </label>

                          <label className="space-y-1 text-xs text-slate-600">
                            Description
                            <input
                              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                              value={node.description ?? ""}
                              onChange={(event) =>
                                updateNode(node.id, {
                                  description: event.target.value,
                                })
                              }
                            />
                          </label>
                        </div>

                        {node.type === "action" ? (
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <label className="space-y-1 text-xs text-slate-600">
                              Action type
                              <select
                                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                                value={actionType}
                                onChange={(event) =>
                                  updateNodeConfig(node, {
                                    actionType: event.target.value,
                                    ...(event.target.value !== "broadcast_send"
                                      ? { broadcastId: null }
                                      : {}),
                                  })
                                }
                              >
                                <option value="generic">Generic action</option>
                                <option value="send_sms">Send SMS</option>
                                <option value="send_email">Send Email</option>
                                <option value="create_task">Create Task</option>
                                <option value="broadcast_send">Queue broadcast send</option>
                              </select>
                            </label>

                            <label className="space-y-1 text-xs text-slate-600">
                              Broadcast
                              <select
                                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                                value={selectedBroadcastId}
                                onChange={(event) =>
                                  updateNodeConfig(node, {
                                    broadcastId: event.target.value || null,
                                  })
                                }
                                disabled={actionType !== "broadcast_send"}
                              >
                                <option value="">Select broadcast...</option>
                                {broadcasts.map((broadcast) => (
                                  <option key={broadcast.id} value={broadcast.id}>
                                    {broadcast.title}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ) : null}

                        <label className="mt-3 block space-y-1 text-xs text-slate-600">
                          Next node IDs (comma separated)
                          <input
                            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                            value={(node.nextIds ?? []).join(",")}
                            onChange={(event) => {
                              const nextIds = event.target.value
                                .split(",")
                                .map((value) => value.trim())
                                .filter(Boolean);
                              updateNode(node.id, { nextIds });
                            }}
                            placeholder="node_a,node_b"
                          />
                        </label>

                        <p className="mt-2 text-[11px] text-slate-400">Node ID: {node.id}</p>
                      </article>
                    )})}
                  </div>

                  {builderValidationErrors.length > 0 ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-xs font-semibold text-red-700">Publish blockers</p>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-red-700">
                        {builderValidationErrors.map((error) => (
                          <li key={error}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                      Workflow graph is valid and publish-ready.
                    </div>
                  )}

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
