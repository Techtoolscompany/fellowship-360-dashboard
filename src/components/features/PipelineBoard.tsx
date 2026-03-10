"use client";

import React, { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";

interface PipelineBoardProps {
  stages: any[];
  items: any[];
  searchQuery: string;
  handleDelete: (id: string) => Promise<void>;
  handleMoveStage: (itemId: string, stageId: string, order?: number) => Promise<void>;
  onDragEndOptimistic: (result: DropResult) => void;
}

export function PipelineBoard({ stages, items, searchQuery, handleDelete, handleMoveStage, onDragEndOptimistic }: PipelineBoardProps) {
  const router = useRouter();
  
  // Need to track mounted state for react-beautiful-dnd strict mode compatibility
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

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

  const handleDragEnd = (result: DropResult) => {
    onDragEndOptimistic(result);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      {stages.map((stage) => {
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
            <Droppable droppableId={stage.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-1 overflow-y-auto pr-2 space-y-4 pb-12 transition-colors ${snapshot.isDraggingOver ? "bg-slate-100/50 dark:bg-slate-800/30 rounded-xl" : ""} [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-slate-700`}
                >
                  {stageItems.length === 0 && !snapshot.isDraggingOver ? (
                     <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                       <span className="material-symbols-outlined text-3xl mb-2 opacity-50">group</span>
                       <p className="text-xs font-medium">No people here</p>
                     </div>
                  ) : (
                     stageItems.map((row, index) => {
                       const isHighPriority = row.item.priority === "high";
                       const timeAgoText = new Date(row.item.updatedAt || row.item.createdAt).toLocaleDateString();
                       
                       return (
                         <Draggable key={row.item.id} draggableId={row.item.id} index={index}>
                           {(provided, snapshot) => (
                             <div
                               ref={provided.innerRef}
                               {...provided.draggableProps}
                               {...provided.dragHandleProps}
                               className={`bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border ${snapshot.isDragging ? 'border-[#84cc16] shadow-md shadow-[#84cc16]/20' : 'border-slate-200 dark:border-slate-800 hover:border-[#84cc16]/50'} transition-colors group cursor-grab relative`}
                               style={provided.draggableProps.style}
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
                                 <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden ring-2 ring-white dark:ring-slate-900 flex items-center justify-center flex-shrink-0 text-slate-600 dark:text-slate-400 font-bold text-sm bg-slate-100 border-none">
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
                           )}
                         </Draggable>
                       )
                     })
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        )
      })}
    </DragDropContext>
  );
}
