"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  Users,
  PieChart,
  Filter,
  Download,
  Calendar,
} from "lucide-react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

// Mock data
const donations = [
  { id: 1, date: "Jan 25, 2025", donor: "Robert Brown", amount: "$250.00", fund: "General", method: "Online", status: "Completed" },
  { id: 2, date: "Jan 25, 2025", donor: "Sarah Johnson", amount: "$100.00", fund: "Building Fund", method: "Online", status: "Completed" },
  { id: 3, date: "Jan 24, 2025", donor: "Michael Davis", amount: "$75.00", fund: "General", method: "Check", status: "Completed" },
  { id: 4, date: "Jan 24, 2025", donor: "Anonymous", amount: "$500.00", fund: "Missions", method: "Cash", status: "Completed" },
  { id: 5, date: "Jan 23, 2025", donor: "Emily White", amount: "$150.00", fund: "General", method: "Online", status: "Completed" },
];

const kpiStats = [
  { title: "This Week", amount: "$12,450", change: "+15%", icon: DollarSign, color: "emerald" },
  { title: "Active Donors", amount: "412", change: "+8", icon: Users, color: "blue" },
  { title: "Avg. Gift", amount: "$85", change: "+12%", icon: TrendingUp, color: "violet" },
  { title: "Recurring", amount: "67%", change: "+3%", icon: PieChart, color: "amber" },
];

const weeklyGivingData = {
  series: [{ name: "Giving", data: [8200, 11500, 9800, 12450, 10200, 14500, 12450] }],
  options: {
    chart: { type: "area" as const, toolbar: { show: false }, background: "transparent" },
    colors: ["#10b981"],
    fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } },
    stroke: { curve: "smooth" as const, width: 2 },
    dataLabels: { enabled: false },
    xaxis: { categories: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] },
    yaxis: { labels: { formatter: (val: number) => "$" + val.toLocaleString() } },
    tooltip: { y: { formatter: (val: number) => "$" + val.toLocaleString() } },
    grid: { borderColor: "#e5e7eb" },
    theme: { mode: "light" as const },
  },
};

const fundBreakdownData = {
  series: [45, 25, 15, 10, 5],
  options: {
    chart: { type: "donut" as const, background: "transparent" },
    labels: ["General Fund", "Building Fund", "Missions", "Youth Ministry", "Benevolence"],
    colors: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"],
    legend: { position: "bottom" as const },
    plotOptions: { pie: { donut: { size: "65%" } } },
    dataLabels: { enabled: true, formatter: (val: number) => val.toFixed(0) + "%" },
  },
};

export default function DonationsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Track Your Church Giving</p>
          <h1 className="text-3xl font-bold text-foreground">Donations</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 bg-card border border-border px-3 py-2 rounded-md shadow-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">This Week</span>
          </div>
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" />Filter</Button>
          <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export</Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">{stat.title}</p>
                  <h3 className="text-2xl font-bold">{stat.amount}</h3>
                  <Badge variant="secondary" className="mt-2 bg-emerald-100 text-emerald-600">
                    {stat.change}
                  </Badge>
                </div>
                <div className={`w-12 h-12 rounded-full bg-${stat.color}-100 flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Weekly Giving Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ReactApexChart options={weeklyGivingData.options} series={weeklyGivingData.series} type="area" height={300} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fund Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <ReactApexChart options={fundBreakdownData.options} series={fundBreakdownData.series} type="donut" height={280} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Donations Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Donations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Donor</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Amount</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Fund</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Method</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {donations.map((donation) => (
                  <tr key={donation.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4">{donation.date}</td>
                    <td className="px-6 py-4 font-semibold">{donation.donor}</td>
                    <td className="px-6 py-4 text-emerald-600 font-semibold">{donation.amount}</td>
                    <td className="px-6 py-4"><Badge variant="secondary">{donation.fund}</Badge></td>
                    <td className="px-6 py-4">{donation.method}</td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-600">{donation.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
