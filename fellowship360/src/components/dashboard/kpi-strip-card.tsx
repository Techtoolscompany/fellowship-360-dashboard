"use client";

import { ArrowDownLeft, ArrowUpRight, Eye } from "lucide-react";

export function KpiStripCard() {
  return (
    <div className="col-span-full">
      <div className="flex items-stretch border-y border-border">
        {/* Total Members */}
        <div className="flex flex-col gap-2 py-4 pr-8">
          <p className="text-base font-semibold text-dark">Total Members</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium capitalize text-dark">
              Active Members
            </span>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Eye className="h-5 w-5 text-dark" />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-8 w-px self-stretch bg-border" />

        {/* New This Month */}
        <div className="flex flex-col gap-2 py-4 pr-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-lime-400">
              <ArrowDownLeft className="h-5 w-5 text-dark" />
            </div>
            <span className="text-base text-muted-foreground">
              New This Month
            </span>
          </div>
          <p className="text-[32px] font-semibold leading-snug text-dark">
            + 38
          </p>
        </div>

        {/* Divider */}
        <div className="mx-8 w-px self-stretch bg-border" />

        {/* Total Count */}
        <div className="flex flex-col gap-2 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-lime-400">
              <ArrowUpRight className="h-5 w-5 text-dark" />
            </div>
            <span className="text-base text-muted-foreground">Total Count</span>
          </div>
          <p className="text-[32px] font-semibold leading-snug text-dark">
            1,247
          </p>
        </div>
      </div>
    </div>
  );
}
