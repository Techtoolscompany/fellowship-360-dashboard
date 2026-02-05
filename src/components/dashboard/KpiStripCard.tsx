"use client";

import React from "react";
import {
  Users,
  UserPlus,
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const KpiStripCard = () => {
  // Sample data - will be replaced with real data from database
  const kpis = [
    {
      label: "Active Members",
      value: "247",
      subtitle: "Attended in last 30 days",
      icon: Users,
      trend: "+12",
      trendDirection: "up",
      iconBg: "#bbff00",
    },
    {
      label: "First-Time Visitors",
      value: "8",
      subtitle: "This week",
      icon: UserPlus,
      trend: "+3",
      trendDirection: "up",
      iconBg: "#bbff00",
    },
    {
      label: "Weekly Giving",
      value: "$4,832",
      subtitle: "This week",
      icon: DollarSign,
      trend: "-5%",
      trendDirection: "down",
      iconBg: "#bbff00",
    },
    {
      label: "Volunteer Hours",
      value: "156",
      subtitle: "This month",
      icon: Clock,
      trend: "+24",
      trendDirection: "up",
      iconBg: "#bbff00",
    },
  ];

  return (
    <div className="w-full">
      {/* Container: Matches Duralux's border-top/bottom style */}
      <div className="flex flex-wrap items-stretch border-y border-border">
        {kpis.map((kpi, index) => (
          <React.Fragment key={kpi.label}>
            {/* KPI Item Container */}
            <div
              className={cn(
                "flex flex-col gap-2 py-4 flex-1 min-w-[200px]",
                // Duralux Logic: paddingRight: 24px always. paddingLeft: 24px ONLY if index > 0.
                "pr-6",
                index > 0 ? "pl-6" : "pl-0"
              )}
            >
              {/* Label and Icon Row */}
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: kpi.iconBg }}
                >
                  <kpi.icon size={18} className="text-[#343330]" />
                </div>
                {/* Duralux font-weight: 500, color: text-secondary (muted-foreground) */}
                <span className="text-sm font-medium text-muted-foreground leading-relaxed">
                  {kpi.label}
                </span>
              </div>

              {/* Value and Trend Row */}
              <div className="flex items-end gap-2 mt-auto">
                {/* Duralux fontSize: 28px, fontWeight: 600, color: text-primary */}
                <p className="text-[28px] font-semibold text-foreground leading-[1.2]">
                  {kpi.value}
                </p>
                
                {/* Trend Indicator */}
                <span
                  className={cn(
                    "flex items-center gap-1 mb-1.5 text-xs font-medium",
                    kpi.trendDirection === "up"
                      ? "text-emerald-600"
                      : "text-red-600"
                  )}
                >
                  {kpi.trendDirection === "up" ? (
                    <TrendingUp size={12} />
                  ) : (
                    <TrendingDown size={12} />
                  )}
                  {kpi.trend}
                </span>
              </div>

              {/* Subtitle: fontSize 12px, text-muted */}
              <span className="text-xs text-muted-foreground mt-1">
                {kpi.subtitle}
              </span>
            </div>

            {/* Divider: Duralux uses a physical div for the border, not border-left/right on the element itself */}
            {index < kpis.length - 1 && (
               <div className="hidden lg:block w-[1px] bg-border my-4" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default KpiStripCard;
