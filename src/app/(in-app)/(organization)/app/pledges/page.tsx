"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, TrendingUp, Target, Clock, DollarSign, MoreHorizontal, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import useOrganization from "@/lib/organizations/useOrganization";
import { getPledges, sendPledgeReminder } from "@/app/actions/finances";
import { CreatePledgeDialog } from "@/components/dialogs/CreatePledgeDialog";
import { EditPledgeDialog } from "@/components/dialogs/EditPledgeDialog";

export default function PledgesPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [pledgeList, setPledgeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editPledgeState, setEditPledgeState] = useState<any>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

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

  const handleSendReminder = async (pledgeId: string) => {
    try {
      setSendingReminderId(pledgeId);
      await sendPledgeReminder({ pledgeId });
      toast.success("Pledge reminder sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send reminder");
    } finally {
      setSendingReminderId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-100 p-8 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Track Commitment Progress
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Pledges
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CreatePledgeDialog open={showAddModal} onOpenChange={setShowAddModal} onSuccess={fetchData}>
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#84cc16] text-white font-bold text-sm hover:bg-[#65a30d] transition-colors shadow-sm ml-2">
                <Plus className="w-4 h-4" />
                Record Pledge
              </button>
            </CreatePledgeDialog>

            <EditPledgeDialog
              open={!!editPledgeState}
              onOpenChange={(open) => !open && setEditPledgeState(null)}
              onSuccess={fetchData}
              pledge={editPledgeState}
            />
          </div>
        </div>
      </section>

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
              {loading ? "..." : stat.value}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.title} {stat.subtitle ? `• ${stat.subtitle}` : ''}</p>
          </div>
        ))}
      </section>

      <div>
        {loading ? (
          <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#84cc16] mx-auto" /></div>
        ) : (
          <section className="rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 overflow-hidden shadow-sm">
            <div className="border-b border-slate-200 p-4 dark:border-slate-800">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Active Pledges</h2>
            </div>
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Donor</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fund</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pledged</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fulfilled</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Progress</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Frequency</th>
                      <th className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {pledgeList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl mx-5 my-5">
                          No active pledges.
                        </td>
                      </tr>
                    ) : pledgeList.map((row) => {
                      const progress = Number(row.pledge.totalAmount) > 0
                        ? Math.round((Number(row.pledge.amountPaid || 0) / Number(row.pledge.totalAmount)) * 100)
                        : 0;
                      return (
                        <tr key={row.pledge.id} className="hover:bg-muted/30">
                          <td className="px-6 py-4 font-semibold">
                            {row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : "Anonymous"}
                          </td>
                          <td className="px-6 py-4 text-slate-500">{row.pledge.fund}</td>
                          <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">${Number(row.pledge.totalAmount).toLocaleString()}</td>
                          <td className="px-6 py-4 font-bold text-[#84cc16]">${Number(row.pledge.amountPaid || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 w-40">
                            <div className="flex items-center gap-2">
                              <Progress value={progress} className="h-2 flex-1 bg-slate-100 dark:bg-slate-800 [&>div]:bg-[#84cc16]" />
                              <span className="text-xs font-semibold text-slate-500">{progress}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4"><Badge variant="outline" className="font-semibold text-xs rounded-lg">{row.pledge.frequency}</Badge></td>
                          <td className="px-6 py-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditPledgeState(row.pledge)}>Edit Pledge</DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleSendReminder(row.pledge.id)}
                                  disabled={sendingReminderId === row.pledge.id}
                                >
                                  Send Reminder
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    {pledgeList.length} total pledges
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
