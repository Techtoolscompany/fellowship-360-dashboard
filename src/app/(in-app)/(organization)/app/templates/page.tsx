"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { getTemplates, deleteTemplate } from "@/app/actions/communications";

const CATEGORY_CONFIG: Record<string, { icon: string, gradient: string, img: string }> = {
  Spiritual: { icon: "volunteer_activism", gradient: "from-lime-500/20 to-purple-500/20", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuA1ODjbFGVFDc5Ha7ukfqWRKYblkI23tDSVzHzZVGGFymJObp-emxdB2BCEh1ScHS-nkQobJxMrnqThdmM_1tBXzACQImm_VZ2_m5dGUPyHvc6bW5LvJB1p7W-xCtxNGlEcM6PjC_telQquqi_v8J286MBrWp26qQ7ZudH4lTJxeOp4j8McdH07NsrqswaL1gRBcjWbUpFgcVO_nucsqLZh-YyPCtGOS4qtd3OXmgUlq0TKf0Fipi4M4dbyDJxZ11U-ByhYfWkxVzHH" },
  Events: { icon: "calendar_month", gradient: "from-lime-500/20 to-blue-500/20", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDrcSIhsHbHME40yo2g9uljmwZ7ypRRkBIeOyIpQ9UJH210Q3N3Bwv8lNizs97Sq3p6S6mI5B8HrLTilSTOaErhVUwEKFBdQD8fLrmIBVgU31AbMJf4xc_6hRBP_RLT93bb3G3tZSIgZCxmyu4yK0dAo1VKSiDkZOagkxfpJmOwEvmJME_WPC2wfSqOVIBE200X8i64zM3KZYmFvwXepeq5xt5Dkya_nHYr23mDJCdcLCllOhPAthS_B5Kn3USbnaj_UYpmzAn7mX5y" },
  Newsletters: { icon: "newspaper", gradient: "from-lime-500/20 to-yellow-500/20", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuBRxqTgdM8Hbi-0E2aJQ2yvtZoQUZjYBqwcKlumPBFNL9FclmkK-2QkPkJJNENRxNcIZCsa0QWFCMI3LjaPPWdox5oUvdR_Ensi1e8B9kud1t5-v1cmXsi9aSj_cb6xsM6gzbVr_4CDzd3XWd_lDKUF9xKWfIsF53OfZ1aLj__LGiB4NolhF8Gf9wMZLzDhb9K3lFo1GJbZaAaRqLvq9zdKUSNt53BHjqqDA2ya_jk_apDB6j9xivEbsfJh2WhcssyOeQgeZUfiuG3P" },
  Admin: { icon: "celebration", gradient: "from-lime-500/20 to-teal-500/20", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDcjcuEOkxxO_TSyA3HTGdhb15eM0EemSrUM6R-uzKTCS9UXqB1sup5TIkSzzmDW3SLRgaJy1yKF4HxZcFWuhkYPgfFGaLgGdFgrisY3uTo08IWxDUvKNeup6wRAKypI55fkjQ1f-3HMz1q6ZhK-AcanIRb8KB2d03md7Ehdh4_enoCopgpDojCTwbIjSk5JcFyBZJcMC9zI4zPtv0BX9_brUoRxyYApLQVeWp5LNUw8awQj6FvR59SxWOzwqe8DDnRVgFdltjGzywc" },
  Archives: { icon: "inventory_2", gradient: "from-lime-500/20 to-slate-500/20", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAnNCJcCu9iHXxuu9HwUN2ZSaPtkO4O0Z_z6v646QBJRfm1NJzBY7phgKYgDESiB9dkLt2wPFvQUP8-Khgq1q2NEkWBVY2hYULVR4AVA0GSJYBXiU7oWZB1KjnwKmVlUObwuZbQks5p2Xw8Pz2WbhP5HzQC17JayeaThOovK9QfEBqnOC-_aTQwcd__rg3Sh-OBJaDfDh_oGiyPYElvDxmIkckwSuVKfNKqMGTeHykU2xR8SJ9j9qzXf3fOzquCc-hHh5wgG2WKAja3" },
};

const DEFAULT_CONFIG = { icon: "description", gradient: "from-lime-500/20 to-emerald-500/20", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAnNCJcCu9iHXxuu9HwUN2ZSaPtkO4O0Z_z6v646QBJRfm1NJzBY7phgKYgDESiB9dkLt2wPFvQUP8-Khgq1q2NEkWBVY2hYULVR4AVA0GSJYBXiU7oWZB1KjnwKmVlUObwuZbQks5p2Xw8Pz2WbhP5HzQC17JayeaThOovK9QfEBqnOC-_aTQwcd__rg3Sh-OBJaDfDh_oGiyPYElvDxmIkckwSuVKfNKqMGTeHykU2xR8SJ9j9qzXf3fOzquCc-hHh5wgG2WKAja3" };

export default function TemplatesPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [templateList, setTemplateList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All Templates");

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
    if (confirm("Are you sure you want to delete this template?")) {
      await deleteTemplate(id);
      await fetchData();
    }
  };

  const categories = ["All Templates", "Spiritual", "Events", "Newsletters", "Admin", "Archives"];

  const filteredTemplates = templateList.filter(t => {
    if (activeCategory !== "All Templates" && t.category !== activeCategory) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return t.name?.toLowerCase().includes(q) || t.content?.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-slate-950 font-display -m-4 sm:-m-8 text-slate-900 dark:text-slate-100 min-h-screen">
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-lime-500">auto_awesome_motion</span>
            <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold">Message Templates</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-64 hidden sm:block">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
              <input 
                className="w-full pl-10 pr-4 py-1.5 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-lime-500 outline-none placeholder:text-slate-500 dark:placeholder:text-slate-400 dark:text-white" 
                placeholder="Search templates..." 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative flex items-center justify-center">
                <span className="material-symbols-outlined">notifications</span>
                <span className="absolute top-2 right-2 size-2 bg-red-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="p-8 max-w-7xl mx-auto w-full">
          {/* Hero/Title Section */}
          <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mb-2">Reusable Templates</h1>
              <p className="text-slate-500 dark:text-slate-400 text-lg">Manage and deploy consistent messages across your community. Streamline communication with pre-built modules.</p>
            </div>
            <button className="px-6 py-3 bg-lime-500 text-white font-bold rounded-xl flex items-center gap-2 hover:shadow-lg hover:shadow-lime-500/25 transition-all">
              <span className="material-symbols-outlined">add_circle</span>
              Create Template
            </button>
          </div>

          {/* Category Filters */}
          <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <button 
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={
                  activeCategory === cat 
                    ? "px-4 py-2 bg-lime-500 text-white rounded-full text-sm font-semibold whitespace-nowrap"
                    : "px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-sm font-semibold hover:border-lime-500 transition-colors whitespace-nowrap"
                }
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Template Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full flex items-center justify-center py-20">
                <span className="material-symbols-outlined text-lime-500 text-4xl animate-spin">sync</span>
              </div>
            ) : filteredTemplates.length === 0 ? (
               <div className="col-span-full text-center py-12 text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                 <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                   <span className="material-symbols-outlined text-slate-400 text-3xl">description</span>
                 </div>
                 <p className="font-bold text-xl text-slate-900 dark:text-white">No templates found</p>
               </div>
            ) : (
              filteredTemplates.map((template) => {
                const config = CATEGORY_CONFIG[template.category] || DEFAULT_CONFIG;
                return (
                  <div key={template.id} className="group bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:border-lime-500/50 transition-all hover:shadow-xl hover:shadow-lime-500/5 flex flex-col h-full">
                    <div className="aspect-video relative overflow-hidden bg-slate-100 dark:bg-slate-800">
                      <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                        <span className="material-symbols-outlined text-4xl text-lime-500/40 group-hover:scale-110 transition-transform">
                          {config.icon}
                        </span>
                      </div>
                      <img className="w-full h-full object-cover mix-blend-overlay opacity-50" alt="" src={config.img} />
                      <div className="absolute top-3 right-3 flex gap-2">
                        {template.channel && (
                          <span className="px-2 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[12px]">{template.channel === 'email' ? 'mail' : 'chat'}</span>
                            {template.channel}
                          </span>
                        )}
                        {template.category && (
                          <span className="px-2 py-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {template.category}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-2 gap-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 line-clamp-1">{template.name}</h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="text-slate-400 hover:text-lime-500 transition-colors bg-transparent rounded-md -mt-1 -mr-2">
                              <span className="material-symbols-outlined text-[20px]">more_vert</span>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 rounded-xl">
                            <DropdownMenuItem className="rounded-lg gap-2"><span className="material-symbols-outlined text-[16px] text-slate-500">edit</span>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="rounded-lg gap-2"><span className="material-symbols-outlined text-[16px] text-slate-500">content_copy</span>Duplicate</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-500 rounded-lg focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-950/20 gap-2" onClick={() => handleDelete(template.id)}>
                              <span className="material-symbols-outlined text-[16px]">delete</span>Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 line-clamp-2 flex-1">
                        {template.content || "No content preview available for this template."}
                      </p>
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                        <span className="text-xs text-slate-400 font-medium">Updated: {new Date(template.createdAt).toLocaleDateString()}</span>
                        <button className="text-lime-500 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all">
                          Edit Template <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Add New Placeholder matching stitching style */}
            {!loading && (
              <div className="group bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-8 hover:border-lime-500 transition-all cursor-pointer min-h-[300px]">
                <div className="size-16 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                  <span className="material-symbols-outlined text-3xl text-lime-500">add</span>
                </div>
                <p className="text-slate-900 dark:text-slate-100 font-bold">New Template</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs text-center mt-1">Start from scratch or use a framework</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
