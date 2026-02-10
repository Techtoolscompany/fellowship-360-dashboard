"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, MoreHorizontal, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { getDonorSummary } from "@/app/actions/finances";

export default function DonorsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [donorList, setDonorList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getDonorSummary(orgId);
      setDonorList(data);
    } catch (err) {
      console.error("Failed to fetch donors:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const avgLifetime = donorList.length > 0
    ? donorList.reduce((s, d) => s + Number(d.totalGiven || 0), 0) / donorList.length
    : 0;

  const kpiStats = [
    { title: "Total Donors", value: String(donorList.length), change: "Unique givers" },
    { title: "Avg Lifetime Value", value: `$${avgLifetime.toFixed(0)}`, change: "Per donor" },
    { title: "Top Donor Total", value: donorList.length > 0 ? `$${Number(donorList[0]?.totalGiven || 0).toLocaleString()}` : "$0", change: "Highest giver" },
    { title: "Total Gifts", value: String(donorList.reduce((s, d) => s + Number(d.donationCount || 0), 0)), change: "All-time" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Manage Your Donor Relationships</p>
          <h1 className="text-3xl font-bold text-foreground">Donors</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" />Filter</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm mb-1">{stat.title}</p>
              <h3 className="text-2xl font-bold">{loading ? "..." : stat.value}</h3>
              <p className="text-sm text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Search donors..." />
        </div>
        <span className="text-sm text-muted-foreground">{donorList.length} donors</span>
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
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Donor</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Total Given</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground"># of Gifts</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Last Gift</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {donorList.map((donor, i) => (
                    <tr key={donor.contactId || i} className="hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold">{donor.firstName && donor.lastName ? `${donor.firstName} ${donor.lastName}` : "Anonymous"}</p>
                          <p className="text-muted-foreground text-xs">{donor.email || "—"}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-emerald-600">${Number(donor.totalGiven).toLocaleString()}</td>
                      <td className="px-6 py-4">{donor.donationCount}</td>
                      <td className="px-6 py-4 text-muted-foreground">{donor.lastDonation ? new Date(donor.lastDonation).toLocaleDateString() : "—"}</td>
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
      )}
    </div>
  );
}
