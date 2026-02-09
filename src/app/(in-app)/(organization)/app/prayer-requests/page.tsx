"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, Heart, Clock, CheckCircle, MoreHorizontal, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const prayerRequests = [
  { id: 1, requester: "Sarah Johnson", request: "Please pray for my mother's surgery next week. She's having heart surgery on Tuesday.", category: "Health", date: "Feb 8, 2025", status: "active", prayerCount: 24, isPrivate: false },
  { id: 2, requester: "Anonymous", request: "Struggling with job loss. Please pray for provision and new opportunities.", category: "Financial", date: "Feb 7, 2025", status: "active", prayerCount: 18, isPrivate: true },
  { id: 3, requester: "Michael Davis", request: "Praise report! My wife and I are expecting our first child. Prayers for a healthy pregnancy.", category: "Praise", date: "Feb 6, 2025", status: "answered", prayerCount: 45, isPrivate: false },
  { id: 4, requester: "The Williams Family", request: "Our teenage son is going through a difficult time. Please pray for wisdom and healing.", category: "Family", date: "Feb 5, 2025", status: "active", prayerCount: 32, isPrivate: false },
  { id: 5, requester: "Pastor James Wilson", request: "Pray for our upcoming missions trip to Guatemala. Safety and open hearts.", category: "Missions", date: "Feb 4, 2025", status: "active", prayerCount: 67, isPrivate: false },
];

const kpiStats = [
  { title: "Active Requests", value: "28", icon: Heart, color: "rose" },
  { title: "Prayers This Week", value: "342", icon: Heart, color: "violet" },
  { title: "Answered (MTD)", value: "12", icon: CheckCircle, color: "emerald" },
  { title: "Avg Response Time", value: "2 hrs", icon: Clock, color: "blue" },
];

export default function PrayerRequestsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Support Your Community in Prayer</p>
          <h1 className="text-3xl font-bold text-foreground">Prayer Requests</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" />Filter</Button>
          <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600]">
            <Plus className="w-4 h-4 mr-2" />Submit Request
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
                <div className={`w-10 h-10 rounded-full bg-${stat.color}-100 flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
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
            placeholder="Search prayer requests..."
          />
        </div>
      </div>

      {/* Prayer Requests Cards */}
      <div className="grid gap-4">
        {prayerRequests.map((pr) => (
          <Card key={pr.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                      {pr.isPrivate ? <Heart className="w-5 h-5 text-rose-600" /> : <User className="w-5 h-5 text-rose-600" />}
                    </div>
                    <div>
                      <h4 className="font-semibold">{pr.requester}</h4>
                      <p className="text-xs text-muted-foreground">{pr.date}</p>
                    </div>
                    <Badge variant="secondary" className={
                      pr.category === "Praise" ? "bg-emerald-100 text-emerald-600" :
                      pr.category === "Health" ? "bg-rose-100 text-rose-600" :
                      pr.category === "Financial" ? "bg-amber-100 text-amber-600" :
                      "bg-blue-100 text-blue-600"
                    }>
                      {pr.category}
                    </Badge>
                    {pr.status === "answered" && (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-600">
                        <CheckCircle className="w-3 h-3 mr-1" />Answered
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{pr.request}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Heart className="w-4 h-4" />Praying ({pr.prayerCount})
                    </Button>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>View Full Request</DropdownMenuItem>
                    <DropdownMenuItem>Mark as Answered</DropdownMenuItem>
                    <DropdownMenuItem>Send Encouragement</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
