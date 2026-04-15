"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Plus, Download, Upload, LayoutGrid, List,
  Search, X, Loader2, Mail, Phone, ChevronRight, Users, ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreateContactDialog } from "@/components/dialogs/CreateContactDialog";
import { ImportContactsDialog } from "@/components/dialogs/ImportContactsDialog";
import useOrganization from "@/lib/organizations/useOrganization";
import {
  getContacts,
  archiveContact,
  restoreContact,
  findPotentialDuplicateContacts,
  mergeContacts,
} from "@/app/actions/contacts";
import {
  getMemberStatusLabel,
  getMemberStatusPluralLabel,
} from "@/lib/contacts/member-status";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  member:           { label: getMemberStatusLabel("member"), className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  visitor:          { label: getMemberStatusLabel("visitor"), className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400" },
  leader:           { label: getMemberStatusLabel("leader"), className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
  regular_attendee: { label: getMemberStatusLabel("regular_attendee"), className: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400" },
  prospect:         { label: getMemberStatusLabel("prospect"), className: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400" },
  inactive:         { label: getMemberStatusLabel("inactive"), className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
};

const AVATAR_COLORS = [
  "from-violet-400 to-purple-600",
  "from-sky-400 to-blue-600",
  "from-lime-400 to-green-500",
  "from-rose-400 to-pink-600",
  "from-amber-400 to-orange-500",
  "from-cyan-400 to-teal-600",
];

function getAvatarColor(name: string) {
  const i = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[i];
}

function formatPhone(phone: string) {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : phone;
}

export default function ContactsPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [contacts, setContacts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [duplicateGroups, setDuplicateGroups] = useState<any[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [mergeBusyKey, setMergeBusyKey] = useState<string | null>(null);

  const fetchContacts = useCallback(async (p = page) => {
    if (!orgId) return;
    setLoading(true);
    try {
      const filters: { search?: string; status?: string } = {};
      if (searchQuery) filters.search = searchQuery;
      if (statusFilter !== "all") filters.status = statusFilter;
      const data = await getContacts(orgId, filters, p);
      setContacts(data.contacts);
      setTotal(data.total);
      setPage(data.page);
      setPageCount(data.pageCount);
    } catch (err) {
      console.error("Failed to fetch contacts:", err);
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [orgId, searchQuery, statusFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => fetchContacts(page), 300);
    return () => clearTimeout(t);
  }, [fetchContacts, page]);

  const fetchDuplicateGroups = useCallback(async () => {
    if (!orgId) return;
    setDuplicatesLoading(true);
    try {
      const groups = await findPotentialDuplicateContacts(orgId);
      setDuplicateGroups(groups.slice(0, 6));
    } catch (error) {
      console.error("Failed to load duplicate groups:", error);
    } finally {
      setDuplicatesLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchDuplicateGroups();
  }, [fetchDuplicateGroups]);

  const handleArchiveToggle = async (id: string, currentlyInactive: boolean) => {
    const confirmed = confirm(
      currentlyInactive
        ? "Restore this contact to active status?"
        : "Archive this contact? You can restore it later."
    );
    if (!confirmed) return;

    try {
      if (currentlyInactive) {
        await restoreContact(id, "visitor");
        toast.success("Contact restored");
      } else {
        await archiveContact(id);
        toast.success("Contact archived");
      }
      await fetchContacts();
    } catch (error) {
      console.error("Failed to update contact status:", error);
      toast.error("Failed to update contact status");
    }
  };

  const handleExport = () => {
    if (!contacts.length) { toast.error("No contacts to export"); return; }
    const rows = [
      ["First Name","Last Name","Email","Phone","Status","Added"].join(","),
      ...contacts.map(c => [`"${c.firstName||''}"`,`"${c.lastName||''}"`,`"${c.email||''}"`,`"${c.phone||''}"`,`"${getMemberStatusLabel(c.memberStatus)}"`,`"${new Date(c.createdAt).toLocaleDateString()}"`].join(","))
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    a.download = `contacts-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast.success("Exported successfully");
  };

  const handleMergeGroup = async (group: any) => {
    if (group.reason === "name") {
      toast.error("Name-only matches need manual review before merge");
      return;
    }

    const [primary, ...duplicates] = group.contacts;
    if (!primary || duplicates.length === 0) {
      return;
    }

    const confirmed = confirm(
      `Merge ${duplicates.length} duplicate contact${duplicates.length === 1 ? "" : "s"} into ${primary.firstName} ${primary.lastName}?`
    );
    if (!confirmed) return;

    setMergeBusyKey(group.key);
    try {
      for (const duplicate of duplicates) {
        await mergeContacts({
          primaryContactId: primary.id,
          duplicateContactId: duplicate.id,
        });
      }
      toast.success("Duplicate contacts merged");
      await Promise.all([fetchContacts(), fetchDuplicateGroups()]);
    } catch (error) {
      console.error("Failed to merge duplicate group:", error);
      toast.error(error instanceof Error ? error.message : "Failed to merge duplicate group");
    } finally {
      setMergeBusyKey(null);
    }
  };

  const filtered = contacts;
  const memberCount = contacts.filter(c => c.memberStatus === "member").length;
  const visitorCount = contacts.filter(c => c.memberStatus === "visitor").length;
  const newGuestCount = contacts.filter(c => c.memberStatus === "prospect").length;
  const archivedCount = contacts.filter(c => c.memberStatus === "inactive").length;

  const STATUS_FILTERS = [
    { id: "all",      label: "All",       count: statusFilter === "all" ? total : null },
    { id: "member",   label: getMemberStatusPluralLabel("member"), count: statusFilter === "member" ? total : null },
    { id: "visitor",  label: getMemberStatusPluralLabel("visitor"), count: statusFilter === "visitor" ? total : null },
    { id: "prospect", label: getMemberStatusPluralLabel("prospect"), count: statusFilter === "prospect" ? total : null },
    { id: "inactive", label: "Archived",  count: statusFilter === "inactive" ? total : null },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">People</h1>
          <p className="text-sm text-slate-500 mt-0.5">{loading ? "Loading…" : `${total.toLocaleString()} contacts`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
          <CreateContactDialog open={showAddModal} onOpenChange={setShowAddModal} onSuccess={fetchContacts}>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-lime-500 text-slate-950 font-bold text-sm hover:bg-lime-400 transition-colors shadow-sm">
              <Plus className="w-4 h-4" />
              Add Contact
            </button>
          </CreateContactDialog>
        </div>
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: total,              color: "text-slate-900 dark:text-white",          bg: "bg-white dark:bg-slate-900" },
          { label: getMemberStatusPluralLabel("member"), value: memberCount, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
          { label: getMemberStatusPluralLabel("visitor"), value: visitorCount, color: "text-sky-700 dark:text-sky-400", bg: "bg-sky-50 dark:bg-sky-500/10" },
          { label: getMemberStatusPluralLabel("prospect"), value: newGuestCount, color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10" },
          { label: "Archived",  value: archivedCount,  color: "text-slate-700 dark:text-slate-300",      bg: "bg-slate-100 dark:bg-slate-700/30" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm`}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-2xl font-extrabold ${color}`}>{loading ? "—" : value}</p>
          </div>
        ))}
      </div>

      {(duplicatesLoading || duplicateGroups.length > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Duplicate Review Queue</h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Review likely duplicate contacts before imports turn into long-term data debt.
              </p>
            </div>
            <button
              onClick={() => void fetchDuplicateGroups()}
              className="px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-800 dark:text-amber-200 hover:bg-amber-100/70 dark:hover:bg-amber-900/30 transition-colors"
            >
              Refresh Review
            </button>
          </div>

          {duplicatesLoading ? (
            <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning for duplicate groups...
            </div>
          ) : (
            <div className="space-y-3">
              {duplicateGroups.map((group) => {
                const primary = group.contacts[0];
                const autoMergeAllowed = group.reason !== "name";
                return (
                  <div
                    key={`${group.reason}:${group.key}`}
                    className="rounded-xl border border-amber-200/70 dark:border-amber-900/40 bg-white/70 dark:bg-slate-900/40 p-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            {group.reason} match
                          </span>
                          <span className="text-xs text-slate-500">
                            Keep {primary.firstName} {primary.lastName} as primary
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-2">
                          {group.contacts
                            .map((contact: any) => `${contact.firstName} ${contact.lastName}`)
                            .join(" • ")}
                        </p>
                      </div>
                      <button
                        onClick={() => void handleMergeGroup(group)}
                        disabled={!autoMergeAllowed || mergeBusyKey === group.key}
                        className="px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {mergeBusyKey === group.key
                          ? "Merging..."
                          : autoMergeAllowed
                            ? "Merge Group"
                            : "Manual Review"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-9 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-lime-500/40 focus:border-lime-500 outline-none placeholder:text-slate-400 dark:text-white transition-all"
            placeholder="Search contacts…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Status filter pills */}
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1 sm:flex-none">
            {STATUS_FILTERS.map(({ id, label, count }) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  statusFilter === id
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {label}
                <span className={`text-[10px] ${statusFilter === id ? "opacity-70" : "opacity-50"}`}>{count}</span>
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600"}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-600"}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-lime-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="font-semibold text-slate-900 dark:text-white">No contacts found</p>
          <p className="text-sm text-slate-500 mt-1">
            {searchQuery ? "Try a different search term." : "Add your first contact to get started."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c) => {
            const name = `${c.firstName} ${c.lastName}`;
            const status = STATUS_CONFIG[c.memberStatus] ?? {
              label: getMemberStatusLabel(c.memberStatus),
              className: "bg-slate-100 text-slate-600",
            };
            const grad = getAvatarColor(name);
            return (
              <Link
                key={c.id}
                href={`/app/contacts/${c.id}`}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-lime-500/40 hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col gap-4"
              >
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold text-base shadow-sm`}>
                    {c.firstName?.[0]}{c.lastName?.[0]}
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors">{name}</p>
                  {c.email && <p className="text-xs text-slate-500 mt-0.5 truncate">{c.email}</p>}
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 mt-auto">
                  {c.phone ? (
                    <span className="text-xs text-slate-500 font-mono">{formatPhone(c.phone)}</span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No phone</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-lime-500 transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {["Contact", "Email", "Phone", "Status", "Added", ""].map((h, i) => (
                    <th key={i} className="px-5 py-3.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((c) => {
                  const name = `${c.firstName} ${c.lastName}`;
                  const status = STATUS_CONFIG[c.memberStatus] ?? {
                    label: getMemberStatusLabel(c.memberStatus),
                    className: "bg-slate-100 text-slate-500",
                  };
                  const grad = getAvatarColor(name);
                  return (
                    <tr
                      key={c.id}
                      className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      onClick={() => router.push(`/app/contacts/${c.id}`)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                            {c.firstName?.[0]}{c.lastName?.[0]}
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-white group-hover:text-lime-600 dark:group-hover:text-lime-400 transition-colors">
                            {name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {c.email ? (
                          <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                            <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            <span className="truncate max-w-[180px]">{c.email}</span>
                          </span>
                        ) : <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        {c.phone ? (
                          <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 font-mono">
                            <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                            {formatPhone(c.phone)}
                          </span>
                        ) : <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveToggle(c.id, c.memberStatus === "inactive");
                          }}
                          className={`text-xs font-semibold transition-colors opacity-0 group-hover:opacity-100 px-2 py-1 rounded-lg ${
                            c.memberStatus === "inactive"
                              ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                              : "text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10"
                          }`}
                        >
                          {c.memberStatus === "inactive" ? "Restore" : "Archive"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Footer / Pagination */}
          <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              {loading ? "Loading…" : `Showing ${((page - 1) * 50) + 1}–${Math.min(page * 50, total)} of ${total.toLocaleString()} contacts`}
            </span>
            {pageCount > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 px-2">
                  {page} / {pageCount}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                  disabled={page === pageCount || loading}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ImportContactsDialog
        open={showImportModal}
        onOpenChange={setShowImportModal}
        organizationId={orgId ?? ""}
        onSuccess={async () => {
          await Promise.all([fetchContacts(), fetchDuplicateGroups()]);
        }}
      />
    </div>
  );
}
