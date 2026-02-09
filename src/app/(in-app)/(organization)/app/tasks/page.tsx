"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, CheckSquare, Circle, Clock, User, MoreHorizontal, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const tasks = [
  { id: 1, title: "Follow up with Sarah Johnson about small group", assignee: "Pastor Mark", dueDate: "Feb 9, 2025", priority: "high", status: "in-progress", contact: "Sarah Johnson" },
  { id: 2, title: "Schedule counseling session - Williams Family", assignee: "Pastor James", dueDate: "Feb 10, 2025", priority: "high", status: "pending", contact: "Williams Family" },
  { id: 3, title: "Send welcome email to new visitors", assignee: "Grace AI", dueDate: "Feb 9, 2025", priority: "medium", status: "completed", contact: "Multiple" },
  { id: 4, title: "Review volunteer applications", assignee: "Angela T.", dueDate: "Feb 11, 2025", priority: "medium", status: "pending", contact: "3 Applications" },
  { id: 5, title: "Prepare outreach event materials", assignee: "Outreach Team", dueDate: "Feb 15, 2025", priority: "low", status: "pending", contact: "-" },
  { id: 6, title: "Call Robert Brown - baptism follow-up", assignee: "Pastor James", dueDate: "Feb 8, 2025", priority: "high", status: "overdue", contact: "Robert Brown" },
];

const kpiStats = [
  { title: "Total Tasks", value: "24" },
  { title: "Due Today", value: "5" },
  { title: "Overdue", value: "2" },
  { title: "Completed (Week)", value: "18" },
];

export default function TasksPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
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

      {/* KPI Strip */}
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

      {/* Search and Filters */}
      <div className="flex items-center gap-3 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm"
            placeholder="Search tasks..."
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">All</Button>
          <Button variant="ghost" size="sm">My Tasks</Button>
          <Button variant="ghost" size="sm">Due Today</Button>
          <Button variant="ghost" size="sm">Overdue</Button>
        </div>
      </div>

      {/* Tasks List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {tasks.map((task) => (
              <div key={task.id} className="p-4 hover:bg-muted/30 flex items-center gap-4">
                <button className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
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
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{task.assignee}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{task.dueDate}</span>
                    <span>{task.contact}</span>
                  </div>
                </div>
                <Badge variant="secondary" className={
                  task.status === "completed" ? "bg-emerald-100 text-emerald-600" :
                  task.status === "in-progress" ? "bg-blue-100 text-blue-600" :
                  task.status === "overdue" ? "bg-rose-100 text-rose-600" :
                  "bg-gray-100 text-gray-600"
                }>{task.status}</Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>Edit Task</DropdownMenuItem>
                    <DropdownMenuItem>Reassign</DropdownMenuItem>
                    <DropdownMenuItem>Mark Complete</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
