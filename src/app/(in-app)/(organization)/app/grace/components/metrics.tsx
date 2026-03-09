"use client";

import type { ElementType } from "react";

export function TopMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: string;
}) {
  return (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-lime-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900/70">
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-lime-300/30 blur-2xl transition-opacity group-hover:opacity-100 dark:bg-lime-500/15" />
      <div className="relative mb-4 flex items-start justify-between">
        <span className="material-symbols-outlined rounded-xl bg-lime-100 px-2 py-1.5 text-[18px] text-lime-700 dark:bg-lime-500/10 dark:text-lime-300">
          {icon}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Live
        </span>
      </div>
      <div className="relative">
        <h4 className="mb-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          {value}
        </h4>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
      </div>
    </div>
  );
}

export function MinistryBriefItem({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: string | ElementType;
}) {
  const isStringIcon = typeof icon === "string";
  const IconComponent = icon as ElementType;

  return (
    <div className="bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col hover:-translate-y-1 transition-all">
      <div className="flex items-center gap-3 mb-4 text-slate-600 dark:text-slate-400">
        {isStringIcon ? (
          <span className="material-symbols-outlined text-[20px]">{icon as string}</span>
        ) : (
          <IconComponent className="w-5 h-5" />
        )}
        <span className="text-sm font-bold">{title}</span>
      </div>
      <p className="text-4xl font-black text-slate-900 dark:text-white mb-2">{value}</p>
      <p className="text-xs text-slate-500 font-medium">{detail}</p>
    </div>
  );
}
