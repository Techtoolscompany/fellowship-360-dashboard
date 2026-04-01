"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import useSWR from "swr";
import { Ticket, Search, MoreVertical, ExternalLink, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDebounce } from "@/hooks/use-debounce";
import { GenerateModal } from "./components/generate-modal";
import { ExpireCouponsModal } from "./components/expire-coupons-modal";
import { ExportCouponsModal } from "./components/export-coupons-modal";
import {
  SuperAdminPageHeader,
  SuperAdminPagination,
  SuperAdminTableShell,
  SuperAdminToolbar,
} from "@/components/super-admin/primitives";

interface Coupon {
  id: string;
  code: string;
  createdAt: string;
  usedAt: string | null;
  usedByUserEmail: string | null;
  organizationId: string | null;
  expired: boolean;
}

interface CouponsResponse {
  coupons: Coupon[];
  totalItems: number;
  page: number;
  limit: number;
}

type StatusFilter = "all" | "used" | "unused" | "expired";

export default function CouponsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const debouncedSearch = useDebounce(searchQuery, 500);

  const { data, isLoading, mutate } = useSWR<CouponsResponse>(
    `/api/super-admin/coupons?page=${page}&search=${debouncedSearch}&status=${statusFilter}`
  );

  const coupons = data?.coupons ?? [];
  const activeCount = coupons.filter((coupon) => coupon.expired === false && coupon.usedAt === null).length;

  const expireCoupon = async (id: string) => {
    try {
      const response = await fetch(`/api/super-admin/coupons/${id}`, {
        method: "PATCH",
      });

      if (!response.ok) throw new Error("Failed to expire coupon");

      mutate();
    } catch (requestError) {
      console.error("Error expiring coupon:", requestError);
    }
  };

  const deleteCoupon = async (id: string) => {
    try {
      const response = await fetch(`/api/super-admin/coupons/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete coupon");

      mutate();
    } catch (requestError) {
      console.error("Error deleting coupon:", requestError);
    }
  };

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        eyebrow="Offers"
        eyebrowIcon={Ticket}
        title="Lifetime Coupons"
        description="Manage lifetime-deal coupons, expire bad codes, and export campaign slices without dropping into a separate tool."
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportCouponsModal currentFilter={statusFilter} searchQuery={debouncedSearch} />
            <ExpireCouponsModal onSuccess={() => mutate()} />
            <GenerateModal onSuccess={() => mutate()} />
          </div>
        }
        stats={[
          { label: "Total", value: data?.totalItems ?? 0, detail: "Across all coupons" },
          { label: "Active", value: activeCount, detail: "Visible on this page" },
          { label: "Filter", value: statusFilter, detail: debouncedSearch || "No search" },
        ]}
      />

      <SuperAdminToolbar>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_180px] lg:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search coupons..."
              className="pl-9 border-slate-200/80 bg-white/90 dark:border-slate-700 dark:bg-slate-900/80"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value: StatusFilter) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="border-slate-200/80 bg-white/90 dark:border-slate-700 dark:bg-slate-900/80">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All coupons</SelectItem>
              <SelectItem value="used">Used</SelectItem>
              <SelectItem value="unused">Unused</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SuperAdminToolbar>

      <SuperAdminTableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Used On</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[72px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  Loading coupons...
                </TableCell>
              </TableRow>
            ) : coupons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  No coupons found.
                </TableCell>
              </TableRow>
            ) : (
              coupons.map((coupon) => (
                <TableRow key={coupon.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/40">
                  <TableCell className="font-mono font-semibold text-slate-900 dark:text-white">{coupon.code}</TableCell>
                  <TableCell>{format(new Date(coupon.createdAt), "PPP 'at' p")}</TableCell>
                  <TableCell>
                    {coupon.organizationId ? (
                      <Link
                        href={`/super-admin/organizations/${coupon.organizationId}`}
                        className="inline-flex items-center text-sm font-medium text-slate-700 hover:underline dark:text-slate-200"
                      >
                        {coupon.organizationId.substring(0, 8)}...
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    {coupon.usedAt ? format(new Date(coupon.usedAt), "PPP 'at' p") : "-"}
                  </TableCell>
                  <TableCell>
                    {coupon.expired ? (
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400">Expired</span>
                    ) : coupon.usedAt ? (
                      <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Used</span>
                    ) : (
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Active</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-9 w-9 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {coupon.expired === false && coupon.usedAt === null ? (
                          <DropdownMenuItem onClick={() => void expireCoupon(coupon.id)} className="text-red-600">
                            <AlertTriangle className="mr-2 h-4 w-4" />
                            Expire
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this coupon?")) {
                              void deleteCoupon(coupon.id);
                            }
                          }}
                          className="text-red-600"
                        >
                          Delete
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

      {data ? (
        <SuperAdminPagination
          page={page}
          pageSize={data.limit}
          total={data.totalItems}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
