"use client";

import React, { useState, useEffect } from "react";
import useUser from "@/lib/users/useUser";
import useOrganization from "@/lib/organizations/useOrganization";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Zap,
  Users,
  CheckCircle,
  MessageCircle,
  Clock,
  BarChart2,
  Shield,
  MapPin,
  Menu,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Bot,
  Plug,
  Sparkles,
  CalendarClock,
  ListChecks,
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
import { ThemeSwitcher } from "@/components/theme-switcher";

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
    isActive = currentTab === hrefTab || (hrefTab === "command" && !currentTab);
  }

  // Clean Style: No background overlay on active.
  // Active = Dark Text + Lime Green Icon.
  const content = (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-transparent text-foreground"
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

function SidebarContent({ className, isCollapsed }: { className?: string; isCollapsed?: boolean }) {
  const { user } = useUser();
  const [collapsedSections, setCollapsedSections] = React.useState<Record<string, boolean>>({
    explore: true,
    onboarding: true,
  });

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const SectionHeader = ({ title, section }: { title: string; section: string }) => {
    if (isCollapsed) return null;
    return (
      <button
        onClick={() => toggleSection(section)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground"
      >
        {title}
        {collapsedSections[section] ? (
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
        {/* Grace Section */}
        <SectionHeader title="Grace" section="grace" />
        {!collapsedSections.grace && (
          <div className="space-y-0.5">
            <NavItem href="/app?tab=command" icon={Zap} isCollapsed={isCollapsed} badgeLabel="Live">
              Grace
            </NavItem>
          </div>
        )}

        {/* Ministry Workflows Section */}
        <SectionHeader title="Ministry Workflows" section="core" />
        {!collapsedSections.core && (
          <div className="space-y-0.5">
            <NavItem href="/app?tab=inbox" icon={MessageCircle} isCollapsed={isCollapsed}>
              Communications
            </NavItem>
            <NavItem href="/app/contacts" icon={Users} isCollapsed={isCollapsed}>
              People
            </NavItem>
            <NavItem href="/app/tasks" icon={CheckCircle} isCollapsed={isCollapsed}>
              Action Items
            </NavItem>
            <NavItem href="/app?tab=calendar" icon={Clock} isCollapsed={isCollapsed}>
              Calendar
            </NavItem>
            <NavItem href="/app?tab=operations" icon={Bot} isCollapsed={isCollapsed}>
              Service Planning
            </NavItem>
            <NavItem href="/app/settings/role-matrix" icon={ListChecks} isCollapsed={isCollapsed}>
              Church Roles
            </NavItem>
            <NavItem href="/app/settings/scheduling-matrix" icon={CalendarClock} isCollapsed={isCollapsed}>
              Scheduling
            </NavItem>
            <NavItem href="/app?tab=visitors" icon={MapPin} isCollapsed={isCollapsed}>
              Guest Follow-Up
            </NavItem>
          </div>
        )}

        {/* Onboarding Section */}
        <SectionHeader title="Onboarding" section="onboarding" />
        {!collapsedSections.onboarding && (
          <div className="space-y-0.5">
            <NavItem href="/app/get-started" icon={MapPin} isCollapsed={isCollapsed} badgeLabel="Setup">
              Get Started
            </NavItem>
          </div>
        )}

        {/* Administration Section */}
        <SectionHeader title="Administration" section="administration" />
        {!collapsedSections.administration && (
          <div className="space-y-0.5">
            <NavItem href="/app/settings" icon={Shield} isCollapsed={isCollapsed}>
              Organization Settings
            </NavItem>
            <NavItem href="/app/settings/team" icon={Shield} isCollapsed={isCollapsed}>
              Users & Roles
            </NavItem>
            <NavItem href="/app/settings/billing" icon={CreditCard} isCollapsed={isCollapsed}>
              Billing
            </NavItem>
            <NavItem href="/app/settings/integrations" icon={Plug} isCollapsed={isCollapsed}>
              Integrations
            </NavItem>
            <NavItem href="/app/settings/grace" icon={Sparkles} isCollapsed={isCollapsed}>
              Grace Runtime
            </NavItem>
          </div>
        )}

        {/* Explore Section (Beta) */}
        <SectionHeader title="Explore" section="explore" />
        {!collapsedSections.explore && (
          <div className="space-y-0.5">
            <NavItem href="/app/broadcasts" icon={Zap} isCollapsed={isCollapsed} badgeLabel="Beta">
              Broadcasts
            </NavItem>
            <NavItem href="/app/reports" icon={BarChart2} isCollapsed={isCollapsed} badgeLabel="Beta">
              Reports
            </NavItem>
          </div>
        )}
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

  // Close mobile menu when route changes
  const pathname = usePathname();
  useEffect(() => {
    // Remove the setIsMobileOpen call since we no longer need it
  }, [pathname]);

  useEffect(() => {
    if (!isUserLoading && !isOrgLoading && !organization) {
      router.push("/app/create-organization");
    }
  }, [isUserLoading, isOrgLoading, organization, pathname, router]);

  if (isUserLoading || isOrgLoading) {
    return <PageLoader />;
  }

  return (
    <TooltipProvider>
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
            <SidebarContent isCollapsed={isCollapsed} />
          </div>
          <div className="flex items-center justify-center gap-1 mb-3 px-2">
            <ThemeSwitcher />
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-accent"
              onClick={() => setIsCollapsed(!isCollapsed)}
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
              <SheetContent side="right" className="w-64 p-0 pt-16">
                <div className="p-3">
                  <SidebarContent />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 md:pt-0 pt-16">
            <div className="p-6 max-w-7xl mx-auto w-full">{children}</div>
          </div>
          <InAppFooter />
        </div>
      </div>
    </TooltipProvider>
  );
}

export default AppLayout;
