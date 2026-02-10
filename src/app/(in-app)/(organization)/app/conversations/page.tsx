"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, MessageCircle, Phone, Mail, MoreHorizontal, Clock, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { getConversations, getConversationStats, updateConversationStatus } from "@/app/actions/communications";

const getChannelIcon = (channel: string) => {
  switch (channel) {
    case "phone": return <Phone className="w-4 h-4" />;
    case "sms": return <MessageCircle className="w-4 h-4" />;
    case "email": return <Mail className="w-4 h-4" />;
    default: return <MessageCircle className="w-4 h-4" />;
  }
};

export default function ConversationsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [conversationList, setConversationList] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [data, s] = await Promise.all([getConversations(orgId), getConversationStats(orgId)]);
      setConversationList(data);
      setStats(s);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleResolve = async (id: string) => {
    await updateConversationStatus(id, "resolved");
    await fetchData();
  };

  const kpiStats = [
    { title: "Open", value: String(stats?.open ?? 0), color: "amber" },
    { title: "Waiting", value: String(stats?.waiting ?? 0), color: "blue" },
    { title: "Resolved", value: String(stats?.resolved ?? 0), color: "emerald" },
    { title: "Total", value: String(stats?.total ?? 0), color: "violet" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Unified Communication Inbox</p>
          <h1 className="text-3xl font-bold text-foreground">Conversations</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" />Filter</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6 text-center">
              <h3 className="text-3xl font-bold">{loading ? "..." : stat.value}</h3>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm" placeholder="Search conversations..." />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">All</Button>
          <Button variant="ghost" size="sm">Open</Button>
          <Button variant="ghost" size="sm">Waiting</Button>
          <Button variant="ghost" size="sm">Resolved</Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#bbff00] mx-auto" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {conversationList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No conversations yet.</div>
              ) : conversationList.map((row) => (
                <div key={row.conversation.id} className="p-4 hover:bg-muted/30 flex items-center justify-between gap-4 cursor-pointer">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      row.conversation.status === "open" ? "bg-amber-100" :
                      row.conversation.status === "waiting" ? "bg-blue-100" : "bg-emerald-100"
                    }`}>
                      {getChannelIcon(row.conversation.channel)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">
                          {row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : (row.conversation.subject || "Unknown")}
                        </h4>
                        <Badge variant="secondary" className="text-[10px]">{row.conversation.channel}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate max-w-md">
                        {row.conversation.subject || "No subject"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(row.conversation.lastMessageAt || row.conversation.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="secondary" className={
                      row.conversation.status === "open" ? "bg-amber-100 text-amber-600" :
                      row.conversation.status === "waiting" ? "bg-blue-100 text-blue-600" :
                      "bg-emerald-100 text-emerald-600"
                    }>{row.conversation.status}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Thread</DropdownMenuItem>
                        <DropdownMenuItem>Assign</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResolve(row.conversation.id)}>Mark Resolved</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
