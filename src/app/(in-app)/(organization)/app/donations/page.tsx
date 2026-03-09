"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DollarSign, TrendingUp, Users, PieChart, Download, Calendar, Loader2, Mail, ChevronLeft, ChevronRight } from "lucide-react";
import useOrganization from "@/lib/organizations/useOrganization";
import { getDonations, getDonationStats, resendDonationReceipt, sendYearEndGivingStatement } from "@/app/actions/finances";
import { CreateDonationDialog } from "@/components/dialogs/CreateDonationDialog";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export default function DonationsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [donationList, setDonationList] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [sendingReceiptId, setSendingReceiptId] = useState<string | null>(null);
  const [yearEndContactId, setYearEndContactId] = useState<string | null>(null);
  const [yearEndYear, setYearEndYear] = useState(String(new Date().getFullYear() - 1));
  const [sendingYearEnd, setSendingYearEnd] = useState(false);

  const fetchData = useCallback(async (p: number, d?: DateRange) => {
    if (!orgId) return;
    setLoading(true);
    try {
      const range = d?.from && d?.to ? { start: d.from, end: d.to } : undefined;
      const [data, s] = await Promise.all([getDonations(orgId, range as any, p), getDonationStats(orgId)]);
      setDonationList(data.donations);
      setTotal(data.total);
      setPage(data.page);
      setPageCount(data.pageCount);
      setStats(s);
    } catch (err) {
      console.error("Failed to fetch donations:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { setPage(1); fetchData(1, date); }, [orgId, date, fetchData]);

  const handleExport = () => {
    if (donationList.length === 0) {
      toast.error("No donations to export");
      return;
    }
    
    const headers = ["Date", "Donor", "Amount", "Fund", "Method", "Memo"];
    const csvContent = [
      headers.join(","),
      ...donationList.map(d => [
        `"${new Date(d.donation.date).toLocaleDateString()}"`,
        `"${d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : "Anonymous"}"`,
        `"${d.donation.amount}"`,
        `"${d.donation.fund || ''}"`,
        `"${d.donation.method || ''}"`,
        `"${d.donation.memo || ''}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `donations_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${donationList.length} donation${donationList.length === 1 ? "" : "s"}`);
  };

  const handleSendReceipt = async (donationId: string) => {
    try {
      setSendingReceiptId(donationId);
      await resendDonationReceipt(donationId);
      toast.success("Donation receipt sent");
      await fetchData(page, date);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send receipt");
    } finally {
      setSendingReceiptId(null);
    }
  };

  const handleSendYearEnd = async () => {
    if (!orgId || !yearEndContactId) return;
    const year = Number(yearEndYear);
    if (!Number.isInteger(year) || year < 2000 || year > new Date().getFullYear()) {
      toast.error("Please enter a valid year");
      return;
    }
    setSendingYearEnd(true);
    try {
      await sendYearEndGivingStatement({ organizationId: orgId, contactId: yearEndContactId, year });
      toast.success(`${year} giving statement sent`);
      setYearEndContactId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send statement");
    } finally {
      setSendingYearEnd(false);
    }
  };

  const totalAmount = stats?.totalAmount ?? 0;
  const avgAmount = stats?.avgAmount ?? 0;
  const donorCount = stats?.uniqueDonorCount ?? 0;

  const kpiStats = [
    { title: "Total Given", amount: `$${Number(totalAmount).toLocaleString()}`, icon: DollarSign, iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
    { title: "Unique Donors", amount: String(donorCount), icon: Users, iconBg: "bg-blue-100", iconColor: "text-blue-600" },
    { title: "Avg. Gift", amount: `$${Number(avgAmount).toFixed(0)}`, icon: TrendingUp, iconBg: "bg-violet-100", iconColor: "text-violet-600" },
    { title: "Total Donations", amount: String(stats?.totalCount ?? 0), icon: PieChart, iconBg: "bg-amber-100", iconColor: "text-amber-600" },
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
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                size="sm"
                className={cn(
                  "justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Filter Dates</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarPicker
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="w-4 h-4 mr-2" />Export</Button>
          <CreateDonationDialog open={showAddModal} onOpenChange={setShowAddModal} onSuccess={() => fetchData(1, date)}>
            <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600]">
              <DollarSign className="w-4 h-4 mr-2" />Record Donation
            </Button>
          </CreateDonationDialog>
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
                <div className={`w-12 h-12 rounded-full ${stat.iconBg} flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.iconColor}`} />
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
                      <th className="px-6 py-3 text-left font-medium text-muted-foreground">Receipt</th>
                      <th className="px-6 py-3 text-left font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {donationList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                          No donations recorded yet.
                        </td>
                      </tr>
                    ) : donationList.map((row) => (
                      <tr key={row.donation.id} className="hover:bg-muted/30">
                        <td className="px-6 py-4">{new Date(row.donation.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 font-semibold">
                          {row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : "Anonymous"}
                        </td>
                        <td className="px-6 py-4 text-emerald-600 font-semibold">${Number(row.donation.amount).toFixed(2)}</td>
                        <td className="px-6 py-4"><Badge variant="secondary">{row.donation.fund}</Badge></td>
                        <td className="px-6 py-4">{row.donation.method}</td>
                        <td className="px-6 py-4">
                          <Badge variant={row.donation.receiptSent ? "default" : "outline"}>
                            {row.donation.receiptSent ? "Sent" : "Pending"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!row.contact?.email || sendingReceiptId === row.donation.id}
                              onClick={() => handleSendReceipt(row.donation.id)}
                            >
                              {sendingReceiptId === row.donation.id ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <Mail className="w-4 h-4 mr-1" />
                              )}
                              Receipt
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={!row.donation.contactId || !row.contact?.email}
                              onClick={() => {
                                setYearEndContactId(row.donation.contactId);
                                setYearEndYear(String(new Date().getFullYear() - 1));
                              }}
                            >
                              Statement
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && pageCount > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t text-sm text-muted-foreground">
                <span>
                  Showing {Math.min((page - 1) * 50 + 1, total)}–{Math.min(page * 50, total)} of {total} donations
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={page <= 1}
                    onClick={() => { const p = page - 1; setPage(p); fetchData(p, date); }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="px-2">{page} / {pageCount}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={page >= pageCount}
                    onClick={() => { const p = page + 1; setPage(p); fetchData(p, date); }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
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
      <Dialog open={!!yearEndContactId} onOpenChange={(open) => !open && setYearEndContactId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Year-End Giving Statement</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-foreground block mb-2">Statement Year</label>
            <input
              type="number"
              min={2000}
              max={new Date().getFullYear()}
              value={yearEndYear}
              onChange={(e) => setYearEndYear(e.target.value)}
              className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-lime-500/40"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setYearEndContactId(null)}>Cancel</Button>
            <Button onClick={handleSendYearEnd} disabled={sendingYearEnd} className="bg-lime-500 text-slate-950 hover:bg-lime-400">
              {sendingYearEnd ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Send Statement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
