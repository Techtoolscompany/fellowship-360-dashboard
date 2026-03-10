"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { deleteBroadcast, getBroadcasts, triggerBroadcast } from "@/app/actions/communications";
import { CreateBroadcastDialog } from "@/components/dialogs/CreateBroadcastDialog";
import { EditBroadcastDialog } from "@/components/dialogs/EditBroadcastDialog";

export default function BroadcastsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [broadcastList, setBroadcastList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editBroadcast, setEditBroadcast] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getBroadcasts(orgId);
      setBroadcastList(data);
    } catch (err) {
      console.error("Failed to fetch broadcasts:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSend = async (id: string) => {
    try {
      await triggerBroadcast(id);
      toast.success("Broadcast dispatched. The SMS job is now running in the background.");
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start broadcast dispatch logic");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBroadcast(id);
      toast.success("Broadcast deleted.");
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete broadcast");
    }
  };

  const sentCount = broadcastList.filter(b => b.status === "sent").length;
  const totalRecipients = broadcastList.reduce((sum, b) => sum + (b.totalRecipients || 0), 0);

  const filteredBroadcasts = broadcastList.filter(bc => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    return bc.title?.toLowerCase().includes(lowerQuery) || bc.channel?.toLowerCase().includes(lowerQuery);
  });

  return (
    <div className="flex flex-col gap-6 pb-8 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-100 p-8 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Outbound Channels
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Broadcasts
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-[#84cc16]/20 focus:border-[#84cc16] outline-none transition-all w-64 shadow-sm" 
                placeholder="Search broadcasts..." 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <CreateBroadcastDialog
              open={showAddModal}
              onOpenChange={setShowAddModal}
              onSuccess={fetchData}
            >
              <button className="flex items-center gap-2 bg-[#84cc16] hover:bg-[#65a30d] text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm">
                <span className="material-symbols-outlined text-lg">add</span>
                Create Broadcast
              </button>
            </CreateBroadcastDialog>
          </div>
        </div>
      </section>

      {/* Scrollable Content */}
      <div className="space-y-6">
          {/* Analytics Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#84cc16]/10 rounded-bl-full transition-transform group-hover:scale-110"></div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#84cc16]/20 flex items-center justify-center text-[#84cc16]">
                    <span className="material-symbols-outlined">send</span>
                  </div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Sent Broadcasts</p>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live</span>
              </div>
              <h3 className="text-3xl font-black z-10 relative">{loading ? "..." : sentCount}</h3>
            </div>

            <div className="bg-white dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full transition-transform group-hover:scale-110"></div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-500">
                    <span className="material-symbols-outlined">group</span>
                  </div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Total Recipients</p>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live</span>
              </div>
              <h3 className="text-3xl font-black z-10 relative">{loading ? "..." : totalRecipients.toLocaleString()}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-12">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-lg text-slate-900 dark:text-white">All Broadcasts</h4>
            </div>
            
            <div className="overflow-x-auto">
              {loading ? (
                <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#84cc16] mx-auto" /></div>
              ) : filteredBroadcasts.length === 0 ? (
                <div className="text-center py-24 text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl mx-5 my-5">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-3xl">campaign</span>
                  </div>
                  <p className="font-bold text-xl text-slate-900 dark:text-white">No broadcasts found</p>
                  <p className="text-base mt-2 max-w-md mx-auto">Create your first campaign to get started.</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Broadcast Name</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Date</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Recipients</th>
                      <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredBroadcasts.map((bc) => {
                      const isSent = bc.status === "sent";

                      return (
                        <tr key={bc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className={`font-semibold text-slate-900 dark:text-white ${isSent ? "" : "text-slate-400 italic"}`}>{bc.title}</div>
                            <div className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase mt-1">{bc.channel}</div>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400">
                            {bc.sentAt ? new Date(bc.sentAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) : "—"}
                          </td>
                          <td className="px-6 py-4">
                            {isSent ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ring-1 ring-[#84cc16]/30 bg-[#84cc16]/10 text-[#65a30d] dark:text-[#84cc16]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#84cc16]"></span>
                                Sent
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ring-1 ring-slate-200 dark:ring-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                Draft
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">
                            {bc.totalRecipients ? bc.totalRecipients.toLocaleString() : "0"}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400">
                                  <span className="material-symbols-outlined">more_vert</span>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48 font-display rounded-xl shadow-lg border-slate-200 dark:border-slate-800">
                                <DropdownMenuItem onClick={() => setEditBroadcast(bc)} className="font-semibold cursor-pointer">
                                  Edit Broadcast
                                </DropdownMenuItem>
                                {bc.status === "draft" && bc.channel === "sms" && (
                                  <DropdownMenuItem onClick={() => handleSend(bc.id)} className="font-semibold text-blue-600 dark:text-blue-500 cursor-pointer">
                                    Send Now
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleDelete(bc.id)} className="font-semibold text-rose-600 dark:text-rose-500 cursor-pointer focus:bg-rose-50 focus:text-rose-700 dark:focus:bg-rose-900/20">
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && filteredBroadcasts.length > 0 && (
              <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-500">Showing {filteredBroadcasts.length} of {broadcastList.length} broadcasts</p>
              </div>
            )}
          </div>
          
          <EditBroadcastDialog
            open={!!editBroadcast}
            onOpenChange={(open) => !open && setEditBroadcast(null)}
            onSuccess={fetchData}
            broadcast={editBroadcast}
          />
        </div>
    </div>
  );
}
