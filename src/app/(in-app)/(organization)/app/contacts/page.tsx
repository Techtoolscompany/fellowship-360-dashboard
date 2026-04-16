"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Upload,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  archiveContact,
  findPotentialDuplicateContacts,
  getContacts,
  mergeContacts,
  restoreContact,
} from "@/app/actions/contacts";
import { CreateContactDialog } from "@/components/dialogs/CreateContactDialog";
import { ImportContactsDialog } from "@/components/dialogs/ImportContactsDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import useOrganization from "@/lib/organizations/useOrganization";
import {
  getMemberStatusLabel,
  getMemberStatusPluralLabel,
} from "@/lib/contacts/member-status";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  inactive: {
    label: getMemberStatusLabel("inactive"),
    className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  },
  leader: {
    label: getMemberStatusLabel("leader"),
    className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  },
  member: {
    label: getMemberStatusLabel("member"),
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  },
  prospect: {
    label: getMemberStatusLabel("prospect"),
    className: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  },
  regular_attendee: {
    label: getMemberStatusLabel("regular_attendee"),
    className: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  },
  visitor: {
    label: getMemberStatusLabel("visitor"),
    className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  },
};

const AVATAR_COLORS = [
  "from-violet-400 to-purple-600",
  "from-sky-400 to-blue-600",
  "from-lime-400 to-green-500",
  "from-rose-400 to-pink-600",
  "from-amber-400 to-orange-500",
  "from-cyan-400 to-teal-600",
];

type ContactRow = Awaited<ReturnType<typeof getContacts>>["contacts"][number];
type DuplicateGroup = Awaited<ReturnType<typeof findPotentialDuplicateContacts>>[number];
type ArchiveDialogState = {
  contactId: string;
  currentlyInactive: boolean;
  name: string;
} | null;

function getAvatarColor(name: string) {
  const index = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function formatPhone(phone: string) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10
    ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    : phone;
}

function buildContactName(contact: Pick<ContactRow, "firstName" | "lastName">) {
  const name = `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim();
  return name || "Unnamed contact";
}

function ContactsLoadingState({ viewMode }: { viewMode: "grid" | "list" }) {
  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-800/50">
        <div className="grid grid-cols-[minmax(220px,2fr)_minmax(160px,1.4fr)_minmax(140px,1fr)_120px_120px_80px] gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-3 w-20" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[minmax(220px,2fr)_minmax(160px,1.4fr)_minmax(140px,1fr)_120px_120px_80px] items-center gap-4 px-5 py-4"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
            <div className="flex justify-end">
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactActionsMenu({
  contact,
  onOpenContact,
  onRequestArchiveToggle,
}: {
  contact: ContactRow;
  onOpenContact: () => void;
  onRequestArchiveToggle: (contact: ContactRow) => void;
}) {
  const isArchived = contact.memberStatus === "inactive";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open contact actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{buildContactName(contact)}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenContact}>Open profile</DropdownMenuItem>
        <DropdownMenuItem
          variant={isArchived ? "default" : "destructive"}
          onClick={() => onRequestArchiveToggle(contact)}
        >
          {isArchived ? "Restore contact" : "Archive contact"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ContactsPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [archiveDialog, setArchiveDialog] = useState<ArchiveDialogState>(null);
  const [archiveBusyId, setArchiveBusyId] = useState<string | null>(null);
  const [mergeBusyKey, setMergeBusyKey] = useState<string | null>(null);
  const [mergeDialogGroup, setMergeDialogGroup] = useState<DuplicateGroup | null>(null);

  const fetchContacts = useCallback(
    async (nextPage = page) => {
      if (!orgId) return;

      setLoading(true);
      try {
        const filters: { search?: string; status?: string } = {};
        if (searchQuery) filters.search = searchQuery;
        if (statusFilter !== "all") filters.status = statusFilter;

        const data = await getContacts(orgId, filters, nextPage);
        setContacts(data.contacts);
        setTotal(data.total);
        setPage(data.page);
        setPageCount(data.pageCount);
      } catch (error) {
        console.error("Failed to fetch contacts:", error);
        toast.error("Failed to load contacts");
      } finally {
        setLoading(false);
      }
    },
    [orgId, page, searchQuery, statusFilter]
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchContacts(page);
    }, 300);

    return () => window.clearTimeout(timeoutId);
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

  const requestArchiveToggle = useCallback((contact: ContactRow) => {
    setArchiveDialog({
      contactId: contact.id,
      currentlyInactive: contact.memberStatus === "inactive",
      name: buildContactName(contact),
    });
  }, []);

  const confirmArchiveToggle = useCallback(async () => {
    if (!archiveDialog) return;

    setArchiveBusyId(archiveDialog.contactId);
    try {
      if (archiveDialog.currentlyInactive) {
        await restoreContact(archiveDialog.contactId, "visitor");
        toast.success("Contact restored");
      } else {
        await archiveContact(archiveDialog.contactId);
        toast.success("Contact archived");
      }

      await fetchContacts();
    } catch (error) {
      console.error("Failed to update contact status:", error);
      toast.error("Failed to update contact status");
    } finally {
      setArchiveBusyId(null);
      setArchiveDialog(null);
    }
  }, [archiveDialog, fetchContacts]);

  const handleExport = () => {
    if (!contacts.length) {
      toast.error("No contacts to export");
      return;
    }

    const rows = [
      ["First Name", "Last Name", "Email", "Phone", "Status", "Added"].join(","),
      ...contacts.map((contact) =>
        [
          `"${contact.firstName || ""}"`,
          `"${contact.lastName || ""}"`,
          `"${contact.email || ""}"`,
          `"${contact.phone || ""}"`,
          `"${getMemberStatusLabel(contact.memberStatus)}"`,
          `"${new Date(contact.createdAt).toLocaleDateString()}"`,
        ].join(",")
      ),
    ].join("\n");

    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    anchor.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    toast.success("Exported successfully");
  };

  const requestMergeGroup = useCallback((group: DuplicateGroup) => {
    if (group.reason === "name") {
      toast.error("Name-only matches need manual review before merge");
      return;
    }

    setMergeDialogGroup(group);
  }, []);

  const confirmMergeGroup = useCallback(async () => {
    if (!mergeDialogGroup) return;

    const [primary, ...duplicates] = mergeDialogGroup.contacts;
    if (!primary || duplicates.length === 0) {
      setMergeDialogGroup(null);
      return;
    }

    setMergeBusyKey(mergeDialogGroup.key);
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
      setMergeDialogGroup(null);
    }
  }, [fetchContacts, fetchDuplicateGroups, mergeDialogGroup]);

  const memberCount = contacts.filter((contact) => contact.memberStatus === "member").length;
  const visitorCount = contacts.filter((contact) => contact.memberStatus === "visitor").length;
  const newGuestCount = contacts.filter((contact) => contact.memberStatus === "prospect").length;
  const archivedCount = contacts.filter((contact) => contact.memberStatus === "inactive").length;
  const mergePrimaryContact = mergeDialogGroup?.contacts[0] ?? null;
  const mergeDuplicateCount = Math.max((mergeDialogGroup?.contacts.length ?? 1) - 1, 0);

  const statusFilters = [
    { id: "all", label: "All", count: statusFilter === "all" ? total : null },
    {
      id: "member",
      label: getMemberStatusPluralLabel("member"),
      count: statusFilter === "member" ? total : null,
    },
    {
      id: "visitor",
      label: getMemberStatusPluralLabel("visitor"),
      count: statusFilter === "visitor" ? total : null,
    },
    {
      id: "prospect",
      label: getMemberStatusPluralLabel("prospect"),
      count: statusFilter === "prospect" ? total : null,
    },
    { id: "inactive", label: "Archived", count: statusFilter === "inactive" ? total : null },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">People</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {loading ? "Loading..." : `${total.toLocaleString()} contacts`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>
          <CreateContactDialog
            open={showAddModal}
            onOpenChange={setShowAddModal}
            onSuccess={fetchContacts}
          >
            <button className="flex items-center gap-2 rounded-xl bg-lime-500 px-4 py-2 text-sm font-bold text-slate-950 shadow-sm transition-colors hover:bg-lime-400">
              <Plus className="h-4 w-4" />
              Add Contact
            </button>
          </CreateContactDialog>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          {
            label: "Total",
            value: total,
            color: "text-slate-900 dark:text-white",
            background: "bg-white dark:bg-slate-900",
          },
          {
            label: getMemberStatusPluralLabel("member"),
            value: memberCount,
            color: "text-emerald-700 dark:text-emerald-400",
            background: "bg-emerald-50 dark:bg-emerald-500/10",
          },
          {
            label: getMemberStatusPluralLabel("visitor"),
            value: visitorCount,
            color: "text-sky-700 dark:text-sky-400",
            background: "bg-sky-50 dark:bg-sky-500/10",
          },
          {
            label: getMemberStatusPluralLabel("prospect"),
            value: newGuestCount,
            color: "text-orange-700 dark:text-orange-400",
            background: "bg-orange-50 dark:bg-orange-500/10",
          },
          {
            label: "Archived",
            value: archivedCount,
            color: "text-slate-700 dark:text-slate-300",
            background: "bg-slate-100 dark:bg-slate-700/30",
          },
        ].map(({ label, value, color, background }) => (
          <div
            key={label}
            className={`${background} rounded-2xl border border-slate-200 p-4 shadow-sm dark:border-slate-800`}
          >
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {label}
            </p>
            <p className={`text-2xl font-extrabold ${color}`}>{loading ? "—" : value}</p>
          </div>
        ))}
      </div>

      {(duplicatesLoading || duplicateGroups.length > 0) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Duplicate Review Queue
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Review likely duplicate contacts before imports turn into long-term data debt.
              </p>
            </div>
            <button
              onClick={() => void fetchDuplicateGroups()}
              className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100/70 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900/30"
            >
              Refresh Review
            </button>
          </div>

          {duplicatesLoading ? (
            <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
              <Loader2 className="h-4 w-4 animate-spin" />
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
                    className="rounded-xl border border-amber-200/70 bg-white/70 p-4 dark:border-amber-900/40 dark:bg-slate-900/40"
                  >
                    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                            {group.reason} match
                          </span>
                          <span className="text-xs text-slate-500">
                            Keep {primary.firstName} {primary.lastName} as primary
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                          {group.contacts
                            .map((contact) => `${contact.firstName} ${contact.lastName}`)
                            .join(" • ")}
                        </p>
                      </div>
                      <button
                        onClick={() => requestMergeGroup(group)}
                        disabled={!autoMergeAllowed || mergeBusyKey === group.key}
                        className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
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

      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-lime-500 focus:ring-2 focus:ring-lime-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="scrollbar-hide flex flex-1 gap-1.5 overflow-x-auto sm:flex-none">
            {statusFilters.map(({ id, label, count }) => (
              <button
                key={id}
                onClick={() => setStatusFilter(id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  statusFilter === id
                    ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                }`}
              >
                {label}
                <span
                  className={`text-[10px] ${statusFilter === id ? "opacity-70" : "opacity-50"}`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex shrink-0 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-lg p-1.5 transition-all ${
                viewMode === "list"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-lg p-1.5 transition-all ${
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <ContactsLoadingState viewMode={viewMode} />
      ) : contacts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white py-24 text-center dark:border-slate-800 dark:bg-slate-900">
          <Users className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-700" />
          <p className="font-semibold text-slate-900 dark:text-white">No contacts found</p>
          <p className="mt-1 text-sm text-slate-500">
            {searchQuery ? "Try a different search term." : "Add your first contact to get started."}
          </p>
          {!searchQuery ? (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-lime-500 px-4 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-lime-400"
            >
              <Plus className="h-4 w-4" />
              Add Contact
            </button>
          ) : null}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {contacts.map((contact) => {
            const name = buildContactName(contact);
            const status = STATUS_CONFIG[contact.memberStatus] ?? {
              label: getMemberStatusLabel(contact.memberStatus),
              className: "bg-slate-100 text-slate-600",
            };
            const gradient = getAvatarColor(name);

            return (
              <Link
                key={contact.id}
                href={`/app/contacts/${contact.id}`}
                className="group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-lime-500/40 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-base font-bold text-white shadow-sm`}
                  >
                    {contact.firstName?.[0]}
                    {contact.lastName?.[0]}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${status.className}`}
                    >
                      {status.label}
                    </span>
                    <div
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                    >
                      <ContactActionsMenu
                        contact={contact}
                        onOpenContact={() => router.push(`/app/contacts/${contact.id}`)}
                        onRequestArchiveToggle={requestArchiveToggle}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="font-bold text-slate-900 transition-colors group-hover:text-lime-600 dark:text-white dark:group-hover:text-lime-400">
                    {name}
                  </p>
                  {contact.email ? (
                    <p className="mt-0.5 truncate text-xs text-slate-500">{contact.email}</p>
                  ) : null}
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                  {contact.phone ? (
                    <span className="text-xs font-mono text-slate-500">
                      {formatPhone(contact.phone)}
                    </span>
                  ) : (
                    <span className="text-xs italic text-slate-400">No phone</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-lime-500" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  {["Contact", "Email", "Phone", "Status", "Added", "Actions"].map((heading) => (
                    <th
                      key={heading}
                      className={`px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 ${
                        heading === "Actions" ? "text-right" : ""
                      }`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {contacts.map((contact) => {
                  const name = buildContactName(contact);
                  const status = STATUS_CONFIG[contact.memberStatus] ?? {
                    label: getMemberStatusLabel(contact.memberStatus),
                    className: "bg-slate-100 text-slate-500",
                  };
                  const gradient = getAvatarColor(name);

                  return (
                    <tr
                      key={contact.id}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      onClick={() => router.push(`/app/contacts/${contact.id}`)}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-xs font-bold text-white`}
                          >
                            {contact.firstName?.[0]}
                            {contact.lastName?.[0]}
                          </div>
                          <span className="font-semibold text-slate-900 transition-colors hover:text-lime-600 dark:text-white dark:hover:text-lime-400">
                            {name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {contact.email ? (
                          <span className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="max-w-[180px] truncate">{contact.email}</span>
                          </span>
                        ) : (
                          <span className="text-sm text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {contact.phone ? (
                          <span className="flex items-center gap-1.5 font-mono text-sm text-slate-600 dark:text-slate-400">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            {formatPhone(contact.phone)}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-500">
                        {new Date(contact.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div
                          className="flex justify-end"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                        >
                          <ContactActionsMenu
                            contact={contact}
                            onOpenContact={() => router.push(`/app/contacts/${contact.id}`)}
                            onRequestArchiveToggle={requestArchiveToggle}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-800/30">
            <span className="text-xs font-medium text-slate-500">
              {loading
                ? "Loading..."
                : `Showing ${((page - 1) * 50) + 1}–${Math.min(page * 50, total)} of ${total.toLocaleString()} contacts`}
            </span>
            {pageCount > 1 ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1 || loading}
                  className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="px-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                  {page} / {pageCount}
                </span>
                <button
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={page === pageCount || loading}
                  className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
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

      <AlertDialog
        open={archiveDialog !== null}
        onOpenChange={(open) => {
          if (!open && !archiveBusyId) {
            setArchiveDialog(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveDialog?.currentlyInactive ? "Restore contact?" : "Archive contact?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveDialog?.currentlyInactive
                ? `${archiveDialog.name} will be restored as an active contact.`
                : `${archiveDialog?.name} will be removed from active lists, but you can restore this record later.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(archiveBusyId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(archiveBusyId)}
              className={
                archiveDialog?.currentlyInactive
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-amber-600 text-white hover:bg-amber-500"
              }
              onClick={(event) => {
                event.preventDefault();
                void confirmArchiveToggle();
              }}
            >
              {archiveBusyId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {archiveDialog?.currentlyInactive ? "Restore contact" : "Archive contact"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={mergeDialogGroup !== null}
        onOpenChange={(open) => {
          if (!open && !mergeBusyKey) {
            setMergeDialogGroup(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge duplicate contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              {mergePrimaryContact
                ? `Merge ${mergeDuplicateCount} duplicate contact${mergeDuplicateCount === 1 ? "" : "s"} into ${buildContactName(mergePrimaryContact)}. This keeps one primary record and folds matching data into it.`
                : "Merge the selected duplicate contacts into one primary record."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(mergeBusyKey)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(mergeBusyKey)}
              className="bg-amber-600 text-white hover:bg-amber-500"
              onClick={(event) => {
                event.preventDefault();
                void confirmMergeGroup();
              }}
            >
              {mergeBusyKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Merge group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
