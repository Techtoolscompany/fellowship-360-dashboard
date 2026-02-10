"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, TrendingUp, Target, Clock, DollarSign, MoreHorizontal, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { getPledges } from "@/app/actions/finances";

export default function PledgesPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [pledgeList, setPledgeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getPledges(orgId);
      setPledgeList(data);
    } catch (err) {
      console.error("Failed to fetch pledges:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPledged = pledgeList.reduce((sum, p) => sum + Number(p.pledge.totalAmount || 0), 0);
  const totalPaid = pledgeList.reduce((sum, p) => sum + Number(p.pledge.amountPaid || 0), 0);
  const outstanding = totalPledged - totalPaid;
  const fulfillmentPct = totalPledged > 0 ? Math.round((totalPaid / totalPledged) * 100) : 0;

  const kpiStats = [
    { title: "Total Pledged", value: `$${totalPledged.toLocaleString()}`, subtitle: "This year", icon: Target },
    { title: "Fulfilled", value: `$${totalPaid.toLocaleString()}`, subtitle: `${fulfillmentPct}% complete`, icon: DollarSign },
    { title: "Outstanding", value: `$${outstanding.toLocaleString()}`, subtitle: "Remaining balance", icon: Clock },
    { title: "Active Pledges", value: String(pledgeList.length), subtitle: "", icon: TrendingUp },
  ];

  return (
    <div className="flex flex-col gap-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">{stat.title}</p>
                  <h3 className="text-2xl font-bold">{loading ? "..." : stat.value}</h3>
                  {stat.subtitle && <p className="text-sm text-muted-foreground mt-1">{stat.subtitle}</p>}
                </div>
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#bbff00] mx-auto" /></div>
      ) : (
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
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Fund</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Pledged</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Fulfilled</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Progress</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Frequency</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pledgeList.map((row) => {
                    const progress = Number(row.pledge.totalAmount) > 0
                      ? Math.round((Number(row.pledge.amountPaid || 0) / Number(row.pledge.totalAmount)) * 100)
                      : 0;
                    return (
                      <tr key={row.pledge.id} className="hover:bg-muted/30">
                        <td className="px-6 py-4 font-semibold">
                          {row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : "Anonymous"}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{row.pledge.fund}</td>
                        <td className="px-6 py-4 font-semibold">${Number(row.pledge.totalAmount).toLocaleString()}</td>
                        <td className="px-6 py-4 text-emerald-600">${Number(row.pledge.amountPaid || 0).toLocaleString()}</td>
                        <td className="px-6 py-4 w-40">
                          <div className="flex items-center gap-2">
                            <Progress value={progress} className="h-2" />
                            <span className="text-xs text-muted-foreground">{progress}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">{row.pledge.frequency}</td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
