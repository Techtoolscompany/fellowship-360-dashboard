"use client";

import React, { useState, useEffect, useCallback } from "react";
import KpiStripCard from "@/components/dashboard/KpiStripCard";
import GivingTrendChart from "@/components/dashboard/GivingTrendChart";
import TrendsBarChart from "@/components/dashboard/TrendsBarChart";
import HighlightPromoCard from "@/components/dashboard/HighlightPromoCard";
import DebtStatusCard from "@/components/dashboard/DebtStatusCard";
import NetWorthLineChart from "@/components/dashboard/NetWorthLineChart";
import TransactionHistoryCard from "@/components/dashboard/TransactionHistoryCard";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Filter, Loader2 } from "lucide-react";
import useOrganization from "@/lib/organizations/useOrganization";
import { getGraceDashboardData } from "@/app/actions/dashboard";

export default function MinistryDashboardPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const d = await getGraceDashboardData(orgId);
      setData(d);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#bbff00]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">
            Manage Your Church with Precision
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            Ministry Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-md shadow-sm">
            <div className="bg-muted p-1 rounded">
              <Calendar className="w-4 h-4 text-foreground" />
            </div>
            <span className="text-sm font-medium">{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-md shadow-sm cursor-pointer hover:bg-accent/50 transition-colors">
            <span className="text-sm font-medium">Weekly</span>
            <div className="bg-muted p-1 rounded">
              <ArrowRight className="w-4 h-4 text-foreground" />
            </div>
          </div>

          <Button variant="outline" size="icon" className="h-10 w-10">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6">
        {/* KPI Strip */}
        <KpiStripCard data={data?.kpi} contacts={data?.kpi?.totalContacts ?? 0} tasks={data?.tasks} />

        {/* Row 1: 3 equal cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GivingTrendChart />
          <TrendsBarChart />
          <HighlightPromoCard />
        </div>

        {/* Row 2: Giving YTD + Line chart + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3">
            <DebtStatusCard totalDonations={data?.kpi?.totalDonations ?? 0} />
          </div>
          <div className="lg:col-span-5">
            <NetWorthLineChart />
          </div>
          <div className="lg:col-span-4">
            <TransactionHistoryCard donations={data?.recentDonations} />
          </div>
        </div>
      </div>
    </div>
  );
}
