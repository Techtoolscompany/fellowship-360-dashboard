"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopyPlus, RefreshCcw, Rocket, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  archiveSuperAdminAutomationTemplate,
  createSuperAdminAutomationTemplate,
  getSuperAdminAutomationStarters,
  getSuperAdminAutomationTemplates,
  publishSuperAdminAutomationTemplate,
  updateSuperAdminAutomationTemplate,
} from "@/app/actions/super-admin-automations";
import { AutomationWorkflowEditor } from "@/components/automations/AutomationWorkflowEditor";
import {
  SuperAdminMetricCard,
  SuperAdminPageHeader,
  SuperAdminSurface,
} from "@/components/super-admin/primitives";
import { Button } from "@/components/ui/button";
import { validateAutomationDefinition } from "@/lib/automations/validation";
import {
  createBuilderStarterDefinition,
  normalizeAutomationDefinition,
} from "@/lib/automations/editor";

type ManagedTemplateRow = Awaited<ReturnType<typeof getSuperAdminAutomationTemplates>>[number];
type StarterTemplateRow = Awaited<ReturnType<typeof getSuperAdminAutomationStarters>>[number];

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

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function SuperAdminAutomationsPage() {
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ManagedTemplateRow[]>([]);
  const [starters, setStarters] = useState<StarterTemplateRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedStarterKey, setSelectedStarterKey] = useState<string>("");

  const [draftName, setDraftName] = useState("");
  const [draftKey, setDraftKey] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftCategory, setDraftCategory] = useState<ManagedTemplateRow["category"]>("Follow-Up");
  const [draftTriggerEvent, setDraftTriggerEvent] = useState("");
  const [draftRecommendedChannels, setDraftRecommendedChannels] = useState<string[]>(["sms"]);
  const [draftDefinition, setDraftDefinition] = useState(createBuilderStarterDefinition());
  const templateEditorRef = useRef<HTMLDivElement | null>(null);

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [templateRows, starterRows] = await Promise.all([
        getSuperAdminAutomationTemplates(),
        getSuperAdminAutomationStarters(),
      ]);
      setTemplates(templateRows);
      setStarters(starterRows);
    } catch (error) {
      console.error("Failed to load super-admin templates:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load automation templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!templates.length) {
      setSelectedTemplateId(null);
      return;
    }

    if (!selectedTemplateId) {
      setSelectedTemplateId(templates[0]?.id ?? null);
      return;
    }

    if (!templates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0]?.id ?? null);
    }
  }, [selectedTemplateId, templates]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates]
  );

  useEffect(() => {
    if (!selectedTemplate) {
      setDraftName("");
      setDraftKey("");
      setDraftDescription("");
      setDraftCategory("Follow-Up");
      setDraftTriggerEvent("");
      setDraftRecommendedChannels(["sms"]);
      setDraftDefinition(createBuilderStarterDefinition());
      return;
    }

    setDraftName(selectedTemplate.name);
    setDraftKey(selectedTemplate.key);
    setDraftDescription(selectedTemplate.description ?? "");
    setDraftCategory(selectedTemplate.category);
    setDraftTriggerEvent(selectedTemplate.triggerEvent ?? "");
    setDraftRecommendedChannels([...(selectedTemplate.recommendedChannels ?? ["sms"])]);
    setDraftDefinition(normalizeAutomationDefinition(selectedTemplate.definitionJson));
  }, [selectedTemplate]);

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      templateEditorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedTemplate]);

  const validationErrors = useMemo(
    () => validateAutomationDefinition(draftDefinition),
    [draftDefinition]
  );

  const createBlankTemplate = useCallback(async () => {
    setBusyKey("create-blank");
    try {
      const created = await createSuperAdminAutomationTemplate({
        name: `Template ${templates.length + 1}`,
      });
      toast.success("Template draft created");
      await refreshData();
      setSelectedTemplateId(created.id);
    } catch (error) {
      console.error("Failed to create template:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create template");
    } finally {
      setBusyKey(null);
    }
  }, [refreshData, templates.length]);

  const createFromStarter = useCallback(async () => {
    if (!selectedStarterKey) {
      toast.error("Choose a starter first");
      return;
    }

    const starter = starters.find((item) => item.key === selectedStarterKey);
    setBusyKey("create-starter");
    try {
      const created = await createSuperAdminAutomationTemplate({
        name: starter?.name ?? "New Template",
        starterTemplateKey: selectedStarterKey,
      });
      toast.success("Starter copied into managed template");
      await refreshData();
      setSelectedTemplateId(created.id);
    } catch (error) {
      console.error("Failed to copy starter:", error);
      toast.error(error instanceof Error ? error.message : "Failed to copy starter");
    } finally {
      setBusyKey(null);
    }
  }, [refreshData, selectedStarterKey, starters]);

  const saveDraft = useCallback(async () => {
    if (!selectedTemplate) return;
    setBusyKey("save");
    try {
      await updateSuperAdminAutomationTemplate({
        templateId: selectedTemplate.id,
        name: draftName,
        key: draftKey,
        description: draftDescription,
        category: draftCategory,
        triggerEvent: draftTriggerEvent,
        recommendedChannels: draftRecommendedChannels as Array<"sms" | "email" | "voice">,
        definition: draftDefinition,
      });
      toast.success(
        validationErrors.length > 0
          ? "Draft saved with validation warnings"
          : "Template draft saved"
      );
      await refreshData();
    } catch (error) {
      console.error("Failed to save template:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save template");
    } finally {
      setBusyKey(null);
    }
  }, [
    selectedTemplate,
    draftName,
    draftKey,
    draftDescription,
    draftCategory,
    draftTriggerEvent,
    draftRecommendedChannels,
    draftDefinition,
    validationErrors.length,
    refreshData,
  ]);

  const publishTemplate = useCallback(async () => {
    if (!selectedTemplate) return;
    if (validationErrors.length > 0) {
      toast.error("Resolve validation blockers before publishing");
      return;
    }

    setBusyKey("publish");
    try {
      await updateSuperAdminAutomationTemplate({
        templateId: selectedTemplate.id,
        name: draftName,
        key: draftKey,
        description: draftDescription,
        category: draftCategory,
        triggerEvent: draftTriggerEvent,
        recommendedChannels: draftRecommendedChannels as Array<"sms" | "email" | "voice">,
        definition: draftDefinition,
      });
      await publishSuperAdminAutomationTemplate({ templateId: selectedTemplate.id });
      toast.success("Template published");
      await refreshData();
    } catch (error) {
      console.error("Failed to publish template:", error);
      toast.error(error instanceof Error ? error.message : "Failed to publish template");
    } finally {
      setBusyKey(null);
    }
  }, [
    selectedTemplate,
    draftName,
    draftKey,
    draftDescription,
    draftCategory,
    draftTriggerEvent,
    draftRecommendedChannels,
    draftDefinition,
    validationErrors.length,
    refreshData,
  ]);

  const archiveTemplate = useCallback(async () => {
    if (!selectedTemplate) return;
    setBusyKey("archive");
    try {
      await archiveSuperAdminAutomationTemplate({ templateId: selectedTemplate.id });
      toast.success("Template archived");
      await refreshData();
    } catch (error) {
      console.error("Failed to archive template:", error);
      toast.error(error instanceof Error ? error.message : "Failed to archive template");
    } finally {
      setBusyKey(null);
    }
  }, [refreshData, selectedTemplate]);

  const publishedCount = templates.filter((template) => template.status === "published").length;
  const draftCount = templates.filter((template) => template.status === "draft").length;

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        eyebrow="Workflow Studio"
        eyebrowIcon={Sparkles}
        title="Automations"
        description="Author managed workflow templates here, publish them, and push them to churches from the rollout screen. Org builders use the same outline editor, so template and local workflow behavior stay aligned."
        actions={
          <>
            <Button variant="outline" onClick={() => void refreshData()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button asChild variant="outline">
              <Link href="/super-admin/automations/deploy">
                <Rocket className="mr-2 h-4 w-4" />
                Open Deploy
              </Link>
            </Button>
          </>
        }
        stats={[
          { label: "Managed", value: templates.length, detail: "Templates in this workspace" },
          { label: "Published", value: publishedCount, detail: "Ready to deploy" },
          { label: "Drafts", value: draftCount, detail: "Still being edited" },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SuperAdminMetricCard
          label="Published"
          value={publishedCount}
          detail="Templates available to org installs and bulk deploy."
          icon={Rocket}
          tone="success"
        />
        <SuperAdminMetricCard
          label="Drafts"
          value={draftCount}
          detail="Templates that still need review before rollout."
          icon={Save}
        />
        <SuperAdminMetricCard
          label="Starters"
          value={starters.length}
          detail="Built-in playbooks you can copy into managed templates."
          icon={CopyPlus}
        />
      </div>

      <SuperAdminSurface className="gap-3 border-sky-200 bg-sky-50 p-4">
        <p className="text-sm font-semibold text-sky-900">How to build managed templates</p>
        <div className="grid gap-2 text-xs text-sky-900 md:grid-cols-3">
          <div className="rounded-lg border border-sky-100 bg-white/80 px-3 py-2">
            Start from <span className="font-semibold">New Managed Template</span> or copy a
            starter playbook.
          </div>
          <div className="rounded-lg border border-sky-100 bg-white/80 px-3 py-2">
            Choose the trigger, add steps in order, and save the draft as you edit.
          </div>
          <div className="rounded-lg border border-sky-100 bg-white/80 px-3 py-2">
            Publish when validation is clean, then deploy it to churches from the rollout screen.
          </div>
        </div>
      </SuperAdminSurface>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <SuperAdminSurface className="gap-4 p-4">
          <div className="space-y-3">
            <Button className="w-full" onClick={createBlankTemplate} disabled={busyKey === "create-blank"}>
              {busyKey === "create-blank" ? "Creating..." : "New Managed Template From Scratch"}
            </Button>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label className="space-y-1 text-xs text-slate-600 block">
                Copy starter
                <select
                  className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
                  value={selectedStarterKey}
                  onChange={(event) => setSelectedStarterKey(event.target.value)}
                >
                  <option value="">Choose starter...</option>
                  {starters.map((starter) => (
                    <option key={starter.key} value={starter.key}>
                      {starter.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="outline"
                className="w-full"
                onClick={createFromStarter}
                disabled={busyKey === "create-starter"}
              >
                {busyKey === "create-starter" ? "Copying..." : "Create From Starter"}
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
              <p className="font-semibold text-slate-700">No managed templates yet.</p>
              <p className="mt-1">
                Create one from scratch or copy a starter to begin authoring deployable workflows.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className={`w-full rounded-xl border px-3 py-3 text-left ${
                    selectedTemplateId === template.id
                      ? "border-lime-500 bg-lime-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                  onClick={() => setSelectedTemplateId(template.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{template.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{template.key}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          STATUS_BADGES[template.status] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {STATUS_LABELS[template.status] ?? template.status}
                      </span>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {selectedTemplateId === template.id ? "Editing" : "Open Editor"}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {template.category} • updated {formatDateTime(template.updatedAt)}
                  </p>
                </button>
              ))}
            </div>
          )}

          {templates.length > 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-600">
              Select a template to edit it. On smaller screens, the editor opens below this list.
            </div>
          ) : null}
        </SuperAdminSurface>

        {!selectedTemplate ? (
          <SuperAdminSurface className="p-8">
            <p className="text-sm font-semibold text-slate-800">
              Create or select a managed template to start editing.
            </p>
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <p>1. Create a blank template or copy a starter from the left rail.</p>
              <p>2. Pick a trigger preset and add steps in the outline editor.</p>
              <p>3. Save the draft, publish it, then deploy it to organizations.</p>
            </div>
          </SuperAdminSurface>
        ) : (
          <div ref={templateEditorRef} className="space-y-4">
            <SuperAdminSurface className="gap-3 border-lime-200 bg-lime-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-lime-950">
                    Editing managed template: {selectedTemplate.name}
                  </p>
                  <p className="text-xs text-lime-900">
                    Update the trigger and outline steps below, then save or publish for rollout.
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    STATUS_BADGES[selectedTemplate.status] ?? "bg-white text-slate-700"
                  }`}
                >
                  {STATUS_LABELS[selectedTemplate.status] ?? selectedTemplate.status}
                </span>
              </div>
            </SuperAdminSurface>

            <SuperAdminSurface className="gap-4 p-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1 text-xs text-slate-600">
                  Template key
                  <input
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={draftKey}
                    onChange={(event) => setDraftKey(event.target.value)}
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-600">
                  Category
                  <select
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={draftCategory}
                    onChange={(event) =>
                      setDraftCategory(event.target.value as ManagedTemplateRow["category"])
                    }
                  >
                    <option value="Follow-Up">Follow-Up</option>
                    <option value="Care">Care</option>
                    <option value="Appointments">Appointments</option>
                    <option value="Service Ops">Service Ops</option>
                  </select>
                </label>
                <label className="space-y-1 text-xs text-slate-600 xl:col-span-2">
                  Recommended channels
                  <div className="flex flex-wrap gap-2 rounded-md border border-slate-300 bg-white px-3 py-2">
                    {(["sms", "email", "voice"] as const).map((channel) => {
                      const selected = draftRecommendedChannels.includes(channel);
                      return (
                        <button
                          key={channel}
                          type="button"
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            selected
                              ? "bg-lime-600 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                          onClick={() =>
                            setDraftRecommendedChannels((current) => {
                              if (selected) {
                                return current.length === 1
                                  ? current
                                  : current.filter((item) => item !== channel);
                              }

                              return [...current, channel];
                            })
                          }
                        >
                          {channel}
                        </button>
                      );
                    })}
                  </div>
                </label>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <div className="space-y-1">
                  <p>
                    <span className="font-semibold text-slate-800">Status:</span>{" "}
                    {STATUS_LABELS[selectedTemplate.status] ?? selectedTemplate.status}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Last updated:</span>{" "}
                    {formatDateTime(selectedTemplate.updatedAt)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Published at:</span>{" "}
                    {formatDateTime(selectedTemplate.publishedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={saveDraft} disabled={busyKey === "save"}>
                    {busyKey === "save" ? "Saving..." : "Save Draft"}
                  </Button>
                  <Button onClick={publishTemplate} disabled={busyKey === "publish"}>
                    {busyKey === "publish" ? "Publishing..." : "Publish"}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    onClick={archiveTemplate}
                    disabled={busyKey === "archive"}
                  >
                    {busyKey === "archive" ? "Archiving..." : "Archive"}
                  </Button>
                </div>
              </div>
            </SuperAdminSurface>

            <SuperAdminSurface className="p-4">
              <AutomationWorkflowEditor
                editorId={selectedTemplate.id}
                name={draftName}
                description={draftDescription}
                triggerEvent={draftTriggerEvent}
                definition={draftDefinition}
                validationErrors={validationErrors}
                onNameChange={setDraftName}
                onDescriptionChange={setDraftDescription}
                onTriggerEventChange={setDraftTriggerEvent}
                onDefinitionChange={setDraftDefinition}
              />
            </SuperAdminSurface>
          </div>
        )}
      </div>
    </div>
  );
}
