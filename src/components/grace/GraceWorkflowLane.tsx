"use client";

import Link from "next/link";
import { ArrowRight, Clock3, MessageSquare, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GraceWorkflowCardView } from "@/lib/grace/workflow-summary";
import { getGraceWorkflowToneClasses } from "@/lib/grace/workflow-summary";

type LaneItem = GraceWorkflowCardView & {
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
};

type GraceWorkflowLaneProps = {
  title: string;
  description: string;
  items: LaneItem[];
  emptyMessage: string;
  accent?: "emerald" | "cyan" | "amber" | "rose" | "slate";
  compact?: boolean;
};

function WorkflowActionButton({
  action,
  variant = "outline",
}: {
  action: NonNullable<LaneItem["primaryAction"]>;
  variant?: "default" | "outline";
}) {
  const className = variant === "default" ? "bg-slate-900 text-white hover:bg-slate-800" : "";
  if (action.href) {
    return (
      <Button asChild size="sm" variant={variant} className={className}>
        <Link href={action.href}>
          {action.label}
          <ArrowRight className="ml-2 h-3.5 w-3.5" />
        </Link>
      </Button>
    );
  }

  return (
    <Button size="sm" variant={variant} className={className} onClick={action.onClick}>
      {action.label}
      <ArrowRight className="ml-2 h-3.5 w-3.5" />
    </Button>
  );
}

export function GraceWorkflowLane({
  title,
  description,
  items,
  emptyMessage,
  accent = "slate",
  compact = false,
}: GraceWorkflowLaneProps) {
  const accentClasses = getGraceWorkflowToneClasses(accent);

  return (
    <section className="workspace-surface overflow-hidden">
      <div className={`border-b px-6 py-4 ${accentClasses}`}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200">
              {title}
            </p>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{description}</p>
          </div>
          <Badge variant="outline" className="border-current/20 bg-white/40 text-slate-700 dark:text-slate-200">
            {items.length} item{items.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</div>
      ) : (
        <div className={compact ? "grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3" : "space-y-3 p-4"}>
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-slate-700"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {item.workflowLabel}
                    </p>
                    <Badge variant="outline" className={getGraceWorkflowToneClasses(item.statusTone)}>
                      {item.statusLabel}
                    </Badge>
                  </div>
                  <p className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                    {item.headline}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.summary}</p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                  {item.statusTone === "emerald" ? (
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                  ) : item.statusTone === "cyan" ? (
                    <MessageSquare className="h-4 w-4 text-cyan-600" />
                  ) : (
                    <Clock3 className="h-4 w-4" />
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {item.meta.map((meta) => (
                  <span
                    key={`${item.id}:${meta}`}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                  >
                    {meta}
                  </span>
                ))}
              </div>

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Correlation
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-slate-900 dark:text-white">
                    {item.correlationKey}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Next checkpoint
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                    {item.nextCheckpointAt ? new Date(item.nextCheckpointAt).toLocaleString() : "None"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Steps
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                    {item.stepSummary}
                  </p>
                </div>
              </div>

              {item.stepTimeline.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {item.stepTimeline.slice(0, 4).map((step) => (
                    <div
                      key={`${item.id}:${step.stepKey}`}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                          {step.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {step.stepKey} · {step.status}
                        </p>
                      </div>
                      <Badge variant="outline">{step.attemptCount}x</Badge>
                    </div>
                  ))}
                </div>
              ) : null}

              {item.primaryAction || item.secondaryAction ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.primaryAction ? (
                    <WorkflowActionButton action={item.primaryAction} variant="default" />
                  ) : null}
                  {item.secondaryAction ? (
                    <WorkflowActionButton action={item.secondaryAction} />
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
