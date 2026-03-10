"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Loader2, GripVertical, User, ArrowRight, TrendingUp, Users, Filter, Kanban, Mail } from "lucide-react";
import useSWR from "swr";
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
import { PipelineBoard } from "@/components/features/PipelineBoard";
import { DropResult } from "@hello-pangea/dnd";

export default function PipelinePage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [searchQuery, setSearchQuery] = useState("");

  const { data, error, mutate, isLoading } = useSWR(
    orgId ? ["pipeline", orgId] : null,
    () => getPipelineData(orgId!)
  );

  const loading = isLoading;
  const stages = data?.stages || [];
  const items = data?.items || [];

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this visitor from the pipeline?")) return;
    await deletePipelineItem(id);
    await mutate();
  };

  const handleMoveStage = async (itemId: string, stageId: string) => {
    await updateItemStage(itemId, stageId, 0);
    await mutate();
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

  const handleDragEndOptimistic = async (result: DropResult) => {
    if (!result.destination || !data?.items || !data?.stages) return;
    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    const newData = { ...data, items: [...data.items] };
    const itemIndex = newData.items.findIndex(i => i.item.id === draggableId);
    if (itemIndex > -1) {
      newData.items[itemIndex] = {
        ...newData.items[itemIndex],
        item: {
          ...newData.items[itemIndex].item,
          stageId: destination.droppableId,
          order: destination.index
        }
      };
      mutate(newData as any, false);
    }

    await updateItemStage(draggableId, destination.droppableId, destination.index);
    await mutate();
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

      <div className="flex-1 overflow-x-auto p-4 sm:p-8 flex gap-6 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-slate-700">
        {loading ? (
          <div className="flex gap-6 w-full h-full">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="min-w-[320px] w-[320px] flex flex-col gap-4">
                <div className="flex justify-between items-center mb-2">
                  <Skeleton className="h-6 w-32 bg-slate-200 dark:bg-slate-800" />
                  <Skeleton className="h-5 w-8 rounded-full bg-slate-200 dark:bg-slate-800" />
                </div>
                <Skeleton className="h-32 w-full rounded-xl bg-slate-200 dark:bg-slate-800" />
                <Skeleton className="h-28 w-full rounded-xl bg-slate-200 dark:bg-slate-800" />
                <Skeleton className="h-36 w-full rounded-xl bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
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
          <PipelineBoard
            stages={stages}
            items={items}
            searchQuery={searchQuery}
            handleDelete={handleDelete}
            handleMoveStage={handleMoveStage}
            onDragEndOptimistic={handleDragEndOptimistic}
          />
        )}
      </div>
    </div>
  );
}
