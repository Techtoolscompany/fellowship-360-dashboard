"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, MoreHorizontal, TrendingUp, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { getMinistries } from "@/app/actions/ministries";

const MINISTRY_COLORS = ["#8b5cf6", "#f59e0b", "#10b981", "#ec4899", "#ef4444", "#3b82f6", "#84cc16", "#6366f1"];

function MinistryCard({ ministry, index }: { ministry: any; index: number }) {
  const color = MINISTRY_COLORS[index % MINISTRY_COLORS.length];

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${color}20` }}>
              <Users className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">{ministry.ministry.name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ministry.ministry.meetingDay && `${ministry.ministry.meetingDay}`}
                {ministry.ministry.meetingTime && ` at ${ministry.ministry.meetingTime}`}
              </p>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>View Details</DropdownMenuItem>
              <DropdownMenuItem>Edit Ministry</DropdownMenuItem>
              <DropdownMenuItem>View Members</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Archive</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {ministry.ministry.description || "No description"}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{ministry.memberCount}</span>
            <span className="text-xs text-muted-foreground">members</span>
          </div>
          {ministry.ministry.meetingLocation && (
            <Badge variant="secondary" className="text-xs">{ministry.ministry.meetingLocation}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MinistriesPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [ministriesList, setMinistriesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMinistries = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getMinistries(orgId);
      setMinistriesList(data);
    } catch (err) {
      console.error("Failed to fetch ministries:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchMinistries(); }, [fetchMinistries]);

  const totalMembers = ministriesList.reduce((sum, m) => sum + Number(m.memberCount), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Organize Your Church Community</p>
          <h1 className="text-3xl font-bold text-foreground">Ministries</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 bg-card border border-border px-4 py-2 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{ministriesList.length}</p>
              <p className="text-xs text-muted-foreground">Ministries</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{totalMembers}</p>
              <p className="text-xs text-muted-foreground">Total Members</p>
            </div>
          </div>
          <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600] font-semibold">
            <Plus className="w-4 h-4 mr-2" />Add Ministry
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#bbff00] mx-auto" /></div>
      ) : ministriesList.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No ministries yet. Create your first ministry!</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {ministriesList.map((ministry, i) => (
            <MinistryCard key={ministry.ministry.id} ministry={ministry} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
