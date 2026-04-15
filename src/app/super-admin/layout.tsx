"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  Activity,
  Building2,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Rocket,
  ShieldCheck,
  Smartphone,
  Ticket,
  Users,
  UserCog,
} from "lucide-react";
import { appConfig } from "@/lib/config";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import type { SuperAdminPermission } from "@/lib/super-admin/permissions";
import { superAdminSurfaceClassName } from "@/components/super-admin/primitives";

const navigation: Array<{
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  detail: string;
  permission?: SuperAdminPermission;
}> = [
  {
    name: "Overview",
    href: "/super-admin",
    icon: LayoutDashboard,
    detail: "Command center",
  },
  {
    name: "Health Board",
    href: "/super-admin/health",
    icon: Activity,
    detail: "Launch risk",
  },
  {
    name: "Organizations",
    href: "/super-admin/organizations",
    icon: Building2,
    detail: "Church records",
  },
  {
    name: "Automations",
    href: "/super-admin/automations",
    icon: Rocket,
    detail: "Templates and rollout",
    permission: "deploy_automations",
  },
  {
    name: "SMS Devices",
    href: "/super-admin/devices",
    icon: Smartphone,
    detail: "Gateway control",
    permission: "manage_devices",
  },
  {
    name: "Users",
    href: "/super-admin/users",
    icon: Users,
    detail: "Admins and access",
    permission: "manage_users",
  },
  {
    name: "Team",
    href: "/super-admin/team",
    icon: UserCog,
    detail: "Staff permissions",
    permission: "manage_super_admin_team" as SuperAdminPermission,
  },
  {
    name: "Plans",
    href: "/super-admin/plans",
    icon: CreditCard,
    detail: "Commercial setup",
    permission: "manage_plans",
  },
  {
    name: "Messages",
    href: "/super-admin/messages",
    icon: MessageSquare,
    detail: "Inbox pressure",
    permission: "manage_messages",
  },
  {
    name: "Lifetime Deal",
    href: "/super-admin/coupons",
    icon: Ticket,
    detail: "Offers",
    permission: "manage_coupons",
  },
  {
    name: "Waitlist",
    href: "/super-admin/waitlist",
    icon: ClipboardList,
    detail: "Pipeline",
    permission: "manage_waitlist",
  },
];

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

function routeIsActive(pathname: string, href: string) {
  if (href === "/super-admin") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const permissions = session?.user?.superAdmin?.permissions ?? [];
  const visibleNavigation = navigation.filter(
    (item) => !item.permission || permissions.includes(item.permission)
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(132,204,22,0.08),transparent_30%),linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.9))] dark:bg-[radial-gradient(circle_at_top,rgba(132,204,22,0.08),transparent_24%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(2,6,23,0.92))]">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65 dark:border-slate-800/80">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 md:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/85 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5 text-lime-500" />
                Platform Control
              </div>
              <div className="space-y-0.5">
                <Link
                  href="/super-admin"
                  className="text-base font-black tracking-tight text-slate-900 dark:text-white md:text-lg"
                >
                  {appConfig.projectName} Super Admin
                </Link>
                <p className="max-w-3xl text-sm text-slate-500 dark:text-slate-300">
                  Fellowship 360 operating workspace for platform, launch, and internal control work.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start lg:self-auto">
              <ThemeSwitcher />
              <Button variant="outline" size="sm" asChild>
                <Link href="/super-admin/logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log Out
                </Link>
              </Button>
            </div>
          </div>

          <nav
            className={cn(
              superAdminSurfaceClassName,
              "flex gap-1.5 overflow-x-auto px-2 py-2 scrollbar-hide"
            )}
          >
            {visibleNavigation.map((item) => {
              const Icon = item.icon;
              const isActive = routeIsActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group min-w-fit shrink-0 rounded-2xl px-3 py-2 transition-colors duration-200",
                    isActive
                      ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                      : "text-slate-700 hover:bg-slate-100/90 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/80 dark:hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "rounded-xl p-2 transition-colors",
                        isActive
                          ? "bg-white/10 text-lime-300 dark:bg-slate-900/10 dark:text-slate-900"
                          : "bg-slate-100 text-slate-500 group-hover:text-slate-900 dark:bg-slate-950/70 dark:text-slate-300 dark:group-hover:text-white"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-black tracking-wide">
                        {item.name}
                      </p>
                      <p
                        className={cn(
                          "hidden truncate text-[10px] font-semibold uppercase tracking-[0.16em] md:block",
                          isActive
                            ? "text-slate-300 dark:text-slate-600"
                            : "text-slate-500 dark:text-slate-400"
                        )}
                      >
                        {item.detail}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-7">{children}</main>
    </div>
  );
}

export default SuperAdminLayout;
