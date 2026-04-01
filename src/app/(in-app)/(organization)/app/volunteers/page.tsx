"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Download, Loader2, Search } from "lucide-react";
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
import { getVolunteerShifts, getVolunteers } from "@/app/actions/operations";

type VolunteerStatusFilter = "all" | "active" | "pending" | "inactive";

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function VolunteersPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VolunteerStatusFilter>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [logShiftVolunteer, setLogShiftVolunteer] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const {
    data: volunteerList = [],
    isLoading: volunteersLoading,
    mutate,
  } = useSWR(orgId ? ["volunteers", orgId] : null, () => getVolunteers(orgId!));
  const { data: shiftRows = [], isLoading: shiftsLoading } = useSWR(
    orgId ? ["volunteer-shifts", orgId] : null,
    () => getVolunteerShifts({ organizationId: orgId! })
  );

  const loading = volunteersLoading || shiftsLoading;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalVolunteers = volunteerList.length;
  const activeVolunteersCount = volunteerList.filter(
    (row) => row.volunteer.status === "active"
  ).length;
  const pendingVolunteersCount = volunteerList.filter(
    (row) => row.volunteer.status === "pending"
  ).length;
  const inactiveVolunteersCount = volunteerList.filter(
    (row) => row.volunteer.status === "inactive"
  ).length;
  const hoursThisMonth = shiftRows
    .filter((row) => new Date(row.shift.date) >= monthStart)
    .reduce((sum, row) => sum + Number(row.shift.hours ?? 0), 0);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredVolunteers = volunteerList.filter((row) => {
    if (statusFilter !== "all" && row.volunteer.status !== statusFilter) {
      return false;
    }
    if (!normalizedQuery) return true;
    const fullName = row.contact
      ? `${row.contact.firstName} ${row.contact.lastName}`.toLowerCase()
      : "";
    const email = row.contact?.email?.toLowerCase() ?? "";
    const role = row.volunteer.role?.toLowerCase() ?? "";
    return (
      fullName.includes(normalizedQuery) ||
      email.includes(normalizedQuery) ||
      role.includes(normalizedQuery)
    );
  });

  const recentShifts = [...shiftRows]
    .sort((a, b) => +new Date(b.shift.date) - +new Date(a.shift.date))
    .slice(0, 5);

  const handleExport = () => {
    if (!filteredVolunteers.length) {
      toast.error("No volunteers to export");
      return;
    }
    const csv = [
      ["Name", "Email", "Role", "Status", "Joined"].join(","),
      ...filteredVolunteers.map((row) => {
        const name = row.contact
          ? `${row.contact.firstName} ${row.contact.lastName}`
          : "Unknown Volunteer";
        return [
          `"${name}"`,
          `"${row.contact?.email ?? ""}"`,
          `"${row.volunteer.role ?? ""}"`,
          `"${row.volunteer.status}"`,
          `"${formatDate(row.volunteer.joinedAt)}"`,
        ].join(",");
      }),
    ].join("\n");

    const link = document.createElement("a");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.href = url;
    link.download = `volunteers-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredVolunteers.length} volunteer records`);
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-100 p-8 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Service Operations
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Volunteers
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage assignments, status, and shift activity across ministry teams.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <CreateVolunteerDialog
              open={showAddModal}
              onOpenChange={setShowAddModal}
              onSuccess={() => void mutate()}
            >
              <button className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition-colors hover:bg-lime-400">
                <span className="material-symbols-outlined text-lg">add</span>
                Add Volunteer
              </button>
            </CreateVolunteerDialog>
            <LogVolunteerShiftDialog
              open={!!logShiftVolunteer}
              onOpenChange={(open: boolean) => !open && setLogShiftVolunteer(null)}
              onSuccess={() => void mutate()}
              volunteerId={logShiftVolunteer?.id || null}
              volunteerName={logShiftVolunteer?.name}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Volunteers" value={loading ? "…" : String(totalVolunteers)} />
        <MetricCard label="Active" value={loading ? "…" : String(activeVolunteersCount)} />
        <MetricCard label="Pending" value={loading ? "…" : String(pendingVolunteersCount)} />
        <MetricCard
          label="Hours This Month"
          value={loading ? "…" : `${hoursThisMonth.toFixed(1)}h`}
          tone="accent"
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 shadow-sm overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "pending", label: "Pending" },
              { id: "inactive", label: "Inactive" },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id as VolunteerStatusFilter)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  statusFilter === filter.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-lime-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              placeholder="Search volunteers by name, email, or role..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-lime-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Volunteer</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Role</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Joined</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredVolunteers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                      No volunteers match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredVolunteers.map((row) => {
                    const name = row.contact
                      ? `${row.contact.firstName} ${row.contact.lastName}`
                      : "Unknown Volunteer";
                    const initials = name
                      .split(" ")
                      .map((part) => part[0] ?? "")
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <tr key={row.volunteer.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200 text-sm font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                              {initials}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
                              <p className="text-xs text-slate-500">{row.contact?.email ?? "No email"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">
                          {row.volunteer.role || "Unassigned"}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                          {formatDate(row.volunteer.joinedAt)}
                        </td>
                        <td className="px-6 py-4">
                          <VolunteerStatusBadge status={row.volunteer.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded-md p-1 text-slate-400 transition-colors hover:text-lime-500">
                                <span className="material-symbols-outlined">more_horiz</span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() =>
                                  row.volunteer?.contactId &&
                                  router.push(`/app/contacts/${row.volunteer.contactId}`)
                                }
                              >
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  setLogShiftVolunteer({
                                    id: row.volunteer.id,
                                    name,
                                  })
                                }
                              >
                                Log Hours
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Shift Activity</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Loading shift activity...</p>
        ) : recentShifts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No volunteer shifts logged yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {recentShifts.map((row) => {
              const name = row.contact
                ? `${row.contact.firstName} ${row.contact.lastName}`
                : "Unknown Volunteer";
              return (
                <div
                  key={row.shift.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-sm dark:border-slate-800"
                >
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {name} logged {Number(row.shift.hours ?? 0).toFixed(1)}h
                  </p>
                  <p className="text-xs text-slate-500">{formatDate(row.shift.date)}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "accent";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-2 text-3xl font-black ${
          tone === "accent"
            ? "text-lime-600 dark:text-lime-400"
            : "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function VolunteerStatusBadge({ status }: { status: string }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        Active
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        Pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      Inactive
    </span>
  );
}
