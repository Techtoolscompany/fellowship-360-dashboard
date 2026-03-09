"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import useOrganization from "@/lib/organizations/useOrganization";
import { CreatePrayerRequestDialog } from "@/components/dialogs/CreatePrayerRequestDialog";
import { EditPrayerRequestDialog } from "@/components/dialogs/EditPrayerRequestDialog";
import { getPrayerRequests, updatePrayerRequest } from "@/app/actions/prayer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function PrayerWallPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editRequest, setEditRequest] = useState<any>(null);

  const fetchRequests = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getPrayerRequests(orgId);
      setRequests(data);
    } catch (err) {
      console.error("Failed to fetch prayer requests:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleMarkAnswered = async (id: string) => {
    await updatePrayerRequest(id, { status: "answered" });
    await fetchRequests();
  };

  const filteredRequests = requests.filter(pr => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    const contactName = pr.contactName || "Member";
    const nameMatch = pr.isAnonymous === "true" ? "anonymous".includes(lowerQuery) : contactName.toLowerCase().includes(lowerQuery);
    return nameMatch || pr.content?.toLowerCase().includes(lowerQuery);
  });

  const activeCount = requests.filter(r => r.status === "new" || r.status === "praying").length;
  const answeredCount = requests.filter(r => r.status === "answered").length;
  const urgentCount = requests.filter(r => r.urgency === "urgent" || r.urgency === "critical").length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50/50 dark:bg-slate-950 font-display -m-4 sm:-m-8 text-slate-900 dark:text-slate-100">
      {/* We can include a top sticky header if wanted, but using the global dashboard header is default. We'll add the specific header as per Stitch HTML */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 lg:px-12 py-4 hidden md:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-2">
              <div className="size-9 bg-lime-500 flex items-center justify-center rounded-xl text-white">
                <span className="material-symbols-outlined font-variation-settings-'FILL' 1">church</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight">Grace Church</h2>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <span className="text-sm font-semibold hover:text-lime-500 transition-colors cursor-pointer text-slate-600 dark:text-slate-400">Dashboard</span>
              <span className="text-sm font-semibold text-lime-500 cursor-pointer">Prayer Wall</span>
              <span className="text-sm font-semibold hover:text-lime-500 transition-colors cursor-pointer text-slate-600 dark:text-slate-400">Events</span>
              <span className="text-sm font-semibold hover:text-lime-500 transition-colors cursor-pointer text-slate-600 dark:text-slate-400">Connect</span>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
              <input 
                className="pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-full text-sm focus:ring-2 focus:ring-lime-500 w-64 outline-none placeholder:text-slate-500 dark:text-white" 
                placeholder="Search requests..." 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="size-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border-2 border-lime-500/20">
              <img className="w-full h-full object-cover" alt="User profile" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCx48DmnkHKjtFpK3FjEVXc_44l-CftjJsf3elo02EJ4fcIemlttPDGJL4vIsU4x2uIMewjEsl9MgNuQEvKPxD58TxUO0f0HlKnz0pQAk_6Eq5Vpd8IhL5Bb5yBgyilEmLeMCLgZqc6tcSktgoouEgmXzG-erHFuKJNzYBOwj8hJfbuEi3amXis9_IipDK54-JfAfL-GkTX5c6BnmzB0nAi7MJTvdRIv_wvZclBK5aLSPFE94_8uI1zQ847Yiq1sxd9OrfKOcyttl9E" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-6 lg:px-12 py-8 flex-1 overflow-y-auto">
        
        {/* Hero & Actions */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <nav className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              <span className="cursor-pointer">Community</span>
              <span className="material-symbols-outlined text-[10px]">chevron_right</span>
              <span className="text-lime-500">Prayer Requests</span>
            </nav>
            <h1 className="text-4xl font-black tracking-tight mb-3">Prayer Wall</h1>
            <p className="text-slate-600 dark:text-slate-400 max-w-xl text-lg leading-relaxed">
              &quot;Carry each other&apos;s burdens, and in this way you will fulfill the law of Christ.&quot;
              <span className="italic font-medium ml-1">— Galatians 6:2</span>
            </p>
          </div>
          <div className="flex gap-3">
            <CreatePrayerRequestDialog
              open={showAddModal}
              onOpenChange={setShowAddModal}
              onSuccess={fetchRequests}
            >
              <button className="flex items-center gap-2 px-6 py-3 bg-lime-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-lime-500/30 transition-all active:scale-95">
                <span className="material-symbols-outlined text-xl">add_circle</span>
                Submit Request
              </button>
            </CreatePrayerRequestDialog>
            <EditPrayerRequestDialog
              open={!!editRequest}
              onOpenChange={(open) => !open && setEditRequest(null)}
              onSuccess={fetchRequests}
              prayerRequest={editRequest}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="p-2 bg-lime-500/10 text-lime-500 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined">favorite</span>
              </span>
              <span className="text-xs font-bold text-lime-600 dark:text-lime-400 bg-lime-500/10 px-2 py-1 rounded-full">+12%</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Active Requests</p>
            <p className="text-3xl font-black mt-1">{loading ? "..." : activeCount}</p>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined">analytics</span>
              </span>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">+5%</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Requests</p>
            <p className="text-3xl font-black mt-1">{loading ? "..." : requests.length}</p>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="p-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined">check_circle</span>
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-1 rounded-full">
                {requests.length > 0 ? Math.round((answeredCount/requests.length) * 100) : 0}%
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Answered</p>
            <p className="text-3xl font-black mt-1">{loading ? "..." : answeredCount}</p>
          </div>
          
          <div className="bg-rose-50 dark:bg-rose-900/10 p-6 rounded-2xl border border-rose-100 dark:border-rose-900/30 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="p-2 bg-rose-500 text-white rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined">priority_high</span>
              </span>
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30 px-2 py-1 rounded-full">High</span>
            </div>
            <p className="text-rose-700 dark:text-rose-400 text-sm font-medium">Urgent Prayers</p>
            <p className="text-3xl font-black text-rose-600 mt-1">{loading ? "..." : urgentCount}</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 mb-6 flex flex-col md:flex-row gap-4 items-center shadow-sm">
          <div className="relative flex-1 w-full md:hidden">
            {/* Show on mobile since top header is hidden */}
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-lime-500 outline-none" 
              placeholder="Search requests by name or keyword..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative hidden md:block flex-1 w-full">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl focus:ring-2 focus:ring-lime-500 outline-none" 
              placeholder="Search requests by name or keyword..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            <button className="px-4 py-2 bg-lime-500 text-white rounded-lg text-sm font-bold whitespace-nowrap">All Categories</button>
            <button onClick={() => toast.info('Filtering feature available soon')} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap text-slate-600 dark:text-slate-300">Healing</button>
            <button onClick={() => toast.info('Filtering feature available soon')} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap text-slate-600 dark:text-slate-300">Job Search</button>
            <button onClick={() => toast.info('Filtering feature available soon')} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap text-slate-600 dark:text-slate-300">Family</button>
          </div>
        </div>

        {/* Request List */}
        <div className="space-y-4 pb-12">
          {loading ? (
             <div className="text-center py-20"><span className="material-symbols-outlined h-8 w-8 animate-spin text-lime-500 mx-auto text-3xl">sync</span></div>
          ) : filteredRequests.length === 0 ? (
             <div className="text-center py-24 text-slate-500 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
               <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                 <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-3xl">volunteer_activism</span>
               </div>
               <p className="font-bold text-xl text-slate-900 dark:text-white">No prayer requests</p>
               <p className="text-base mt-2 max-w-md mx-auto">Lift up your community by submitting the first prayer request.</p>
             </div>
          ) : filteredRequests.map((pr) => {
            const isUrgent = pr.urgency === "urgent" || pr.urgency === "critical";
            const isAnswered = pr.status === "answered";
            const isAnonymous = pr.isAnonymous === "true";
            const reqName = isAnonymous ? "Anonymous" : (pr.contactName || "Community Member");

            return (
              <div 
                key={pr.id}
                className={`group bg-white dark:bg-slate-800 p-6 rounded-2xl border-l-[4px] border-y border-r hover:shadow-md transition-all ${
                  isUrgent && !isAnswered 
                    ? "border-l-rose-500 border-slate-200 dark:border-slate-700" 
                    : "border-l-lime-500 border-slate-200 dark:border-slate-700"
                }`}
              >
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-shrink-0">
                    <div className="relative size-14">
                      {isAnonymous ? (
                         <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center border-2 border-slate-200 dark:border-slate-600 shadow-sm">
                           <span className="material-symbols-outlined text-slate-400">person</span>
                         </div>
                      ) : (
                         <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-sm text-indigo-700 dark:text-indigo-400 font-bold text-xl">
                            {reqName.substring(0,2).toUpperCase()}
                         </div>
                      )}
                      
                      {isUrgent && !isAnswered && (
                        <span className="absolute -bottom-1 -right-1 size-5 bg-rose-500 border-2 border-white dark:border-slate-800 rounded-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-[12px] text-white font-bold">priority_high</span>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-grow">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-lg font-bold group-hover:text-lime-500 transition-colors">{reqName}</h3>
                      
                      {isUrgent && !isAnswered && (
                        <span className="text-xs font-semibold text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded">URGENT</span>
                      )}
                      {isAnswered && (
                        <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">
                           <span className="material-symbols-outlined text-[14px]">stars</span> Answered
                        </div>
                      )}
                      {!isUrgent && !isAnswered && (
                        <span className="text-xs font-semibold text-slate-400">Active</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 mb-3 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">calendar_today</span> 
                        {new Date(pr.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}
                      </span>
                      <span className="flex items-center gap-1 text-lime-500 font-bold">
                        <span className="material-symbols-outlined text-base font-variation-settings-'FILL' 1">volunteer_activism</span> General
                      </span>
                    </div>
                    
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4 whitespace-pre-wrap">
                      {pr.content}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {/* Mock Avatar list of those praying */}
                        <div className="size-8 rounded-full border-2 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500">+12</div>
                      </div>
                      
                      <div className="flex gap-2">
                        {isAnswered ? (
                          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm transition-colors">
                            <span className="material-symbols-outlined text-lg">favorite</span>
                            Praise God
                          </button>
                        ) : (
                          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-lime-500/10 text-lime-600 dark:text-lime-500 font-bold text-sm hover:bg-lime-500/20 transition-colors cursor-pointer">
                            <span className="material-symbols-outlined text-lg">folded_hands</span>
                            I&apos;m Praying
                          </button>
                        )}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 transition-colors">
                              <span className="material-symbols-outlined">more_horiz</span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 font-display rounded-xl">
                            <DropdownMenuItem onClick={() => setEditRequest(pr)} className="font-medium rounded-lg">
                              Edit Request
                            </DropdownMenuItem>
                            {!isAnswered && (
                              <DropdownMenuItem onClick={() => handleMarkAnswered(pr.id)} className="font-medium text-emerald-600 dark:text-emerald-400 rounded-lg focus:text-emerald-600 focus:bg-emerald-50 dark:focus:bg-emerald-950/20">
                                Mark as Answered
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {!loading && filteredRequests.length > 0 && (
            <div className="flex justify-center py-8">
              <button className="flex items-center gap-2 px-8 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-sm">
                Load More Requests
                <span className="material-symbols-outlined">expand_more</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer matching Stitch Layout */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-12 px-6 lg:px-12 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="size-8 bg-lime-500/20 flex items-center justify-center rounded-lg text-lime-500">
              <span className="material-symbols-outlined font-variation-settings-'FILL' 1 text-lg">church</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Grace Church</h2>
          </div>
          <div className="flex gap-8 text-sm font-medium text-slate-500">
            <span className="hover:text-lime-500 transition-colors cursor-pointer">Privacy Policy</span>
            <span className="hover:text-lime-500 transition-colors cursor-pointer">Terms of Service</span>
            <span className="hover:text-lime-500 transition-colors cursor-pointer">Contact Support</span>
          </div>
          <p className="text-sm text-slate-400">© 2025 Grace Church. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
