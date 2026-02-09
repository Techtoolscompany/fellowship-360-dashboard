"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, MoreHorizontal, TrendingUp, DollarSign, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const donors = [
  { id: 1, name: "Robert & Mary Brown", email: "brown.family@example.com", totalGiven: "$12,450", lastGift: "Jan 25, 2025", frequency: "Weekly", status: "active" },
  { id: 2, name: "Sarah Johnson", email: "sarah.j@example.com", totalGiven: "$8,200", lastGift: "Jan 20, 2025", frequency: "Monthly", status: "active" },
  { id: 3, name: "Michael Davis", email: "m.davis@example.com", totalGiven: "$5,750", lastGift: "Jan 15, 2025", frequency: "Monthly", status: "active" },
  { id: 4, name: "The Williams Family", email: "williams@example.com", totalGiven: "$24,000", lastGift: "Jan 22, 2025", frequency: "Weekly", status: "active" },
  { id: 5, name: "Emily White", email: "emily.w@example.com", totalGiven: "$3,200", lastGift: "Dec 28, 2024", frequency: "Occasional", status: "lapsed" },
  { id: 6, name: "James Anderson", email: "j.anderson@example.com", totalGiven: "$15,800", lastGift: "Jan 18, 2025", frequency: "Bi-weekly", status: "active" },
];

const kpiStats = [
  { title: "Total Donors", value: "412", change: "+8 this month", icon: "users" },
  { title: "Active Donors", value: "358", change: "87% active rate", icon: "active" },
  { title: "Avg Lifetime Value", value: "$2,450", change: "+12% YoY", icon: "trending" },
  { title: "New Donors (YTD)", value: "45", change: "+18 vs last year", icon: "new" },
];

export default function DonorsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Manage Your Donor Relationships</p>
          <h1 className="text-3xl font-bold text-foreground">Donors</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" />Filter</Button>
          <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600]">
            <Plus className="w-4 h-4 mr-2" />Add Donor
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm mb-1">{stat.title}</p>
              <h3 className="text-2xl font-bold">{stat.value}</h3>
              <p className="text-sm text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search donors..."
          />
        </div>
        <span className="text-sm text-muted-foreground">{donors.length} donors</span>
      </div>

      {/* Donors Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Donor</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Total Given</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Last Gift</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Frequency</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {donors.map((donor) => (
                  <tr key={donor.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold">{donor.name}</p>
                        <p className="text-muted-foreground text-xs">{donor.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-emerald-600">{donor.totalGiven}</td>
                    <td className="px-6 py-4 text-muted-foreground">{donor.lastGift}</td>
                    <td className="px-6 py-4">{donor.frequency}</td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className={donor.status === "active" ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-600"}>
                        {donor.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Profile</DropdownMenuItem>
                          <DropdownMenuItem>View History</DropdownMenuItem>
                          <DropdownMenuItem>Send Thank You</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
