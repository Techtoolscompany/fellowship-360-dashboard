"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Loader2, Search } from "lucide-react";

function formatMeetingSchedule(ministry: {
  meetingDay?: string | null;
  meetingTime?: string | null;
  meetingLocation?: string | null;
}) {
  const pieces = [ministry.meetingDay, ministry.meetingTime, ministry.meetingLocation].filter(
    Boolean
  );
  return pieces.length ? pieces.join(" • ") : "Schedule not set";
}

export default function MinistriesPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMinistryState, setEditMinistryState] = useState<any>(null);
  const [viewMembersMinistry, setViewMembersMinistry] = useState<any>(null);

  const {
    data: ministriesList = [],
    isLoading: loading,
    mutate,
  } = useSWR(orgId ? ["ministries", orgId] : null, () => getMinistries(orgId!));

  const filteredMinistries = useMemo(() => {
    if (!searchQuery.trim()) return ministriesList;
    const query = searchQuery.toLowerCase();
    return ministriesList.filter((row: any) => {
      const name = row.ministry.name?.toLowerCase() ?? "";
      const description = row.ministry.description?.toLowerCase() ?? "";
      return name.includes(query) || description.includes(query);
    });
  }, [ministriesList, searchQuery]);

  const totalMinistries = ministriesList.length;
  const totalMembers = ministriesList.reduce(
    (sum: number, row: any) => sum + Number(row.memberCount ?? 0),
    0
  );
  const assignedLeaderCount = ministriesList.filter(
    (row: any) => Boolean(row.ministry.leaderId)
  ).length;
  const needsLeaderCount = totalMinistries - assignedLeaderCount;

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this ministry? This removes the ministry and member assignments.")) {
      return;
    }
    try {
      await deleteMinistry(id);
      toast.success("Ministry deleted");
      await mutate();
    } catch (error) {
      console.error("Failed to delete ministry:", error);
      toast.error("Failed to delete ministry");
    }
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
              Ministries
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Track ministry structure, leaders, and member coverage.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-lime-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition-colors hover:bg-lime-400"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              Add Ministry
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Ministries" value={loading ? "…" : String(totalMinistries)} />
        <MetricCard label="Assigned Leaders" value={loading ? "…" : String(assignedLeaderCount)} />
        <MetricCard label="Total Members" value={loading ? "…" : String(totalMembers)} />
        <MetricCard
          label="Needs Leader"
          value={loading ? "…" : String(needsLeaderCount)}
          tone={needsLeaderCount > 0 ? "warning" : "default"}
        />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Ministry Directory</h2>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm outline-none focus:border-lime-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              placeholder="Search ministries..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-lime-500" />
          </div>
        ) : filteredMinistries.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500">
            No ministries match your search.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredMinistries.map((row: any) => (
              <div
                key={row.ministry.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {row.ministry.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatMeetingSchedule(row.ministry)}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="rounded-md p-1 text-slate-400 transition-colors hover:text-lime-500">
                        <span className="material-symbols-outlined">more_horiz</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onClick={() => setViewMembersMinistry(row.ministry)}>
                        View Members
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditMinistryState(row.ministry)}>
                        Edit Ministry
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={() => handleDelete(row.ministry.id)}
                      >
                        Delete Ministry
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                  {row.ministry.description || "No description added yet."}
                </p>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {Number(row.memberCount ?? 0)} members
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 font-semibold ${
                      row.ministry.leaderId
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}
                  >
                    {row.ministry.leaderId ? "Leader assigned" : "Leader needed"}
                  </span>
                </div>

                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => setViewMembersMinistry(row.ministry)}
                >
                  Manage Members
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

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

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-2 text-3xl font-black ${
          tone === "warning"
            ? "text-amber-600 dark:text-amber-400"
            : "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
