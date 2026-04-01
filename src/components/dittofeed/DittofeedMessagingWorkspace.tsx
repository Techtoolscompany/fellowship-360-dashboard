"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Inbox,
  Loader2,
  Megaphone,
  NotebookText,
  RefreshCw,
  Route,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const MESSAGING_TABS = [
  {
    id: "journeys",
    label: "Journeys",
    description: "Design onboarding, nurture, and lifecycle automations.",
    icon: Route,
  },
  {
    id: "templates",
    label: "Templates",
    description: "Author reusable email and SMS content in one place.",
    icon: NotebookText,
  },
  {
    id: "broadcasts",
    label: "Broadcasts",
    description: "Launch one-time announcements and campaigns.",
    icon: Megaphone,
  },
  {
    id: "deliveries",
    label: "Deliveries",
    description: "Inspect delivery activity and message history.",
    icon: Inbox,
  },
] as const;

type MessagingTabId = (typeof MESSAGING_TABS)[number]["id"];

type DittofeedSessionResponse = {
  success: boolean;
  workspaceId?: string;
  baseUrl?: string;
  token?: string;
  urls?: Record<MessagingTabId, string>;
  provider?: {
    workspaceId?: string | null;
    workspaceName?: string | null;
    baseUrl?: string | null;
    mode?: string | null;
    isActive?: boolean | null;
  } | null;
  error?: string;
};

type SessionState =
  | { status: "loading" }
  | { status: "ready"; data: Required<Pick<DittofeedSessionResponse, "workspaceId" | "baseUrl" | "token" | "urls">> & DittofeedSessionResponse }
  | { status: "unconfigured"; message: string }
  | { status: "error"; message: string };

type DittofeedMessagingWorkspaceProps = {
  initialTab: MessagingTabId;
  eyebrow: string;
  title: string;
  description: string;
};

function getTabById(tabId: MessagingTabId) {
  return MESSAGING_TABS.find((tab) => tab.id === tabId) ?? MESSAGING_TABS[0];
}

function normalizeMessage(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

export function DittofeedMessagingWorkspace({
  initialTab,
  eyebrow,
  title,
  description,
}: DittofeedMessagingWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<MessagingTabId>(initialTab);
  const [sessionState, setSessionState] = useState<SessionState>({ status: "loading" });
  const [iframeState, setIframeState] = useState<"loading" | "ready" | "error">("loading");
  const [refreshCount, setRefreshCount] = useState(0);
  const loadTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      setSessionState({ status: "loading" });

      try {
        const response = await fetch("/api/app/organizations/current/dittofeed/session", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as DittofeedSessionResponse | null;

        if (!isMounted) return;

        if (!response.ok) {
          const message = normalizeMessage(
            payload?.error,
            response.status === 404 || response.status === 409
              ? "Dittofeed is not configured for this organization yet."
              : "Failed to load the Dittofeed workspace."
          );

          setSessionState(
            response.status === 404 || response.status === 409
              ? { status: "unconfigured", message }
              : { status: "error", message }
          );
          return;
        }

        if (!payload?.urls?.journeys || !payload.workspaceId || !payload.baseUrl || !payload.token) {
          setSessionState({
            status: "error",
            message: "Dittofeed returned an incomplete session payload.",
          });
          return;
        }

        setSessionState({
          status: "ready",
          data: {
            ...payload,
            workspaceId: payload.workspaceId,
            baseUrl: payload.baseUrl,
            token: payload.token,
            urls: payload.urls as Required<Pick<DittofeedSessionResponse, "urls">>["urls"],
          },
        });
      } catch (error) {
        if (!isMounted) return;

        setSessionState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load the Dittofeed workspace.",
        });
      }
    };

    void loadSession();

    return () => {
      isMounted = false;
    };
  }, [refreshCount]);

  const currentTab = useMemo(() => getTabById(activeTab), [activeTab]);
  const currentUrl = sessionState.status === "ready" ? sessionState.data.urls[activeTab] : null;
  const workspaceName =
    sessionState.status === "ready"
      ? sessionState.data.provider?.workspaceName?.trim() ||
        sessionState.data.provider?.workspaceId ||
        sessionState.data.workspaceId
      : null;

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (sessionState.status !== "ready") {
      setIframeState("loading");
      if (loadTimeoutRef.current) {
        window.clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
      return;
    }

    setIframeState("loading");

    if (loadTimeoutRef.current) {
      window.clearTimeout(loadTimeoutRef.current);
    }

    loadTimeoutRef.current = window.setTimeout(() => {
      setIframeState((current) => (current === "loading" ? "error" : current));
    }, 30000);

    return () => {
      if (loadTimeoutRef.current) {
        window.clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [activeTab, sessionState.status, currentUrl]);

  const refreshWorkspace = () => {
    setRefreshCount((count) => count + 1);
  };

  const openCurrentTab = () => {
    if (!currentUrl || typeof window === "undefined") return;
    window.open(currentUrl, "_blank", "noopener,noreferrer");
  };

  const renderFrame = () => {
    if (sessionState.status !== "ready") return null;

    return (
      <>
        {iframeState !== "ready" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
            {iframeState === "error" ? (
              <div className="max-w-md rounded-3xl border border-white/10 bg-white/95 p-6 text-center shadow-2xl dark:bg-slate-950/95">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
                  <AlertTriangle className="size-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Dittofeed is taking too long to load
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  The workspace session is ready, but the embedded view has not responded yet.
                </p>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <Button variant="outline" onClick={refreshWorkspace}>
                    Reload session
                  </Button>
                  <Button onClick={openCurrentTab}>Open in new tab</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center text-white">
                <Loader2 className="size-8 animate-spin text-lime-300" />
                <div>
                  <p className="text-base font-semibold">Loading Dittofeed {currentTab.label.toLowerCase()}...</p>
                  <p className="mt-1 text-sm text-white/70">
                    Preparing the embedded workspace for {workspaceName ?? "this organization"}.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        <iframe
          key={`${activeTab}-${sessionState.data.token}`}
          title={`Dittofeed ${currentTab.label}`}
          src={currentUrl ?? undefined}
          className="h-full w-full border-0 bg-white"
          allow="clipboard-read; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => {
            if (loadTimeoutRef.current) {
              window.clearTimeout(loadTimeoutRef.current);
              loadTimeoutRef.current = null;
            }
            setIframeState("ready");
          }}
          onError={() => {
            if (loadTimeoutRef.current) {
              window.clearTimeout(loadTimeoutRef.current);
              loadTimeoutRef.current = null;
            }
            setIframeState("error");
          }}
        />
      </>
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col gap-6 pb-8 text-slate-950 dark:text-white">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(132,204,22,0.16),_transparent_28%),linear-gradient(135deg,_#ffffff,_#f8fafc_52%,_#eef2ff)] p-6 shadow-sm dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(132,204,22,0.18),_transparent_28%),linear-gradient(135deg,_#020617,_#0f172a_52%,_#111827)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-lime-600 dark:text-lime-400">
              {eyebrow}
            </p>
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                {description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-2 rounded-full border border-lime-500/20 bg-lime-500/10 px-3 py-1 text-xs font-semibold text-lime-700 dark:text-lime-300">
                <span className="size-2 rounded-full bg-lime-500" />
                {sessionState.status === "ready" ? `Connected to ${workspaceName ?? "Dittofeed"}` : "Launching Dittofeed"}
              </span>
              {sessionState.status === "ready" && (
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
                  Workspace {sessionState.data.workspaceId}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={refreshWorkspace} className="bg-white/70 dark:bg-slate-950/60">
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
            <Button onClick={openCurrentTab} disabled={sessionState.status !== "ready"}>
              <ExternalLink className="mr-2 size-4" />
              Open current tab
            </Button>
          </div>
        </div>
      </section>

      {sessionState.status === "loading" && (
        <section className="flex min-h-[42vh] items-center justify-center rounded-[2rem] border border-slate-200 bg-white/80 p-8 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-lime-500/10 text-lime-600 dark:text-lime-400">
              <Loader2 className="size-6 animate-spin" />
            </div>
            <div>
              <p className="text-lg font-semibold">Loading Dittofeed workspace</p>
              <p className="mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
                We are creating a short-lived session for this organization and preparing the embedded messaging hub.
              </p>
            </div>
          </div>
        </section>
      )}

      {sessionState.status === "unconfigured" && (
        <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-8 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="max-w-2xl">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-5" />
            </div>
            <h2 className="mt-5 text-2xl font-bold">Dittofeed is not ready for this organization</h2>
            <p className="mt-3 text-sm leading-6 text-amber-900/80 dark:text-amber-100/80">
              {sessionState.message}
            </p>
            <p className="mt-3 text-sm leading-6 text-amber-900/70 dark:text-amber-100/70">
              An admin needs to provision or complete the Dittofeed integration before this messaging hub can load.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button onClick={refreshWorkspace}>Try again</Button>
              <Button variant="outline" onClick={openCurrentTab} disabled>
                Open current tab
              </Button>
            </div>
          </div>
        </section>
      )}

      {sessionState.status === "error" && (
        <section className="rounded-[2rem] border border-rose-200 bg-rose-50 p-8 shadow-sm dark:border-rose-500/20 dark:bg-rose-500/10">
          <div className="max-w-2xl">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="size-5" />
            </div>
            <h2 className="mt-5 text-2xl font-bold">We could not load Dittofeed</h2>
            <p className="mt-3 text-sm leading-6 text-rose-900/80 dark:text-rose-100/80">
              {sessionState.message}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button onClick={refreshWorkspace}>Retry</Button>
            </div>
          </div>
        </section>
      )}

      {sessionState.status === "ready" && (
        <section className="flex min-h-[72vh] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-slate-950">
          <div className="border-b border-slate-200 bg-slate-50/90 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Dittofeed workspace
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{currentTab.label}</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{currentTab.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {MESSAGING_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tab.id === activeTab;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={[
                        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                        isActive
                          ? "border-lime-500 bg-lime-500 text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-lime-500/40 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-white",
                      ].join(" ")}
                    >
                      <Icon className="size-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden bg-slate-100 dark:bg-slate-900">
            {renderFrame()}
          </div>
        </section>
      )}
    </div>
  );
}
