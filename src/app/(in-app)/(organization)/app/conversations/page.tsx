"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, MessageCircle, Phone, Mail, Users, MoreHorizontal, Clock, CheckCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const conversations = [
  { id: 1, contact: "Sarah Johnson", lastMessage: "Thank you for calling! I'll see you Sunday.", channel: "Phone", time: "10 min ago", status: "resolved", assignee: "Grace AI" },
  { id: 2, contact: "Michael Davis", lastMessage: "Yes, I'd like to join the small group. Can you send me the details?", channel: "SMS", time: "25 min ago", status: "open", assignee: "Pastor Mark" },
  { id: 3, contact: "Emily White", lastMessage: "I received the newsletter, thank you!", channel: "Email", time: "1 hour ago", status: "resolved", assignee: "Grace AI" },
  { id: 4, contact: "Robert Brown", lastMessage: "Is there volunteer training this weekend?", channel: "SMS", time: "2 hours ago", status: "waiting", assignee: "Angela T." },
  { id: 5, contact: "The Williams Family", lastMessage: "We'd like to schedule a meeting with Pastor James.", channel: "Email", time: "3 hours ago", status: "open", assignee: "Unassigned" },
  { id: 6, contact: "Anonymous Prayer", lastMessage: "Prayer request submitted for health concerns.", channel: "Web", time: "5 hours ago", status: "resolved", assignee: "Prayer Team" },
];

const kpiStats = [
  { title: "Open", value: "8", color: "amber" },
  { title: "Waiting", value: "3", color: "blue" },
  { title: "Resolved Today", value: "24", color: "emerald" },
  { title: "Avg Response", value: "12 min", color: "violet" },
];

const getChannelIcon = (channel: string) => {
  switch (channel) {
    case "Phone": return <Phone className="w-4 h-4" />;
    case "SMS": return <MessageCircle className="w-4 h-4" />;
    case "Email": return <Mail className="w-4 h-4" />;
    default: return <MessageCircle className="w-4 h-4" />;
  }
};

export default function ConversationsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Unified Communication Inbox</p>
          <h1 className="text-3xl font-bold text-foreground">Conversations</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" />Filter</Button>
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

      {/* Search Bar */}
      <div className="flex items-center gap-3 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm"
            placeholder="Search conversations..."
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">All</Button>
          <Button variant="ghost" size="sm">Open</Button>
          <Button variant="ghost" size="sm">Waiting</Button>
          <Button variant="ghost" size="sm">Resolved</Button>
        </div>
      </div>

      {/* Conversations List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {conversations.map((convo) => (
              <div key={convo.id} className="p-4 hover:bg-muted/30 flex items-center justify-between gap-4 cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    convo.status === "open" ? "bg-amber-100" :
                    convo.status === "waiting" ? "bg-blue-100" : "bg-emerald-100"
                  }`}>
                    {getChannelIcon(convo.channel)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{convo.contact}</h4>
                      <Badge variant="secondary" className="text-[10px]">{convo.channel}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate max-w-md">{convo.lastMessage}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />{convo.time}
                    </p>
                    <p className="text-xs text-muted-foreground">{convo.assignee}</p>
                  </div>
                  <Badge variant="secondary" className={
                    convo.status === "open" ? "bg-amber-100 text-amber-600" :
                    convo.status === "waiting" ? "bg-blue-100 text-blue-600" :
                    "bg-emerald-100 text-emerald-600"
                  }>{convo.status}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Thread</DropdownMenuItem>
                      <DropdownMenuItem>Assign</DropdownMenuItem>
                      <DropdownMenuItem>Mark Resolved</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
