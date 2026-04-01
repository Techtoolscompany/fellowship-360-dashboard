export const ACCESS_SECTIONS = [
  "grace",
  "people",
  "tasks",
  "finance",
  "automations",
  "reports",
  "communications",
  "settings",
  "onboarding",
  "service_ops",
] as const;

export const ORG_ROLES = ["owner", "admin", "user"] as const;

export type AccessSection = (typeof ACCESS_SECTIONS)[number];
export type OrgRole = (typeof ORG_ROLES)[number];
export type RoleAccessMatrix = Record<OrgRole, AccessSection[]>;

const DEFAULT_ROLE_ACCESS: RoleAccessMatrix = {
  owner: [...ACCESS_SECTIONS],
  admin: [...ACCESS_SECTIONS],
  user: ["grace", "people", "tasks", "communications", "onboarding"],
};

const SECTION_DEFAULT_PATH: Record<AccessSection, string> = {
  grace: "/app/grace?tab=command",
  people: "/app/contacts",
  tasks: "/app/tasks",
  finance: "/app/donations",
  automations: "/app/automations",
  reports: "/app/reports",
  communications: "/app/conversations",
  settings: "/app/settings",
  onboarding: "/app/get-started",
  service_ops: "/app/volunteers",
};

const ROUTE_ACCESS_EXACT: Array<{ path: string; section: AccessSection }> = [
  { path: "/app", section: "grace" },
];

const ROUTE_ACCESS_PREFIXES: Array<{ prefix: string; section: AccessSection }> = [
  { prefix: "/app/grace", section: "grace" },
  { prefix: "/app/grace-center", section: "grace" },
  { prefix: "/app/home", section: "grace" },
  { prefix: "/app/contacts", section: "people" },
  { prefix: "/app/pipeline", section: "people" },
  { prefix: "/app/tasks", section: "tasks" },
  { prefix: "/app/donations", section: "finance" },
  { prefix: "/app/donors", section: "finance" },
  { prefix: "/app/pledges", section: "finance" },
  { prefix: "/app/automations", section: "automations" },
  { prefix: "/app/templates", section: "automations" },
  { prefix: "/app/reports", section: "reports" },
  { prefix: "/app/broadcasts", section: "communications" },
  { prefix: "/app/conversations", section: "communications" },
  { prefix: "/app/inbox", section: "communications" },
  { prefix: "/app/calls", section: "communications" },
  { prefix: "/app/appointments", section: "communications" },
  { prefix: "/app/calendar", section: "communications" },
  { prefix: "/app/prayer-requests", section: "communications" },
  { prefix: "/app/settings", section: "settings" },
  { prefix: "/app/get-started", section: "onboarding" },
  { prefix: "/app/seed", section: "onboarding" },
  { prefix: "/app/subscribe", section: "onboarding" },
  { prefix: "/app/volunteers", section: "service_ops" },
  { prefix: "/app/ministries", section: "service_ops" },
];

function uniqueSections(sections: AccessSection[]) {
  return Array.from(new Set(sections));
}

export function normalizeAccessSections(raw: string[] | null | undefined): AccessSection[] {
  if (!raw || raw.length === 0) return [];
  return uniqueSections(
    raw.filter((section): section is AccessSection =>
      ACCESS_SECTIONS.includes(section as AccessSection)
    )
  );
}

export function normalizeRoleAccessMatrix(matrix: Partial<RoleAccessMatrix>): RoleAccessMatrix {
  const next: RoleAccessMatrix = {
    owner: normalizeAccessSections(matrix.owner ?? DEFAULT_ROLE_ACCESS.owner),
    admin: normalizeAccessSections(matrix.admin ?? DEFAULT_ROLE_ACCESS.admin),
    user: normalizeAccessSections(matrix.user ?? DEFAULT_ROLE_ACCESS.user),
  };

  // Owner always has full access.
  next.owner = [...ACCESS_SECTIONS];

  return next;
}

export function defaultRoleAccessMatrix(): RoleAccessMatrix {
  return {
    owner: [...DEFAULT_ROLE_ACCESS.owner],
    admin: [...DEFAULT_ROLE_ACCESS.admin],
    user: [...DEFAULT_ROLE_ACCESS.user],
  };
}

export function getAllowedSectionsForRole(matrix: RoleAccessMatrix, role: string) {
  if (role === "owner") return [...ACCESS_SECTIONS];
  if (role === "admin") return matrix.admin;
  return matrix.user;
}

export function resolveAccessSectionFromPath(pathname: string): AccessSection | null {
  for (const row of ROUTE_ACCESS_EXACT) {
    if (pathname === row.path) return row.section;
  }

  const sorted = [...ROUTE_ACCESS_PREFIXES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const row of sorted) {
    if (pathname === row.prefix || pathname.startsWith(`${row.prefix}/`)) {
      return row.section;
    }
  }
  return null;
}

export function isPathAllowed(pathname: string, allowedSections: AccessSection[]) {
  const section = resolveAccessSectionFromPath(pathname);
  if (!section) return true;
  return allowedSections.includes(section);
}

export function getDefaultPathForAllowedSections(allowedSections: AccessSection[]) {
  const priority: AccessSection[] = [
    "grace",
    "people",
    "tasks",
    "communications",
    "onboarding",
    "finance",
    "automations",
    "reports",
    "service_ops",
    "settings",
  ];

  const nextSection = priority.find((section) => allowedSections.includes(section));
  if (!nextSection) return "/app";
  return SECTION_DEFAULT_PATH[nextSection];
}

export const ACCESS_SECTION_METADATA: Record<
  AccessSection,
  { label: string; description: string }
> = {
  grace: {
    label: "Grace Command Center",
    description: "AI workspace, assistant command tabs, and follow-up control.",
  },
  people: {
    label: "People",
    description: "Contacts, member records, and profile updates.",
  },
  tasks: {
    label: "Tasks",
    description: "Task queue, ownership, and completion updates.",
  },
  finance: {
    label: "Finance",
    description: "Donations, pledges, and financial views.",
  },
  automations: {
    label: "Automations",
    description: "Template installs, workflow builder, and automation runs.",
  },
  reports: {
    label: "Reports",
    description: "Growth, engagement, model health, and analytics views.",
  },
  communications: {
    label: "Communications",
    description: "Conversations, broadcasts, calls, calendar, and appointments.",
  },
  settings: {
    label: "Settings",
    description: "Organization settings, team management, and integrations.",
  },
  onboarding: {
    label: "Get Started",
    description: "Onboarding setup, readiness, and guided launch flows.",
  },
  service_ops: {
    label: "Service Operations",
    description: "Volunteer and ministry operations surfaces.",
  },
};
