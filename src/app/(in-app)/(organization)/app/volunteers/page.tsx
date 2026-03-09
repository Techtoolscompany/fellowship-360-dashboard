"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateVolunteerDialog } from "@/components/dialogs/CreateVolunteerDialog";
import { LogVolunteerShiftDialog } from "@/components/dialogs/LogVolunteerShiftDialog";
import useOrganization from "@/lib/organizations/useOrganization";
import { getVolunteers } from "@/app/actions/operations";

const ROLE_STYLES: Record<string, { bg: string, text: string, icon: string }> = {
  "Worship Leader": { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", icon: "music_note" },
  "Worship Team":   { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-400", icon: "music_note" },
  "Parking Lot":    { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-700 dark:text-purple-400", icon: "local_parking" },
  "Greeter":        { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-400", icon: "front_hand" },
  "Guest Services": { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-700 dark:text-orange-400", icon: "front_hand" },
  "Production":     { bg: "bg-cyan-50 dark:bg-cyan-900/20", text: "text-cyan-700 dark:text-cyan-400", icon: "videocam" },
  "Default":        { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-400", icon: "award_star" }
};

export default function VolunteersPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [volunteerList, setVolunteerList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All Volunteers");
  const [showAddModal, setShowAddModal] = useState(false);
  const [logShiftVolunteer, setLogShiftVolunteer] = useState<{ id: string; name: string } | null>(null);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getVolunteers(orgId);
      setVolunteerList(data);
    } catch (err) {
      console.error("Failed to fetch volunteers:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeVolunteersCount = volunteerList.filter(v => v.volunteer.status === "active").length;
  const pendingVolunteersCount = volunteerList.filter(v => v.volunteer.status === "pending").length;

  const tabs = ["All Volunteers", "Worship Team", "Guest Services", "Production", "Parking Lot"];

  const filteredVolunteers = volunteerList.filter(vol => {
    if (activeTab !== "All Volunteers" && vol.volunteer.role !== activeTab) return false;
    
    if (!searchQuery) return true;
    const lowerQuery = searchQuery.toLowerCase();
    const nameMatch = vol.contact ? `${vol.contact.firstName} ${vol.contact.lastName}`.toLowerCase().includes(lowerQuery) : false;
    const emailMatch = vol.contact?.email?.toLowerCase().includes(lowerQuery);
    const roleMatch = vol.volunteer.role?.toLowerCase().includes(lowerQuery);
    return nameMatch || emailMatch || roleMatch;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 font-display -m-4 sm:-m-8 min-h-screen">
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-6 lg:px-10 py-8 relative">
        
        {/* Header Section */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8 xl:pr-[340px]">
          <div className="flex flex-col gap-1">
            <h1 className="text-slate-900 dark:text-white text-3xl font-extrabold tracking-tight">Volunteer Management</h1>
            <p className="text-slate-500 dark:text-slate-400 text-base">Organize and empower your ministry teams.</p>
          </div>
          <div className="flex gap-3">
            <button
              disabled
              title="Export coming soon"
              className="inline-flex items-center gap-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-400 dark:text-slate-500 shadow-sm opacity-50 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-lg">file_download</span>
              Export CSV
            </button>
            <CreateVolunteerDialog open={showAddModal} onOpenChange={setShowAddModal} onSuccess={fetchData}>
              <button className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-opacity-90 transition-all">
                <span className="material-symbols-outlined text-lg">add</span>
                Add Volunteer
              </button>
            </CreateVolunteerDialog>
            <LogVolunteerShiftDialog
              open={!!logShiftVolunteer}
              onOpenChange={(open: boolean) => !open && setLogShiftVolunteer(null)}
              onSuccess={fetchData}
              volunteerId={logShiftVolunteer?.id || null}
              volunteerName={logShiftVolunteer?.name}
            />
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 xl:pr-[340px]">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-lime-500/10 text-lime-600 dark:text-lime-500">
                <span className="material-symbols-outlined">groups</span>
              </div>
              <span className="text-emerald-500 text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded">+12%</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Volunteers</p>
            <p className="text-slate-900 dark:text-white text-3xl font-bold mt-1">
              {loading ? "..." : volunteerList.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-lime-500/10 text-lime-600 dark:text-lime-500">
                <span className="material-symbols-outlined">bolt</span>
              </div>
              <span className="text-emerald-500 text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded">+5%</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Active Now</p>
            <p className="text-slate-900 dark:text-white text-3xl font-bold mt-1">
              {loading ? "..." : activeVolunteersCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-orange-100 text-orange-600">
                <span className="material-symbols-outlined">bedtime</span>
              </div>
              <span className="text-orange-500 text-xs font-bold bg-orange-50 dark:bg-orange-500/10 px-2 py-1 rounded">-2%</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Pending</p>
            <p className="text-slate-900 dark:text-white text-3xl font-bold mt-1">
              {loading ? "..." : pendingVolunteersCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 rounded-lg bg-lime-500/10 text-lime-600 dark:text-lime-500">
                <span className="material-symbols-outlined">fact_check</span>
              </div>
              <span className="text-emerald-500 text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 rounded">+3%</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Roles Filled</p>
            <p className="text-slate-900 dark:text-white text-3xl font-bold mt-1">92%</p>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm xl:mr-[340px]">
          {/* Table Header / Filters */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-[300px]">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                <input 
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-lime-500 focus:border-lime-500 text-sm dark:text-white outline-none" 
                  placeholder="Search volunteers by name, email, or role..." 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                disabled
                title="Filters coming soon"
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-400 dark:text-slate-500 opacity-50 cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-lg">filter_list</span>
                Filters
              </button>
            </div>
            <div className="flex items-center gap-2 hidden sm:flex">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">Sort by</span>
              <select className="rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-400 py-2 outline-none">
                <option>Newest First</option>
                <option>Oldest First</option>
                <option>Name (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab 
                    ? "border-lime-500 text-lime-500" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 border-transparent"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto min-h-[400px]">
            {loading ? (
               <div className="flex items-center justify-center py-32">
                 <span className="material-symbols-outlined h-8 w-8 animate-spin text-lime-500 mx-auto text-3xl">sync</span>
               </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Volunteer</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Role</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Joined Date</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredVolunteers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        No volunteers match your current filters.
                      </td>
                    </tr>
                  ) : filteredVolunteers.map((vol) => {
                    const name = vol.contact ? `${vol.contact.firstName} ${vol.contact.lastName}` : "Unknown Volunteer";
                    const email = vol.contact?.email || "No email";
                    const initials = name.split(" ").map((n: string) => n[0]).join("");
                    
                    const roleName = vol.volunteer.role || "General";
                    const roleStyle = ROLE_STYLES[roleName] || ROLE_STYLES.Default;
                    
                    const isActive = vol.volunteer.status === "active";
                    
                    return (
                      <tr key={vol.volunteer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 dark:text-slate-400">
                              {initials}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${roleStyle.bg} ${roleStyle.text}`}>
                            <span className="material-symbols-outlined text-[14px]">{roleStyle.icon}</span>
                            {roleName}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {new Date(vol.volunteer.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold">
                              <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                              {vol.volunteer.status.replace("_", " ")}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="text-slate-400 hover:text-lime-500 transition-colors p-1 bg-transparent rounded-md outline-none">
                                <span className="material-symbols-outlined">more_horiz</span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 rounded-xl font-display">
                              <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => vol.volunteer?.contactId && router.push(`/app/contacts/${vol.volunteer.contactId}`)}>
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem className="rounded-lg cursor-pointer" onClick={() => setLogShiftVolunteer({ id: vol.volunteer.id, name })}>
                                Log Hours
                              </DropdownMenuItem>
                              <DropdownMenuItem className="rounded-lg cursor-pointer">
                                Send Message
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Table Footer / Pagination */}
          {!loading && (
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Showing {filteredVolunteers.length} volunteers</p>
              <div className="flex items-center gap-2">
                <button className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-lime-500 transition-colors">
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>
                <button className="h-8 w-8 rounded bg-lime-500 text-white text-xs font-bold">1</button>
                <button className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 hover:text-lime-500 transition-colors">
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Activity (Hidden on mobile and smaller desktops) */}
        <div className="absolute right-0 top-8 bottom-8 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hidden xl:block p-6">
          <h3 className="text-slate-900 dark:text-white font-bold mb-4">Recent Activity</h3>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-lime-500/20 flex items-center justify-center text-lime-600 dark:text-lime-500">
                  <span className="material-symbols-outlined text-sm">person_add</span>
                </div>
                <div className="absolute top-8 bottom-[-24px] left-1/2 -translate-x-1/2 w-0.5 bg-slate-100 dark:bg-slate-800"></div>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">New volunteer joined</p>
                <p className="text-xs text-slate-500 mt-0.5">James Wilson joined Guest Services</p>
                <p className="text-[10px] text-slate-400 uppercase mt-1">2 hours ago</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="relative">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <span className="material-symbols-outlined text-sm">edit</span>
                </div>
                <div className="absolute top-8 bottom-[-24px] left-1/2 -translate-x-1/2 w-0.5 bg-slate-100 dark:bg-slate-800"></div>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Role Updated</p>
                <p className="text-xs text-slate-500 mt-0.5">Sarah Jenkins was promoted to Leader</p>
                <p className="text-[10px] text-slate-400 uppercase mt-1">5 hours ago</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                <span className="material-symbols-outlined text-sm">schedule</span>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Shift Change</p>
                <p className="text-xs text-slate-500 mt-0.5">Michael Chen requested time off</p>
                <p className="text-[10px] text-slate-400 uppercase mt-1">Yesterday</p>
              </div>
            </div>
          </div>
          
          <div className="mt-12">
            <h3 className="text-slate-900 dark:text-white font-bold mb-4">Ministry Growth</h3>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 border border-slate-100 dark:border-slate-700">
              <div className="h-24 flex items-end justify-between gap-1">
                <div className="w-full bg-lime-500/30 rounded-t h-[40%]"></div>
                <div className="w-full bg-lime-500/30 rounded-t h-[60%]"></div>
                <div className="w-full bg-lime-500/30 rounded-t h-[55%]"></div>
                <div className="w-full bg-lime-500/30 rounded-t h-[75%]"></div>
                <div className="w-full bg-lime-500/30 rounded-t h-[90%]"></div>
                <div className="w-full bg-lime-500 rounded-t h-[100%]"></div>
              </div>
              <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400 uppercase">
                <span>Jan</span>
                <span>Jun</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4 leading-relaxed">Volunteer engagement is up by <span className="text-lime-500 font-bold">18.4%</span> since the beginning of the year.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
