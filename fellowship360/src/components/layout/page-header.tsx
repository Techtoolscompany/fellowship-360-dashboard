"use client";

import { Calendar, ArrowRight, Filter } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function PageHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <SidebarTrigger className="h-8 w-8" />

      <div className="flex items-center gap-2">
        {/* Date Range Picker */}
        <div className="flex items-center gap-2 rounded-pill bg-muted px-3 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
            <Calendar className="h-4 w-4 text-dark" />
          </div>
          <span className="text-xs text-dark">01/01/2025 - 05/01/2025</span>
        </div>

        {/* Weekly Toggle */}
        <div className="flex items-center gap-2 rounded-pill bg-dark px-3 py-1.5">
          <span className="text-xs text-white">Weekly</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
            <ArrowRight className="h-4 w-4 text-dark" />
          </div>
        </div>

        {/* Filter Button */}
        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-transparent transition-colors hover:bg-muted">
          <Filter className="h-4 w-4 text-dark" />
        </button>
      </div>
    </header>
  );
}
