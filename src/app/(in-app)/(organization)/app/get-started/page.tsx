"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import useOrganization from "@/lib/organizations/useOrganization";
import {
  bootstrapSampleData,
  getGuidedSequenceOnboarding,
  getLaunchReadiness,
  getProviderHealthChecks,
  installStarterTemplates,
  startGuidedSequenceOnboarding,
} from "@/app/actions/onboarding";

type SetupMetrics = {
  contacts: number;
  conversations: number;
  tasks: number;
  appointments: number;
  members: number;
  admins: number;
  activeChannels: string[];
  starterTemplateCount: number;
  pipelineStageCount: number;
  serviceTemplateCount: number;
};

type SetupStep = {
  id: string;
  title: string;
  description: string;
  status: "done" | "pending";
  href: string;
  blocking: boolean;
};

type BlockingAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  impact: string;
};

type LaunchReadiness = {
  score: number;
  completedCount: number;
  totalCount: number;
  steps: SetupStep[];
  blockingActions: BlockingAction[];
  metrics: SetupMetrics;
};

type ProviderHealthSnapshot = Awaited<ReturnType<typeof getProviderHealthChecks>>;
type GuidedSequenceSnapshot = Awaited<ReturnType<typeof getGuidedSequenceOnboarding>>;

export default function GetStartedPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [loading, setLoading] = useState(true);
  const [readiness, setReadiness] = useState<LaunchReadiness | null>(null);
  const [providerHealth, setProviderHealth] = useState<ProviderHealthSnapshot | null>(null);
  const [guidedSequences, setGuidedSequences] = useState<GuidedSequenceSnapshot | null>(null);
  const [installingStarters, setInstallingStarters] = useState(false);
  const [seedingSampleData, setSeedingSampleData] = useState(false);
  const [startingGuideId, setStartingGuideId] = useState<string | null>(null);

  const fetchSetupState = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [readinessData, providerHealthData, guidedSequencesData] = await Promise.all([
        getLaunchReadiness(orgId),
        getProviderHealthChecks(orgId),
        getGuidedSequenceOnboarding(orgId),
      ]);
      setReadiness(readinessData);
      setProviderHealth(providerHealthData);
      setGuidedSequences(guidedSequencesData);
    } catch (error) {
      console.error("Failed to load launch readiness:", error);
      toast.error("Failed to load onboarding data");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchSetupState();
  }, [fetchSetupState]);

  const setupSteps = readiness?.steps ?? [];
  const metrics = readiness?.metrics ?? {
    contacts: 0,
    conversations: 0,
    tasks: 0,
    appointments: 0,
    members: 0,
    admins: 0,
    activeChannels: [],
    starterTemplateCount: 0,
    pipelineStageCount: 0,
    serviceTemplateCount: 0,
  };
  const completionPercent = readiness?.score ?? 0;
  const completed = readiness?.completedCount ?? 0;
  const totalSteps = readiness?.totalCount ?? setupSteps.length;
  const nextBlockingAction = readiness?.blockingActions[0] ?? null;
  const providerSummary = providerHealth?.summary ?? {
    total: 0,
    healthy: 0,
    degraded: 0,
    critical: 0,
    scorePercent: 0,
  };
  const providerChecks = providerHealth?.checks ?? [];
  const nextProviderAction = providerHealth?.nextAction ?? null;
  const guidedRows = guidedSequences?.guides ?? [];
  const guidedSummary = guidedSequences?.summary ?? {
    templateInstalledCount: 0,
    builderDraftCount: 0,
    total: 0,
  };
  const nextGuideId = guidedSequences?.nextGuideId ?? null;

  const wizardSteps = useMemo(
    () =>
      setupSteps.filter((step) =>
        [
          "profile",
          "people_import",
          "household_cleanup",
          "provider_readiness",
          "roles",
          "template_install",
          "first_live_service",
        ].includes(step.id)
      ),
    [setupSteps]
  );

  const handleInstallStarterTemplates = async () => {
    if (!orgId) return;
    setInstallingStarters(true);
    try {
      const result = await installStarterTemplates(orgId);
      toast.success(
        `Starter assets installed (${result.messageTemplatesCreated} templates, ${result.pipelineStagesCreated} stages, ${result.serviceTemplatesCreated} service templates)`
      );
      await fetchSetupState();
    } catch (error) {
      console.error("Failed to install starter templates:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to install starter templates"
      );
    } finally {
      setInstallingStarters(false);
    }
  };

  const handleBootstrapSampleData = async () => {
    if (!orgId) return;
    setSeedingSampleData(true);
    try {
      const result = await bootstrapSampleData(orgId);
      toast.success(
        `Sample data bootstrap complete (${result.contactCount ?? 0} contacts created)`
      );
      await fetchSetupState();
    } catch (error) {
      console.error("Failed to bootstrap sample data:", error);
      toast.error(error instanceof Error ? error.message : "Failed to bootstrap sample data");
    } finally {
      setSeedingSampleData(false);
    }
  };

  const handleStartGuidedSequence = async (blueprintId: string) => {
    if (!orgId) return;
    setStartingGuideId(blueprintId);
    try {
      const result = await startGuidedSequenceOnboarding({
        organizationId: orgId,
        blueprintId,
        installTemplate: true,
      });
      toast.success(`${result.blueprintTitle} guide is ready`, {
        description: result.builderCreated
          ? "Builder draft created and linked template checked."
          : "Existing builder draft reused and template checked.",
      });
      await fetchSetupState();
    } catch (error) {
      console.error("Failed to start guided sequence:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start guided sequence");
    } finally {
      setStartingGuideId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="h-48 relative rounded-3xl overflow-hidden group">
        <div
          className="absolute inset-0 bg-slate-900"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=2070&auto=format&fit=crop')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-transparent p-10 flex flex-col justify-center">
          <span className="inline-block px-3 py-1 bg-[#84cc16] text-slate-950 text-[10px] font-black rounded w-max uppercase tracking-wider mb-4">
            Readiness
          </span>
          <h1 className="text-3xl font-black text-white mb-2">Workspace Launch Status</h1>
          <div className="flex items-center gap-4 max-w-xl">
            <div className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-[#84cc16] transition-all" style={{ width: `${completionPercent}%` }} />
            </div>
            <span className="text-white font-bold">{completionPercent}%</span>
          </div>
          <p className="text-xs text-white/80 mt-2">
            {completed}/{totalSteps} launch steps completed
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/app/get-started/concierge"
              className="inline-flex items-center gap-2 rounded-full bg-[#84cc16] px-4 py-2 text-xs font-black text-slate-950 hover:bg-[#a3e635] transition-colors"
            >
              Open Launch Concierge
              <span className="material-symbols-outlined text-[14px]">headset_mic</span>
            </Link>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-bold text-white/80 backdrop-blur">
              Voice + form onboarding app
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-800/50">
          <Loader2 className="h-6 w-6 animate-spin text-[#84cc16]" />
        </div>
      ) : (
        <div className="space-y-6">
          {nextBlockingAction ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-800 dark:bg-amber-950/20">
              <p className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Blocking Next Action
              </p>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {nextBlockingAction.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                {nextBlockingAction.description}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                Impact: {nextBlockingAction.impact}
              </p>
              <div className="mt-4">
                <Link
                  href={nextBlockingAction.href}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-500 transition-colors"
                >
                  Resolve Now
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-800 dark:bg-emerald-950/20">
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                All blocking launch actions are complete.
              </p>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  White-Glove Beta Checklist
                </h2>
                <p className="text-xs text-slate-500">
                  Import people, clean households, confirm SMS readiness, install templates, and set the first live service.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void fetchSetupState()}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
              {wizardSteps.map((step) => (
                <div
                  key={step.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/40"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        step.status === "done"
                          ? "bg-[#84cc16]/20 text-[#84cc16]"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {step.status === "done" ? "check" : "pending"}
                      </span>
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-900 dark:text-white text-sm mb-1">
                        {step.title}
                      </h5>
                      <p className="text-xs text-slate-500 leading-snug">{step.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60 flex justify-end">
                    <Link
                      href={step.href}
                      className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1"
                    >
                      {step.status === "done" ? "Review" : "Open Step"}
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">
              Starter Bootstrap
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Install the beta starter pack for messaging, visitor follow-up, donor care, and Sunday ops, then optionally seed sample records for validation.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Message Templates</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{metrics.starterTemplateCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Pipeline Stages</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{metrics.pipelineStageCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Service Templates</p>
                <p className="text-lg font-black text-slate-900 dark:text-white">{metrics.serviceTemplateCount}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleInstallStarterTemplates()}
                disabled={installingStarters || seedingSampleData}
                className="inline-flex items-center gap-2 rounded-lg bg-[#84cc16] px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-60"
              >
                {installingStarters ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Install Starter Templates
              </button>
              <button
                type="button"
                onClick={() => void handleBootstrapSampleData()}
                disabled={installingStarters || seedingSampleData}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 disabled:opacity-60"
              >
                {seedingSampleData ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Bootstrap Sample Data
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Provider Health Checks
                </h3>
                <p className="text-xs text-slate-500">
                  Runtime health for AI, SMS, email, and voice with guided remediation links.
                </p>
              </div>
              <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {providerSummary.scorePercent}% healthy
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <HealthPill label="Total" value={providerSummary.total} tone="slate" />
              <HealthPill label="Healthy" value={providerSummary.healthy} tone="emerald" />
              <HealthPill label="Degraded" value={providerSummary.degraded} tone="amber" />
              <HealthPill label="Critical" value={providerSummary.critical} tone="rose" />
            </div>

            {nextProviderAction ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 mb-4 dark:border-amber-800 dark:bg-amber-950/20">
                <p className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Recommended Next Fix
                </p>
                <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                  {nextProviderAction.title}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {nextProviderAction.summary}
                </p>
              </div>
            ) : null}

            <div className="space-y-3">
              {providerChecks.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
                  Provider checks are not available yet.
                </div>
              ) : (
                providerChecks.map((check) => (
                  <div
                    key={check.key}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {check.title}
                          </p>
                          <span className={statusBadgeClass(check.status)}>{check.status}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{check.summary}</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Runtime: {check.runtime.errors}/{check.runtime.events} errors (
                          {check.runtime.errorRatePercent}%)
                        </p>
                      </div>
                      <Link
                        href={check.remediation.href}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        {check.remediation.label}
                        <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Teach Me This Sequence
                </h3>
                <p className="text-xs text-slate-500">
                  Guided onboarding creates a builder draft and checks template installation.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">
                  Templates installed:{" "}
                  <span className="font-black text-slate-900 dark:text-white">
                    {guidedSummary.templateInstalledCount}/{guidedSummary.total}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Builder drafts:{" "}
                  <span className="font-black text-slate-900 dark:text-white">
                    {guidedSummary.builderDraftCount}/{guidedSummary.total}
                  </span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {guidedRows.map((guide) => {
                const isStarting = startingGuideId === guide.id;
                const isRecommended = guide.id === nextGuideId;
                return (
                  <div
                    key={guide.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        {guide.title}
                      </h4>
                      {isRecommended ? (
                        <span className="rounded-full bg-[#84cc16]/20 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#65a30d]">
                          Next
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{guide.summary}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                          guide.templateInstalled
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}
                      >
                        {guide.templateInstalled ? "Template Ready" : "Template Pending"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                          guide.builderWorkflowId
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {guide.builderWorkflowId ? "Builder Draft Ready" : "No Draft Yet"}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1">
                      {guide.checklist.map((item) => (
                        <p key={item} className="text-[11px] text-slate-600 dark:text-slate-300">
                          • {item}
                        </p>
                      ))}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => void handleStartGuidedSequence(guide.id)}
                        disabled={Boolean(startingGuideId)}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#84cc16] px-3 py-2 text-[11px] font-black text-slate-950 disabled:opacity-60"
                      >
                        {isStarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        {guide.builderWorkflowId ? "Refresh Guided Draft" : "Teach Me This Sequence"}
                      </button>
                      <Link
                        href="/app/automations"
                        className="text-[11px] font-black text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      >
                        Open Automations
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MiniCard label="Contacts" value={metrics.contacts} icon="groups" href="/app/contacts" />
            <MiniCard
              label="Conversations"
              value={metrics.conversations}
              icon="forum"
              href="/app/grace?tab=care"
            />
            <MiniCard label="Tasks" value={metrics.tasks} icon="check_box" href="/app/tasks" />
            <MiniCard
              label="Appointments"
              value={metrics.appointments}
              icon="event"
              href="/app/calendar"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function MiniCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number;
  icon: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between hover:-translate-y-1 transition-all h-full group"
    >
      <div className="flex items-start justify-between mb-4">
        <span className="material-symbols-outlined text-[#84cc16] text-[20px]">{icon}</span>
        <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-slate-900 dark:group-hover:text-white transition-colors text-[18px]">
          open_in_new
        </span>
      </div>
      <div>
        <p className="text-3xl font-black text-slate-900 dark:text-white mb-1">{value}</p>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</p>
      </div>
    </Link>
  );
}

function statusBadgeClass(status: "healthy" | "degraded" | "critical") {
  if (status === "healthy") {
    return "rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (status === "critical") {
    return "rounded-full bg-rose-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
  }
  return "rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
}

function HealthPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "slate" | "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300"
        : tone === "rose"
          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300"
          : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300";

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wide">{label}</p>
      <p className="text-lg font-black">{value}</p>
    </div>
  );
}
