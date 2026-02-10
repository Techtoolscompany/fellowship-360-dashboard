"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, Heart, Clock, CheckCircle, MoreHorizontal, User, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { getPrayerRequests, updatePrayerRequest } from "@/app/actions/prayer";

export default function PrayerRequestsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getPrayerRequests(orgId);
      setRequests(data);
    } catch (err) {
      console.error("Failed to fetch prayer requests:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleMarkAnswered = async (id: string) => {
    await updatePrayerRequest(id, { status: "answered" });
    await fetchRequests();
  };

  const kpiStats = [
    { title: "Active Requests", value: String(requests.filter(r => r.status === "active").length), icon: Heart, color: "rose" },
    { title: "Total Requests", value: String(requests.length), icon: Heart, color: "violet" },
    { title: "Answered", value: String(requests.filter(r => r.status === "answered").length), icon: CheckCircle, color: "emerald" },
    { title: "Urgent", value: String(requests.filter(r => r.urgency === "urgent" || r.urgency === "critical").length), icon: Clock, color: "blue" },
  ];

  return (
    <div className="flex flex-col gap-6">
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

      <div className="flex items-center gap-3 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm" placeholder="Search prayer requests..." />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#bbff00] mx-auto" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No prayer requests yet.</div>
      ) : (
        <div className="grid gap-4">
          {requests.map((pr) => (
            <Card key={pr.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                        {pr.isAnonymous === "true" ? <Heart className="w-5 h-5 text-rose-600" /> : <User className="w-5 h-5 text-rose-600" />}
                      </div>
                      <div>
                        <h4 className="font-semibold">{pr.isAnonymous === "true" ? "Anonymous" : (pr.contactName || "Member")}</h4>
                        <p className="text-xs text-muted-foreground">{new Date(pr.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="secondary" className={
                        pr.urgency === "urgent" || pr.urgency === "critical" ? "bg-rose-100 text-rose-600" :
                        "bg-blue-100 text-blue-600"
                      }>{pr.urgency}</Badge>
                      {pr.status === "answered" && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-600">
                          <CheckCircle className="w-3 h-3 mr-1" />Answered
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{pr.content}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Full Request</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleMarkAnswered(pr.id)}>Mark as Answered</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
