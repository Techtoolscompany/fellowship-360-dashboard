"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  CreditCard,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Pencil,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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
import { PlanEditorDialog } from "@/components/super-admin/plan-editor-dialog";

interface Plan {
  id: string;
  name: string;
  codename: string;
  default: boolean;
  isLifetime: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  onetimePrice: number;
  createdAt: string;
}

interface PaginationInfo {
  total: number;
  pageCount: number;
  currentPage: number;
  perPage: number;
}

export default function PlansPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [confirmDeletePlanId, setConfirmDeletePlanId] = useState<string | null>(null);
  const limit = 10;

  const { data, error, isLoading, mutate } = useSWR<{
    plans: Plan[];
    pagination: PaginationInfo;
  }>(`/api/super-admin/plans?page=${page}&limit=${limit}&search=${search}`);

  const plans = data?.plans ?? [];
  const summary = useMemo(
    () => ({
      defaultCount: plans.filter((plan) => plan.default).length,
      lifetimeCount: plans.filter((plan) => plan.isLifetime).length,
    }),
    [plans]
  );

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price / 100);

  const handleDeletePlan = async (planId: string) => {
    setDeletingPlanId(planId);
    try {
      const response = await fetch(`/api/super-admin/plans?id=${planId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to delete plan");
      }

      toast.success("Plan deleted");
      setConfirmDeletePlanId(null);
      await mutate();
    } catch (requestError) {
      console.error("Error deleting plan:", requestError);
      toast.error(requestError instanceof Error ? requestError.message : "Failed to delete plan");
    } finally {
      setDeletingPlanId(null);
    }
  };

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        eyebrow="Commercial Setup"
        eyebrowIcon={CreditCard}
        title="Plans"
        description="Own the commercial configuration for churches, including pricing structures, defaults, and lifetime offer paths."
        actions={
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create plan
          </Button>
        }
        stats={[
          { label: "Total", value: data?.pagination.total ?? 0, detail: "Across all plans" },
          { label: "Defaults", value: summary.defaultCount, detail: "Visible on this page" },
          { label: "Lifetime", value: summary.lifetimeCount, detail: "Visible on this page" },
        ]}
      />

      <SuperAdminToolbar>
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search plans..."
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
              <TableHead className="min-w-[180px]">Plan</TableHead>
              <TableHead className="min-w-[120px]">Codename</TableHead>
              <TableHead className="min-w-[120px]">Monthly</TableHead>
              <TableHead className="min-w-[120px]">Yearly</TableHead>
              <TableHead className="min-w-[120px]">One-time</TableHead>
              <TableHead className="min-w-[160px]">Status</TableHead>
              <TableHead className="min-w-[140px]">Created</TableHead>
              <TableHead className="w-[72px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  Loading plans...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-destructive">
                  Error loading plans
                </TableCell>
              </TableRow>
            ) : plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  No plans found.
                </TableCell>
              </TableRow>
            ) : (
              plans.map((plan) => (
                <TableRow key={plan.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/40">
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-900 dark:text-white">{plan.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">ID {plan.id.slice(0, 8)}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{plan.codename}</Badge>
                  </TableCell>
                  <TableCell>{formatPrice(plan.monthlyPrice)}</TableCell>
                  <TableCell>{formatPrice(plan.yearlyPrice)}</TableCell>
                  <TableCell>{formatPrice(plan.onetimePrice)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {plan.default ? <Badge>Default</Badge> : null}
                      {plan.isLifetime ? <Badge variant="secondary">Lifetime</Badge> : null}
                      {!plan.default && !plan.isLifetime ? <Badge variant="outline">Standard</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      {new Date(plan.createdAt).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-9 w-9 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setEditingPlanId(plan.id)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit plan
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          disabled={deletingPlanId === plan.id}
                          onClick={() => setConfirmDeletePlanId(plan.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {deletingPlanId === plan.id ? "Deleting..." : "Delete plan"}
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

      <PlanEditorDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        mode="create"
        onSaved={mutate}
      />

      <PlanEditorDialog
        open={!!editingPlanId}
        onOpenChange={(open) => {
          if (!open) setEditingPlanId(null);
        }}
        mode="edit"
        planId={editingPlanId}
        onSaved={mutate}
      />

      <AlertDialog
        open={!!confirmDeletePlanId}
        onOpenChange={(open) => !open && setConfirmDeletePlanId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete plan</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this plan from the catalog? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingPlanId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!deletingPlanId || !confirmDeletePlanId}
              onClick={() => confirmDeletePlanId && handleDeletePlan(confirmDeletePlanId)}
            >
              {deletingPlanId ? "Deleting..." : "Delete plan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
