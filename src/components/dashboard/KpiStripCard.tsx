"use client";

import React from "react";
import {
  Users,
  UserPlus,
  DollarSign,
  Clock,
  TrendingUp,
  TrendingDown,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiData {
  totalContacts: number;
  totalDonations: number;
  donationCount: number;
  broadcastsSent: number;
  totalRecipients: number;
}

interface TaskData {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
}

const KpiStripCard = ({ data, contacts, tasks }: { data?: KpiData; contacts?: number; tasks?: TaskData }) => {
  const kpis = [
    {
      label: "Active Members",
      value: data ? String(data.totalContacts) : "—",
      subtitle: "Total contacts",
      icon: Users,
      trend: "",
      trendDirection: "neutral",
      iconBg: "#bbff00",
    },
    {
      label: "Total Giving",
      value: data ? `$${data.totalDonations.toLocaleString()}` : "—",
      subtitle: `${data?.donationCount ?? 0} gifts received`,
      icon: DollarSign,
      trend: "",
      trendDirection: "neutral",
      iconBg: "#bbff00",
    },
    {
      label: "Tasks Completed",
      value: tasks ? `${tasks.completed}/${tasks.total}` : "—",
      subtitle: `${tasks?.inProgress ?? 0} in progress`,
      icon: CheckCircle,
      trend: "",
      trendDirection: "neutral",
      iconBg: "#bbff00",
    },
    {
      label: "Broadcasts",
      value: data ? String(data.broadcastsSent) : "—",
      subtitle: `${data?.totalRecipients ?? 0} people reached`,
      icon: UserPlus,
      trend: "",
      trendDirection: "neutral",
      iconBg: "#bbff00",
    },
  ];

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-stretch border-y border-border">
        {kpis.map((kpi, index) => (
          <React.Fragment key={kpi.label}>
            <div
              className={cn(
                "flex flex-col gap-2 py-4 flex-1 min-w-[200px]",
                "pr-6",
                index > 0 ? "pl-6" : "pl-0"
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: kpi.iconBg }}
                >
                  <kpi.icon size={18} className="text-[#343330]" />
                </div>
                <span className="text-sm font-medium text-muted-foreground leading-relaxed">
                  {kpi.label}
                </span>
              </div>

              <div className="flex items-end gap-2 mt-auto">
                <p className="text-[28px] font-semibold text-foreground leading-[1.2]">
                  {kpi.value}
                </p>
              </div>

              <span className="text-xs text-muted-foreground mt-1">
                {kpi.subtitle}
              </span>
            </div>

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
