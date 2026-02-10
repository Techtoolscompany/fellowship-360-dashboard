"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, Users, Clock, Award, MoreHorizontal, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { getVolunteers } from "@/app/actions/operations";

export default function VolunteersPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [volunteerList, setVolunteerList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getVolunteers(orgId);
      setVolunteerList(data);
    } catch (err) {
      console.error("Failed to fetch volunteers:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const kpiStats = [
    { title: "Total Volunteers", value: String(volunteerList.length), icon: Users },
    { title: "Active", value: String(volunteerList.filter(v => v.volunteer.status === "active").length), icon: Users },
    { title: "On Break", value: String(volunteerList.filter(v => v.volunteer.status === "on_break").length), icon: Clock },
    { title: "Roles Filled", value: String(new Set(volunteerList.map(v => v.volunteer.role).filter(Boolean)).size), icon: Award },
  ];

  return (
    <div className="flex flex-col gap-6">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">{stat.title}</p>
                  <h3 className="text-2xl font-bold">{loading ? "..." : stat.value}</h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm" placeholder="Search volunteers..." />
        </div>
        <span className="text-sm text-muted-foreground">{volunteerList.length} volunteers</span>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#bbff00] mx-auto" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Volunteer</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Role</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Joined</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {volunteerList.map((vol) => (
                    <tr key={vol.volunteer.id} className="hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold">{vol.contact ? `${vol.contact.firstName} ${vol.contact.lastName}` : "Unknown"}</p>
                          <p className="text-muted-foreground text-xs">{vol.contact?.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">{vol.volunteer.role || "—"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{new Date(vol.volunteer.joinedAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className={vol.volunteer.status === "active" ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-600"}>
                          {vol.volunteer.status}
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
      )}
    </div>
  );
}
