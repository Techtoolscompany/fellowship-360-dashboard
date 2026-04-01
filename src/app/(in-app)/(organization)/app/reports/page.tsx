"use client";
import React, { useState } from "react";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import useOrganization from "@/lib/organizations/useOrganization";
import { getModelHealthDashboard, getReportsData } from "@/app/actions/reports";

type Timeframe = "week" | "month" | "quarter" | "year";

const TIMEFRAMES: { id: Timeframe; label: string }[] = [
  { id: "week",    label: "This Week" },
  { id: "month",   label: "This Month" },
  { id: "quarter", label: "Quarter" },
  { id: "year",    label: "Year" },
];

const MODEL_WINDOW_BY_TIMEFRAME: Record<Timeframe, number> = {
  week: 7,
  month: 30,
  quarter: 60,
  year: 90,
};

const KPI_STYLES = [
  { icon: "person_add",         iconBg: "bg-blue-100 dark:bg-blue-900/30",     iconColor: "text-blue-600 dark:text-blue-400" },
  { icon: "calendar_today",     iconBg: "bg-[#84cc16]/10",                     iconColor: "text-[#84cc16]" },
  { icon: "task_alt",           iconBg: "bg-amber-100 dark:bg-amber-900/30",   iconColor: "text-amber-600 dark:text-amber-400" },
  { icon: "volunteer_activism", iconBg: "bg-purple-100 dark:bg-purple-900/30", iconColor: "text-purple-600 dark:text-purple-400" },
];

export default function ReportsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [timeframe, setTimeframe] = useState<Timeframe>("month");
  const timeframeLabel =
    TIMEFRAMES.find((row) => row.id === timeframe)?.label ?? "This Month";
  const growthWindowLabel: Record<Timeframe, string> = {
    week: "7d",
    month: "30d",
    quarter: "90d",
    year: "12m",
  };

  const { data, isLoading } = useSWR(
    orgId ? ["reports", orgId, timeframe] : null,
    () => getReportsData(orgId!, timeframe)
  );
  const { data: modelHealth, isLoading: modelHealthLoading } = useSWR(
    orgId ? ["reports-model-health", orgId, timeframe] : null,
    () => getModelHealthDashboard(orgId!, MODEL_WINDOW_BY_TIMEFRAME[timeframe])
  );

  const loading = isLoading;

  const kpis          = data?.kpis ?? [];
  const monthlyTrends = data?.monthlyTrends ?? [];
  const engagementData = data?.engagement ?? [];
  const ministryData  = data?.ministries ?? [];
  const modelRows = modelHealth?.byModel ?? [];
  const byDay = modelHealth?.byDay ?? [];

  const maxTrendVal = Math.max(...monthlyTrends.flatMap(m => [m.visitors, m.members]), 1);
  const maxLatency = Math.max(...byDay.map((day) => day.avgLatencyMs), 1);

  const handleExport = () => {
    if (!data) return;
    const lines = ["section,label,value,extra"];
    for (const k of data.kpis) lines.push(`kpi,${JSON.stringify(k.label)},${JSON.stringify(k.value)},${JSON.stringify(k.change)}`);
    for (const e of data.engagement) lines.push(`engagement,${JSON.stringify(e.label)},${e.percentage},`);
    for (const m of data.monthlyTrends) lines.push(`monthly,${JSON.stringify(m.month)},${m.visitors},${m.members}`);
    if (modelHealth) {
      lines.push(
        `model_totals,ai_decisions,${modelHealth.totals.aiDecisions},window_days=${modelHealth.windowDays}`
      );
      lines.push(
        `model_totals,estimated_cost_usd,${modelHealth.totals.estimatedCostUsd},avg_latency_ms=${modelHealth.totals.avgLatencyMs}`
      );
      for (const row of modelHealth.byModel) {
        lines.push(
          `model,${JSON.stringify(row.model)},${row.total},success_rate=${row.successRatePercent}%|p95_ms=${row.p95LatencyMs}|cost_usd=${row.estimatedCostUsd}`
        );
      }
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `reports-${timeframe}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col flex-1 h-full font-display bg-slate-50 dark:bg-slate-950 -m-4 sm:-m-8 min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Growth & Engagement</h1>
          <p className="text-sm text-slate-500">
            Ministry impact and reach analytics for {timeframeLabel.toLowerCase()}.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleExport}
            disabled={!data || loading}
            className="bg-lime-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-lime-600 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export Report
          </button>
        </div>
      </header>

      {loading ? (
        <div className="p-8 space-y-8 mx-auto w-full max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 w-full rounded-xl bg-slate-200 dark:bg-slate-800" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-80 w-full lg:col-span-2 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <Skeleton className="h-80 w-full rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      ) : (
        <div className="p-8 space-y-8 mx-auto w-full max-w-7xl">
          {/* High Level Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpis.map((kpi, i) => {
              const style = KPI_STYLES[i % KPI_STYLES.length];
              const isUp = kpi.trend === "up";
              return (
                <div key={kpi.label} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`size-10 ${style.iconBg} rounded-lg flex items-center justify-center ${style.iconColor}`}>
                      <span className="material-symbols-outlined">{style.icon}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      isUp ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "text-rose-500 bg-rose-50 dark:bg-rose-900/20"
                    }`}>
                      {isUp ? "+" : ""}{kpi.change}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-500">{kpi.label}</p>
                  <h3 className="text-3xl font-extrabold mt-1">{kpi.value}</h3>
                </div>
              );
            })}
          </div>

          {/* Model Health */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h3 className="text-lg font-bold">Grace Model Health</h3>
                <p className="text-sm text-slate-500">
                  Cost, latency, and reliability over the selected window.
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {modelHealth?.windowDays ?? MODEL_WINDOW_BY_TIMEFRAME[timeframe]} day window
              </span>
            </div>

            {modelHealthLoading ? (
              <Skeleton className="h-40 w-full rounded-xl bg-slate-200 dark:bg-slate-800" />
            ) : modelHealth ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricChip
                    label="AI Decisions"
                    value={String(modelHealth.totals.aiDecisions)}
                  />
                  <MetricChip
                    label="Success Rate"
                    value={`${modelHealth.totals.aiSuccessRatePercent}%`}
                  />
                  <MetricChip
                    label="Avg Latency"
                    value={`${modelHealth.totals.avgLatencyMs}ms`}
                  />
                  <MetricChip
                    label="Est. Cost"
                    value={`$${modelHealth.totals.estimatedCostUsd.toFixed(4)}`}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr>
                          <th className="px-3 py-2 text-xs uppercase text-slate-500">Model</th>
                          <th className="px-3 py-2 text-xs uppercase text-slate-500">Runs</th>
                          <th className="px-3 py-2 text-xs uppercase text-slate-500">Success</th>
                          <th className="px-3 py-2 text-xs uppercase text-slate-500">P95</th>
                          <th className="px-3 py-2 text-xs uppercase text-slate-500">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {modelRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                              No model traffic in this window.
                            </td>
                          </tr>
                        ) : (
                          modelRows.slice(0, 8).map((row) => (
                            <tr key={row.model}>
                              <td className="px-3 py-2 font-medium">{row.model}</td>
                              <td className="px-3 py-2">{row.total}</td>
                              <td className="px-3 py-2">{row.successRatePercent}%</td>
                              <td className="px-3 py-2">{row.p95LatencyMs}ms</td>
                              <td className="px-3 py-2">${row.estimatedCostUsd.toFixed(4)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <h4 className="text-sm font-bold mb-4">Daily Latency Trend</h4>
                    {byDay.length === 0 ? (
                      <div className="h-28 flex items-center justify-center text-slate-400 text-sm">
                        No daily latency samples.
                      </div>
                    ) : (
                      <div className="h-32 flex items-end gap-2">
                        {byDay.slice(-14).map((day) => {
                          const height =
                            maxLatency > 0 ? Math.max((day.avgLatencyMs / maxLatency) * 100, 10) : 10;
                          return (
                            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                              <div
                                className="w-full rounded-t bg-[#84cc16]/70"
                                style={{ height: `${height}%` }}
                                title={`${day.date}: ${day.avgLatencyMs}ms`}
                              />
                              <span className="text-[10px] text-slate-500">
                                {day.date.slice(5)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-400">Model health unavailable.</div>
            )}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Monthly Trends Chart */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-bold">Monthly Trends</h3>
                  <p className="text-sm text-slate-500">Ministry growth over the last 6 months</p>
                </div>
                <select 
                  className="bg-slate-50 dark:bg-slate-800 border-none text-xs font-bold rounded-lg focus:ring-lime-500 outline-none px-3 py-2 cursor-pointer"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                >
                  {TIMEFRAMES.map(({ id, label }) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </div>
              
              <div className="h-64 flex items-end justify-between gap-4 mt-auto">
                {monthlyTrends.length === 0 ? (
                  <div className="w-full flex items-center justify-center text-slate-400 text-sm">No trend data available</div>
                ) : (
                  monthlyTrends.map((m, idx) => {
                    const visitorH = maxTrendVal === 0 ? 0 : (m.visitors / maxTrendVal) * 100;
                    const memberH  = maxTrendVal === 0 ? 0 : (m.members  / maxTrendVal) * 100;
                    const isLast = idx === monthlyTrends.length - 1;

                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                        <div className="flex h-full w-full items-end gap-1">
                          <div
                            className={`w-1/2 rounded-t-md transition-all duration-300 ${isLast ? "bg-sky-500" : "bg-sky-500/40 group-hover:bg-sky-500"}`}
                            style={{ height: `${Math.max(visitorH, visitorH > 0 ? 8 : 0)}%` }}
                            title={`Visitors: ${m.visitors}`}
                          />
                          <div
                            className={`w-1/2 rounded-t-md transition-all duration-300 ${isLast ? "bg-lime-500" : "bg-lime-500/40 group-hover:bg-lime-500"}`}
                            style={{ height: `${Math.max(memberH, memberH > 0 ? 8 : 0)}%` }}
                            title={`Members: ${m.members}`}
                          />
                        </div>
                        <span className={`text-xs font-bold ${isLast ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>
                          {m.month}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Engagement Breakdown */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
              <h3 className="text-lg font-bold mb-1">Engagement Breakdown</h3>
              <p className="text-sm text-slate-500 mb-8">Completion rates by department</p>
              
              {engagementData.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">No data</div>
              ) : (
                <div className="space-y-6 flex-1">
                  {engagementData.map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium">{item.label}</span>
                        <span className="font-bold">{item.percentage}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-lime-500 rounded-full" style={{ width: `${item.percentage}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ministry Growth Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-lg font-bold">Ministry Growth Details</h3>
              <Link href="/app/ministries" className="text-lime-500 text-sm font-bold hover:underline">
                View All Ministries
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Ministry Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Ministry Leader</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Members</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">
                      New ({growthWindowLabel[timeframe]})
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Growth Rate</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ministryData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-sm">No ministry data available</td>
                    </tr>
                  ) : ministryData.map((m) => {
                    const isGrowing = Number(m.growthRatePercent ?? 0) > 0;
                    return (
                      <tr key={m.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4 font-bold">{m.name}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                          {m.leaderName || "Unassigned"}
                        </td>
                        <td className="px-6 py-4 font-medium">{m.members}</td>
                        <td className="px-6 py-4">{m.newMembersInWindow}</td>
                        <td className={`px-6 py-4 font-bold ${isGrowing ? "text-emerald-500" : "text-rose-500"}`}>
                          {isGrowing ? "+" : ""}
                          {m.growthRatePercent}%
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            isGrowing 
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" 
                              : "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
                          }`}>
                            {isGrowing ? "Thriving" : "Action Needed"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-black text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
