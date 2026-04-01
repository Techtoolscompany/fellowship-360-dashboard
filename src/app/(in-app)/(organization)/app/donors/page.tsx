"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Search, MoreHorizontal, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { getDonorSummary, sendDonorThankYou } from "@/app/actions/finances";

export default function DonorsPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [donorList, setDonorList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingThankYouId, setSendingThankYouId] = useState<string | null>(null);

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

  const filteredDonors = donorList.filter(donor => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    const nameMatch = (donor.firstName && donor.lastName) ? `${donor.firstName} ${donor.lastName}`.toLowerCase().includes(lowerQuery) : "anonymous".includes(lowerQuery);
    const emailMatch = donor.email?.toLowerCase().includes(lowerQuery);
    return nameMatch || emailMatch;
  });

  const handleSendThankYou = async (contactId: string | null | undefined) => {
    if (!orgId || !contactId) {
      toast.error("This donor does not have a linked contact record.");
      return;
    }
    try {
      setSendingThankYouId(contactId);
      await sendDonorThankYou({ organizationId: orgId, contactId });
      toast.success("Thank-you email sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send thank-you email");
    } finally {
      setSendingThankYouId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-100 p-8 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Manage Your Donor Relationships
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Donors
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <div className="mb-3 flex items-center justify-end">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live</span>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">
              {loading ? "..." : stat.value}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.title} • {stat.change}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="border-b border-slate-200 p-4 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Donor Directory</h2>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              className="w-full sm:w-64 pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-[#84cc16]/40 transition-all font-semibold" 
              placeholder="Search donors..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div>
          {loading ? (
            <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#84cc16] mx-auto" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Donor</th>
                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Given</th>
                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider"># of Gifts</th>
                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Last Gift</th>
                    <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDonors.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl mx-5 my-5">
                        No donors match your search.
                      </td>
                    </tr>
                  ) : filteredDonors.map((donor, i) => (
                    <tr key={donor.contactId || i} className="hover:bg-muted/30">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold">{donor.firstName && donor.lastName ? `${donor.firstName} ${donor.lastName}` : "Anonymous"}</p>
                          <p className="text-slate-500 text-xs">{donor.email || "—"}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-emerald-600">${Number(donor.totalGiven).toLocaleString()}</td>
                      <td className="px-6 py-4">{donor.donationCount}</td>
                      <td className="px-6 py-4 text-slate-500">{donor.lastDonation ? new Date(donor.lastDonation).toLocaleDateString() : "—"}</td>
                      <td className="px-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => donor.contactId && router.push(`/app/contacts/${donor.contactId}`)}>View Profile</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => donor.contactId && router.push(`/app/contacts/${donor.contactId}?tab=giving`)}>View History</DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleSendThankYou(donor.contactId)}
                              disabled={!donor.contactId || sendingThankYouId === donor.contactId}
                            >
                              Send Thank You
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  {filteredDonors.length} total donors
                </span>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
