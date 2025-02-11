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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
