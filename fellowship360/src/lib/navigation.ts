import {
  Home,
  Users,
  Target,
  MessageCircle,
  Phone,
  Heart,
  Calendar,
  DollarSign,
  BarChart2,
  Settings,
  Shield,
  type LucideIcon,
} from "lucide-react";

export interface NavSubItem {
  name: string;
  path: string;
}

export interface NavItem {
  id: number;
  name: string;
  path: string;
  icon: LucideIcon;
  subItems: NavSubItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const menuItems: NavItem[] = [
  {
    id: 0,
    name: "Home",
    path: "/home",
    icon: Home,
    subItems: [],
  },
  {
    id: 1,
    name: "People",
    path: "/people/contacts",
    icon: Users,
    subItems: [
      { name: "Contacts", path: "/people/contacts" },
      { name: "Segments", path: "/people/segments" },
    ],
  },
  {
    id: 2,
    name: "Engage",
    path: "/engage/pipeline",
    icon: Target,
    subItems: [
      { name: "Pipeline", path: "/engage/pipeline" },
      { name: "Tasks", path: "/engage/tasks" },
    ],
  },
  {
    id: 3,
    name: "Comms",
    path: "/comms/conversations",
    icon: MessageCircle,
    subItems: [
      { name: "Conversations", path: "/comms/conversations" },
      { name: "Broadcasts", path: "/comms/broadcasts" },
      { name: "Templates", path: "/comms/templates" },
    ],
  },
  {
    id: 4,
    name: "Grace AI",
    path: "/grace/calls",
    icon: Phone,
    subItems: [
      { name: "Calls", path: "/grace/calls" },
      { name: "Settings", path: "/grace/settings" },
    ],
  },
  {
    id: 5,
    name: "Prayer & Care",
    path: "/care/prayer-requests",
    icon: Heart,
    subItems: [
      { name: "Prayer Requests", path: "/care/prayer-requests" },
    ],
  },
  {
    id: 6,
    name: "Scheduling",
    path: "/scheduling/calendar",
    icon: Calendar,
    subItems: [
      { name: "Calendar", path: "/scheduling/calendar" },
      { name: "Appointments", path: "/scheduling/appointments" },
      { name: "Volunteers", path: "/scheduling/volunteers" },
    ],
  },
  {
    id: 7,
    name: "Giving",
    path: "/giving/donations",
    icon: DollarSign,
    subItems: [
      { name: "Donations", path: "/giving/donations" },
      { name: "Donors", path: "/giving/donors" },
      { name: "Pledges", path: "/giving/pledges" },
    ],
  },
  {
    id: 8,
    name: "Reports",
    path: "/reports/overview",
    icon: BarChart2,
    subItems: [
      { name: "Overview", path: "/reports/overview" },
      { name: "Attendance", path: "/reports/attendance" },
      { name: "Engagement", path: "/reports/engagement" },
    ],
  },
  {
    id: 9,
    name: "Settings",
    path: "/settings/church-profile",
    icon: Settings,
    subItems: [
      { name: "Church Profile", path: "/settings/church-profile" },
      { name: "Users & Roles", path: "/settings/users-roles" },
      { name: "Integrations", path: "/settings/integrations" },
      { name: "Billing", path: "/settings/billing" },
    ],
  },
  {
    id: 10,
    name: "Admin",
    path: "/admin/churches",
    icon: Shield,
    subItems: [
      { name: "Churches", path: "/admin/churches" },
      { name: "Provisioning", path: "/admin/provisioning" },
    ],
  },
];

const itemsByName = Object.fromEntries(menuItems.map((item) => [item.name, item]));

export const navigationSections: NavSection[] = [
  {
    title: "Main",
    items: ["Home", "People", "Engage"].map((n) => itemsByName[n]),
  },
  {
    title: "Communication",
    items: ["Comms", "Grace AI", "Prayer & Care"].map((n) => itemsByName[n]),
  },
  {
    title: "Operations",
    items: ["Scheduling", "Giving", "Reports"].map((n) => itemsByName[n]),
  },
  {
    title: "Administration",
    items: ["Settings", "Admin"].map((n) => itemsByName[n]),
  },
];
