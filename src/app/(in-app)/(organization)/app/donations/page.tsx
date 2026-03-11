"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Download,
  Loader2,
  Mail,
  Minus,
  PieChart,
  TrendingUp,
  Users,
} from "lucide-react";
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });
import useOrganization from "@/lib/organizations/useOrganization";
import {
  getDonations,
  getDonationStats,
  getWeeklyGivingReport,
  resendDonationReceipt,
  sendYearEndGivingStatement,
} from "@/app/actions/finances";
import { CreateDonationDialog } from "@/components/dialogs/CreateDonationDialog";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Link from "next/link";

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
  const [weeklyReport, setWeeklyReport] = useState<Awaited<ReturnType<typeof getWeeklyGivingReport>> | null>(null);

  const fetchData = useCallback(async (p: number, d?: DateRange) => {
    if (!orgId) return;
    setLoading(true);
    try {
      const range = d?.from && d?.to ? { start: d.from, end: d.to } : undefined;
      const [data, s, weekly] = await Promise.all([
        getDonations(orgId, range as any, p),
        getDonationStats(orgId),
        getWeeklyGivingReport({ organizationId: orgId }),
      ]);
      setDonationList(data.donations);
      setTotal(data.total);
      setPage(data.page);
      setPageCount(data.pageCount);
      setStats(s);
      setWeeklyReport(weekly);
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
  const weeklyTotals = weeklyReport?.totals ?? null;
  const weeklyVarianceTone =
    weeklyTotals?.trend === "up"
      ? "text-emerald-600"
      : weeklyTotals?.trend === "down"
        ? "text-rose-600"
        : "text-slate-500";

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
    <div className="flex flex-col gap-6 pb-8">
      {/* Header */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-100 p-8 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Track Your Church Giving
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Donations
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
          <button className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-semibold text-sm" onClick={handleExport}>
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          
          <CreateDonationDialog open={showAddModal} onOpenChange={setShowAddModal} onSuccess={() => fetchData(1, date)}>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#84cc16] text-white font-bold text-sm hover:bg-[#65a30d] transition-colors shadow-sm ml-2">
              <DollarSign className="w-4 h-4" />
              Record Donation
            </button>
          </CreateDonationDialog>
        </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiStats.map((stat, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
          >
            <div className="mb-3 flex items-center justify-between">
              <stat.icon className="h-5 w-5 text-slate-500 dark:text-slate-300" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live</span>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">
              {loading ? "..." : stat.amount}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.title}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Auto-Generated by Grace
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-900 dark:text-white">
              Weekly Giving Report
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {weeklyReport ? weeklyReport.period.label : "Current week"}
            </p>
          </div>
          <Link
            href="/app/grace?tab=command"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Ask Grace
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </Link>
        </div>

        {loading || !weeklyReport ? (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#84cc16]" />
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">This Week</p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                  ${Number(weeklyReport.totals.current).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {weeklyReport.totals.currentCount} donation{weeklyReport.totals.currentCount === 1 ? "" : "s"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Week over Week</p>
                <p className={`mt-1 inline-flex items-center gap-1 text-2xl font-black ${weeklyVarianceTone}`}>
                  {weeklyTotals?.trend === "up" ? <ArrowUpRight className="h-5 w-5" /> : null}
                  {weeklyTotals?.trend === "down" ? <ArrowDownRight className="h-5 w-5" /> : null}
                  {weeklyTotals?.trend === "flat" ? <Minus className="h-5 w-5" /> : null}
                  {weeklyTotals ? `${Math.abs(weeklyTotals.variancePercent).toFixed(1)}%` : "0.0%"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {weeklyTotals?.trend === "up" ? "+" : weeklyTotals?.trend === "down" ? "-" : ""}
                  ${Math.abs(weeklyTotals?.varianceAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/40">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Prior Week</p>
                <p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                  ${Number(weeklyReport.totals.previous).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {weeklyReport.totals.previousCount} donation{weeklyReport.totals.previousCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>

            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
              {weeklyReport.summary}
            </p>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/30">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">By Source</h3>
                <div className="mt-3 space-y-2">
                  {weeklyReport.breakdownBySource.map((row) => (
                    <div key={row.source} className="flex items-center justify-between text-xs">
                      <span className="font-semibold uppercase tracking-wide text-slate-500">
                        {row.source}
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        ${row.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({row.sharePercent.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/30">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">By Category</h3>
                <div className="mt-3 space-y-2">
                  {weeklyReport.breakdownByCategory.map((row) => (
                    <div key={row.category} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-500">{row.category}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        ${row.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({row.sharePercent.toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/30">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Top Funds</h3>
                <div className="mt-3 space-y-2">
                  {weeklyReport.breakdownByFund.slice(0, 5).map((row) => (
                    <div key={row.fund} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-500">
                        {row.fund} <span className="text-[10px] uppercase">({row.category})</span>
                      </span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        ${row.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Tables and Charts Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="border-b border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Recent Donations</h2>
          </div>
          
          <div>
            {loading ? (
              <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#84cc16] mx-auto" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Donor</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fund</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Method</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Receipt</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {donationList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl mx-5 my-5">
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
            
            {/* Pagination */}
            {!loading && pageCount > 1 && (
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  Showing {Math.min((page - 1) * 50 + 1, total)}–{Math.min(page * 50, total)} of {total.toLocaleString()}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => { const p = page - 1; setPage(p); fetchData(p, date); }}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400 px-2">{page} / {pageCount}</span>
                  <button
                    disabled={page >= pageCount}
                    onClick={() => { const p = page + 1; setPage(p); fetchData(p, date); }}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 overflow-hidden shadow-sm">
          <div className="border-b border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Fund Breakdown</h2>
          </div>
          <div className="p-6 flex items-center justify-center">
            {!loading && <ReactApexChart options={fundBreakdownData.options} series={fundBreakdownData.series} type="donut" height={280} />}
          </div>
        </div>
      </section>
      
      <Dialog open={!!yearEndContactId} onOpenChange={(open) => !open && setYearEndContactId(null)}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Send Year-End Giving Statement</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-slate-900 dark:text-slate-200 block mb-2">Statement Year</label>
            <input
              type="number"
              min={2000}
              max={new Date().getFullYear()}
              value={yearEndYear}
              onChange={(e) => setYearEndYear(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#84cc16]/40 transition-all font-semibold"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setYearEndContactId(null)}>Cancel</Button>
            <Button onClick={handleSendYearEnd} disabled={sendingYearEnd} className="rounded-xl bg-[#84cc16] text-white font-bold hover:bg-[#65a30d]">
              {sendingYearEnd ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Send Statement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
