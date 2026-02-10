"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Mail, MessageSquare, MoreHorizontal, Copy, Edit, Trash2, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { getTemplates, deleteTemplate } from "@/app/actions/communications";

export default function TemplatesPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [templateList, setTemplateList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getTemplates(orgId);
      setTemplateList(data);
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    await deleteTemplate(id);
    await fetchData();
  };

  const categories = ["All", ...new Set(templateList.map(t => t.category).filter(Boolean))];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Reusable Message Templates</p>
          <h1 className="text-3xl font-bold text-foreground">Templates</h1>
        </div>
        <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600]">
          <Plus className="w-4 h-4 mr-2" />Create Template
        </Button>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center gap-3 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" className="w-full pl-10 pr-4 py-2 bg-background border border-input rounded-md text-sm" placeholder="Search templates..." />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <Button key={cat} variant={cat === "All" ? "default" : "outline"} size="sm" className={cat === "All" ? "bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600]" : ""}>
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#bbff00] mx-auto" /></div>
      ) : templateList.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No templates yet. Create your first template!</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templateList.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    template.channel === "email" ? "bg-blue-100" : "bg-violet-100"
                  }`}>
                    {template.channel === "email" ? <Mail className="w-5 h-5 text-blue-600" /> : <MessageSquare className="w-5 h-5 text-violet-600" />}
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
                      <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(template.id)}><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <h4 className="font-semibold mb-1">{template.name}</h4>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className="text-[10px]">{template.channel}</Badge>
                  {template.category && <Badge variant="outline" className="text-[10px]">{template.category}</Badge>}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{template.content?.slice(0, 40)}...</span>
                  <span>{new Date(template.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
