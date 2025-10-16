"use client";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, Plus } from "lucide-react";
import Link from "next/link";
import useOrganization from "@/lib/organizations/useOrganization";
import useSWR from "swr";
import { UserOrganization } from "@/lib/organizations/getUserOrganizations";
import { Skeleton } from "../ui/skeleton";

interface OrganizationSwitcherProps {
  className?: string;
  isCollapsed?: boolean;
}

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase();
};

export function OrganizationSwitcher({
  className,
  isCollapsed,
}: OrganizationSwitcherProps) {
  const {
    organization: currentOrganization,
    switchOrganization,
    isLoading: currentOrganizationLoading,
  } = useOrganization();
  const { data: organizations, isLoading: organizationsListLoading } = useSWR<
    UserOrganization[]
  >("/api/app/organizations");

  if (currentOrganizationLoading || organizationsListLoading) {
    return <Skeleton className="h-10 w-full rounded-lg" />;
  }

  if (!currentOrganization || !organizations) return null;

  // Sort organizations with current one first, then alphabetically
  const sortedOrganizations = [...organizations].sort((a, b) => {
    if (a.id === currentOrganization.id) return -1;
    if (b.id === currentOrganization.id) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            "rounded-lg border border-border/40",
            className
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Avatar className="h-6 w-6 rounded-md">
              <AvatarImage
                src={currentOrganization.image || undefined}
                alt=""
                className="object-cover"
              />
              <AvatarFallback className="rounded-md text-xs">
                {getInitials(currentOrganization.name)}
              </AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <span className="truncate">{currentOrganization.name}</span>
            )}
          </div>
          {!isCollapsed && (
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-100" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isCollapsed ? "center" : "start"}
        className="w-64"
      >
        {sortedOrganizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => {
              if (org.id !== currentOrganization.id) {
                switchOrganization(org.id);
              }
            }}
            className={cn(
              "flex items-center gap-2 p-2",
              org.id === currentOrganization.id && "bg-accent/50"
            )}
          >
            <Avatar className="h-8 w-8 rounded-md">
              <AvatarImage
                src={org.image || undefined}
                alt=""
                className="object-cover"
              />
              <AvatarFallback className="rounded-md">
                {getInitials(org.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate">{org.name}</span>
              <span className="text-xs text-muted-foreground">{org.role}</span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/app/create-organization"
            className="flex items-center gap-2 p-2 text-primary"
          >
            <div className="h-8 w-8 rounded-md border border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
              <Plus className="h-4 w-4" />
            </div>
            <span className="font-medium">Create Organization</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
