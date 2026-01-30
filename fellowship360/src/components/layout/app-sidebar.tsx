"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { navigationSections } from "@/lib/navigation";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar className="border-r border-border">
      {/* Logo */}
      <SidebarHeader className="px-6 py-5">
        <Link href="/home" className="flex items-center gap-2 no-underline">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400">
            <span className="text-sm font-bold text-dark">F</span>
          </div>
          <span className="text-lg font-semibold text-foreground">
            Fellowship 360
          </span>
        </Link>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className="px-3">
        {navigationSections.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel className="px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {section.title}
            </SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.path ||
                  item.subItems.some((sub) => pathname.startsWith(sub.path));
                const showSubs = isActive && item.subItems.length > 0;

                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className={
                        isActive
                          ? "bg-lime-400 text-dark hover:bg-lime-500 font-medium"
                          : "text-foreground hover:bg-muted"
                      }
                    >
                      <Link href={item.path}>
                        <Icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                    {showSubs && (
                      <SidebarMenuSub>
                        {item.subItems.map((sub) => (
                          <SidebarMenuSubItem key={sub.path}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={pathname === sub.path}
                              className={
                                pathname === sub.path
                                  ? "font-medium text-foreground"
                                  : "text-muted-foreground"
                              }
                            >
                              <Link href={sub.path}>{sub.name}</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-4">
        <button className="flex w-full items-center justify-center gap-2 rounded-pill bg-dark px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-dark/90">
          <Plus className="h-4 w-4" />
          Quick Add
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
