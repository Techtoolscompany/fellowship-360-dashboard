"use client"

import * as React from "react"
import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

// This is sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "Acme Inc",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "IndieKit",
      url: "/app",
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: "Dashboard",
          url: "/app",
        },
        {
          title: "Projects",
          url: "/app/projects",
        },
        {
          title: "User Settings",
          url: "/app/user/settings",
        },
      ],
    },
    {
      title: "Models",
      url: "/app/models",
      icon: Bot,
      items: [
        {
          title: "Genesis",
          url: "/app/models/genesis",
        },
        {
          title: "Explorer",
          url: "/app/models/explorer",
        },
        {
          title: "Quantum",
          url: "/app/models/quantum",
        },
      ],
    },
    {
      title: "Documentation",
      url: "/app/docs",
      icon: BookOpen,
      items: [
        {
          title: "Introduction",
          url: "/app/docs/introduction",
        },
        {
          title: "Get Started",
          url: "/app/docs/getting-started",
        },
        {
          title: "Tutorials",
          url: "/app/docs/tutorials",
        },
        {
          title: "Changelog",
          url: "/app/docs/changelog",
        },
      ],
    },
    {
      title: "Settings",
      url: "/app/settings",
      icon: Settings2,
      items: [
        {
          title: "General",
          url: "/app/settings",
        },
        {
          title: "Team",
          url: "/app/settings/team",
        },
        {
          title: "Billing",
          url: "/app/settings/billing",
        },
        {
          title: "Integrations",
          url: "/app/settings/integrations",
        },
        {
          title: "Grace AI",
          url: "/app/settings/grace",
        },
      ],
    },
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "/app/projects/design",
      icon: Frame,
    },
    {
      name: "Sales & Marketing",
      url: "/app/projects/sales",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "/app/projects/travel",
      icon: Map,
    },
  ],
}

export function AppSidebar({ className, ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar 
      collapsible="icon" 
      className={cn(
        "bg-linear-to-b from-background/80 to-background border-r border-border/40 backdrop-blur-xl",
        className
      )}
      {...props}
    >
      <SidebarHeader className="border-b border-border/40 bg-background/50">
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent className="px-4 py-4">
        <div className="space-y-6">
          <NavMain items={data.navMain} />
          <NavProjects projects={data.projects} />
        </div>
      </SidebarContent>
      <SidebarFooter className="border-t border-border/40 bg-background/50 p-4">
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail className="bg-border/40" />
    </Sidebar>
  )
}
