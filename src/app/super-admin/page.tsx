"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  Activity,
  ArrowRight,
  Building2,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  MessageSquareWarning,
  RefreshCcw,
  Rocket,
  ShieldCheck,
  Smartphone,
  Users,
  UserCog,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgencyOrgHealthRow } from "@/lib/super-admin/agency-launch-contracts";
import type { SuperAdminPermission } from "@/lib/super-admin/permissions";

interface SignupStat {
  date: string;
  count: number;
}

interface PlanStat {
  id: string | null;
  name: string;
  count: number;
}

interface UnreadContactsResponse {
  count: number;
}

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  createdAt: string;
  readAt: string | null;
}

interface MessagesApiResponse {
  messages: ContactMessage[];
  pagination: {
    total: number;
    pageCount: number;
    currentPage: number;
    perPage: number;
  };
}

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

const EMPTY_SUMMARY: HealthApiResponse["summary"] = {
  total: 0,
  critical: 0,
  degraded: 0,
  healthy: 0,
};

const QUICK_ACTIONS: Array<{
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  permission?: SuperAdminPermission;
}> = [
  {
    href: "/super-admin/health",
    label: "Health Board",
    description: "Triages churches that are blocked or drifting.",
    icon: Activity,
  },
  {
    href: "/super-admin/organizations",
    label: "Organizations",
    description: "Open church records, plans, access, and integrations.",
    icon: Building2,
  },
  {
    href: "/super-admin/automations/deploy",
    label: "Bulk Deploy",
    description: "Push starter workflows across churches.",
    icon: Rocket,
    permission: "deploy_automations",
  },
  {
    href: "/super-admin/devices",
    label: "SMS Devices",
    description: "Watch device assignment and heartbeat freshness.",
    icon: Smartphone,
    permission: "manage_devices",
  },
  {
    href: "/super-admin/messages",
    label: "Inbox",
    description: "Clear unread lead and support traffic.",
    icon: Inbox,
  },
  {
    href: "/super-admin/users",
    label: "Users",
    description: "Inspect admins, memberships, and impersonation flows.",
    icon: Users,
    permission: "manage_users",
  },
  {
    href: "/super-admin/team",
    label: "Team",
    description: "Invite internal staff and control super-admin permissions.",
    icon: UserCog,
    permission: "manage_super_admin_team",
  },
];

const dashboardCardClassName =
  "rounded-3xl border-border/60 bg-white/90 shadow-sm backdrop-blur-sm dark:bg-slate-900/80";

function statusBadgeVariant(status: AgencyOrgHealthRow["status"]) {
  if (status === "critical") return "destructive" as const;
  if (status === "degraded") return "secondary" as const;
  return "outline" as const;
}

function formatHeartbeat(minutes: number | null) {
  if (minutes === null) return "No signal";
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

export default function SuperAdminDashboard() {
  const { data: session } = useSession();
  const permissions = session?.user?.superAdmin?.permissions ?? [];
  const canManageDevices = permissions.includes("manage_devices");
  const {
    data: signupStats,
    isLoading: isLoadingSignups,
    mutate: mutateSignups,
  } = useSWR<SignupStat[]>("/api/super-admin/stats/signups");

  const {
    data: planStats,
    isLoading: isLoadingPlans,
    mutate: mutatePlans,
  } = useSWR<PlanStat[]>("/api/super-admin/stats/plans");

  const {
    data: healthData,
    isLoading: isLoadingHealth,
    mutate: mutateHealth,
  } = useSWR<HealthApiResponse>("/api/super-admin/organizations/health?status=all&plan=all");

  const {
    data: unreadContacts,
    isLoading: isLoadingUnreadContacts,
    mutate: mutateUnreadContacts,
  } = useSWR<UnreadContactsResponse>("/api/super-admin/stats/unread-contacts");

  const {
    data: inboxData,
    isLoading: isLoadingInbox,
    mutate: mutateInbox,
  } = useSWR<MessagesApiResponse>("/api/super-admin/messages?page=1&limit=5");
  const summary = healthData?.summary ?? EMPTY_SUMMARY;
  const healthRows = healthData?.rows ?? [];

  const chartData = useMemo(
    () =>
      (signupStats ?? []).map((stat) => ({
        date: format(new Date(stat.date), "MMM d"),
        signups: stat.count,
      })),
    [signupStats]
  );

  const signupSummary = useMemo(() => {
    const stats = signupStats ?? [];
    const total30d = stats.reduce((sum, stat) => sum + stat.count, 0);
    const last7d = stats.slice(-7).reduce((sum, stat) => sum + stat.count, 0);
    const today = stats.at(-1)?.count ?? 0;

    return {
      total30d,
      last7d,
      today,
    };
  }, [signupStats]);

  const launchQueue = useMemo(
    () => healthRows.filter((row) => row.status !== "healthy").slice(0, 6),
    [healthRows]
  );

  const planBreakdown = useMemo(
    () => [...(planStats ?? [])].sort((a, b) => b.count - a.count).slice(0, 6),
    [planStats]
  );
  const visibleQuickActions = useMemo(
    () => QUICK_ACTIONS.filter((item) => !item.permission || permissions.includes(item.permission)),
    [permissions]
  );

  const refreshAll = async () => {
    await Promise.all([
      mutateHealth(),
      mutateSignups(),
      mutatePlans(),
      mutateUnreadContacts(),
      mutateInbox(),
    ]);
  };

  const isRefreshingAny =
    isLoadingHealth ||
    isLoadingSignups ||
    isLoadingPlans ||
    isLoadingUnreadContacts ||
    isLoadingInbox;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(132,204,22,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_28%)]" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
              <LayoutDashboard className="h-3.5 w-3.5 text-lime-500" />
              Operations Command
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white md:text-4xl">
                Super Admin Command Center
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Fellowship 360 platform view across launch readiness, church risk, inbox pressure,
                and deployment work. This stays separate from church workspaces, but it should feel
                like the same product everywhere.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/super-admin/health">Open Health Board</Link>
              </Button>
              <Button onClick={() => void refreshAll()} disabled={isRefreshingAny}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh Dashboard
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/60">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Total Churches
              </div>
              <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                {summary.total}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/60">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Launch Queue
              </div>
              <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                {summary.critical + summary.degraded}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950/60">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Unread Inbox
              </div>
              <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">
                {unreadContacts?.count ?? 0}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className={dashboardCardClassName}>
          <CardHeader className="space-y-1 pb-3">
            <CardDescription>Total Churches</CardDescription>
            <CardTitle className="text-3xl">{summary.total}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            All organizations currently visible to super admin.
          </CardContent>
        </Card>
        <Card className={dashboardCardClassName}>
          <CardHeader className="space-y-1 pb-3">
            <CardDescription>Critical Churches</CardDescription>
            <CardTitle className="text-3xl text-destructive">{summary.critical}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Churches with blocking provider, SMS, or reliability issues.
          </CardContent>
        </Card>
        <Card className={dashboardCardClassName}>
          <CardHeader className="space-y-1 pb-3">
            <CardDescription>Launch Queue</CardDescription>
            <CardTitle className="text-3xl">{summary.critical + summary.degraded}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Churches that still need super-admin action before they are clean.
          </CardContent>
        </Card>
        <Card className={dashboardCardClassName}>
          <CardHeader className="space-y-1 pb-3">
            <CardDescription>Unread Inbox</CardDescription>
            <CardTitle className="text-3xl">{unreadContacts?.count ?? 0}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Contact messages waiting for review or response.
          </CardContent>
        </Card>
        <Card className={dashboardCardClassName}>
          <CardHeader className="space-y-1 pb-3">
            <CardDescription>New Users (30d)</CardDescription>
            <CardTitle className="text-3xl">{signupSummary.total30d}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <div>{signupSummary.last7d} in the last 7 days</div>
            <div>{signupSummary.today} today</div>
          </CardContent>
        </Card>
      </div>

      <Card className={dashboardCardClassName}>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Direct entry points into the workflows super admin should use daily.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {visibleQuickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-2xl border border-slate-200/80 bg-white/80 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-lime-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-950/60 dark:hover:border-lime-500/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {action.label}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-300">
                        {action.description}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-500 transition-colors group-hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:group-hover:text-white">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
        <div className="space-y-6">
          <Card className={dashboardCardClassName}>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Church Launch Queue</CardTitle>
                <CardDescription>
                  Critical and degraded churches sorted by urgency. This is where super admin should
                  start each day.
                </CardDescription>
              </div>
              <Badge variant="outline">{launchQueue.length} shown</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingHealth ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="rounded-xl border border-border/60 p-4">
                      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                      <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-muted" />
                      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : launchQueue.length === 0 ? (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                    <div>
                      <div className="font-medium text-emerald-700 dark:text-emerald-400">
                        No churches are currently in the launch queue.
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        The health board is fully green right now.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                launchQueue.map((row) => (
                  <div key={row.organizationId} className="rounded-xl border border-border/60 p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/super-admin/organizations/${row.organizationId}`}
                            className="font-semibold hover:underline"
                          >
                            {row.organizationName}
                          </Link>
                          <Badge variant={statusBadgeVariant(row.status)}>{row.status}</Badge>
                          {row.planName ? <Badge variant="outline">{row.planName}</Badge> : null}
                          {row.criticalIssuesCount > 0 ? (
                            <Badge variant="outline">{row.criticalIssuesCount} issues</Badge>
                          ) : null}
                        </div>
                        <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <span className="font-medium text-foreground">Readiness:</span> {row.readinessScore}/100
                          </div>
                          <div>
                            <span className="font-medium text-foreground">Provider:</span> {row.providerHealthStatus}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">SMS:</span> {formatHeartbeat(row.smsHeartbeatMinutes)}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">AI error:</span> {row.aiErrorRate24h}%
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {canManageDevices && row.smsHeartbeatMinutes === null ? (
                          <Button variant="outline" size="sm" asChild>
                            <Link href="/super-admin/devices">Assign device</Link>
                          </Button>
                        ) : null}
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/super-admin/organizations/${row.organizationId}`}>
                            Open church
                          </Link>
                        </Button>
                        <Button size="sm" asChild>
                          <Link href={row.nextActionHref}>
                            {row.nextActionLabel}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className={dashboardCardClassName}>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Growth Trend</CardTitle>
                <CardDescription>
                  User registration activity over the last 30 days.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">30d: {signupSummary.total30d}</Badge>
                <Badge variant="outline">7d: {signupSummary.last7d}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                {isLoadingSignups ? (
                  <div className="h-full w-full animate-pulse rounded bg-muted" />
                ) : chartData.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
                    No signup activity is available yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickMargin={10}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickMargin={10}
                        allowDecimals={false}
                        domain={[0, "auto"]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                        }}
                        labelStyle={{ color: "hsl(var(--foreground))" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="signups"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className={dashboardCardClassName}>
            <CardHeader>
              <CardTitle>Inbox Pressure</CardTitle>
              <CardDescription>
                Recent contact traffic that still needs super-admin attention.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-muted-foreground">Unread conversations</div>
                    <div className="text-3xl font-semibold">{unreadContacts?.count ?? 0}</div>
                  </div>
                  <MessageSquareWarning className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>

              {isLoadingInbox ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-xl border border-border/60 p-4">
                      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                      <div className="mt-3 h-3 w-full animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {(inboxData?.messages ?? []).map((message) => (
                    <div key={message.id} className="rounded-xl border border-border/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{message.name}</div>
                          <div className="text-xs text-muted-foreground">{message.email}</div>
                        </div>
                        {message.readAt ? (
                          <Badge variant="outline">Read</Badge>
                        ) : (
                          <Badge variant="secondary">Unread</Badge>
                        )}
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                        {message.message}
                      </p>
                      <div className="mt-3 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  ))}
                  {(inboxData?.messages?.length ?? 0) === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                      No inbound messages yet.
                    </div>
                  ) : null}
                </div>
              )}

              <Button variant="outline" className="w-full" asChild>
                <Link href="/super-admin/messages">Open Inbox</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className={dashboardCardClassName}>
            <CardHeader>
              <CardTitle>Platform Posture</CardTitle>
              <CardDescription>
                High-level distribution of church health across the platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-xl border border-border/60 p-4">
                  <div className="text-sm text-muted-foreground">Healthy</div>
                  <div className="mt-1 text-2xl font-semibold">{summary.healthy}</div>
                </div>
                <div className="rounded-xl border border-border/60 p-4">
                  <div className="text-sm text-muted-foreground">Degraded</div>
                  <div className="mt-1 text-2xl font-semibold">{summary.degraded}</div>
                </div>
                <div className="rounded-xl border border-border/60 p-4">
                  <div className="text-sm text-muted-foreground">Critical</div>
                  <div className="mt-1 text-2xl font-semibold text-destructive">{summary.critical}</div>
                </div>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/super-admin/health">Review Full Health Board</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className={dashboardCardClassName}>
            <CardHeader>
              <CardTitle>Plan Mix</CardTitle>
              <CardDescription>
                Distribution of churches across plans, including orgs still missing a plan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingPlans ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="space-y-2">
                      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                      <div className="h-2 w-full animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : planBreakdown.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 p-4 text-sm text-muted-foreground">
                  No organization plan distribution is available yet.
                </div>
              ) : (
                planBreakdown.map((plan) => {
                  const share = summary.total > 0 ? Math.round((plan.count / summary.total) * 100) : 0;
                  const width = Math.max(plan.count > 0 ? 8 : 0, share);

                  return (
                    <div key={`${plan.id ?? "plan"}-${plan.name}`} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="font-medium">{plan.name}</div>
                        <div className="text-muted-foreground">
                          {plan.count} orgs • {share}%
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card className={dashboardCardClassName}>
            <CardHeader>
              <CardTitle>Watch Items</CardTitle>
              <CardDescription>
                Fast indicators for the issues that tend to create launch friction.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <span className="text-muted-foreground">Churches with active blockers</span>
                <span className="font-semibold">{summary.critical}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <span className="text-muted-foreground">Churches still in launch queue</span>
                <span className="font-semibold">{summary.critical + summary.degraded}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <span className="text-muted-foreground">Unread contact messages</span>
                <span className="font-semibold">{unreadContacts?.count ?? 0}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <span className="text-muted-foreground">Users added in last 7 days</span>
                <span className="font-semibold">{signupSummary.last7d}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Dashboard data refreshes from live super-admin APIs. Last chart point: {chartData.at(-1)?.date ?? "n/a"}.
      </div>
    </div>
  );
}
