"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Users, PieChart, Filter, Download, Calendar, Loader2 } from "lucide-react";
import useOrganization from "@/lib/organizations/useOrganization";
import { getDonations, getDonationStats } from "@/app/actions/finances";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function DonationsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [donationList, setDonationList] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [data, s] = await Promise.all([getDonations(orgId), getDonationStats(orgId)]);
      setDonationList(data);
      setStats(s);
    } catch (err) {
      console.error("Failed to fetch donations:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalAmount = stats?.totalAmount ?? 0;
  const avgAmount = stats?.avgAmount ?? 0;
  const donorCount = new Set(donationList.map(d => d.donation?.contactId).filter(Boolean)).size;

  const kpiStats = [
    { title: "Total Given", amount: `$${Number(totalAmount).toLocaleString()}`, icon: DollarSign, color: "emerald" },
    { title: "Unique Donors", amount: String(donorCount), icon: Users, color: "blue" },
    { title: "Avg. Gift", amount: `$${Number(avgAmount).toFixed(0)}`, icon: TrendingUp, color: "violet" },
    { title: "Total Donations", amount: String(stats?.totalCount ?? 0), icon: PieChart, color: "amber" },
  ];

  // Build fund breakdown from real data
  const fundMap: Record<string, number> = {};
  donationList.forEach(d => {
    const fund = d.donation?.fund ?? "General";
    fundMap[fund] = (fundMap[fund] || 0) + Number(d.donation?.amount ?? 0);
  });
  const fundLabels = Object.keys(fundMap);
  const fundValues = Object.values(fundMap);

  const fundBreakdownData = {
    series: fundValues.length > 0 ? fundValues : [1],
    options: {
      chart: { type: "donut" as const, background: "transparent" },
      labels: fundLabels.length > 0 ? fundLabels : ["No Data"],
      colors: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"],
      legend: { position: "bottom" as const },
      plotOptions: { pie: { donut: { size: "65%" } } },
      dataLabels: { enabled: true, formatter: (val: number) => val.toFixed(0) + "%" },
    },
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Track Your Church Giving</p>
          <h1 className="text-3xl font-bold text-foreground">Donations</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" />Filter</Button>
          <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpiStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">{stat.title}</p>
                  <h3 className="text-2xl font-bold">{loading ? "..." : stat.amount}</h3>
                </div>
                <div className={`w-12 h-12 rounded-full bg-${stat.color}-100 flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fund Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Donations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#bbff00] mx-auto" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-6 py-3 text-left font-medium text-muted-foreground">Donor</th>
                      <th className="px-6 py-3 text-left font-medium text-muted-foreground">Amount</th>
                      <th className="px-6 py-3 text-left font-medium text-muted-foreground">Fund</th>
                      <th className="px-6 py-3 text-left font-medium text-muted-foreground">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {donationList.map((row) => (
                      <tr key={row.donation.id} className="hover:bg-muted/30">
                        <td className="px-6 py-4">{new Date(row.donation.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 font-semibold">
                          {row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : "Anonymous"}
                        </td>
                        <td className="px-6 py-4 text-emerald-600 font-semibold">${Number(row.donation.amount).toFixed(2)}</td>
                        <td className="px-6 py-4"><Badge variant="secondary">{row.donation.fund}</Badge></td>
                        <td className="px-6 py-4">{row.donation.method}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fund Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            {!loading && <ReactApexChart options={fundBreakdownData.options} series={fundBreakdownData.series} type="donut" height={280} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
