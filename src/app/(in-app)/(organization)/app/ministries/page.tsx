"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Users,
  Music,
  Heart,
  Baby,
  Globe,
  BookOpen,
  Coffee,
  Mic2,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock ministry data
const ministries = [
  {
    id: 1,
    name: "Youth Ministry",
    description: "Engaging teens and young adults in faith and fellowship",
    memberCount: 85,
    leader: "Pastor Marcus Johnson",
    status: "active",
    icon: Users,
    color: "#8b5cf6",
    growth: 12,
  },
  {
    id: 2,
    name: "Worship Team",
    description: "Leading the congregation in praise and worship",
    memberCount: 32,
    leader: "Sarah Mitchell",
    status: "active",
    icon: Music,
    color: "#f59e0b",
    growth: 8,
  },
  {
    id: 3,
    name: "Outreach & Missions",
    description: "Serving our community and global missions",
    memberCount: 64,
    leader: "Deacon Robert Williams",
    status: "active",
    icon: Globe,
    color: "#10b981",
    growth: 15,
  },
  {
    id: 4,
    name: "Children's Ministry",
    description: "Nurturing faith in children ages 0-12",
    memberCount: 120,
    leader: "Angela Thompson",
    status: "active",
    icon: Baby,
    color: "#ec4899",
    growth: 5,
  },
  {
    id: 5,
    name: "Care & Prayer",
    description: "Supporting members through prayer and pastoral care",
    memberCount: 28,
    leader: "Elder Patricia Davis",
    status: "active",
    icon: Heart,
    color: "#ef4444",
    growth: -2,
  },
  {
    id: 6,
    name: "Bible Study",
    description: "Weekly small groups for scripture study",
    memberCount: 156,
    leader: "Dr. James Anderson",
    status: "active",
    icon: BookOpen,
    color: "#3b82f6",
    growth: 20,
  },
  {
    id: 7,
    name: "Hospitality",
    description: "Welcoming visitors and coordinating fellowship events",
    memberCount: 45,
    leader: "Maria Gonzalez",
    status: "active",
    icon: Coffee,
    color: "#84cc16",
    growth: 3,
  },
  {
    id: 8,
    name: "Media & Tech",
    description: "Managing audio/visual, livestreaming, and social media",
    memberCount: 18,
    leader: "David Chen",
    status: "active",
    icon: Mic2,
    color: "#6366f1",
    growth: 25,
  },
];

function MinistryCard({ ministry }: { ministry: typeof ministries[0] }) {
  const Icon = ministry.icon;
  const isPositiveGrowth = ministry.growth >= 0;

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl"
              style={{ backgroundColor: `${ministry.color}20` }}
            >
              <Icon
                className="w-5 h-5"
                style={{ color: ministry.color }}
              />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                {ministry.name}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ministry.leader}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>View Details</DropdownMenuItem>
              <DropdownMenuItem>Edit Ministry</DropdownMenuItem>
              <DropdownMenuItem>View Members</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {ministry.description}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{ministry.memberCount}</span>
            <span className="text-xs text-muted-foreground">members</span>
          </div>
          <Badge
            variant="secondary"
            className={`text-xs font-medium ${
              isPositiveGrowth
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-red-500/10 text-red-600"
            }`}
          >
            {isPositiveGrowth ? (
              <TrendingUp className="w-3 h-3 mr-1" />
            ) : (
              <TrendingDown className="w-3 h-3 mr-1" />
            )}
            {isPositiveGrowth ? "+" : ""}
            {ministry.growth}%
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MinistriesPage() {
  const totalMembers = ministries.reduce((sum, m) => sum + m.memberCount, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">
            Organize Your Church Community
          </p>
          <h1 className="text-3xl font-bold text-foreground">Ministries</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Stats Summary */}
          <div className="hidden sm:flex items-center gap-4 bg-card border border-border px-4 py-2 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                {ministries.length}
              </p>
              <p className="text-xs text-muted-foreground">Ministries</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">
                {totalMembers}
              </p>
              <p className="text-xs text-muted-foreground">Total Members</p>
            </div>
          </div>

          {/* Add Ministry Button */}
          <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600] font-semibold">
            <Plus className="w-4 h-4 mr-2" />
            Add Ministry
          </Button>
        </div>
      </div>

      {/* Ministry Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {ministries.map((ministry) => (
          <MinistryCard key={ministry.id} ministry={ministry} />
        ))}
      </div>
    </div>
  );
}
