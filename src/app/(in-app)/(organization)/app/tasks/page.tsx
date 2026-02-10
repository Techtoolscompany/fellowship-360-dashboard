"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, CheckSquare, Circle, Clock, User, MoreHorizontal, Calendar, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { getTasks, updateTask, deleteTask } from "@/app/actions/tasks";

export default function TasksPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getTasks(orgId);
      setTasks(data);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleComplete = async (id: string) => {
    await updateTask(id, { status: "completed" });
    await fetchTasks();
  };

  const handleDelete = async (id: string) => {
    await deleteTask(id);
    await fetchTasks();
  };

  const kpiStats = [
    { title: "Total Tasks", value: String(tasks.length) },
    { title: "Due Today", value: String(tasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()).length) },
    { title: "Overdue", value: String(tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "completed").length) },
    { title: "Completed", value: String(tasks.filter(t => t.status === "completed").length) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Manage Team Responsibilities</p>
          <h1 className="text-3xl font-bold text-foreground">Tasks</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" />Filter</Button>
          <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600]">
            <Plus className="w-4 h-4 mr-2" />Add Task
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6 text-center">
              <h3 className="text-3xl font-bold">{stat.value}</h3>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm" placeholder="Search tasks..." />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#bbff00] mx-auto" /></div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No tasks yet. Create your first task!</div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {tasks.map((task) => (
                <div key={task.id} className="p-4 hover:bg-muted/30 flex items-center gap-4">
                  <button onClick={() => task.status !== "completed" && handleComplete(task.id)} className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    task.status === "completed" ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 hover:border-gray-400"
                  }`}>
                    {task.status === "completed" && <CheckSquare className="w-3 h-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                        {task.title}
                      </h4>
                      <Badge variant="secondary" className={
                        task.priority === "high" ? "bg-rose-100 text-rose-600" :
                        task.priority === "medium" ? "bg-amber-100 text-amber-600" :
                        "bg-gray-100 text-gray-600"
                      }>{task.priority}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      {task.dueDate && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(task.dueDate).toLocaleDateString()}</span>}
                      {task.description && <span>{task.description}</span>}
                    </div>
                  </div>
                  <Badge variant="secondary" className={
                    task.status === "completed" ? "bg-emerald-100 text-emerald-600" :
                    task.status === "in_progress" ? "bg-blue-100 text-blue-600" :
                    "bg-gray-100 text-gray-600"
                  }>{task.status}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleComplete(task.id)}>Mark Complete</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(task.id)}>Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
