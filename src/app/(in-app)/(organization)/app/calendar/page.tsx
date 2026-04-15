"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import useOrganization from "@/lib/organizations/useOrganization";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { createEvent, getEvents } from "@/app/actions/calendar";
import { getAppointments } from "@/app/actions/operations";
import { sendCopilotMessage } from "@/app/actions/grace";

type AppointmentRow = Awaited<ReturnType<typeof getAppointments>>[number];
type CalendarEventRow = Awaited<ReturnType<typeof getEvents>>[number];

type CalendarSurfaceItem = {
  id: string;
  title: string;
  startDate: string | Date;
  location: string | null;
  source: "event" | "appointment";
  appointmentId?: string;
  appointmentStatus?: AppointmentRow["appointment"]["status"];
  contactName?: string;
};

function formatDateTimeLocalInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fmtDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function fmtDurationFromNow(value: Date | string | null | undefined) {
  if (!value) return "now";
  const deltaMs = new Date(value).getTime() - Date.now();
  const absMinutes = Math.round(Math.abs(deltaMs) / 60_000);
  if (absMinutes < 60) {
    if (absMinutes <= 1) return deltaMs >= 0 ? "now" : "just now";
    return deltaMs >= 0 ? `in ${absMinutes}m` : `${absMinutes}m ago`;
  }
  const absHours = Math.round(absMinutes / 60);
  return deltaMs >= 0 ? `in ${absHours}h` : `${absHours}h ago`;
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="workspace-stat-card">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

export default function CalendarPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [calendarTitle, setCalendarTitle] = useState("");
  const [calendarStartsAt, setCalendarStartsAt] = useState(() =>
    formatDateTimeLocalInput(new Date(Date.now() + 3_600_000))
  );
  const [calendarLocation, setCalendarLocation] = useState("");
  const [calendarCreating, setCalendarCreating] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());

  const loadCalendar = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [appointmentRows, eventRows] = await Promise.all([
        getAppointments(orgId),
        getEvents(orgId),
      ]);
      setAppointments(appointmentRows);
      setCalendarEvents(eventRows);
    } catch (error) {
      console.error("Failed to load calendar workspace:", error);
      toast.error("Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const appointmentCalendarItems = useMemo<CalendarSurfaceItem[]>(
    () =>
      appointments
        .filter(
          (row) =>
            row.appointment.status === "scheduled" ||
            row.appointment.status === "confirmed"
        )
        .map((row) => ({
          id: `appointment-${row.appointment.id}`,
          title: row.appointment.title,
          startDate: row.appointment.dateTime,
          location: null,
          source: "appointment",
          appointmentId: row.appointment.id,
          appointmentStatus: row.appointment.status,
          contactName: row.contact
            ? `${row.contact.firstName} ${row.contact.lastName}`.trim()
            : undefined,
        })),
    [appointments]
  );

  const calendarSurfaceItems = useMemo<CalendarSurfaceItem[]>(
    () =>
      [
        ...calendarEvents.map((event) => ({
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          location: event.location,
          source: "event" as const,
        })),
        ...appointmentCalendarItems,
      ].sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      ),
    [appointmentCalendarItems, calendarEvents]
  );

  const nowMs = Date.now();
  const upcomingCalendarEvents = useMemo(
    () =>
      calendarSurfaceItems.filter(
        (event) => new Date(event.startDate).getTime() >= nowMs
      ),
    [calendarSurfaceItems, nowMs]
  );

  const calendarEventsNext7Days = useMemo(
    () =>
      upcomingCalendarEvents.filter(
        (event) =>
          new Date(event.startDate).getTime() <= nowMs + 7 * 24 * 60 * 60 * 1000
      ).length,
    [nowMs, upcomingCalendarEvents]
  );

  const pastoralAppointments = useMemo(
    () =>
      appointmentCalendarItems.filter(
        (row) => new Date(row.startDate).getTime() <= nowMs + 2 * 24 * 60 * 60 * 1000
      ).length,
    [appointmentCalendarItems, nowMs]
  );

  const calendarMonthLabel = useMemo(
    () =>
      calendarViewDate.toLocaleString("default", {
        month: "long",
        year: "numeric",
      }),
    [calendarViewDate]
  );

  const calendarGridCells = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; events: CalendarSurfaceItem[] }> = [];

    for (let index = 0; index < firstDay; index += 1) {
      cells.push({ day: null, events: [] });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const eventsForDay = calendarSurfaceItems.filter((event) => {
        const eventDate = new Date(event.startDate);
        return (
          eventDate.getFullYear() === year &&
          eventDate.getMonth() === month &&
          eventDate.getDate() === day
        );
      });

      cells.push({
        day,
        events: eventsForDay.sort(
          (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        ),
      });
    }

    return cells;
  }, [calendarSurfaceItems, calendarViewDate]);

  const handleAskGraceForEvent = useCallback(
    async (event: CalendarSurfaceItem) => {
      if (!orgId) return;

      const message =
        event.source === "appointment"
          ? `Prepare pastoral follow-up for "${event.title}" on ${fmtDateTime(
              event.startDate
            )}${event.contactName ? ` with ${event.contactName}` : ""}. Suggest reminders and next steps for staff.`
          : `Prepare event follow-up for "${event.title}" on ${fmtDateTime(
              event.startDate
            )}. Suggest reminders, communication, and staffing checks.`;

      try {
        await sendCopilotMessage({
          organizationId: orgId,
          message,
        });
        toast.success("Grace queued follow-up ideas for this event");
      } catch (error) {
        console.error("Failed to queue Grace follow-up context:", error);
        toast.error("Grace could not prepare follow-up right now");
      }
    },
    [orgId]
  );

  const handleCreateCalendarEvent = useCallback(async () => {
    if (!orgId) return;
    const title = calendarTitle.trim();
    if (!title) {
      toast.error("Event title is required");
      return;
    }

    const startsAt = new Date(calendarStartsAt);
    if (Number.isNaN(startsAt.getTime())) {
      toast.error("Choose a valid start date and time");
      return;
    }

    setCalendarCreating(true);
    try {
      const created = await createEvent({
        organizationId: orgId,
        title,
        startDate: startsAt,
        location: calendarLocation.trim() || undefined,
      });

      setCalendarTitle("");
      setCalendarLocation("");
      setCalendarStartsAt(formatDateTimeLocalInput(new Date(Date.now() + 3_600_000)));
      toast.success("Event added to the calendar");
      await loadCalendar();

      await sendCopilotMessage({
        organizationId: orgId,
        message: `Calendar update: "${created.title}" is scheduled for ${fmtDateTime(
          created.startDate
        )}${created.location ? ` at ${created.location}` : ""}. Suggest reminders, communication, and staffing follow-up.`,
      });
    } catch (error) {
      console.error("Failed to create calendar event:", error);
      toast.error("Failed to create event");
    } finally {
      setCalendarCreating(false);
    }
  }, [
    calendarLocation,
    calendarStartsAt,
    calendarTitle,
    loadCalendar,
    orgId,
  ]);

  if (!orgId) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-lime-500" />
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <section className="workspace-hero-light">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Calendar
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Keep the next week easy to see
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              See upcoming ministry plans, schedule something new, and ask Grace to help you
              prepare.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="w-fit border-lime-300 text-lime-700 dark:border-lime-700 dark:text-lime-300">
              {upcomingCalendarEvents[0]
                ? `Next up ${fmtDurationFromNow(upcomingCalendarEvents[0].startDate)}`
                : "No upcoming items"}
            </Badge>
            <Button variant="outline" asChild>
              <Link href="/app/grace?tab=home">Open Grace</Link>
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard
            label="Next 7 Days"
            value={loading ? "…" : calendarEventsNext7Days}
            detail="Events and appointments coming up soon"
          />
          <StatCard
            label="Pastoral Care"
            value={loading ? "…" : pastoralAppointments}
            detail="Appointments happening in the next 48 hours"
          />
          <StatCard
            label="On The Calendar"
            value={loading ? "…" : calendarSurfaceItems.length}
            detail="Everything Grace can help you prepare for"
          />
        </div>
      </section>

      <section className="workspace-surface overflow-hidden rounded-3xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-6 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Ministry calendar</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Appointments and events stay together here so nothing gets missed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setCalendarViewDate(
                  (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                )
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                setCalendarViewDate(
                  (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                )
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-lime-500" />
          </div>
        ) : (
          <div className="grid gap-6 p-6 xl:grid-cols-12">
            <div className="workspace-panel-soft xl:col-span-8 p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  {calendarMonthLabel}
                </h3>
              </div>

              <div className="grid grid-cols-7 border-y border-slate-200 dark:border-slate-800">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 auto-rows-[112px] md:auto-rows-[124px]">
                {calendarGridCells.map((cell, index) => {
                  const today = new Date();
                  const isTodayCell =
                    cell.day !== null &&
                    cell.day === today.getDate() &&
                    calendarViewDate.getMonth() === today.getMonth() &&
                    calendarViewDate.getFullYear() === today.getFullYear();

                  return (
                    <div
                      key={`${cell.day ?? "empty"}-${index}`}
                      className={`relative border-b border-r border-slate-200 p-2 dark:border-slate-800 ${
                        cell.day === null
                          ? "bg-slate-50/70 dark:bg-slate-900/30"
                          : "bg-white dark:bg-slate-950/20"
                      }`}
                    >
                      {isTodayCell ? (
                        <div className="pointer-events-none absolute inset-0 border-2 border-lime-400/70" />
                      ) : null}
                      <div
                        className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                          isTodayCell
                            ? "bg-lime-400 text-slate-950"
                            : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {cell.day}
                      </div>
                      <div className="space-y-1 overflow-y-auto pr-1">
                        {cell.events.slice(0, 2).map((event) => (
                          <button
                            key={event.id}
                            className={`w-full truncate rounded-md px-2 py-1 text-left text-[10px] font-semibold transition-colors ${
                              event.source === "appointment"
                                ? "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25"
                                : "bg-lime-100 text-lime-800 hover:bg-lime-200 dark:bg-lime-500/15 dark:text-lime-300 dark:hover:bg-lime-500/25"
                            }`}
                            onClick={() => void handleAskGraceForEvent(event)}
                            title={event.title}
                          >
                            {event.title}
                          </button>
                        ))}
                        {cell.events.length > 2 ? (
                          <p className="px-1 text-[10px] font-semibold text-slate-500">
                            +{cell.events.length - 2} more
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4 xl:col-span-4">
              <div className="workspace-panel p-4">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Quick schedule</p>
                <div className="mt-3 space-y-3">
                  <Input
                    value={calendarTitle}
                    onChange={(event) => setCalendarTitle(event.target.value)}
                    placeholder="Event title"
                  />
                  <Input
                    type="datetime-local"
                    value={calendarStartsAt}
                    onChange={(event) => setCalendarStartsAt(event.target.value)}
                  />
                  <Input
                    value={calendarLocation}
                    onChange={(event) => setCalendarLocation(event.target.value)}
                    placeholder="Location (optional)"
                  />
                  <Button
                    className="w-full"
                    onClick={() => void handleCreateCalendarEvent()}
                    disabled={calendarCreating || !calendarTitle.trim()}
                  >
                    {calendarCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Add event
                  </Button>
                </div>
              </div>

              <div className="workspace-panel p-4">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Coming up
                </p>
                <div className="mt-3 space-y-3">
                  {upcomingCalendarEvents.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-sm text-slate-500 dark:border-slate-700">
                      Nothing is scheduled yet.
                    </p>
                  ) : (
                    upcomingCalendarEvents.slice(0, 10).map((event) => (
                      <div
                        key={event.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {event.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {fmtDateTime(event.startDate)}
                              {event.location ? ` · ${event.location}` : ""}
                              {event.source === "appointment" && event.contactName
                                ? ` · ${event.contactName}`
                                : ""}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              event.source === "appointment"
                                ? "border-blue-300 text-blue-700 dark:border-blue-700 dark:text-blue-300"
                                : "border-lime-300 text-lime-700 dark:border-lime-700 dark:text-lime-300"
                            }
                          >
                            {event.source === "appointment" ? "Appointment" : "Event"}
                          </Badge>
                        </div>
                        <div className="mt-3 flex justify-between gap-3 text-xs text-slate-500">
                          <span>{fmtDurationFromNow(event.startDate)}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleAskGraceForEvent(event)}
                          >
                            <Sparkles className="mr-2 h-4 w-4" />
                            Ask Grace
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
