"use client";

import React, { useCallback, useEffect, useState } from "react";
import useUser from "@/lib/users/useUser";
import useOrganization from "@/lib/organizations/useOrganization";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Zap,
  Users,
  CheckCircle,
  DollarSign,
  BarChart2,
  Shield,
  MapPin,
  Menu,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Plug,
  Sparkles,
  CalendarClock,
  CalendarDays,
  ListChecks,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { InAppFooter } from "@/components/layout/in-app-footer";
import { UserDropdown } from "@/components/in-app/user-dropdown";
import { PageLoader } from "@/components/in-app/page-loader";
import { OrganizationSwitcher } from "@/components/in-app/organization-switcher";
import { AppBreadcrumbs } from "@/components/in-app/app-breadcrumbs";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { GraceFab } from "@/components/grace/GraceFab";
import { getOrganizationRoleAccess } from "@/app/actions/access";
import {
  type AccessSection,
  defaultRoleAccessMatrix,
  getAllowedSectionsForRole,
  getDefaultPathForAllowedSections,
  isPathAllowed,
} from "@/lib/access/role-access.shared";

const DEFAULT_ACCESS_MATRIX = defaultRoleAccessMatrix();
const NAV_PREFERENCES_STORAGE_KEY = "f360:organization-nav-preferences";
const DEFAULT_COLLAPSED_SECTIONS: Record<string, boolean> = {
  administration: false,
  core: false,
  explore: true,
  grace: false,
  onboarding: true,
};

function NavItem({
  href,
  icon: Icon,
  children,
  className,
  badgeLabel,
  isCollapsed,
}: {
  href: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
  badgeLabel?: string;
  isCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hrefPath, hrefQuery] = href.split("?");
  const hrefParams = new URLSearchParams(hrefQuery || "");
  const hrefTab = hrefParams.get("tab");
  const currentTab = searchParams.get("tab");

  let isActive = pathname === hrefPath;
  if (isActive && hrefTab) {
    isActive = currentTab === hrefTab || (hrefTab === "home" && !currentTab);
  }

  // Clean Style: No background overlay on active.
  // Active = Dark Text + Lime Green Icon.
  const content = (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/15"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        isCollapsed && "justify-center px-2",
        className
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-colors",
          isActive ? "text-primary fill-primary/20" : "text-muted-foreground group-hover:text-foreground"
        )}
      />
      {!isCollapsed && (
        <>
          <span className="truncate">{children}</span>
          {badgeLabel && (
            <Badge
              variant="secondary"
              className="ml-auto text-[10px] h-4 bg-primary/20 text-primary-foreground font-medium border-none"
            >
              {badgeLabel}
            </Badge>
          )}
        </>
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {children}
          {badgeLabel ? ` (${badgeLabel})` : ""}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function SidebarContent({
  className,
  isCollapsed,
  allowedSections,
  canManageAccess,
  collapsedSections,
  onToggleSection,
}: {
  className?: string;
  isCollapsed?: boolean;
  allowedSections: AccessSection[];
  canManageAccess: boolean;
  collapsedSections: Record<string, boolean>;
  onToggleSection: (section: string) => void;
}) {
  const { user } = useUser();
  const allowedSectionSet = new Set(allowedSections);

  const hasAccess = (section: AccessSection) => allowedSectionSet.has(section);

  const SectionHeader = ({ title, section }: { title: string; section: string }) => {
    if (isCollapsed) return null;

    const isSectionCollapsed = collapsedSections[section] ?? false;

    return (
      <button
        type="button"
        aria-expanded={!isSectionCollapsed}
        onClick={() => onToggleSection(section)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground"
      >
        {title}
        {isSectionCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
    );
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Organization Switcher (Church Switcher) */}
      <div className={cn("mb-4", isCollapsed ? "px-2" : "px-2")}>
        <OrganizationSwitcher isCollapsed={isCollapsed} />
      </div>

      {/* Main Navigation */}
      <nav className={cn("space-y-1 flex-1 overflow-y-auto", isCollapsed ? "px-2" : "px-2")}>
        {hasAccess("grace") ? (
          <>
            <SectionHeader title="Grace" section="grace" />
            {!collapsedSections.grace && (
              <div className="space-y-0.5">
                <NavItem
                  href="/app/grace?tab=home"
                  icon={Zap}
                  isCollapsed={isCollapsed}
                  badgeLabel="Live"
                >
                  Grace
                </NavItem>
              </div>
            )}
          </>
        ) : null}

        {hasAccess("people") ||
        hasAccess("tasks") ||
        hasAccess("finance") ||
        hasAccess("automations") ||
        hasAccess("communications") ||
        hasAccess("service_ops") ? (
          <>
            <SectionHeader title="Ministry Workflows" section="core" />
            {!collapsedSections.core && (
              <div className="space-y-0.5">
                {hasAccess("people") ? (
                  <NavItem href="/app/contacts" icon={Users} isCollapsed={isCollapsed}>
                    People
                  </NavItem>
                ) : null}
                {hasAccess("tasks") ? (
                  <NavItem href="/app/tasks" icon={CheckCircle} isCollapsed={isCollapsed}>
                    Action Items
                  </NavItem>
                ) : null}
                {hasAccess("finance") ? (
                  <NavItem href="/app/donations" icon={DollarSign} isCollapsed={isCollapsed}>
                    Finance
                  </NavItem>
                ) : null}
                {hasAccess("automations") ? (
                  <NavItem href="/app/automations" icon={GitBranch} isCollapsed={isCollapsed}>
                    Automations
                  </NavItem>
                ) : null}
                {hasAccess("communications") ? (
                  <NavItem href="/app/calendar" icon={CalendarDays} isCollapsed={isCollapsed}>
                    Calendar
                  </NavItem>
                ) : null}
                {hasAccess("service_ops") ? (
                  <NavItem href="/app/services" icon={CalendarClock} isCollapsed={isCollapsed}>
                    Services
                  </NavItem>
                ) : null}
                {hasAccess("service_ops") ? (
                  <NavItem href="/app/volunteers" icon={Users} isCollapsed={isCollapsed}>
                    Volunteers
                  </NavItem>
                ) : null}
                {hasAccess("service_ops") ? (
                  <NavItem href="/app/ministries" icon={ListChecks} isCollapsed={isCollapsed}>
                    Ministries
                  </NavItem>
                ) : null}
              </div>
            )}
          </>
        ) : null}

        {hasAccess("onboarding") ? (
          <>
            <SectionHeader title="Onboarding" section="onboarding" />
            {!collapsedSections.onboarding && (
              <div className="space-y-0.5">
                <NavItem
                  href="/app/get-started"
                  icon={MapPin}
                  isCollapsed={isCollapsed}
                  badgeLabel="Setup"
                >
                  Get Started
                </NavItem>
              </div>
            )}
          </>
        ) : null}

        {hasAccess("settings") ? (
          <>
            <SectionHeader title="Administration" section="administration" />
            {!collapsedSections.administration && (
              <div className="space-y-0.5">
                <NavItem href="/app/settings" icon={Shield} isCollapsed={isCollapsed}>
                  Organization Settings
                </NavItem>
                <NavItem href="/app/settings/team" icon={Shield} isCollapsed={isCollapsed}>
                  Users & Roles
                </NavItem>
                {canManageAccess ? (
                  <NavItem href="/app/settings/access" icon={ListChecks} isCollapsed={isCollapsed}>
                    Access Control
                  </NavItem>
                ) : null}
                <NavItem href="/app/settings/role-matrix" icon={ListChecks} isCollapsed={isCollapsed}>
                  Church Roles
                </NavItem>
                <NavItem
                  href="/app/settings/scheduling-matrix"
                  icon={CalendarClock}
                  isCollapsed={isCollapsed}
                >
                  Scheduling
                </NavItem>
                <NavItem href="/app/settings/billing" icon={CreditCard} isCollapsed={isCollapsed}>
                  Billing
                </NavItem>
                <NavItem href="/app/settings/integrations" icon={Plug} isCollapsed={isCollapsed}>
                  Integrations
                </NavItem>
                <NavItem href="/app/settings/grace" icon={Sparkles} isCollapsed={isCollapsed}>
                  Grace Settings
                </NavItem>
              </div>
            )}
          </>
        ) : null}

        {hasAccess("communications") || hasAccess("reports") ? (
          <>
            <SectionHeader title="Explore" section="explore" />
            {!collapsedSections.explore && (
              <div className="space-y-0.5">
                {hasAccess("communications") ? (
                  <NavItem href="/app/broadcasts" icon={Zap} isCollapsed={isCollapsed} badgeLabel="Beta">
                    Messaging
                  </NavItem>
                ) : null}
                {hasAccess("reports") ? (
                  <NavItem href="/app/reports" icon={BarChart2} isCollapsed={isCollapsed} badgeLabel="Beta">
                    Reports
                  </NavItem>
                ) : null}
              </div>
            )}
          </>
        ) : null}
      </nav>

      {/* User Dropdown at bottom */}
      <div className={cn("border-t border-border/40 pt-3", isCollapsed ? "px-2" : "px-2")}>
        <UserDropdown 
          user={user || null} 
          variant={isCollapsed ? "compact" : "full"} 
        />
      </div>
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Bypass auth for development - hooks still called but results ignored
  const { isLoading: isUserLoading } = useUser();
  const { organization, isLoading: isOrgLoading } = useOrganization();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState(DEFAULT_COLLAPSED_SECTIONS);
  const [allowedSections, setAllowedSections] = useState<AccessSection[] | null>(null);
  const [isAccessLoading, setIsAccessLoading] = useState(true);
  const [navPreferencesReady, setNavPreferencesReady] = useState(false);

  const pathname = usePathname();
  const hideGraceFab = pathname === "/app" || pathname === "/app/grace";

  useEffect(() => {
    try {
      const storedPreferences = window.localStorage.getItem(NAV_PREFERENCES_STORAGE_KEY);
      if (!storedPreferences) {
        return;
      }

      const parsed = JSON.parse(storedPreferences) as {
        collapsedSections?: Record<string, boolean>;
        sidebarCollapsed?: boolean;
      };

      if (typeof parsed.sidebarCollapsed === "boolean") {
        setIsCollapsed(parsed.sidebarCollapsed);
      }

      if (parsed.collapsedSections && typeof parsed.collapsedSections === "object") {
        setCollapsedSections((current) => ({
          ...current,
          ...parsed.collapsedSections,
        }));
      }
    } catch (error) {
      console.error("Failed to load navigation preferences", error);
    } finally {
      setNavPreferencesReady(true);
    }
  }, []);

  useEffect(() => {
    if (!navPreferencesReady) return;

    try {
      window.localStorage.setItem(
        NAV_PREFERENCES_STORAGE_KEY,
        JSON.stringify({
          collapsedSections,
          sidebarCollapsed: isCollapsed,
        })
      );
    } catch (error) {
      console.error("Failed to save navigation preferences", error);
    }
  }, [collapsedSections, isCollapsed, navPreferencesReady]);

  useEffect(() => {
    if (!isUserLoading && !isOrgLoading && !organization) {
      router.push("/app/create-organization");
    }
  }, [isUserLoading, isOrgLoading, organization, pathname, router]);

  useEffect(() => {
    if (!organization?.id || !organization.role) {
      setAllowedSections(null);
      setIsAccessLoading(false);
      return;
    }

    let active = true;
    setIsAccessLoading(true);

    getOrganizationRoleAccess(organization.id)
      .then((data) => {
        if (!active) return;
        setAllowedSections(data.allowedSections);
      })
      .catch((error) => {
        console.error("Failed to load role access policy", error);
        if (!active) return;
        setAllowedSections(getAllowedSectionsForRole(DEFAULT_ACCESS_MATRIX, organization.role));
      })
      .finally(() => {
        if (!active) return;
        setIsAccessLoading(false);
      });

    return () => {
      active = false;
    };
  }, [organization?.id, organization?.role]);

  useEffect(() => {
    if (!organization || isAccessLoading || !allowedSections) return;
    if (isPathAllowed(pathname, allowedSections)) return;

    const nextPath = getDefaultPathForAllowedSections(allowedSections);
    if (pathname !== nextPath) {
      router.replace(nextPath);
    }
  }, [allowedSections, isAccessLoading, organization, pathname, router]);

  const effectiveAllowedSections =
    allowedSections ??
    (organization?.role
      ? getAllowedSectionsForRole(DEFAULT_ACCESS_MATRIX, organization.role)
      : []);
  const canManageAccess = organization?.role === "owner" || organization?.role === "admin";
  const handleToggleSection = useCallback((section: string) => {
    setCollapsedSections((current) => ({
      ...current,
      [section]: !(current[section] ?? false),
    }));
  }, []);

  if (isUserLoading || isOrgLoading || (organization && isAccessLoading)) {
    return <PageLoader />;
  }

  return (
    <TooltipProvider>
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-md bg-background px-4 py-2 text-sm font-medium text-foreground shadow-lg ring-1 ring-border focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-primary"
      >
        Skip to main content
      </a>
      <div className="flex min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <div
          className={cn(
            "hidden md:flex flex-col border-r border-border/40",
            isCollapsed ? "w-[80px]" : "w-64",
            "transition-all duration-300"
          )}
        >
          <div className="p-3 flex-1">
            <SidebarContent
              isCollapsed={isCollapsed}
              allowedSections={effectiveAllowedSections}
              canManageAccess={canManageAccess}
              collapsedSections={collapsedSections}
              onToggleSection={handleToggleSection}
            />
          </div>
          <div className="flex items-center justify-center gap-1 mb-3 px-2">
            <ThemeSwitcher />
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-accent"
              onClick={() => setIsCollapsed((current) => !current)}
            >
              <ChevronLeft
                className={cn(
                  "h-4 w-4 text-inherit transition-transform duration-100",
                  isCollapsed && "rotate-180"
                )}
              />
              <span className="sr-only">
                {isCollapsed ? "Expand" : "Collapse"} Sidebar
              </span>
            </Button>
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-16 border-b border-border/40 bg-background z-30 px-4">
          <div className="flex items-center justify-between h-full">
            <div className="w-[180px]">
              <OrganizationSwitcher />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-accent">
                  <Menu className="h-5 w-5 text-inherit" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[18rem] p-0 pt-16 sm:w-80">
                <div className="p-3">
                  <SidebarContent
                    allowedSections={effectiveAllowedSections}
                    canManageAccess={canManageAccess}
                    collapsedSections={collapsedSections}
                    onToggleSection={handleToggleSection}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 pt-16 focus:outline-none md:pt-0"
          >
            <div className="max-w-7xl mx-auto w-full p-6">
              <AppBreadcrumbs />
              {children}
            </div>
          </main>
          <InAppFooter />
        </div>

        {!hideGraceFab && <GraceFab />}
      </div>
    </TooltipProvider>
  );
}

export default AppLayout;
