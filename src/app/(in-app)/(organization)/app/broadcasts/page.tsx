"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
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
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-light dark:bg-slate-900 font-display text-slate-900 dark:text-slate-100 -m-4 sm:-m-8">
        {/* Header */}
        <header className="h-16 flex shrink-0 items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold">Broadcasts</h2>
            <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2"></div>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input 
                className="pl-10 pr-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-lime-500/20 focus:border-lime-500 outline-none transition-all w-64" 
                placeholder="Search broadcasts..." 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <CreateBroadcastDialog
              open={showAddModal}
              onOpenChange={setShowAddModal}
              onSuccess={fetchData}
            >
              <button className="flex items-center gap-2 bg-lime-500 hover:bg-lime-600 text-slate-900 dark:text-slate-950 px-4 py-2 rounded-lg text-sm font-semibold transition-all">
                <span className="material-symbols-outlined text-lg">add</span>
                Create Broadcast
              </button>
            </CreateBroadcastDialog>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Analytics Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-lime-500/10 rounded-bl-full transition-transform group-hover:scale-110"></div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-lg bg-lime-500/20 flex items-center justify-center text-lime-600 dark:text-lime-500">
                  <span className="material-symbols-outlined">send</span>
                </div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Sent Broadcasts</p>
              </div>
              <h3 className="text-3xl font-bold z-10 relative">{loading ? "..." : sentCount}</h3>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full transition-transform group-hover:scale-110"></div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-500">
                  <span className="material-symbols-outlined">group</span>
                </div>
                <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Recipients</p>
              </div>
              <h3 className="text-3xl font-bold z-10 relative">{loading ? "..." : totalRecipients.toLocaleString()}</h3>
            </div>
          </div>

          {/* Recent Broadcasts Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-12">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-lg">All Broadcasts</h4>
            </div>
            
            <div className="overflow-x-auto">
              {loading ? (
                <div className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin text-lime-500 mx-auto" /></div>
              ) : filteredBroadcasts.length === 0 ? (
                <div className="text-center py-24 text-slate-500">
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
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Broadcast Name</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Date</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Recipients</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredBroadcasts.map((bc) => {
                      const isSent = bc.status === "sent";

                      return (
                        <tr key={bc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className={`font-semibold ${isSent ? "" : "text-slate-400 italic"}`}>{bc.title}</div>
                            <div className="text-xs text-slate-400 uppercase">{bc.channel}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                            {bc.sentAt ? new Date(bc.sentAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'}) : "—"}
                          </td>
                          <td className="px-6 py-4">
                            {isSent ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-lime-500/20 text-lime-700 dark:text-lime-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-lime-500"></span>
                                Sent
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                Draft
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium">
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
              <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500 font-medium">Showing {filteredBroadcasts.length} of {broadcastList.length} broadcasts</p>
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
