"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, Calendar, Clock, User, MoreHorizontal, Video, MapPin } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const appointments = [
  { id: 1, title: "Pastoral Counseling", person: "Michael Davis", date: "Feb 9, 2025", time: "2:00 PM", duration: "1 hour", type: "In-Person", status: "confirmed", pastor: "Pastor James Wilson" },
  { id: 2, title: "Pre-Marital Counseling", person: "John & Sarah Smith", date: "Feb 10, 2025", time: "10:00 AM", duration: "1.5 hours", type: "In-Person", status: "confirmed", pastor: "Pastor James Wilson" },
  { id: 3, title: "New Member Meeting", person: "Emily White", date: "Feb 10, 2025", time: "3:00 PM", duration: "45 min", type: "Video Call", status: "pending", pastor: "Associate Pastor Mark" },
  { id: 4, title: "Baptism Consultation", person: "The Brown Family", date: "Feb 11, 2025", time: "11:00 AM", duration: "30 min", type: "In-Person", status: "confirmed", pastor: "Pastor James Wilson" },
  { id: 5, title: "Grief Counseling", person: "Anonymous", date: "Feb 12, 2025", time: "4:00 PM", duration: "1 hour", type: "Video Call", status: "confirmed", pastor: "Pastor James Wilson" },
];

const kpiStats = [
  { title: "Today", value: "3", subtitle: "appointments" },
  { title: "This Week", value: "12", subtitle: "scheduled" },
  { title: "Pending", value: "4", subtitle: "needs confirmation" },
  { title: "Completed (MTD)", value: "28", subtitle: "appointments" },
];

export default function AppointmentsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground mb-1 text-base">Manage Pastoral Appointments</p>
          <h1 className="text-3xl font-bold text-foreground">Appointments</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" />Filter</Button>
          <Button className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a8e600]">
            <Plus className="w-4 h-4 mr-2" />Schedule Appointment
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6 text-center">
              <h3 className="text-3xl font-bold">{stat.value}</h3>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
              <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Appointments List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Upcoming Appointments</CardTitle>
          <div className="relative w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md text-sm"
              placeholder="Search appointments..."
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {appointments.map((apt) => (
              <div key={apt.id} className="p-4 hover:bg-muted/30 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{apt.title}</h4>
                    <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{apt.person}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{apt.date} at {apt.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">with {apt.pastor}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className={apt.type === "Video Call" ? "bg-violet-100 text-violet-600" : "bg-blue-100 text-blue-600"}>
                    {apt.type === "Video Call" ? <Video className="w-3 h-3 mr-1" /> : <MapPin className="w-3 h-3 mr-1" />}
                    {apt.type}
                  </Badge>
                  <Badge variant="secondary" className={apt.status === "confirmed" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}>
                    {apt.status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>Reschedule</DropdownMenuItem>
                      <DropdownMenuItem>Cancel</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
