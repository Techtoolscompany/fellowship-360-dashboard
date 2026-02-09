"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronLeft, ChevronRight, MapPin, Clock } from "lucide-react";

const events = [
  { id: 1, title: "Sunday Service", date: "Feb 9", time: "10:00 AM", location: "Main Sanctuary", color: "blue" },
  { id: 2, title: "Youth Group", date: "Feb 9", time: "6:00 PM", location: "Youth Room", color: "violet" },
  { id: 3, title: "Small Group - Life Together", date: "Feb 10", time: "7:00 PM", location: "Room 201", color: "emerald" },
  { id: 4, title: "Prayer Meeting", date: "Feb 11", time: "6:30 AM", location: "Chapel", color: "amber" },
  { id: 5, title: "Staff Meeting", date: "Feb 11", time: "10:00 AM", location: "Conference Room", color: "gray" },
  { id: 6, title: "Worship Team Rehearsal", date: "Feb 12", time: "7:00 PM", location: "Main Sanctuary", color: "pink" },
];

const calendarDays = [
  { day: "", events: [] },
  { day: "", events: [] },
  { day: "", events: [] },
  { day: "", events: [] },
  { day: "", events: [] },
  { day: "", events: [] },
  { day: "1", events: [] },
  { day: "2", events: ["Service"] },
  { day: "3", events: [] },
  { day: "4", events: [] },
  { day: "5", events: [] },
  { day: "6", events: [] },
  { day: "7", events: [] },
  { day: "8", events: [] },
  { day: "9", events: ["Service", "Youth"] },
  { day: "10", events: ["Group"] },
  { day: "11", events: ["Prayer"] },
  { day: "12", events: ["Rehearsal"] },
  { day: "13", events: [] },
  { day: "14", events: [] },
  { day: "15", events: [] },
  { day: "16", events: ["Service"] },
  { day: "17", events: [] },
  { day: "18", events: [] },
  { day: "19", events: [] },
  { day: "20", events: [] },
  { day: "21", events: [] },
  { day: "22", events: [] },
  { day: "23", events: ["Service"] },
  { day: "24", events: [] },
  { day: "25", events: [] },
  { day: "26", events: [] },
  { day: "27", events: [] },
  { day: "28", events: [] },
];

export default function CalendarPage() {
  const [currentMonth] = useState("February 2025");

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Church Events & Schedule</p>
          <h1 className="text-3xl font-bold text-foreground">Calendar</h1>
        </div>
        <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600]">
          <Plus className="w-4 h-4 mr-2" />Add Event
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <Button variant="ghost" size="icon"><ChevronLeft className="w-4 h-4" /></Button>
            <CardTitle>{currentMonth}</CardTitle>
            <Button variant="ghost" size="icon"><ChevronRight className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              {calendarDays.map((cell, index) => (
                <div
                  key={index}
                  className={`min-h-[80px] p-2 border rounded-lg text-sm ${
                    cell.day === "9" ? "bg-blue-50 border-blue-200" : "border-border"
                  } ${cell.day ? "hover:bg-muted/50 cursor-pointer" : ""}`}
                >
                  {cell.day && (
                    <>
                      <span className={`font-medium ${cell.day === "9" ? "text-blue-600" : ""}`}>
                        {cell.day}
                      </span>
                      <div className="mt-1 space-y-1">
                        {cell.events.slice(0, 2).map((event, i) => (
                          <div key={i} className="text-[10px] bg-blue-100 text-blue-700 rounded px-1 py-0.5 truncate">
                            {event}
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

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {events.map((event) => (
              <div key={event.id} className="p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <h4 className="font-semibold text-sm">{event.title}</h4>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{event.date} at {event.time}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span>{event.location}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
