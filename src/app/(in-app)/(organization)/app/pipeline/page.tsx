"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Loader2, GripVertical, User, ArrowRight, TrendingUp, Users, Filter, Kanban, Mail } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { getPipelineData, deletePipelineItem, updateItemStage } from "@/app/actions/pipeline";
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

export default function PipelinePage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [stages, setStages] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getPipelineData(orgId);
      setStages(data.stages);
      setItems(data.items);
    } catch (err) {
      console.error("Failed to fetch pipeline:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this visitor from the pipeline?")) return;
    await deletePipelineItem(id);
    await fetchData();
  };

  const handleMoveStage = async (itemId: string, stageId: string) => {
    await updateItemStage(itemId, stageId, 0);
    await fetchData();
  };

  const getItemsForStage = (stageId: string) => {
    const query = searchQuery.trim().toLowerCase();
    return items
      .filter(i => i.item.stageId === stageId)
      .filter(i => {
        if (!query) return true;
        const name = `${i.contact?.firstName ?? ""} ${i.contact?.lastName ?? ""}`.toLowerCase();
        const phone = (i.contact?.phone ?? "").toLowerCase();
        const email = (i.contact?.email ?? "").toLowerCase();
        return name.includes(query) || phone.includes(query) || email.includes(query);
      })
      .sort((a, b) => a.item.order - b.item.order);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] sm:h-[calc(100vh-5rem)] -m-4 sm:-m-8 bg-[#f8fafc] dark:bg-[#0f172a] font-display">
      {/* Header */}
      <header className="h-16 flex-shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-4 sm:px-8 z-10 w-full">
        <div className="flex items-center gap-4 flex-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">Visitor Pipeline</h2>
          
          <div className="relative w-64 hidden md:block flex-shrink-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
            <input
              className="w-full pl-10 pr-4 py-1.5 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-[#84cc16] dark:text-white outline-none"
              placeholder="Search visitors..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="hidden sm:flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 hover:bg-slate-50 transition-colors text-slate-900 dark:text-slate-100">
            <span className="material-symbols-outlined text-sm">filter_list</span>
            Filter
          </button>
          <Button className="flex items-center justify-center gap-2 px-4 py-2 bg-[#84cc16] text-slate-950 font-bold hover:bg-[#84cc16]/90 transition-all shadow-sm rounded-lg">
            <span className="material-symbols-outlined text-sm">add</span>
            <span className="hidden sm:inline">Add New Visitor</span>
          </Button>
          
        </div>
      </header>

      {/* Kanban Board Area */}
      <div className="flex-1 overflow-x-auto p-4 sm:p-8 flex gap-6 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
        {loading ? (
          <div className="flex items-center justify-center w-full h-full">
            <span className="material-symbols-outlined text-4xl text-[#84cc16] animate-spin">progress_activity</span>
          </div>
        ) : stages.length === 0 ? (
          <div className="flex flex-col items-center justify-center w-full h-full text-slate-500 max-w-md mx-auto text-center space-y-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
             <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                 <span className="material-symbols-outlined text-3xl text-slate-400" style={{ fontVariationSettings: "'FILL' 1" }}>view_kanban</span>
             </div>
             <p className="text-xl font-bold text-slate-900 dark:text-white">Empty Pipeline</p>
             <p className="text-sm">No pipeline stages set up yet. Seed your database or create stages to start tracking visitors.</p>
          </div>
        ) : (
          stages.map((stage, stageIndex) => {
            const stageItems = getItemsForStage(stage.id);
            
            return (
              <div key={stage.id} className="min-w-[320px] w-[320px] flex flex-col max-h-full">
                
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-700 dark:text-slate-300">{stage.name}</h3>
                    <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white rounded-full text-xs font-bold">
                      {stageItems.length}
                    </span>
                  </div>
                </div>

                {/* Column Cards Container */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-4 pb-12 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
                  {stageItems.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                       <span className="material-symbols-outlined text-3xl mb-2 opacity-50">group</span>
                       <p className="text-xs font-medium">No people here</p>
                     </div>
                  ) : (
                     stageItems.map((row) => {
                       const isHighPriority = row.item.priority === "high";
                       const timeAgoText = new Date(row.item.updatedAt || row.item.createdAt).toLocaleDateString();
                       
                       return (
                        <div 
                          key={row.item.id} 
                          className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-[#84cc16]/50 transition-colors group cursor-grab relative"
                        >
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="h-6 w-6 flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
                                  <span className="material-symbols-outlined text-[16px]">more_horiz</span>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44 rounded-xl font-display">
                                <DropdownMenuItem className="cursor-pointer" onClick={() => row.contact?.id && router.push(`/app/contacts/${row.contact.id}`)}>
                                  View Contact
                                </DropdownMenuItem>
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger className="cursor-pointer">Move to Stage</DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent className="w-48 rounded-xl font-display">
                                    {stages.filter(s => s.id !== row.item.stageId).map(s => (
                                      <DropdownMenuItem
                                        key={s.id}
                                        className="cursor-pointer"
                                        onClick={() => handleMoveStage(row.item.id, s.id)}
                                      >
                                        {s.name}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-600" onClick={() => handleDelete(row.item.id)}>
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="flex items-start justify-between mb-3">
                            <div className="flex gap-2 h-[18px]">
                               {isHighPriority && (
                                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded">
                                    <span className="material-symbols-outlined text-[10px]">priority_high</span> High Priority
                                  </span>
                               )}
                               {row.item.priority === "medium" && (
                                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded">
                                    Medium Priority
                                  </span>
                               )}
                            </div>
                            <span className="text-[11px] text-slate-400 mt-0.5">{timeAgoText}</span>
                          </div>
                          
                          <div className="flex items-center gap-3 mb-4">
                            <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden ring-2 ring-white dark:ring-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0 text-slate-600 dark:text-slate-400 font-bold text-sm bg-slate-100 border-none">
                               {row.contact?.firstName ? (
                                  `${row.contact.firstName[0]}${row.contact.lastName?.[0] || ""}`
                               ) : (
                                  <span className="material-symbols-outlined text-xl">person</span>
                               )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : "Unknown"}
                              </h4>
                              <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-1">
                                Individual
                              </span>
                            </div>
                          </div>
                          
                          {(row.contact?.phone || row.contact?.email) && (
                            <div className="flex -space-x-2">
                                {row.contact?.email && (
                                  <div className="size-6 rounded-full border-2 border-white dark:border-slate-900 bg-[#84cc16]/20 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[12px] text-[#84cc16]">mail</span>
                                  </div>
                                )}
                                {row.contact?.phone && (
                                  <div className="size-6 rounded-full border-2 border-white dark:border-slate-900 bg-[#84cc16]/20 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[12px] text-[#84cc16]">call</span>
                                  </div>
                                )}
                            </div>
                          )}

                          {row.item.notes && (
                            <div className="mt-3 bg-[#84cc16]/5 rounded-lg p-2 flex items-center gap-2">
                              <span className="material-symbols-outlined text-[#84cc16] text-sm">notes</span>
                              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-none truncate">{row.item.notes}</span>
                            </div>
                          )}
                        </div>
                       )
                     })
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  );
}
