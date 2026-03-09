"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, UserCog, Shield, CalendarClock, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useOrganization from "@/lib/organizations/useOrganization";
import { getPeopleOverview } from "@/app/actions/people";
import { getContacts } from "@/app/actions/contacts";

type PeopleOverviewData = Awaited<ReturnType<typeof getPeopleOverview>>;
type ContactsResult = Awaited<ReturnType<typeof getContacts>>;
type Contact = ContactsResult["contacts"][number];

function getInitials(firstName?: string | null, lastName?: string | null, fallback = "U") {
  const first = firstName?.trim()?.[0] ?? "";
  const last = lastName?.trim()?.[0] ?? "";
  const initials = `${first}${last}`.trim();
  return initials || fallback;
}

const STATUS_COLORS: Record<string, string> = {
  member: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  leader: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  regular_attendee: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  volunteer: "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300",
  visitor: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  prospect: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  inactive: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const AVATAR_COLORS = [
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
];

function avatarColor(name: string) {
  const code = (name.charCodeAt(0) ?? 0) + (name.charCodeAt(1) ?? 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "member", label: "Member" },
  { value: "leader", label: "Leader" },
  { value: "regular_attendee", label: "Regular Attendee" },
  { value: "volunteer", label: "Volunteer" },
  { value: "visitor", label: "Visitor" },
  { value: "prospect", label: "Prospect" },
  { value: "inactive", label: "Inactive" },
];

export default function PeopleDirectoryPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summary, setSummary] = useState<PeopleOverviewData["summary"] | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchSummary = useCallback(async () => {
    if (!orgId) return;
    setSummaryLoading(true);
    try {
      const result = await getPeopleOverview(orgId);
      setSummary(result.summary);
    } finally {
      setSummaryLoading(false);
    }
  }, [orgId]);

  const fetchContacts = useCallback(async () => {
    if (!orgId) return;
    setListLoading(true);
    try {
      const result = await getContacts(
        orgId,
        { search: search || undefined, status: statusFilter !== "all" ? statusFilter : undefined },
        page
      );
      setContacts(result.contacts);
      setPageCount(result.pageCount);
      setTotal(result.total);
    } finally {
      setListLoading(false);
    }
  }, [orgId, search, statusFilter, page]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const summaryCards = useMemo(() => [
    { id: "members", label: "Members", value: summary?.members ?? 0, icon: Users, detail: "Active member records" },
    { id: "volunteers", label: "Volunteers", value: summary?.volunteers ?? 0, icon: UserCog, detail: "Serving in ministry roles" },
    { id: "staff", label: "Paid Staff", value: summary?.paidStaff ?? 0, icon: Shield, detail: "Organization team users" },
    { id: "schedulable", label: "Schedulable", value: summary?.schedulable ?? 0, icon: CalendarClock, detail: "Enabled in scheduling matrix" },
  ], [summary]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-100 p-8 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              People
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Church Directory
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Every person connected to your church — members, volunteers, staff, and visitors in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/app/settings/scheduling-matrix">Scheduling Matrix</Link>
            </Button>
            <Button asChild>
              <Link href="/app/contacts">Contacts Table</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
          >
            <div className="mb-3 flex items-center justify-between">
              <card.icon className="h-5 w-5 text-slate-500 dark:text-slate-300" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live</span>
            </div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">
              {summaryLoading ? "..." : card.value}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{card.detail}</p>
          </div>
        ))}
      </section>

      {/* Directory */}
      <section className="rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search by name, email, or phone..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onBlur={() => setSearch(searchInput)}
              />
            </div>
          </form>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {listLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-lime-500" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="py-20 text-center text-sm text-slate-500">
            No people found.{" "}
            <Link href="/app/contacts" className="text-lime-600 underline">
              Add someone in Contacts
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {contacts.map((contact) => {
              const name = `${contact.firstName} ${contact.lastName}`.trim() || "Unknown";
              const initials = getInitials(contact.firstName, contact.lastName);
              const avatarCls = avatarColor(name);
              const statusCls = STATUS_COLORS[contact.memberStatus] ?? STATUS_COLORS.inactive;
              return (
                <Link
                  key={contact.id}
                  href={`/app/contacts/${contact.id}`}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${avatarCls}`}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {contact.email || contact.phone || "No contact info"}
                    </p>
                  </div>
                  {contact.phone && (
                    <p className="hidden text-xs text-slate-400 sm:block">{contact.phone}</p>
                  )}
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusCls}`}>
                    {contact.memberStatus.replace(/_/g, " ")}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!listLoading && pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
            <p className="text-xs text-slate-500">{total} people</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {page} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
