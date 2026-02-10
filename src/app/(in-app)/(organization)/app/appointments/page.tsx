"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Filter, Calendar, Clock, User, MoreHorizontal, Video, MapPin, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useOrganization from "@/lib/organizations/useOrganization";
import { getAppointments, updateAppointment } from "@/app/actions/operations";

export default function AppointmentsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [appointmentList, setAppointmentList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await getAppointments(orgId);
      setAppointmentList(data);
    } catch (err) {
      console.error("Failed to fetch appointments:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCancel = async (id: string) => {
    await updateAppointment(id, { status: "cancelled" });
    await fetchData();
  };

  const today = new Date().toDateString();
  const kpiStats = [
    { title: "Today", value: String(appointmentList.filter(a => new Date(a.appointment.dateTime).toDateString() === today).length), subtitle: "appointments" },
    { title: "This Week", value: String(appointmentList.filter(a => { const d = new Date(a.appointment.dateTime); const now = new Date(); const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7); return d >= now && d <= weekEnd; }).length), subtitle: "scheduled" },
    { title: "Pending", value: String(appointmentList.filter(a => a.appointment.status === "pending").length), subtitle: "needs confirmation" },
    { title: "Completed", value: String(appointmentList.filter(a => a.appointment.status === "completed").length), subtitle: "appointments" },
  ];

  return (
    <div className="flex flex-col gap-6">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiStats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="pt-6 text-center">
              <h3 className="text-3xl font-bold">{loading ? "..." : stat.value}</h3>
              <p className="text-sm text-muted-foreground">{stat.title}</p>
              <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#bbff00] mx-auto" /></div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Appointments</CardTitle>
            <div className="relative w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md text-sm" placeholder="Search appointments..." />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {appointmentList.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No appointments scheduled.</div>
              ) : appointmentList.map((row) => (
                <div key={row.appointment.id} className="p-4 hover:bg-muted/30 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{row.appointment.title}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(row.appointment.dateTime).toLocaleDateString()} at {new Date(row.appointment.dateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{row.appointment.duration} min · {row.appointment.type || "In-Person"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className={
                      row.appointment.status === "confirmed" ? "bg-emerald-100 text-emerald-600" :
                      row.appointment.status === "cancelled" ? "bg-red-100 text-red-600" :
                      "bg-amber-100 text-amber-600"
                    }>{row.appointment.status}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Reschedule</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => handleCancel(row.appointment.id)}>Cancel</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
