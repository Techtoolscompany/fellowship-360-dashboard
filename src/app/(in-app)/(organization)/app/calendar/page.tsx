"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Plus, ChevronLeft, ChevronRight, MapPin, Clock, Loader2, Calendar as CalendarIcon, Filter } from "lucide-react";
import useOrganization from "@/lib/organizations/useOrganization";
import { getEvents } from "@/app/actions/calendar";
import { CreateEventDialog } from "@/components/dialogs/CreateEventDialog";
import { EditEventDialog } from "@/components/dialogs/EditEventDialog";

export default function CalendarPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [eventList, setEventList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [showAddModal, setShowAddModal] = useState(false);
  const [editEventState, setEditEventState] = useState<any>(null);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getEvents(orgId);
      setEventList(data);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build calendar cells
  const calendarCells: { day: number | null; events: any[] }[] = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push({ day: null, events: [] });
  for (let d = 1; d <= daysInMonth; d++) {
    const dayEvents = eventList.filter(e => {
      const eventDate = new Date(e.startDate);
      return eventDate.getFullYear() === year && eventDate.getMonth() === month && eventDate.getDate() === d;
    });
    calendarCells.push({ day: d, events: dayEvents });
  }

  const today = new Date();
  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const eventColors = [
    "bg-lime-500/10 text-lime-600 dark:text-lime-400", 
    "bg-blue-500/10 text-blue-600 dark:text-blue-400", 
    "bg-purple-500/10 text-purple-600 dark:text-purple-400", 
    "bg-amber-500/10 text-amber-600 dark:text-amber-400"
  ];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Upcoming events (within next 14 days from today)
  const upcomingEvents = eventList
    .filter(e => new Date(e.startDate) >= today)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 8);

  const getDayShort = (dateStr: string) => {
    return new Date(dateStr).getDate();
  };
  const getMonthShort = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("default", { month: "short" });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 font-display -m-4 sm:-m-8">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="size-10 bg-lime-500 flex items-center justify-center rounded-lg text-slate-950 shadow-lg shadow-lime-500/20">
               <CalendarIcon className="w-5 h-5" />
             </div>
             <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Church Calendar</h2>
          </div>
          <p className="text-sm text-slate-500 hidden md:block">{eventList.length} events scheduled</p>
        </div>
      </header>

      <main className="flex-1 w-full px-8 py-8 overflow-y-auto">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 mt-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-lime-600 dark:text-lime-500 font-semibold text-sm tracking-wide uppercase">
              <CalendarIcon className="w-4 h-4" />
              <span>Community Schedule</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Events Calendar</h1>
            <p className="text-slate-500 dark:text-slate-400 max-w-lg mt-2">Manage, plan, and discover all upcoming services, community outreach, and special events across our campuses.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto shadow-none">
            <button className="flex items-center justify-center flex-1 md:flex-none gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-semibold text-sm">
              <Filter className="w-4 h-4" />
              Filter
            </button>
            <CreateEventDialog open={showAddModal} onOpenChange={setShowAddModal} onSuccess={fetchData}>
              <button className="flex items-center justify-center flex-1 md:flex-none gap-2 px-6 py-2.5 rounded-xl bg-lime-500 text-slate-950 hover:bg-lime-500/90 transition-all font-bold text-sm shadow-xl shadow-lime-500/20">
                <Plus className="w-4 h-4" />
                Add Event
              </button>
            </CreateEventDialog>

            <EditEventDialog
              open={!!editEventState}
              onOpenChange={(open) => !open && setEditEventState(null)}
              onSuccess={fetchData}
              event={editEventState}
            />
          </div>
        </div>

        {loading ? (
           <div className="text-center py-24"><Loader2 className="h-8 w-8 animate-spin text-lime-500 mx-auto" /></div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Left: Full Monthly Calendar */}
            <div className="xl:col-span-8 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Calendar Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white min-w-[200px]">{monthName}</h3>
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                      <button onClick={prevMonth} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all text-slate-600 dark:text-slate-300">
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button onClick={nextMonth} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all text-slate-600 dark:text-slate-300">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 self-start w-full md:w-auto">
                    <button className="flex-1 px-4 py-1.5 rounded-lg text-sm font-semibold bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm transition-all border border-slate-200 dark:border-slate-600">Month</button>
                    <button disabled title="Week view coming soon" className="flex-1 px-4 py-1.5 rounded-lg text-sm font-semibold text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed transition-all">Week</button>
                    <button disabled title="Day view coming soon" className="flex-1 px-4 py-1.5 rounded-lg text-sm font-semibold text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed transition-all">Day</button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                     <div key={d} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 auto-rows-[120px]">
                  {calendarCells.map((cell, index) => {
                    const todaySelected = cell.day && isToday(cell.day);
                    return (
                      <div
                        key={index}
                        className={`border-r border-b border-slate-100 dark:border-slate-800 p-2 flex flex-col gap-1 overflow-hidden group ${
                          !cell.day ? 'bg-slate-50/50 dark:bg-slate-800/20' : 
                          todaySelected ? 'bg-lime-500/5 relative' : 'bg-white dark:bg-slate-900'
                        }`}
                      >
                        {todaySelected && <div className="absolute inset-0 border-2 border-lime-500 z-10 pointer-events-none rounded-lg m-1"></div>}
                        
                        <div className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
                          todaySelected ? 'bg-lime-500 text-slate-950 font-bold ml-1 mt-1' : cell.day ? 'text-slate-700 dark:text-slate-300 ml-1 mt-1' : ''
                        }`}>
                          {cell.day}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto scrollbar-hide space-y-1 mt-1 px-1">
                           {cell.events.map((event, i) => (
                             <div 
                               key={event.id}
                               onClick={() => setEditEventState(event)}
                               className={`text-[10px] px-2 py-1 rounded font-bold truncate cursor-pointer transition-transform hover:scale-[1.02] ${eventColors[i % eventColors.length]}`}
                               title={event.title}
                             >
                               {event.title}
                             </div>
                           ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right: Upcoming Events Sidebar */}
            <div className="xl:col-span-4 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Upcoming Events</h3>
                <button className="text-lime-600 dark:text-lime-500 text-sm font-semibold hover:underline">View All</button>
              </div>
              
              <div className="space-y-4">
                {upcomingEvents.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-sm">
                    No upcoming events.
                  </div>
                ) : upcomingEvents.map((event, idx) => {
                  const borderColors = [
                    "border-lime-500/20", "border-blue-500/20", "border-purple-500/20", "border-amber-500/20"
                  ];
                  const bgColors = [
                    "bg-lime-500/10", "bg-blue-500/10", "bg-purple-500/10", "bg-amber-500/10"
                  ];
                  const textColors = [
                    "text-lime-600 dark:text-lime-400 gap-hover:text-lime-500", 
                    "text-blue-600 dark:text-blue-400 group-hover:text-blue-500", 
                    "text-purple-600 dark:text-purple-400 group-hover:text-purple-500", 
                    "text-amber-600 dark:text-amber-400 group-hover:text-amber-500"
                  ];
                  const colorIdx = idx % borderColors.length;

                  return (
                    <div 
                      key={event.id}
                      onClick={() => setEditEventState(event)}
                      className="group bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-lime-500/50 transition-all cursor-pointer"
                    >
                      <div className="flex gap-4">
                        <div className={`flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center border ${bgColors[colorIdx]} ${borderColors[colorIdx]} ${textColors[colorIdx].split(' ')[0]}`}>
                          <span className="text-lg font-bold">{getDayShort(event.startDate)}</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest">{getMonthShort(event.startDate)}</span>
                        </div>
                        <div className="flex-1 space-y-1.5 overflow-hidden">
                          <h4 className="font-bold text-slate-900 dark:text-white truncate transition-colors group-hover:text-lime-600 dark:group-hover:text-lime-400">{event.title}</h4>
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{new Date(event.startDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Actions */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm mt-8">
                <h4 className="font-bold text-slate-900 dark:text-white mb-4">Quick Stats</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <p className="text-3xl font-black text-lime-600 dark:text-lime-500">{upcomingEvents.length}</p>
                    <p className="text-[10px] uppercase font-bold text-slate-500 mt-1 tracking-wider">Events coming</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <p className="text-3xl font-black text-lime-600 dark:text-lime-500">{eventList.length}</p>
                    <p className="text-[10px] uppercase font-bold text-slate-500 mt-1 tracking-wider">Total Hosted</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
