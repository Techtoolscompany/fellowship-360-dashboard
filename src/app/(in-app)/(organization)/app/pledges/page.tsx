"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, TrendingUp, Target, Clock, DollarSign, MoreHorizontal } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const pledges = [
  { id: 1, donor: "Robert & Mary Brown", campaign: "Building Fund 2025", pledged: "$25,000", fulfilled: "$12,500", progress: 50, dueDate: "Dec 31, 2025", status: "on-track" },
  { id: 2, donor: "The Williams Family", campaign: "Building Fund 2025", pledged: "$50,000", fulfilled: "$35,000", progress: 70, dueDate: "Dec 31, 2025", status: "on-track" },
  { id: 3, donor: "First National Bank", campaign: "Youth Center", pledged: "$100,000", fulfilled: "$100,000", progress: 100, dueDate: "Jun 30, 2025", status: "completed" },
  { id: 4, donor: "Sarah Johnson", campaign: "Missions 2025", pledged: "$2,400", fulfilled: "$600", progress: 25, dueDate: "Dec 31, 2025", status: "on-track" },
  { id: 5, donor: "Anonymous Donor", campaign: "Building Fund 2025", pledged: "$10,000", fulfilled: "$2,500", progress: 25, dueDate: "Dec 31, 2025", status: "behind" },
];

const kpiStats = [
  { title: "Total Pledged", value: "$425,000", subtitle: "This year", icon: Target },
  { title: "Fulfilled", value: "$285,000", subtitle: "67% complete", icon: DollarSign },
  { title: "Outstanding", value: "$140,000", subtitle: "Remaining balance", icon: Clock },
  { title: "Active Pledges", value: "48", subtitle: "+12 this quarter", icon: TrendingUp },
];

export default function PledgesPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Track Commitment Progress</p>
          <h1 className="text-3xl font-bold text-foreground">Pledges</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" />Filter</Button>
          <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600]">
            <Plus className="w-4 h-4 mr-2" />Record Pledge
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">{stat.title}</p>
                  <h3 className="text-2xl font-bold">{stat.value}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{stat.subtitle}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pledges Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Pledges</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Donor</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Campaign</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Pledged</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Fulfilled</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Progress</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Due Date</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pledges.map((pledge) => (
                  <tr key={pledge.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4 font-semibold">{pledge.donor}</td>
                    <td className="px-6 py-4 text-muted-foreground">{pledge.campaign}</td>
                    <td className="px-6 py-4 font-semibold">{pledge.pledged}</td>
                    <td className="px-6 py-4 text-emerald-600">{pledge.fulfilled}</td>
                    <td className="px-6 py-4 w-40">
                      <div className="flex items-center gap-2">
                        <Progress value={pledge.progress} className="h-2" />
                        <span className="text-xs text-muted-foreground">{pledge.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{pledge.dueDate}</td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className={
                        pledge.status === "completed" ? "bg-emerald-100 text-emerald-600" :
                        pledge.status === "on-track" ? "bg-blue-100 text-blue-600" :
                        "bg-amber-100 text-amber-600"
                      }>
                        {pledge.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Record Payment</DropdownMenuItem>
                          <DropdownMenuItem>Send Reminder</DropdownMenuItem>
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
