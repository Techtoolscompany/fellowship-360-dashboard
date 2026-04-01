"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Activity,
  AlertTriangle,
  RefreshCcw,
  Search,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SuperAdminInlineStat,
  SuperAdminPageHeader,
  SuperAdminSectionHeading,
  SuperAdminTableShell,
  SuperAdminToolbar,
  SuperAdminToolbarGroup,
} from "@/components/super-admin/primitives";
import type { AgencyOrgHealthRow } from "@/lib/super-admin/agency-launch-contracts";

type HealthApiResponse = {
  success: boolean;
  rows: AgencyOrgHealthRow[];
  planOptions: string[];
  summary: {
    total: number;
    critical: number;
    degraded: number;
    healthy: number;
  };
  error?: string;
};

function statusBadgeVariant(status: AgencyOrgHealthRow["status"]) {
  if (status === "critical") return "destructive" as const;
  if (status === "degraded") return "secondary" as const;
  return "outline" as const;
}

function formatHeartbeat(minutes: number | null) {
  if (minutes === null) return "No signal";
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = (minutes / 60).toFixed(1);
  return `${hours}h`;
}

export default function SuperAdminHealthPage() {
  const [status, setStatus] = useState<"all" | "critical" | "degraded" | "healthy">("all");
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");

  const params = useMemo(() => {
    const searchParams = new URLSearchParams();
    searchParams.set("status", status);
    if (search.trim()) {
      searchParams.set("search", search.trim());
    }
    searchParams.set("plan", plan);
    return searchParams.toString();
  }, [plan, search, status]);

  const { data, isLoading, error, mutate } = useSWR<HealthApiResponse>(
    `/api/super-admin/organizations/health?${params}`
  );

  const rows = data?.rows ?? [];
  const summary = data?.summary ?? {
    total: 0,
    critical: 0,
    degraded: 0,
    healthy: 0,
  };

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        eyebrow="Launch Risk"
        eyebrowIcon={Activity}
        title="Agency Health Board"
        description="Platform-wide readiness and failure pressure across church launches, providers, automations, and SMS device health."
        actions={
          <Button variant="outline" onClick={() => void mutate()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh board
          </Button>
        }
        stats={[
          { label: "Churches", value: summary.total },
          { label: "Critical", value: summary.critical, detail: "Blocking issues" },
          { label: "Degraded", value: summary.degraded, detail: "Needs follow-up" },
          { label: "Healthy", value: summary.healthy, detail: "Launch-ready" },
        ]}
      />

      <SuperAdminToolbar>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <SuperAdminToolbarGroup>
            <div className="relative w-full">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search church name..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
            </div>
          </SuperAdminToolbarGroup>

          <div className="grid gap-3 sm:grid-cols-3">
            <SuperAdminToolbarGroup>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as "all" | "critical" | "degraded" | "healthy")}
              >
                <SelectTrigger className="border-0 bg-transparent px-0 shadow-none focus:ring-0 dark:bg-transparent">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="degraded">Degraded</SelectItem>
                  <SelectItem value="healthy">Healthy</SelectItem>
                </SelectContent>
              </Select>
            </SuperAdminToolbarGroup>
            <SuperAdminToolbarGroup>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="border-0 bg-transparent px-0 shadow-none focus:ring-0 dark:bg-transparent">
                  <SelectValue placeholder="Plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plans</SelectItem>
                  {(data?.planOptions ?? []).map((planOption) => (
                    <SelectItem key={planOption} value={planOption}>
                      {planOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SuperAdminToolbarGroup>
            <SuperAdminInlineStat label="Action Queue" value={summary.critical + summary.degraded} tone="warning" />
          </div>
        </div>
      </SuperAdminToolbar>

      <SuperAdminTableShell className="p-0">
        <div className="border-b border-slate-200/70 px-5 py-4 dark:border-slate-800/80">
          <SuperAdminSectionHeading
            eyebrow="Board"
            title="Church launch pressure"
            description="Each row consolidates readiness, provider state, automation failures, and SMS heartbeat so the next action is obvious."
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[260px]">Church</TableHead>
              <TableHead className="min-w-[220px]">Launch State</TableHead>
              <TableHead className="min-w-[320px]">Reliability Signals</TableHead>
              <TableHead className="w-[180px] text-right">Next Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  Loading health board...
                </TableCell>
              </TableRow>
            ) : error || data?.success === false ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-destructive">
                  {data?.error ?? "Failed to load health board"}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  No organizations match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.organizationId} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/40">
                  <TableCell>
                    <div className="space-y-2">
                      <div className="font-semibold text-slate-900 dark:text-white">{row.organizationName}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        {row.planName ? <Badge variant="outline">{row.planName}</Badge> : <Badge variant="outline">No plan</Badge>}
                        <span>{row.totalAiEvents24h} AI events in 24h</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusBadgeVariant(row.status)} className="capitalize">
                          {row.status}
                        </Badge>
                        {row.criticalIssuesCount > 0 ? (
                          <Badge variant="outline">{row.criticalIssuesCount} issues</Badge>
                        ) : null}
                      </div>
                      <div className="text-sm text-slate-700 dark:text-slate-200">
                        Readiness <span className="font-semibold text-slate-900 dark:text-white">{row.readinessScore}/100</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">Provider:</span> {row.providerHealthStatus}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">AI error:</span> {row.aiErrorRate24h}%
                      </div>
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">Automation:</span> {row.automationFailures24h} failures
                      </div>
                      <div className="inline-flex items-center gap-2">
                        {row.smsHeartbeatMinutes === null ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : row.smsHeartbeatMinutes <= 10 ? (
                          <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Stethoscope className="h-4 w-4 text-amber-500" />
                        )}
                        <span>
                          <span className="font-semibold text-slate-900 dark:text-white">SMS:</span> {formatHeartbeat(row.smsHeartbeatMinutes)}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end gap-2">
                      <Button size="sm" asChild>
                        <Link href={row.nextActionHref}>{row.nextActionLabel}</Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/super-admin/organizations/${row.organizationId}`}>Open church</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </SuperAdminTableShell>
    </div>
  );
}
