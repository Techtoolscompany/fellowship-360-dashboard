"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight, MapPin, Clock, Loader2 } from "lucide-react";
import useOrganization from "@/lib/organizations/useOrganization";
import { getEvents } from "@/app/actions/calendar";

export default function CalendarPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [eventList, setEventList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

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
  const eventColors = ["blue", "violet", "emerald", "amber", "pink", "rose"];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Upcoming events (within next 14 days from today)
  const upcomingEvents = eventList
    .filter(e => new Date(e.startDate) >= today)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Church Events & Schedule</p>
          <h1 className="text-3xl font-bold text-foreground">Calendar</h1>
        </div>
        <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600]">
          <Plus className="w-4 h-4 mr-2" />Add Event
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#bbff00] mx-auto" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
              <CardTitle>{monthName}</CardTitle>
              <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">{day}</div>
                ))}
                {calendarCells.map((cell, index) => (
                  <div
                    key={index}
                    className={`min-h-[80px] p-2 border rounded-lg text-sm ${
                      cell.day && isToday(cell.day) ? "bg-blue-50 border-blue-200" : "border-border"
                    } ${cell.day ? "hover:bg-muted/50 cursor-pointer" : ""}`}
                  >
                    {cell.day && (
                      <>
                        <span className={`font-medium ${isToday(cell.day) ? "text-blue-600" : ""}`}>{cell.day}</span>
                        <div className="mt-1 space-y-1">
                          {cell.events.slice(0, 2).map((event, i) => (
                            <div key={event.id} className={`text-[10px] bg-${eventColors[i % eventColors.length]}-100 text-${eventColors[i % eventColors.length]}-700 rounded px-1 py-0.5 truncate`}>
                              {event.title}
                            </div>
                          ))}
                          {cell.events.length > 2 && (
                            <div className="text-[10px] text-muted-foreground">+{cell.events.length - 2} more</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {upcomingEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming events.</p>
              ) : upcomingEvents.map((event) => (
                <div key={event.id} className="p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                  <h4 className="font-semibold text-sm">{event.title}</h4>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(event.startDate).toLocaleDateString()} at {new Date(event.startDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>{event.location}</span>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
