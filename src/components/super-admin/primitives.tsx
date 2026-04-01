import Link from "next/link";
import * as React from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const superAdminSurfaceClassName =
  "rounded-[24px] border border-slate-200/70 bg-white/92 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.4)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/82";

export const superAdminInsetClassName =
  "rounded-[20px] border border-slate-200/70 bg-slate-50/88 shadow-sm dark:border-slate-700/80 dark:bg-slate-950/45";

export const superAdminMutedPanelClassName =
  "rounded-[18px] border border-slate-200/70 bg-white/75 dark:border-slate-700/70 dark:bg-slate-950/50";

export function SuperAdminSurface({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Card>) {
  return (
    <Card className={cn(superAdminSurfaceClassName, className)} {...props}>
      {children}
    </Card>
  );
}

interface SuperAdminPageHeaderStat {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
}

interface SuperAdminPageHeaderProps {
  eyebrow?: string;
  eyebrowIcon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  stats?: SuperAdminPageHeaderStat[];
  backHref?: string;
  backLabel?: string;
  className?: string;
}

export function SuperAdminPageHeader({
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  title,
  description,
  actions,
  stats,
  backHref,
  backLabel = "Back",
  className,
}: SuperAdminPageHeaderProps) {
  return (
    <section className={cn(superAdminSurfaceClassName, "relative overflow-hidden p-5 md:p-6", className)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_34%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.1),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_30%)]" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          {backHref ? (
            <Button variant="ghost" size="sm" className="-ml-3 h-8 px-3 text-slate-600 dark:text-slate-300" asChild>
              <Link href={backHref}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {backLabel}
              </Link>
            </Button>
          ) : null}

          {eyebrow ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
              {EyebrowIcon ? <EyebrowIcon className="h-3.5 w-3.5 text-lime-500" /> : null}
              {eyebrow}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-[2rem]">
              {title}
            </h1>
            {description ? (
              <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {description}
              </p>
            ) : null}
          </div>

          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>

        {stats?.length ? (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:min-w-[360px] xl:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className={cn(superAdminMutedPanelClassName, "p-3.5 shadow-sm")}
              >
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {stat.label}
                </div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white md:text-[1.75rem]">
                  {stat.value}
                </div>
                {stat.detail ? (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{stat.detail}</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface SuperAdminMetricCardProps {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
}

const toneClassNames: Record<NonNullable<SuperAdminMetricCardProps["tone"]>, string> = {
  default: "text-slate-500 dark:text-slate-400",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
};

export function SuperAdminMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
  className,
}: SuperAdminMetricCardProps) {
  return (
    <div className={cn(superAdminSurfaceClassName, "p-4 md:p-5", className)}>
      <div className={cn("mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em]", toneClassNames[tone])}>
        {Icon ? <Icon className="h-4 w-4" /> : null}
        <span>{label}</span>
      </div>
      <div className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">{value}</div>
      {detail ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{detail}</p> : null}
    </div>
  );
}

export function SuperAdminToolbar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn(superAdminInsetClassName, "p-4", className)}>{children}</div>;
}

export function SuperAdminToolbarGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        superAdminMutedPanelClassName,
        "flex min-h-[3.25rem] items-center gap-3 px-3 py-2.5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SuperAdminSectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="space-y-1">
        {eyebrow ? (
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            {eyebrow}
          </div>
        ) : null}
        <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function SuperAdminTableShell({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(superAdminSurfaceClassName, "overflow-hidden", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

interface SuperAdminPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function SuperAdminPagination({
  page,
  pageSize,
  total,
  onPageChange,
}: SuperAdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className={cn(superAdminInsetClassName, "flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between")}>
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Showing {Math.min((page - 1) * pageSize + 1, total)} to {Math.min(page * pageSize, total)} of {total} results
      </div>
      <div className="flex items-center justify-end gap-2">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Page {page} of {totalPages}
        </div>
        <Button variant="outline" size="icon" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous page</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next page</span>
        </Button>
      </div>
    </div>
  );
}

export function SuperAdminInlineStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <div className={cn(superAdminMutedPanelClassName, "px-3 py-2")}>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className={cn("mt-1 text-lg font-black tracking-tight", toneClassNames[tone])}>{value}</div>
    </div>
  );
}

export function SuperAdminEmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        superAdminInsetClassName,
        "flex min-h-[220px] flex-col items-center justify-center gap-3 p-8 text-center",
        className
      )}
    >
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  );
}
