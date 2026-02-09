"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Mail, MessageSquare, MoreHorizontal, Copy, Edit, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const templates = [
  { id: 1, name: "Welcome New Member", type: "Email", category: "Onboarding", lastModified: "Feb 5, 2025", usageCount: 45 },
  { id: 2, name: "Sunday Service Reminder", type: "SMS", category: "Reminders", lastModified: "Feb 3, 2025", usageCount: 234 },
  { id: 3, name: "Birthday Greeting", type: "Email", category: "Celebrations", lastModified: "Jan 28, 2025", usageCount: 89 },
  { id: 4, name: "Event RSVP Confirmation", type: "Email", category: "Events", lastModified: "Jan 25, 2025", usageCount: 156 },
  { id: 5, name: "Prayer Request Follow-up", type: "Email", category: "Care", lastModified: "Jan 20, 2025", usageCount: 67 },
  { id: 6, name: "Volunteer Appreciation", type: "Email", category: "Recognition", lastModified: "Jan 15, 2025", usageCount: 34 },
  { id: 7, name: "Giving Thank You", type: "Email", category: "Giving", lastModified: "Jan 10, 2025", usageCount: 198 },
  { id: 8, name: "Snow Day Cancellation", type: "SMS", category: "Alerts", lastModified: "Jan 8, 2025", usageCount: 12 },
];

const categories = ["All", "Onboarding", "Reminders", "Care", "Events", "Giving", "Celebrations"];

export default function TemplatesPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Reusable Message Templates</p>
          <h1 className="text-3xl font-bold text-foreground">Templates</h1>
        </div>
        <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600]">
          <Plus className="w-4 h-4 mr-2" />Create Template
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm"
            placeholder="Search templates..."
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <Button key={cat} variant={cat === "All" ? "default" : "outline"} size="sm" className={cat === "All" ? "bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600]" : ""}>
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow group">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  template.type === "Email" ? "bg-blue-100" : "bg-violet-100"
                }`}>
                  {template.type === "Email" ? <Mail className="w-5 h-5 text-blue-600" /> : <MessageSquare className="w-5 h-5 text-violet-600" />}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem><Edit className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                    <DropdownMenuItem><Copy className="w-4 h-4 mr-2" />Duplicate</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <h4 className="font-semibold mb-1">{template.name}</h4>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="text-[10px]">{template.type}</Badge>
                <Badge variant="outline" className="text-[10px]">{template.category}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Used {template.usageCount} times</span>
                <span>{template.lastModified}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
