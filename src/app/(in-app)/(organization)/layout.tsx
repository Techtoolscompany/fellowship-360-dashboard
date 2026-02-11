"use client";

import React, { useState, useEffect } from "react";
import useUser from "@/lib/users/useUser";
import useOrganization from "@/lib/organizations/useOrganization";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Zap,
  Home,
  Users,
  Layers,
  Target,
  CheckCircle,
  MessageCircle,
  Send,
  Phone,
  FileText,
  Heart,
  Calendar,
  Clock,
  UserCheck,
  DollarSign,
  UserPlus,
  GitCommit,
  BarChart2,
  Globe,
  Shield,
  Link as LinkIcon,
  Briefcase,
  Sliders,
  MapPin,
  Settings,
  Menu,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Bot,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function NavItem({
  href,
  icon: Icon,
  children,
  className,
  isNew,
  isCollapsed,
}: {
  href: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
  isNew?: boolean;
  isCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  // Clean Style: No background overlay on active.
  // Active = Dark Text + Lime Green Icon.
  const content = (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-transparent text-[#1a1d21]" // Active: No bg, Dark Text
          : "text-[#64748b] hover:bg-[#f3f4f6] hover:text-[#1f2937]",
        isCollapsed && "justify-center px-2",
        className
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 transition-colors",
          // Active Icon = Lime Green (#bbff00), Inactive = Gray
          isActive ? "text-[#bbff00] fill-[#bbff00]/20" : "text-[#9ca3af] group-hover:text-[#1a1d21]"
        )}
      />
      {!isCollapsed && (
        <>
          <span className="truncate">{children}</span>
          {isNew && (
            <Badge
              variant="secondary"
              className="ml-auto text-[10px] h-4 bg-[#bbff00]/20 text-[#4a6b00] font-medium border-none"
            >
              New
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
          {isNew && " (New)"}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function SidebarContent({ className, isCollapsed }: { className?: string; isCollapsed?: boolean }) {
  const { user } = useUser();
  const [collapsedSections, setCollapsedSections] = React.useState<Record<string, boolean>>({});

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
        {/* Main Section */}
        <SectionHeader title="Main" section="main" />
        {!collapsedSections.main && (
          <div className="space-y-0.5">
            <NavItem href="/app" icon={Zap} isCollapsed={isCollapsed} isNew>
              Grace AI
            </NavItem>
            <NavItem href="/app/grace-center" icon={Bot} isCollapsed={isCollapsed}>
              Grace Center
            </NavItem>
            <NavItem href="/app/home" icon={Home} isCollapsed={isCollapsed}>
              Ministry Overview
            </NavItem>
            <NavItem href="/app/contacts" icon={Users} isCollapsed={isCollapsed}>
              Contacts
            </NavItem>
            <NavItem href="/app/ministries" icon={Layers} isCollapsed={isCollapsed}>
              Ministries
            </NavItem>
            <NavItem href="/app/pipeline" icon={Target} isCollapsed={isCollapsed}>
              Pipeline
            </NavItem>
            <NavItem href="/app/tasks" icon={CheckCircle} isCollapsed={isCollapsed}>
              Tasks
            </NavItem>
          </div>
        )}

        {/* Communication Section */}
        <SectionHeader title="Communication" section="communication" />
        {!collapsedSections.communication && (
          <div className="space-y-0.5">
            <NavItem href="/app/conversations" icon={MessageCircle} isCollapsed={isCollapsed}>
              Conversations
            </NavItem>
            <NavItem href="/app/broadcasts" icon={Send} isCollapsed={isCollapsed}>
              Broadcasts
            </NavItem>
            <NavItem href="/app/calls" icon={Phone} isCollapsed={isCollapsed}>
              Calls
            </NavItem>
            <NavItem href="/app/templates" icon={FileText} isCollapsed={isCollapsed}>
              Templates
            </NavItem>
            <NavItem href="/app/prayer-requests" icon={Heart} isCollapsed={isCollapsed}>
              Prayer Requests
            </NavItem>
          </div>
        )}

        {/* Operations Section */}
        <SectionHeader title="Operations" section="operations" />
        {!collapsedSections.operations && (
          <div className="space-y-0.5">
            <NavItem href="/app/calendar" icon={Calendar} isCollapsed={isCollapsed}>
              Calendar
            </NavItem>
            <NavItem href="/app/appointments" icon={Clock} isCollapsed={isCollapsed}>
              Appointments
            </NavItem>
            <NavItem href="/app/volunteers" icon={UserCheck} isCollapsed={isCollapsed}>
              Volunteers
            </NavItem>
            <NavItem href="/app/donations" icon={DollarSign} isCollapsed={isCollapsed}>
              Donations
            </NavItem>
            <NavItem href="/app/donors" icon={UserPlus} isCollapsed={isCollapsed}>
              Donors
            </NavItem>
            <NavItem href="/app/pledges" icon={GitCommit} isCollapsed={isCollapsed}>
              Pledges
            </NavItem>
            <NavItem href="/app/reports" icon={BarChart2} isCollapsed={isCollapsed}>
              Reports
            </NavItem>
          </div>
        )}

        {/* Administration Section */}
        <SectionHeader title="Administration" section="administration" />
        {!collapsedSections.administration && (
          <div className="space-y-0.5">
            <NavItem href="/app/settings" icon={Globe} isCollapsed={isCollapsed}>
              Church Profile
            </NavItem>
            <NavItem href="/app/settings/team" icon={Shield} isCollapsed={isCollapsed}>
              Users & Roles
            </NavItem>
            <NavItem href="/app/settings/integrations" icon={LinkIcon} isCollapsed={isCollapsed}>
              Integrations
            </NavItem>
            <NavItem href="/app/settings/billing" icon={CreditCard} isCollapsed={isCollapsed}>
              Billing
            </NavItem>
            <NavItem href="/app/settings/grace" icon={Sliders} isCollapsed={isCollapsed}>
              Grace AI Settings
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

  // BYPASSED: Auth and org checks disabled for development
  // useEffect(() => {
  //   if (!isUserLoading && !isOrgLoading && !organization) {
  //     router.push("/app/create-organization");
  //   }
  // }, [isUserLoading, isOrgLoading, organization, pathname, router]);

  // BYPASSED: Skip loading state for development
  // if (isUserLoading || isOrgLoading) {
  //   return <PageLoader />;
  // }

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
          <Button
            variant="ghost"
            size="icon"
            className="mb-3 mx-auto hover:bg-accent"
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
