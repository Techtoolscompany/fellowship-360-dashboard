"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import useOrganization from "@/lib/organizations/useOrganization";
import { CreateTaskDialog } from "@/components/dialogs/CreateTaskDialog";
import { EditTaskDialog, EditableTask } from "@/components/dialogs/EditTaskDialog";
import { deleteTask, getTasks, updateTask } from "@/app/actions/tasks";

type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
type TaskPriority = "low" | "medium" | "high" | "urgent";
type TaskSlaStatus =
  | "overdue"
  | "due_soon"
  | "due_next_72h"
  | "on_track"
  | "no_due_date"
  | "closed";

type TaskRow = EditableTask & {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  slaStatus: TaskSlaStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const taskTabs = [
  "All Tasks",
  "High Priority",
  "In Progress",
  "Overdue",
  "Unassigned",
] as const;

type TaskTab = (typeof taskTabs)[number];

const slaLabel: Record<TaskSlaStatus, string> = {
  overdue: "Overdue",
  due_soon: "Due <24h",
  due_next_72h: "Due <72h",
  on_track: "On Track",
  no_due_date: "No Due Date",
  closed: "Closed",
};

const statusLabel: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  cancelled: "Cancelled",
};

function isIncomplete(task: TaskRow) {
  return task.status !== "done" && task.status !== "cancelled";
}

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) return 0;
  return new Date(value).getTime();
}

function getSlaClass(status: TaskSlaStatus) {
  if (status === "overdue") {
    return "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400";
  }
  if (status === "due_soon") {
    return "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400";
  }
  if (status === "due_next_72h") {
    return "bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300";
  }
  if (status === "no_due_date") {
    return "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";
  }
  if (status === "closed") {
    return "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400";
  }
  return "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400";
}

export default function TasksPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TaskTab>("All Tasks");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTaskState, setEditTaskState] = useState<EditableTask | null>(null);

  const {
    data: tasks = [],
    error,
    mutate,
    isLoading: loading,
  } = useSWR<TaskRow[]>(orgId ? ["tasks", orgId] : null, () => getTasks(orgId!));

  const filteredTasks = useMemo(() => {
    const lowerQuery = searchQuery.trim().toLowerCase();
    if (!lowerQuery) {
      return tasks;
    }

    return tasks.filter((task) => {
      const title = task.title?.toLowerCase() ?? "";
      const description = task.description?.toLowerCase() ?? "";
      const assigneeName = task.assigneeName?.toLowerCase() ?? "";
      const assigneeEmail = task.assigneeEmail?.toLowerCase() ?? "";
      return (
        title.includes(lowerQuery) ||
        description.includes(lowerQuery) ||
        assigneeName.includes(lowerQuery) ||
        assigneeEmail.includes(lowerQuery)
      );
    });
  }, [searchQuery, tasks]);

  const displayTasks = useMemo(() => {
    const activeTasks = filteredTasks.filter(isIncomplete);
    if (activeTab === "All Tasks") {
      return activeTasks;
    }
    if (activeTab === "High Priority") {
      return activeTasks.filter(
        (task) => task.priority === "high" || task.priority === "urgent"
      );
    }
    if (activeTab === "In Progress") {
      return activeTasks.filter((task) => task.status === "in_progress");
    }
    if (activeTab === "Overdue") {
      return activeTasks.filter((task) => task.slaStatus === "overdue");
    }
    return activeTasks.filter((task) => !task.assigneeId);
  }, [activeTab, filteredTasks]);

  const completedTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status === "done")
        .sort((a, b) => toTimestamp(b.updatedAt || b.createdAt) - toTimestamp(a.updatedAt || a.createdAt)),
    [tasks]
  );

  const activeCount = tasks.filter(isIncomplete).length;
  const inProgressCount = tasks.filter((task) => task.status === "in_progress").length;
  const overdueCount = tasks.filter(
    (task) => isIncomplete(task) && task.slaStatus === "overdue"
  ).length;
  const completedCount = completedTasks.length;
  const totalCount = Math.max(tasks.length, 1);

  const handleComplete = async (task: TaskRow) => {
    if (!orgId || task.status === "done") return;
    try {
      await updateTask(task.id, { status: "done", organizationId: orgId });
      await mutate();
      toast.success("Task marked done");
    } catch (err) {
      console.error("Failed to complete task:", err);
      toast.error("Could not update task status.");
    }
  };

  const handleStart = async (task: TaskRow) => {
    if (!orgId || task.status !== "todo") return;
    try {
      await updateTask(task.id, { status: "in_progress", organizationId: orgId });
      await mutate();
    } catch (err) {
      console.error("Failed to start task:", err);
      toast.error("Could not move task to in progress.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!orgId) return;
    try {
      await deleteTask(id, orgId);
      await mutate();
      toast.success("Task deleted");
    } catch (err) {
      console.error("Failed to delete task:", err);
      toast.error("Could not delete task.");
    }
  };

  return (
    <div className="-m-4 flex h-full flex-col bg-[#f6f7f8] font-display dark:bg-[#101922] sm:-m-8">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
          <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h2 className="mb-2 text-4xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                Task Management
              </h2>
              <p className="text-lg text-slate-500">
                Track priorities, owners, and due dates for ministry operations.
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 rounded-lg bg-[#a3e635] px-5 py-2.5 text-sm font-bold text-slate-900 transition-all hover:opacity-90"
            >
              <span className="material-symbols-outlined text-lg">add_task</span>
              Quick Add Task
            </button>
          </div>

          <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-4 font-medium text-slate-500">Active Tasks</p>
              <p className="mb-4 text-4xl font-black text-slate-900 dark:text-slate-100">
                {loading ? "—" : activeCount}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full bg-[#2b8cee]" style={{ width: `${(activeCount / totalCount) * 100}%` }}></div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-4 font-medium text-slate-500">In Progress</p>
              <p className="mb-4 text-4xl font-black text-slate-900 dark:text-slate-100">
                {loading ? "—" : inProgressCount}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full bg-[#a3e635]" style={{ width: `${(inProgressCount / totalCount) * 100}%` }}></div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-4 font-medium text-slate-500">Overdue</p>
              <p className="mb-4 text-4xl font-black text-slate-900 dark:text-slate-100">
                {loading ? "—" : overdueCount}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full bg-red-500" style={{ width: `${(overdueCount / totalCount) * 100}%` }}></div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-4 font-medium text-slate-500">Completed</p>
              <p className="mb-4 text-4xl font-black text-slate-900 dark:text-slate-100">
                {loading ? "—" : completedCount}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full bg-green-500" style={{ width: `${(completedCount / totalCount) * 100}%` }}></div>
              </div>
            </div>
          </div>

          <div className="mb-8 flex flex-col justify-between border-b border-slate-200 dark:border-slate-800 md:flex-row md:items-center">
            <div className="scrollbar-hide flex gap-8 overflow-x-auto">
              {taskTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`whitespace-nowrap border-b-2 pb-4 text-sm transition-all ${
                    activeTab === tab
                      ? "border-[#2b8cee] font-bold text-[#2b8cee]"
                      : "border-transparent font-medium text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-4 pb-4">
              <span className="material-symbols-outlined cursor-pointer text-slate-400">tune</span>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  search
                </span>
                <input
                  className="rounded-full border border-slate-200 bg-white py-1.5 pl-9 pr-4 text-xs outline-none focus:border-[#2b8cee] focus:ring-[#2b8cee] dark:border-slate-800 dark:bg-slate-900"
                  placeholder="Search tasks, owners..."
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="mb-12 min-h-[300px] space-y-4">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
              <span
                className={`size-2 rounded-full ${
                  activeTab === "High Priority"
                    ? "bg-red-500"
                    : activeTab === "Overdue"
                      ? "bg-amber-500"
                      : "bg-[#2b8cee]"
                }`}
              ></span>
              {activeTab}
            </h3>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                Failed to load tasks. Refresh and try again.
              </div>
            ) : loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((value) => (
                  <Skeleton
                    key={value}
                    className="h-20 w-full rounded-xl bg-slate-200 dark:bg-slate-800"
                  />
                ))}
              </div>
            ) : displayTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-slate-500 dark:border-slate-800">
                No tasks to display in this view.
              </div>
            ) : (
              displayTasks.map((task) => (
                <div
                  key={task.id}
                  className="group task-card flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center"
                >
                  <div className="flex-shrink-0">
                    <div
                      onClick={() => void handleComplete(task)}
                      className="flex size-6 cursor-pointer items-center justify-center rounded-md border-2 border-slate-300 transition-colors hover:border-[#2b8cee] dark:border-slate-700"
                    >
                      {task.status === "done" && (
                        <span className="material-symbols-outlined text-[14px] text-[#2b8cee]">check</span>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-base font-bold text-slate-900 dark:text-slate-100">
                        {task.title}
                      </h4>
                      {(task.priority === "urgent" || task.priority === "high") && (
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            task.priority === "urgent"
                              ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}
                        >
                          {task.priority}
                        </span>
                      )}
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {statusLabel[task.status]}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${getSlaClass(task.slaStatus)}`}>
                        {slaLabel[task.slaStatus]}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      {task.dueDate ? (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">calendar_month</span>
                          Due{" "}
                          {new Date(task.dueDate).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">event_busy</span>
                          No due date
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">person</span>
                        {task.assigneeName || task.assigneeEmail || "Unassigned"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {task.status === "todo" && (
                      <button
                        onClick={() => void handleStart(task)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600 transition-colors hover:border-[#2b8cee] hover:text-[#2b8cee] dark:border-slate-700 dark:text-slate-300"
                      >
                        Start
                      </button>
                    )}

                    <div className="flex -space-x-1.5">
                      {task.assigneeName || task.assigneeEmail ? (
                        <div
                          className="flex size-7 items-center justify-center rounded-full border border-white bg-[#2b8cee]/10 text-[10px] font-bold uppercase text-[#2b8cee] dark:border-slate-900"
                          title={task.assigneeName || task.assigneeEmail || ""}
                        >
                          {(task.assigneeName || task.assigneeEmail || "UN")
                            .replace(/\s+/g, "")
                            .slice(0, 2)}
                        </div>
                      ) : (
                        <div className="flex size-7 items-center justify-center rounded-full border border-white bg-slate-200 dark:border-slate-900 dark:bg-slate-700">
                          <span className="material-symbols-outlined text-[11px] text-slate-400">person_off</span>
                        </div>
                      )}
                    </div>

                    <div className="task-action flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => setEditTaskState(task)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-[#2b8cee] dark:hover:bg-slate-800"
                      >
                        <span className="material-symbols-outlined text-xl">edit</span>
                      </button>
                      <button
                        onClick={() => void handleDelete(task.id)}
                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-red-500 dark:hover:bg-slate-800"
                      >
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-16">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">
                Completed Lately
              </h3>
              <span className="text-sm text-slate-400">{completedCount} completed</span>
            </div>
            <div className="space-y-3">
              {completedTasks.length === 0 ? (
                <p className="text-sm text-slate-500">No recently completed tasks.</p>
              ) : (
                completedTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 rounded-xl border border-transparent bg-slate-50 p-4 opacity-60 dark:bg-slate-800/30"
                  >
                    <div className="flex-shrink-0">
                      <div className="flex size-6 items-center justify-center rounded-md bg-[#a3e635]">
                        <span className="material-symbols-outlined text-sm font-bold text-slate-900">
                          check
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-medium text-slate-500 line-through">
                        {task.title}
                      </h4>
                    </div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">
                      {task.updatedAt
                        ? new Date(task.updatedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })
                        : "Completed"}
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
        onOpenChange={(open) => {
          if (!open) {
            setEditTaskState(null);
          }
        }}
        onSuccess={() => void mutate()}
        task={editTaskState}
      />
    </div>
  );
}
