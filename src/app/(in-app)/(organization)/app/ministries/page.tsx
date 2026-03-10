"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { getMinistries, deleteMinistry } from "@/app/actions/ministries";
import { CreateMinistryDialog } from "@/components/dialogs/CreateMinistryDialog";
import { EditMinistryDialog } from "@/components/dialogs/EditMinistryDialog";
import { MinistryMembersSheet } from "@/components/sheets/MinistryMembersSheet";

const getGradient = (index: number) => {
  const colors = [
    { from: "#4f46e5", to: "#7c3aed" }, // Indigo
    { from: "#059669", to: "#10b981" }, // Emerald
    { from: "#ea580c", to: "#f97316" }, // Orange
    { from: "#0284c7", to: "#0ea5e9" }, // Sky
  ];
  const color = colors[index % colors.length];
  return `linear-gradient(135deg, ${color.from} 0%, ${color.to} 100%)`;
};

const getIcon = (index: number) => {
  const icons = ["school", "public", "music_note", "auto_stories", "groups", "diversity_1", "child_care", "language"];
  return icons[index % icons.length];
};

function MinistryCard({ ministry, index, onEdit, onDelete, onViewMembers }: { ministry: any; index: number; onEdit: (m: any) => void; onDelete: (id: string) => void; onViewMembers: (m: any) => void }) {
  const gradientStyle = { background: getGradient(index) };
  const icon = getIcon(index);

  return (
    <div className="group bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden hover:shadow-2xl transition-all hover:-translate-y-1 flex flex-col h-full">
      <div className="h-48 overflow-hidden relative flex-shrink-0">
        <div 
          className="absolute inset-0 bg-cover bg-center group-hover:scale-110 transition-transform duration-500" 
          style={gradientStyle}
        ></div>
        <div className="absolute top-4 left-4">
          <span 
            className="bg-[#84cc16] text-slate-950 text-[10px] font-black px-2 py-1 rounded uppercase tracking-tighter"
          >
            {ministry.ministry.meetingDay || "Active"}
          </span>
        </div>
        <div className="absolute top-4 right-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1.5 shadow-sm">
          <span className="material-symbols-outlined text-[12px] text-slate-700 dark:text-slate-300">group</span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{ministry.memberCount}</span>
        </div>
      </div>
      
      <div className="p-6 space-y-4 flex flex-col flex-1">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 text-[#84cc16]">
            <span className="material-symbols-outlined text-xl">{icon}</span>
            <h4 className="font-bold text-lg text-slate-900 dark:text-white line-clamp-1">{ministry.ministry.name}</h4>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <span className="material-symbols-outlined text-base">more_horiz</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 font-display">
              <DropdownMenuItem onClick={() => onViewMembers(ministry.ministry)}>View Members</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(ministry.ministry)}>Edit Ministry</DropdownMenuItem>
              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => onDelete(ministry.ministry.id)}>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <p className="text-slate-500 dark:text-slate-400 text-sm line-clamp-2 flex-1">
          {ministry.ministry.description || "Building foundations of faith for the next generation through fun, fellowship, and deep study."}
        </p>
        
        {ministry.ministry.meetingLocation && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="material-symbols-outlined text-[14px]">location_on</span>
            <span className="truncate">{ministry.ministry.meetingLocation}</span>
          </div>
        )}

        <button 
          onClick={() => onViewMembers(ministry.ministry)}
          className="w-full mt-auto py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold group-hover:bg-[#84cc16] group-hover:text-slate-950 group-hover:border-[#84cc16] transition-all"
        >
          Learn More
        </button>
      </div>
    </div>
  );
}

export default function MinistriesPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [searchQuery, setSearchQuery] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [editMinistryState, setEditMinistryState] = useState<any>(null);
  const [viewMembersMinistry, setViewMembersMinistry] = useState<any>(null);

  const { data: ministriesList = [], error, mutate, isLoading: loading } = useSWR<any[]>(
    orgId ? ["ministries", orgId] : null,
    () => getMinistries(orgId!)
  );

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this ministry?")) {
      await deleteMinistry(id);
      await mutate();
    }
  };

  const filteredMinistries = ministriesList.filter((m: any) => {
    if (!searchQuery) return true;
    return m.ministry.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           (m.ministry.description || "").toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-[#f6f7f8] dark:bg-[#101922] font-display -m-4 sm:-m-8 pb-10">
      {/* Header */}
      <header className="h-20 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400">search</span>
          <input 
            className="border-none bg-transparent focus:ring-0 text-sm w-64 placeholder-slate-400 p-0" 
            placeholder="Find a ministry or community..." 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
           {/* Add Ministry Button placed in header */}
           <CreateMinistryDialog open={showAddModal} onOpenChange={setShowAddModal} onSuccess={() => void mutate()}>
            <button className="bg-[#84cc16] hover:bg-[#84cc16]/90 text-slate-950 font-bold px-4 py-2 rounded-xl transition-all hidden sm:flex items-center gap-2 text-sm">
              <span className="material-symbols-outlined text-sm">add</span>Add Ministry
            </button>
          </CreateMinistryDialog>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto w-full space-y-12">
        {/* Hero Section */}
        <section className="relative h-[400px] rounded-3xl overflow-hidden group">
          <div className="absolute inset-0 bg-slate-900 transition-transform duration-700" 
               style={{ backgroundImage: "url('https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=2070&auto=format&fit=crop')", backgroundSize: "cover", backgroundPosition: "center" }}></div>
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/40 to-transparent"></div>
          <div className="absolute inset-0 p-12 flex flex-col justify-center max-w-2xl gap-4">
            <span className="inline-block px-3 py-1 bg-[#84cc16] text-slate-950 text-xs font-bold rounded-full w-max uppercase tracking-wider">Featured Outreach</span>
            <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">Make an impact in your local community.</h2>
            <p className="text-slate-200 text-lg">Join our &quot;Harvest Project&quot; this Saturday. We&apos;re providing over 500 meals to families in need and looking for hands to help.</p>
            <div className="flex gap-4 mt-4">
              <button className="bg-[#84cc16] hover:bg-[#84cc16]/90 text-slate-950 font-bold px-8 py-3 rounded-xl transition-all flex items-center gap-2">
                Register Now <span className="material-symbols-outlined">arrow_forward</span>
              </button>
              <button className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/20 font-bold px-8 py-3 rounded-xl transition-all">
                View Details
              </button>
            </div>
          </div>
        </section>

        {/* Filter & Categories Header */}
        <section className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Discover Ministries</h3>
              <p className="text-slate-500 dark:text-slate-400">Find where you belong in our growing church family.</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button className="px-5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold border border-slate-900 dark:border-white shrink-0">All Areas</button>
              <button className="px-5 py-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium border border-slate-200 dark:border-slate-700 shrink-0 hover:border-[#84cc16] transition-colors">Adults</button>
              <button className="px-5 py-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium border border-slate-200 dark:border-slate-700 shrink-0 hover:border-[#84cc16] transition-colors">Students</button>
              <button className="px-5 py-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium border border-slate-200 dark:border-slate-700 shrink-0 hover:border-[#84cc16] transition-colors">Creative</button>
              <button className="px-5 py-2 rounded-full bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium border border-slate-200 dark:border-slate-700 shrink-0 hover:border-[#84cc16] transition-colors">Compassion</button>
            </div>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-80 w-full rounded-3xl bg-slate-200 dark:bg-slate-800" />
              ))}
            </div>
          ) : filteredMinistries.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-700">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl text-slate-400">group</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No ministries found</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-6">You haven&apos;t created any ministries yet. Click the button below to get started building your community.</p>
              <Button onClick={() => setShowAddModal(true)} className="bg-[#84cc16] text-slate-950 hover:bg-[#84cc16]/90 font-bold rounded-xl">
                Create First Ministry
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {filteredMinistries.map((ministry, i) => (
                <MinistryCard 
                  key={ministry.ministry.id} 
                  ministry={ministry} 
                  index={i} 
                  onEdit={setEditMinistryState}
                  onDelete={handleDelete}
                  onViewMembers={setViewMembersMinistry}
                />
              ))}
            </div>
          )}
        </section>

        {/* CTA Section from Stitch */}
        {!loading && ministriesList.length > 0 && (
          <section className="bg-slate-900 dark:bg-[#84cc16]/10 rounded-3xl p-12 text-center space-y-6">
            <h3 className="text-3xl font-bold text-white dark:text-[#84cc16]">Not sure where you fit in?</h3>
            <p className="text-slate-400 dark:text-slate-300 max-w-xl mx-auto">Take our 2-minute &quot;Community Connector&quot; quiz to find the ministry that matches your unique spiritual gifts and passions.</p>
            <button className="bg-[#84cc16] text-slate-950 font-bold px-10 py-4 rounded-xl hover:bg-[#84cc16]/90 transition-all shadow-xl shadow-[#84cc16]/10">
              Take the Quiz
            </button>
          </section>
        )}
      </div>

      <CreateMinistryDialog 
        open={showAddModal} 
        onOpenChange={setShowAddModal} 
        onSuccess={() => void mutate()} 
      />
      <EditMinistryDialog
        open={!!editMinistryState}
        onOpenChange={(open) => !open && setEditMinistryState(null)}
        onSuccess={() => void mutate()}
        ministry={editMinistryState}
      />

      <MinistryMembersSheet
        open={!!viewMembersMinistry}
        onOpenChange={(open) => {
          if (!open) {
            setViewMembersMinistry(null);
            void mutate(); 
          }
        }}
        ministryId={viewMembersMinistry?.id || null}
        ministryName={viewMembersMinistry?.name || ""}
      />
    </div>
  );
}
