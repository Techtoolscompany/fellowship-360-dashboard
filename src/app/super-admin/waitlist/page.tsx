"use client";

import { useState } from "react";
import useSWR from "swr";
import { Search, Download, ClipboardList, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SuperAdminPageHeader,
  SuperAdminPagination,
  SuperAdminTableShell,
  SuperAdminToolbar,
} from "@/components/super-admin/primitives";

interface WaitlistEntry {
  id: number;
  name: string;
  email: string;
  twitterAccount: string | null;
  createdAt: string;
}

interface PaginationInfo {
  total: number;
  pageCount: number;
  currentPage: number;
  perPage: number;
}

export default function WaitlistPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const limit = 10;

  const { data, error, isLoading, mutate } = useSWR<{
    entries: WaitlistEntry[];
    pagination: PaginationInfo;
  }>(`/api/super-admin/waitlist-entries?page=${page}&limit=${limit}&search=${search}`);

  const entries = data?.entries ?? [];

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(`/api/super-admin/waitlist-entries?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete entry");
      }

      toast.success("Entry deleted successfully");
      mutate();
    } catch (requestError) {
      console.error("Failed to delete entry", requestError);
      toast.error("Failed to delete entry");
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const response = await fetch("/api/super-admin/waitlist-entries/export");

      if (!response.ok) {
        throw new Error("Failed to export waitlist");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `waitlist-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);

      toast.success("Waitlist exported successfully");
    } catch (requestError) {
      console.error("Failed to export waitlist", requestError);
      toast.error("Failed to export waitlist");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        eyebrow="Pipeline"
        eyebrowIcon={ClipboardList}
        title="Waitlist"
        description="Track incoming pipeline before churches become live organizations, then export or clean entries without leaving the platform shell."
        actions={
          <Button variant="outline" onClick={() => void handleExport()} disabled={isExporting}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
        }
        stats={[
          { label: "Total", value: data?.pagination.total ?? 0, detail: "Across the full waitlist" },
          { label: "This Page", value: entries.length, detail: `Page ${page}` },
          { label: "Search", value: search ? "Active" : "All", detail: search || "No filter" },
        ]}
      />

      <SuperAdminToolbar>
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search waitlist..."
            className="pl-9 border-slate-200/80 bg-white/90 dark:border-slate-700 dark:bg-slate-900/80"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </SuperAdminToolbar>

      <SuperAdminTableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Name</TableHead>
              <TableHead className="min-w-[220px]">Email</TableHead>
              <TableHead className="min-w-[160px]">Twitter</TableHead>
              <TableHead className="min-w-[140px]">Joined</TableHead>
              <TableHead className="w-[72px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  Loading waitlist entries...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-destructive">
                  Error loading waitlist entries
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  No entries found.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/40">
                  <TableCell className="font-semibold text-slate-900 dark:text-white">{entry.name}</TableCell>
                  <TableCell>{entry.email}</TableCell>
                  <TableCell>{entry.twitterAccount || "-"}</TableCell>
                  <TableCell>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-9 w-9 p-0">
                          <span className="sr-only">Open menu</span>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600" onClick={() => void handleDelete(entry.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete entry
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </SuperAdminTableShell>

      {data?.pagination ? (
        <SuperAdminPagination
          page={page}
          pageSize={limit}
          total={data.pagination.total}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
