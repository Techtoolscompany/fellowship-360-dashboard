"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import useOrganization from "@/lib/organizations/useOrganization";
import {
  bootstrapSampleData,
  getLaunchReadiness,
  installStarterTemplates,
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

export default function GetStartedPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [loading, setLoading] = useState(true);
  const [readiness, setReadiness] = useState<LaunchReadiness | null>(null);
  const [installingStarters, setInstallingStarters] = useState(false);
  const [seedingSampleData, setSeedingSampleData] = useState(false);

  const fetchSetupState = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getLaunchReadiness(orgId);
      setReadiness(data);
    } catch (error) {
      console.error("Failed to load launch readiness:", error);
      toast.error("Failed to load launch readiness");
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

  const wizardSteps = useMemo(
    () =>
      setupSteps.filter((step) =>
        ["profile", "channels", "roles", "escalation"].includes(step.id)
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
                  Guided Setup Wizard
                </h2>
                <p className="text-xs text-slate-500">
                  Profile, channels, team roles, and escalation policy.
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
              Install starter templates and optionally seed sample records for fast validation.
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

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MiniCard label="Contacts" value={metrics.contacts} icon="groups" href="/app/contacts" />
            <MiniCard
              label="Conversations"
              value={metrics.conversations}
              icon="forum"
              href="/app/grace?tab=inbox"
            />
            <MiniCard label="Tasks" value={metrics.tasks} icon="check_box" href="/app/tasks" />
            <MiniCard
              label="Appointments"
              value={metrics.appointments}
              icon="event"
              href="/app/grace?tab=calendar"
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
