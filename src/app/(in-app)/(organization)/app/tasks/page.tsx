"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { Skeleton } from "@/components/ui/skeleton";
import useOrganization from "@/lib/organizations/useOrganization";
import { CreateTaskDialog } from "@/components/dialogs/CreateTaskDialog";
import { EditTaskDialog, EditableTask } from "@/components/dialogs/EditTaskDialog";
import { getTasks, updateTask, deleteTask } from "@/app/actions/tasks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function TasksPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All Tasks");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editTaskState, setEditTaskState] = useState<EditableTask | null>(null);

  const { data: tasks = [], error, mutate, isLoading: loading } = useSWR<any[]>(
    orgId ? ["tasks", orgId] : null,
    () => getTasks(orgId!)
  );

  const handleComplete = async (id: string, currentStatus: string) => {
    if (currentStatus === "done") return;
    await updateTask(id, { status: "done", organizationId: orgId! });
    await mutate();
  };

  const handleDelete = async (id: string) => {
    if (!orgId) return;
    await deleteTask(id, orgId);
    await mutate();
  };

  const filteredTasks = tasks.filter(task => {
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    return (
      task.title?.toLowerCase().includes(lowerQuery) ||
      task.description?.toLowerCase().includes(lowerQuery)
    );
  });

  const isIncomplete = (t: any) => t.status !== "done" && t.status !== "cancelled";
  const now = new Date();

  const displayTasks = filteredTasks.filter(task => {
    if (!isIncomplete(task)) return false;
    if (activeTab === "All Tasks") return true;
    if (activeTab === "High Priority") return task.priority === "high" || task.priority === "urgent";
    if (activeTab === "In Progress") return task.status === "in_progress";
    if (activeTab === "Overdue") return task.dueDate && new Date(task.dueDate) < now;
    return true;
  });

  const completedTasks = tasks
    .filter(t => t.status === "done")
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

  const activeCount = tasks.filter(isIncomplete).length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
  const completedCount = completedTasks.length;
  const totalCount = Math.max(tasks.length, 1);

  return (
    <div className="flex flex-col h-full bg-[#f6f7f8] dark:bg-[#101922] font-display -m-4 sm:-m-8">
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <h2 className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2">Task Management</h2>
              <p className="text-slate-500 text-lg">Organizing ministry goals and community outreach.</p>
            </div>
            <div className="flex items-center gap-3">
                <button 
                onClick={() => setShowAddModal(true)}
                className="bg-[#a3e635] text-slate-900 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-all"
              >
                <span className="material-symbols-outlined text-lg">add_task</span>
                Quick Add Task
              </button>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-slate-500 font-medium mb-4">Active Tasks</p>
              <p className="text-4xl font-black text-slate-900 dark:text-slate-100 mb-4">{loading ? "—" : activeCount}</p>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#2b8cee] h-full" style={{ width: `${(activeCount / totalCount) * 100}%` }}></div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-slate-500 font-medium mb-4">In Progress</p>
              <p className="text-4xl font-black text-slate-900 dark:text-slate-100 mb-4">{loading ? "—" : inProgressCount}</p>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#a3e635] h-full" style={{ width: `${(inProgressCount / totalCount) * 100}%` }}></div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-slate-500 font-medium mb-4">Completed</p>
              <p className="text-4xl font-black text-slate-900 dark:text-slate-100 mb-4">{loading ? "—" : completedCount}</p>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-green-500 h-full" style={{ width: `${(completedCount / totalCount) * 100}%` }}></div>
              </div>
            </div>
          </div>

          {/* Tabs & Filter */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 dark:border-slate-800 mb-8">
            <div className="flex gap-8 overflow-x-auto scrollbar-hide">
              {["All Tasks", "High Priority", "In Progress", "Overdue"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-4 border-b-2 text-sm whitespace-nowrap transition-all ${
                    activeTab === tab 
                      ? "border-[#2b8cee] text-[#2b8cee] font-bold" 
                      : "border-transparent text-slate-500 hover:text-slate-700 font-medium"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="pb-4 flex items-center gap-4 shrink-0">
              <span className="material-symbols-outlined text-slate-400 cursor-pointer">tune</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-sm">search</span>
                <input 
                  className="pl-9 pr-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-[#2b8cee] focus:border-[#2b8cee] outline-none" 
                  placeholder="Search tasks..." 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Task List Section */}
          <div className="space-y-4 mb-12 min-h-[300px]">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
              <span className={`size-2 rounded-full ${activeTab === 'High Priority' ? 'bg-red-500' : 'bg-[#2b8cee]'}`}></span>
              {activeTab}
            </h3>

            {loading ? (
               <div className="space-y-4">
                 {[1, 2, 3].map(i => (
                   <Skeleton key={i} className="h-20 w-full rounded-xl bg-slate-200 dark:bg-slate-800" />
                 ))}
               </div>
            ) : displayTasks.length === 0 ? (
               <div className="text-center py-12 text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">No tasks to display in this view.</div>
            ) : (
               displayTasks.map((task) => (
                 <div key={task.id} className="group task-card bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center gap-4">
                   <div className="flex-shrink-0">
                     <div 
                       onClick={() => handleComplete(task.id, task.status)}
                       className="size-6 border-2 border-slate-300 dark:border-slate-700 rounded-md flex items-center justify-center cursor-pointer hover:border-[#2b8cee] transition-colors"
                     >
                     </div>
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2 mb-1">
                       <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">{task.title}</h4>
                       {task.priority === "urgent" && (
                         <span className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Urgent</span>
                       )}
                       {task.priority === "high" && (
                         <span className="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">High</span>
                       )}
                     </div>
                     <div className="flex items-center gap-4 text-xs text-slate-500">
                       {task.dueDate && (
                         <span className="flex items-center gap-1">
                           <span className="material-symbols-outlined text-xs">calendar_month</span>
                           Due {new Date(task.dueDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}
                         </span>
                       )}
                       <span className="flex items-center gap-1">
                         <span className="material-symbols-outlined text-xs">folder</span>
                         {task.category || "General"}
                       </span>
                     </div>
                   </div>
                   <div className="flex items-center gap-6">
                     <div className="flex -space-x-1.5">
                       {task.assignee ? (
                          <div className="size-6 rounded-full border border-white dark:border-slate-900 bg-[#2b8cee]/10 text-[#2b8cee] flex items-center justify-center text-[10px] font-bold uppercase" title={task.assignee}>
                            {task.assignee.substring(0, 2)}
                          </div>
                       ) : (
                         <div className="size-6 rounded-full border border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                           <span className="material-symbols-outlined text-[10px] text-slate-400">person</span>
                         </div>
                       )}
                     </div>
                     <div className="task-action opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity">
                       <button 
                         onClick={() => setEditTaskState(task)} 
                         className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-[#2b8cee] transition-all"
                       >
                         <span className="material-symbols-outlined text-xl">edit</span>
                       </button>
                       <button 
                         onClick={() => handleDelete(task.id)} 
                         className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-500 transition-all"
                       >
                         <span className="material-symbols-outlined text-xl">delete</span>
                       </button>
                     </div>
                   </div>
                 </div>
               ))
             )}
          </div>

          {/* Completed Section */}
          <div className="mt-16">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest text-sm">Completed Lately</h3>
              <span className="text-slate-400 text-sm">{completedCount} completed</span>
            </div>
            <div className="space-y-3">
              {completedTasks.length === 0 ? (
                 <p className="text-sm text-slate-500">No recently completed tasks.</p>
              ) : (
                completedTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="bg-slate-50 dark:bg-slate-800/30 p-4 rounded-xl flex items-center gap-4 border border-transparent opacity-60">
                    <div className="flex-shrink-0">
                      <div className="size-6 bg-[#a3e635] rounded-md flex items-center justify-center">
                        <span className="material-symbols-outlined text-slate-900 text-sm font-bold">check</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-slate-500 line-through truncate">{task.title}</h4>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                      {task.updatedAt ? new Date(task.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "Completed"}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
        </div>
      </main>

      <CreateTaskDialog
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={() => void mutate()}
      />
      <EditTaskDialog
        open={!!editTaskState}
        onOpenChange={(open) => !open && setEditTaskState(null)}
        onSuccess={() => void mutate()}
        task={editTaskState}
      />
    </div>
  );
}
