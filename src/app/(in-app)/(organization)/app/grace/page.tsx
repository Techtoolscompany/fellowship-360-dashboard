"use client";

import GraceKpiStrip from "@/components/grace/GraceKpiStrip";
import CallActivityChart from "@/components/grace/CallActivityChart";
import RequestTypesChart from "@/components/grace/RequestTypesChart";
import RecentBroadcastsCard from "@/components/grace/RecentBroadcastsCard";
import PrayerRequestsCard from "@/components/grace/PrayerRequestsCard";
import AppointmentsCard from "@/components/grace/AppointmentsCard";
import InquiriesCard from "@/components/grace/InquiriesCard";
import VisitorFollowupsCard from "@/components/grace/VisitorFollowupsCard";
import RecentActivityCard from "@/components/grace/RecentActivityCard";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Filter, Phone, Settings } from "lucide-react";
import Link from "next/link";

export default function GraceDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Date Picker (Mock) */}
          <div className="hidden sm:flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-md shadow-sm">
            <div className="bg-muted p-1 rounded">
              <Calendar className="w-4 h-4 text-foreground" />
            </div>
            <span className="text-sm font-medium">Feb 1 - Feb 4, 2025</span>
          </div>

          {/* Period Toggle (Mock) */}
          <div className="hidden sm:flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-md shadow-sm cursor-pointer hover:bg-accent/50 transition-colors">
            <span className="text-sm font-medium">Today</span>
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
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <p className="text-muted-foreground mb-1 text-base">
              AI-Powered Church Communication
            </p>
            <h1 className="text-3xl font-bold text-foreground">
              Grace AI Dashboard
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/grace/calls"
              className="btn flex items-center gap-2 bg-[#bbff00] text-[#343330] px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-[#a3df00] transition-colors"
            >
              <Phone size={16} />
              View All Calls
            </Link>
            <Link
              href="/grace/settings"
              className="btn flex items-center gap-2 bg-secondary text-foreground px-5 py-2.5 rounded-full font-medium text-sm border border-border hover:bg-secondary/80 transition-colors"
            >
              <Settings size={16} />
              Settings
            </Link>
          </div>
        </div>

        <div className="grid gap-6">
          {/* KPI Strip */}
          <GraceKpiStrip />

          {/* Row 1: Charts + Broadcasts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <CallActivityChart />
            <RequestTypesChart />
            <RecentBroadcastsCard />
          </div>

          {/* Row 2: Request Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <PrayerRequestsCard />
            <AppointmentsCard />
            <InquiriesCard />
            <VisitorFollowupsCard />
          </div>

          {/* Row 3: Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <RecentActivityCard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
