"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, Users, Clock, Award, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const volunteers = [
  { id: 1, name: "Sarah Johnson", email: "sarah.j@example.com", ministry: "Children's Ministry", role: "Teacher", hoursThisMonth: 12, status: "active" },
  { id: 2, name: "Michael Davis", email: "m.davis@example.com", ministry: "Worship Team", role: "Vocalist", hoursThisMonth: 8, status: "active" },
  { id: 3, name: "Emily White", email: "emily.w@example.com", ministry: "Hospitality", role: "Greeter", hoursThisMonth: 6, status: "active" },
  { id: 4, name: "Robert Brown", email: "robert.b@example.com", ministry: "Media & Tech", role: "Sound Engineer", hoursThisMonth: 15, status: "active" },
  { id: 5, name: "Angela Thompson", email: "angela.t@example.com", ministry: "Outreach", role: "Coordinator", hoursThisMonth: 20, status: "active" },
  { id: 6, name: "David Chen", email: "david.c@example.com", ministry: "Youth Ministry", role: "Leader", hoursThisMonth: 10, status: "on-break" },
];

const kpiStats = [
  { title: "Total Volunteers", value: "156", icon: Users },
  { title: "Active This Month", value: "128", icon: Users },
  { title: "Hours Logged", value: "842", icon: Clock },
  { title: "Recognition Due", value: "8", icon: Award },
];

export default function VolunteersPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Manage Your Volunteer Team</p>
          <h1 className="text-3xl font-bold text-foreground">Volunteers</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" />Filter</Button>
          <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600]">
            <Plus className="w-4 h-4 mr-2" />Add Volunteer
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">{stat.title}</p>
                  <h3 className="text-2xl font-bold">{stat.value}</h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-violet-600" />
                </div>
              </div>
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
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm"
            placeholder="Search volunteers..."
          />
        </div>
        <span className="text-sm text-muted-foreground">{volunteers.length} volunteers</span>
      </div>

      {/* Volunteers Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Volunteer</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Ministry</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Hours (MTD)</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {volunteers.map((vol) => (
                  <tr key={vol.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold">{vol.name}</p>
                        <p className="text-muted-foreground text-xs">{vol.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">{vol.ministry}</td>
                    <td className="px-6 py-4 text-muted-foreground">{vol.role}</td>
                    <td className="px-6 py-4 font-semibold">{vol.hoursThisMonth}</td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className={vol.status === "active" ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-600"}>
                        {vol.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Profile</DropdownMenuItem>
                          <DropdownMenuItem>Log Hours</DropdownMenuItem>
                          <DropdownMenuItem>Send Message</DropdownMenuItem>
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
