"use client";

import React from "react";
import KpiStripCard from "@/components/dashboard/KpiStripCard";
import GivingTrendChart from "@/components/dashboard/GivingTrendChart";
import TrendsBarChart from "@/components/dashboard/TrendsBarChart";
import HighlightPromoCard from "@/components/dashboard/HighlightPromoCard";
import DebtStatusCard from "@/components/dashboard/DebtStatusCard";
import NetWorthLineChart from "@/components/dashboard/NetWorthLineChart";
import TransactionHistoryCard from "@/components/dashboard/TransactionHistoryCard";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Filter } from "lucide-react";

export default function MinistryDashboardPage() {
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
          {/* Date Picker (Mock) */}
          <div className="hidden sm:flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-md shadow-sm">
            <div className="bg-muted p-1 rounded">
              <Calendar className="w-4 h-4 text-foreground" />
            </div>
            <span className="text-sm font-medium">01/01/2025 - 05/01/2025</span>
          </div>

          {/* Period Toggle (Mock) */}
          <div className="hidden sm:flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-md shadow-sm cursor-pointer hover:bg-accent/50 transition-colors">
            <span className="text-sm font-medium">Weekly</span>
            <div className="bg-muted p-1 rounded">
              <ArrowRight className="w-4 h-4 text-foreground" />
            </div>
          </div>

          {/* Filter Button */}
          <Button variant="outline" size="icon" className="h-10 w-10">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid gap-6">
        {/* KPI Strip */}
        <KpiStripCard />

        {/* Row 1: 3 equal cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <GivingTrendChart />
          <TrendsBarChart />
          <HighlightPromoCard />
        </div>

        {/* Row 2: Giving YTD + Line chart + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3">
            <DebtStatusCard />
          </div>
          <div className="lg:col-span-5">
            <NetWorthLineChart />
          </div>
          <div className="lg:col-span-4">
            <TransactionHistoryCard />
          </div>
        </div>
      </div>
    </div>
  );
}
