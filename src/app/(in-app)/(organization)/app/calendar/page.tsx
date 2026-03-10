"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, ChevronLeft, ChevronRight, MapPin, Clock, Loader2, Calendar as CalendarIcon, Filter } from "lucide-react";
import useOrganization from "@/lib/organizations/useOrganization";
import { getEvents } from "@/app/actions/calendar";
import { CreateEventDialog } from "@/components/dialogs/CreateEventDialog";
import { EditEventDialog } from "@/components/dialogs/EditEventDialog";

type CalendarView = "month" | "week" | "day";

function getWeekDays(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getDayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default function CalendarPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [eventList, setEventList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>("month");

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

  // Date range for fetching events (buffer around visible range)
  const dateRange = useMemo(() => {
    const start = new Date(year, month, 1);
    start.setMonth(start.getMonth() - 1);
    start.setDate(1);
    const end = new Date(year, month + 2, 0);
    return { start, end };
  }, [year, month]);

  // Filter events by date range
  const filteredEvents = useMemo(() => {
    return eventList.filter(e => {
      const eventDate = new Date(e.startDate);
      return eventDate >= dateRange.start && eventDate <= dateRange.end;
    });
  }, [eventList, dateRange]);

  // Build calendar cells for month view
  const calendarCells = useMemo(() => {
    const cells: { day: number | null; date: Date | null; events: any[] }[] = [];
    for (let i = 0; i < firstDay; i++) {
      const d = new Date(year, month, -firstDay + i + 1);
      cells.push({ day: null, date: d, events: [] });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, month, d);
      const dayEvents = filteredEvents.filter(e => {
        const eventDate = new Date(e.startDate);
        return eventDate.getFullYear() === year && eventDate.getMonth() === month && eventDate.getDate() === d;
      });
      cells.push({ day: d, date: cellDate, events: dayEvents });
    }
    // Fill remaining cells to complete 6 weeks
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({ day: i, date: d, events: [] });
    }
    return cells;
  }, [year, month, firstDay, daysInMonth, filteredEvents]);

  // Week view data
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  // Day view data
  const dayEvents = useMemo(() => {
    const { start, end } = getDayBounds(currentDate);
    return filteredEvents.filter(e => {
      const eventDate = new Date(e.startDate);
      return eventDate >= start && eventDate <= end;
    }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [filteredEvents, currentDate]);

  const today = new Date();
  const isToday = (d: number, m: number, y: number) => d === today.getDate() && m === today.getMonth() && y === today.getFullYear();
  const eventColors = [
    "bg-lime-500/10 text-lime-600 dark:text-lime-400", 
    "bg-blue-500/10 text-blue-600 dark:text-blue-400", 
    "bg-purple-500/10 text-purple-600 dark:text-purple-400", 
    "bg-amber-500/10 text-amber-600 dark:text-amber-400"
  ];

  const navigatePrev = () => {
    if (view === "month") setCurrentDate(new Date(year, month - 1, 1));
    else if (view === "week") {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 7);
      setCurrentDate(newDate);
    } else {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 1);
      setCurrentDate(newDate);
    }
  };

  const navigateNext = () => {
    if (view === "month") setCurrentDate(new Date(year, month + 1, 1));
    else if (view === "week") {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 7);
      setCurrentDate(newDate);
    } else {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 1);
      setCurrentDate(newDate);
    }
  };

  const navigateToday = () => setCurrentDate(new Date());

  const goToDate = (date: Date) => {
    setCurrentDate(date);
    if (view === "month") {
      // Already set
    } else if (view === "week") {
      // Week view centers on the date
    } else {
      // Day view shows the date
    }
  };

  // Upcoming events (within next 14 days from today)
  const upcomingEvents = eventList
    .filter(e => new Date(e.startDate) >= today)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 8);

  const getDayShort = (dateStr: string) => new Date(dateStr).getDate();
  const getMonthShort = (dateStr: string) => new Date(dateStr).toLocaleString("default", { month: "short" });

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const renderMonthView = () => (
    <div className="grid grid-cols-7 auto-rows-[120px]">
      {calendarCells.map((cell, index) => {
        const cellMonth = cell.date?.getMonth() ?? month;
        const isCurrentMonth = cellMonth === month;
        const dayNum = cell.day ?? 0;
        const todaySelected = isCurrentMonth && isToday(dayNum, month, year);
        
        return (
          <div
            key={index}
            onClick={() => cell.date && (isCurrentMonth ? goToDate(cell.date) : setCurrentDate(cell.date))}
            className={`border-r border-b border-slate-100 dark:border-slate-800 p-2 flex flex-col gap-1 overflow-hidden group cursor-pointer transition-colors ${
              !isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-800/20' : 
              todaySelected ? 'bg-lime-500/5' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {todaySelected && <div className="absolute inset-0 border-2 border-lime-500 z-10 pointer-events-none rounded-lg m-1"></div>}
            
            <div className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
              todaySelected ? 'bg-lime-500 text-slate-950 font-bold' : 
              !isCurrentMonth ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'
            }`}>
              {cell.day}
            </div>
            
            <div className="flex-1 overflow-y-auto scrollbar-hide space-y-1 mt-1 px-1">
              {cell.events.slice(0, 3).map((event, i) => (
                <div 
                  key={event.id}
                  onClick={(e) => { e.stopPropagation(); setEditEventState(event); }}
                  className={`text-[10px] px-2 py-1 rounded font-bold truncate cursor-pointer transition-transform hover:scale-[1.02] ${eventColors[i % eventColors.length]}`}
                  title={event.title}
                >
                  {event.title}
                </div>
              ))}
              {cell.events.length > 3 && (
                <div className="text-[10px] text-slate-500 pl-2">+{cell.events.length - 3} more</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderWeekView = () => (
    <div className="flex flex-col h-full">
      {/* Week header */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
        {weekDays.map((day, i) => {
          const isTodayDate = day.toDateString() === today.toDateString();
          return (
            <div 
              key={i} 
              onClick={() => goToDate(day)}
              className={`p-3 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${isTodayDate ? 'bg-lime-500/10' : ''}`}
            >
              <div className="text-xs font-bold text-slate-400 uppercase">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
              <div className={`text-lg font-bold ${isTodayDate ? 'text-lime-600 dark:text-lime-400' : 'text-slate-900 dark:text-white'}`}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      {/* Week grid */}
      <div className="grid grid-cols-7 flex-1 divide-x divide-slate-200 dark:divide-slate-700">
        {weekDays.map((day, i) => {
          const dayEvts = filteredEvents.filter(e => {
            const eventDate = new Date(e.startDate);
            return eventDate.toDateString() === day.toDateString();
          });
          return (
            <div key={i} className="p-2 space-y-2 overflow-y-auto">
              {dayEvts.map((event, j) => (
                <div
                  key={event.id}
                  onClick={() => setEditEventState(event)}
                  className={`p-2 rounded text-xs font-bold cursor-pointer hover:opacity-80 ${eventColors[j % eventColors.length]}`}
                >
                  <div className="truncate">{event.title}</div>
                  <div className="text-[10px] opacity-70">{formatTime(event.startDate)}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="text-center p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="text-sm font-bold text-slate-400 uppercase">
            {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">
            {currentDate.getDate()}
          </div>
          <div className="text-slate-500">{monthName}</div>
        </div>
        <div className="flex-1">
          {hours.map(hour => {
            const hourEvents = dayEvents.filter(e => new Date(e.startDate).getHours() === hour);
            return (
              <div key={hour} className="flex border-b border-slate-100 dark:border-slate-800 min-h-[60px]">
                <div className="w-16 text-xs text-slate-400 p-2 text-right shrink-0">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </div>
                <div className="flex-1 p-1 space-y-1">
                  {hourEvents.map((event, i) => (
                    <div
                      key={event.id}
                      onClick={() => setEditEventState(event)}
                      className={`p-2 rounded text-xs font-bold cursor-pointer ${eventColors[i % eventColors.length]}`}
                    >
                      {event.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
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
          <p className="text-sm text-slate-500 hidden md:block">{filteredEvents.length} events</p>
        </div>
      </header>

      <main className="flex-1 w-full px-8 py-8 overflow-y-auto">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6 mt-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-lime-600 dark:text-lime-500 font-semibold text-sm tracking-wide uppercase">
              <CalendarIcon className="w-4 h-4" />
              <span>Community Schedule</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Events Calendar</h1>
            <p className="text-slate-500 dark:text-slate-400 max-w-lg mt-2">Manage, plan, and discover all upcoming services, community outreach, and special events across our campuses.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
              onClick={navigateToday}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-semibold text-sm"
            >
              Today
            </button>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <button onClick={navigatePrev} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all text-slate-600 dark:text-slate-300">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={navigateNext} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-all text-slate-600 dark:text-slate-300">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
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

        {/* View Toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-6 w-fit">
          {(["month", "week", "day"] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize ${
                view === v 
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {loading ? (
           <div className="text-center py-24"><Loader2 className="h-8 w-8 animate-spin text-lime-500 mx-auto" /></div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Calendar */}
            <div className="xl:col-span-8 space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Calendar Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {view === 'month' && monthName}
                    {view === 'week' && `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                    {view === 'day' && currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                     <div key={d} className="py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">{d}</div>
                  ))}
                </div>

                {/* Calendar content */}
                {view === 'month' && renderMonthView()}
                {view === 'week' && renderWeekView()}
                {view === 'day' && renderDayView()}
              </div>
            </div>

            {/* Right: Upcoming Events Sidebar */}
            <div className="xl:col-span-4 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Upcoming Events</h3>
              </div>
              
              <div className="space-y-4">
                {upcomingEvents.length === 0 ? (
                  <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 text-sm">
                    No upcoming events.
                  </div>
                ) : upcomingEvents.map((event, idx) => {
                  const colorIdx = idx % 4;
                  const colors = [
                    ["bg-lime-500/10", "border-lime-500/20", "text-lime-600 dark:text-lime-400"],
                    ["bg-blue-500/10", "border-blue-500/20", "text-blue-600 dark:text-blue-400"],
                    ["bg-purple-500/10", "border-purple-500/20", "text-purple-600 dark:text-purple-400"],
                    ["bg-amber-500/10", "border-amber-500/20", "text-amber-600 dark:text-amber-400"],
                  ];

                  return (
                    <div 
                      key={event.id}
                      onClick={() => setEditEventState(event)}
                      className="group bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-lime-500/50 transition-all cursor-pointer"
                    >
                      <div className="flex gap-4">
                        <div className={`flex-shrink-0 w-16 h-16 rounded-xl flex flex-col items-center justify-center border ${colors[colorIdx][0]} ${colors[colorIdx][1]}`}>
                          <span className="text-lg font-bold">{getDayShort(event.startDate)}</span>
                          <span className="text-[10px] font-bold uppercase tracking-widest">{getMonthShort(event.startDate)}</span>
                        </div>
                        <div className="flex-1 space-y-1.5 overflow-hidden">
                          <h4 className="font-bold text-slate-900 dark:text-white truncate transition-colors group-hover:text-lime-600 dark:group-hover:text-lime-400">{event.title}</h4>
                          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{formatTime(event.startDate)}</span>
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

              {/* Quick Stats */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
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
