"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MoreHorizontal, Loader2, GripVertical, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { getPipelineData, deletePipelineItem } from "@/app/actions/pipeline";

export default function PipelinePage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [stages, setStages] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getPipelineData(orgId);
      setStages(data.stages);
      setItems(data.items);
    } catch (err) {
      console.error("Failed to fetch pipeline:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    await deletePipelineItem(id);
    await fetchData();
  };

  const getItemsForStage = (stageId: string) =>
    items.filter(i => i.item.stageId === stageId).sort((a, b) => a.item.order - b.item.order);

  const priorityColors: Record<string, string> = {
    high: "bg-rose-100 text-rose-600",
    medium: "bg-amber-100 text-amber-600",
    low: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Track Visitor & Member Journey</p>
          <h1 className="text-3xl font-bold text-foreground">Pipeline</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 bg-card border border-border px-4 py-2 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{items.length}</p>
              <p className="text-xs text-muted-foreground">People</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground">{stages.length}</p>
              <p className="text-xs text-muted-foreground">Stages</p>
            </div>
          </div>
          <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600]">
            <Plus className="w-4 h-4 mr-2" />Add Person
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#bbff00] mx-auto" /></div>
      ) : stages.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No pipeline stages set up yet. Seed your database first!</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage) => {
            const stageItems = getItemsForStage(stage.id);
            return (
              <div key={stage.id} className="flex-shrink-0 w-80">
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color || "#6366f1" }} />
                        <CardTitle className="text-sm font-semibold">{stage.name}</CardTitle>
                      </div>
                      <Badge variant="secondary" className="text-xs">{stageItems.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 min-h-[200px]">
                    {stageItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">No people in this stage</p>
                    ) : stageItems.map((row) => (
                      <div key={row.item.id} className="p-3 bg-muted/30 rounded-lg border border-border hover:shadow-sm transition-shadow group">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm font-semibold truncate">
                                {row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : "Unknown"}
                              </h4>
                              <p className="text-xs text-muted-foreground truncate">
                                {row.contact?.email || "—"}
                              </p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>View Contact</DropdownMenuItem>
                              <DropdownMenuItem>Move to Stage</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(row.item.id)}>Remove</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary" className={`text-[10px] ${priorityColors[row.item.priority] || "bg-gray-100 text-gray-600"}`}>
                            {row.item.priority}
                          </Badge>
                          {row.item.notes && (
                            <p className="text-[10px] text-muted-foreground truncate">{row.item.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
