"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, Send, Mail, MessageSquare, Users, MoreHorizontal, Eye, MousePointer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { getBroadcasts, updateBroadcastStatus } from "@/app/actions/communications";
import { CreateBroadcastDialog } from "@/components/dialogs/CreateBroadcastDialog";
import { EditBroadcastDialog } from "@/components/dialogs/EditBroadcastDialog";

export default function BroadcastsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [broadcastList, setBroadcastList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editBroadcast, setEditBroadcast] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getBroadcasts(orgId);
      setBroadcastList(data);
    } catch (err) {
      console.error("Failed to fetch broadcasts:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSend = async (id: string, currentTotal?: number) => {
    // Mocking recipient count for now before send integration
    await updateBroadcastStatus(id, "sent", { totalRecipients: currentTotal || Math.floor(Math.random() * 200) + 50 });
    await fetchData();
  };

  const handleDelete = async (id: string) => {
    // Use an archived status for deletion in UI, or a true delete if needed
    // Assuming archived for soft-delete. If true delete is needed, add deleteBroadcast to actions.
    await updateBroadcastStatus(id, "archived");
    await fetchData();
  };

  const sentCount = broadcastList.filter(b => b.status === "sent").length;
  const totalRecipients = broadcastList.reduce((sum, b) => sum + (b.totalRecipients || 0), 0);

  const kpiStats = [
    { title: "Sent This Month", value: String(sentCount), icon: Send },
    { title: "Total Recipients", value: totalRecipients.toLocaleString(), icon: Users },
    { title: "Total Broadcasts", value: String(broadcastList.filter(b => b.status !== "archived").length), icon: Eye },
    { title: "Drafts", value: String(broadcastList.filter(b => b.status === "draft").length), icon: MousePointer },
  ];

  const filteredBroadcasts = broadcastList.filter(bc => {
    if (bc.status === 'archived') return false;
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    return bc.title?.toLowerCase().includes(lowerQuery) || bc.channel?.toLowerCase().includes(lowerQuery);
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Communicate with Your Congregation</p>
          <h1 className="text-3xl font-bold text-foreground">Broadcasts</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info('Advanced filtering coming soon')}><Filter className="w-4 h-4 mr-2" />Filter</Button>
          <CreateBroadcastDialog
            open={showAddModal}
            onOpenChange={setShowAddModal}
            onSuccess={fetchData}
          >
            <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600]">
              <Plus className="w-4 h-4 mr-2" />Create Broadcast
            </Button>
          </CreateBroadcastDialog>

          <EditBroadcastDialog
            open={!!editBroadcast}
            onOpenChange={(open) => !open && setEditBroadcast(null)}
            onSuccess={fetchData}
            broadcast={editBroadcast}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm mb-1">{stat.title}</p>
                  <h3 className="text-2xl font-bold">{loading ? "..." : stat.value}</h3>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#bbff00] mx-auto" /></div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Broadcasts</CardTitle>
            <div className="relative w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text" 
                className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md text-sm" 
                placeholder="Search broadcasts..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Campaign</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Channel</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Recipients</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Sent</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredBroadcasts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                        No broadcasts match your search.
                      </td>
                    </tr>
                  ) : filteredBroadcasts.map((bc) => (
                    <tr key={bc.id} className="hover:bg-muted/30">
                      <td className="px-6 py-4 font-semibold">{bc.title}</td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className={bc.channel === "email" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"}>
                          {bc.channel === "email" ? <Mail className="w-3 h-3 mr-1" /> : <MessageSquare className="w-3 h-3 mr-1" />}
                          {bc.channel}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">{bc.totalRecipients ? bc.totalRecipients.toLocaleString() : "—"}</td>
                      <td className="px-6 py-4 text-muted-foreground">{bc.sentAt ? new Date(bc.sentAt).toLocaleDateString() : "—"}</td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className={bc.status === "sent" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}>
                          {bc.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {bc.status === "draft" && (
                              <>
                                <DropdownMenuItem onClick={() => setEditBroadcast(bc)}>Edit Draft</DropdownMenuItem>
                                <DropdownMenuItem className="text-emerald-600" onClick={() => handleSend(bc.id, bc.totalRecipients)}>Send Broadcast</DropdownMenuItem>
                              </>
                            )}
                            {bc.status === "sent" && (
                              <DropdownMenuItem onClick={() => toast.info('Broadcast reporting interface coming soon')}>View Report</DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(bc.id)}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
