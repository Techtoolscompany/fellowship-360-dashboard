"use client";
import React, { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Heart,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import useOrganization from "@/lib/organizations/useOrganization";
import { getReportsData } from "@/app/actions/reports";

type Timeframe = "week" | "month" | "quarter" | "year";

const ICON_MAP = {
  users: Users,
  calendar: Calendar,
  dollar: DollarSign,
  heart: Heart,
} as const;

const KPI_COLOR_MAP = {
  users: "text-[#bbff00]",
  calendar: "text-blue-400",
  dollar: "text-green-400",
  heart: "text-purple-400",
} as const;
const TIMEFRAMES: Timeframe[] = ["week", "month", "quarter", "year"];

export default function ReportsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [timeframe, setTimeframe] = useState<Timeframe>("month");
  const [data, setData] = useState<Awaited<ReturnType<typeof getReportsData>> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const result = await getReportsData(orgId, timeframe);
      setData(result);
    } catch (err) {
      console.error("Failed to load reports data:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId, timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const kpis = data?.kpis ?? [];
  const monthlyTrends = data?.monthlyTrends ?? [];
  const engagementData = data?.engagement ?? [];
  const ministryData = data?.ministries ?? [];

  const handleExport = () => {
    if (!data) return;

    const lines: string[] = [];
    lines.push("section,label,value,extra");

    for (const kpi of data.kpis) {
      lines.push(`kpi,${JSON.stringify(kpi.label)},${JSON.stringify(kpi.value)},${JSON.stringify(`${kpi.change} (${kpi.trend})`)}`);
    }

    for (const item of data.engagement) {
      lines.push(`engagement,${JSON.stringify(item.label)},${item.percentage},`);
    }

    for (const item of data.monthlyTrends) {
      lines.push(`monthly_trend,${JSON.stringify(item.month)},${item.giving},${JSON.stringify(`visitors=${item.visitors}; members=${item.members}`)}`);
    }

    for (const item of data.ministries) {
      lines.push(`ministry,${JSON.stringify(item.name)},${item.members},${JSON.stringify(`growth=${item.growth}; participation=${item.participation}%`)}`);
    }

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-${timeframe}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Reports & Analytics</h2>
          <nav aria-label="breadcrumb" className="text-sm text-muted-foreground mt-1">
            <ol className="flex items-center gap-1">
              <li><Link href="/app/home" className="hover:text-primary">Home</Link></li>
              <li>/</li>
              <li className="text-foreground font-medium" aria-current="page">Reports</li>
            </ol>
          </nav>
        </div>
        <div className="flex gap-2">
          {TIMEFRAMES.map((tf) => (
            <Button
              key={tf}
              variant={timeframe === tf ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeframe(tf)}
              className={timeframe === tf ? "bg-[#bbff00] text-[#1a1d21] hover:bg-[#a3df00]" : ""}
            >
              {tf.charAt(0).toUpperCase() + tf.slice(1)}
            </Button>
          ))}
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={!data || loading}>
            <Download size={14} /> Export
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#bbff00] mx-auto" /></div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {kpis.map((kpi) => {
              const Icon = ICON_MAP[kpi.icon as keyof typeof ICON_MAP] || Users;
              const color = KPI_COLOR_MAP[kpi.icon as keyof typeof KPI_COLOR_MAP] || "text-[#bbff00]";
              return (
                <Card key={kpi.label} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`p-2.5 rounded-xl bg-muted/50 ${color}`}>
                        <Icon size={18} />
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-medium ${kpi.trend === "up" ? "text-green-400" : "text-red-400"}`}>
                        {kpi.trend === "up" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        {kpi.change}
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Monthly Trends */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp size={16} /> Monthly Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {monthlyTrends.map((month) => (
                <div key={month.month} className="flex items-center gap-4">
                  <span className="w-8 text-xs text-muted-foreground font-medium">{month.month}</span>
                  <div className="flex-1 flex gap-2">
                    <div className="flex-1 bg-muted/30 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#bbff00]/60 to-[#bbff00] flex items-center justify-end pr-2"
                        style={{ width: `${Math.min((month.visitors / 50) * 100, 100)}%` }}
                      >
                        <span className="text-[10px] font-bold text-[#1a1d21]">{month.visitors}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right w-20">
                    <span className="text-xs text-muted-foreground">${(month.giving / 1000).toFixed(1)}k</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-4 pt-2 border-t border-border text-xs text-muted-foreground">
                <span className="w-8"></span>
                <div className="flex-1 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#bbff00]"></div>
                  <span>Visitors</span>
                </div>
                <span className="w-20 text-right">Giving</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Engagement Breakdown */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 size={16} /> Engagement Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {engagementData.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-foreground">{item.label}</span>
                    <span className="text-sm font-semibold text-foreground">{item.percentage}%</span>
                  </div>
                  <div className="w-full bg-muted/30 rounded-full h-2.5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#bbff00]/50 to-[#bbff00]"
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ministry Growth */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Users size={16} /> Ministry Growth
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-muted-foreground uppercase text-xs border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-medium">Ministry</th>
                  <th className="px-4 py-3 font-medium">Members</th>
                  <th className="px-4 py-3 font-medium">Growth</th>
                  <th className="px-4 py-3 font-medium">Participation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ministryData.map((ministry) => (
                  <tr key={ministry.name} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{ministry.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{ministry.members}</td>
                    <td className="px-4 py-3">
                      <span className="text-green-400 text-xs font-medium flex items-center gap-1">
                        <ArrowUpRight size={12} /> +{ministry.growth}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-full max-w-[120px] bg-muted/30 rounded-full h-2">
                        <div
                          className="h-full rounded-full bg-[#bbff00]"
                          style={{ width: `${ministry.participation}%` }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
        </>
      )}
    </>
  );
}
