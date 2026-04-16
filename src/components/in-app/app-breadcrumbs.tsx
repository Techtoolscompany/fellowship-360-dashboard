"use client";

import Link from "next/link";
import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

const SEGMENT_LABELS: Record<string, string> = {
  app: "Workspace",
  appointments: "Appointments",
  automations: "Automations",
  billing: "Billing",
  broadcasts: "Messaging",
  calendar: "Calendar",
  calls: "Calls",
  contacts: "People",
  conversations: "Conversations",
  credits: "Credits",
  donations: "Finance",
  donors: "Donors",
  "get-started": "Get Started",
  grace: "Grace",
  "grace-center": "Grace Center",
  home: "Home",
  inbox: "Inbox",
  integrations: "Integrations",
  ministries: "Ministries",
  page: "Overview",
  pipeline: "Pipeline",
  "prayer-requests": "Prayer Requests",
  reports: "Reports",
  "role-matrix": "Church Roles",
  seed: "Seed Data",
  services: "Services",
  settings: "Settings",
  "scheduling-matrix": "Scheduling",
  subscribe: "Subscription",
  tasks: "Action Items",
  team: "Users & Roles",
  templates: "Templates",
  user: "User Settings",
  volunteers: "Volunteers",
};

const GRACE_TAB_LABELS: Record<string, string> = {
  care: "Care",
  guests: "Guests",
  home: "Home",
  services: "Services",
  workflow: "Workflow",
};

const DYNAMIC_SEGMENT_LABELS: Record<string, string> = {
  contacts: "Profile",
  organizations: "Organization",
  users: "User",
};

const UUID_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function formatSegment(segment: string) {
  return decodeURIComponent(segment)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSegmentLabel(segment: string, previousSegment?: string) {
  if (SEGMENT_LABELS[segment]) {
    return SEGMENT_LABELS[segment];
  }

  if (UUID_LIKE_PATTERN.test(segment)) {
    return previousSegment ? DYNAMIC_SEGMENT_LABELS[previousSegment] ?? "Details" : "Details";
  }

  return formatSegment(segment);
}

type BreadcrumbEntry = {
  href: string;
  label: string;
};

export function AppBreadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!pathname.startsWith("/app")) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  const items: BreadcrumbEntry[] = [{ href: "/app", label: "Workspace" }];
  let currentHref = "";

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    currentHref += `/${segment}`;

    if (segment === "app") {
      continue;
    }

    items.push({
      href: currentHref,
      label: getSegmentLabel(segment, segments[index - 1]),
    });
  }

  if (segments[1] === "grace") {
    const activeTab = searchParams.get("tab");
    if (activeTab && GRACE_TAB_LABELS[activeTab]) {
      items.push({
        href: `${pathname}?tab=${activeTab}`,
        label: GRACE_TAB_LABELS[activeTab],
      });
    }
  }

  if (items.length <= 1) {
    return null;
  }

  return (
    <Breadcrumb className={cn("mb-4", className)}>
      <BreadcrumbList>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <React.Fragment key={`${item.href}-${item.label}`}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast ? <BreadcrumbSeparator /> : null}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
