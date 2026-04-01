"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Building2,
  MoreHorizontal,
  PlusCircle,
  Search,
  ShieldCheck,
  Trash2,
  Users,
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
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SuperAdminInlineStat,
  SuperAdminPageHeader,
  SuperAdminPagination,
  SuperAdminSectionHeading,
  SuperAdminTableShell,
  SuperAdminToolbar,
  SuperAdminToolbarGroup,
} from "@/components/super-admin/primitives";

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  planName: string;
  planId: string | null;
  memberCount: number;
}

interface PaginationInfo {
  total: number;
  pageCount: number;
  currentPage: number;
  perPage: number;
}

interface PlansResponse {
  plans: Array<{
    id: string;
    name: string;
  }>;
}

export default function OrganizationsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [planDrafts, setPlanDrafts] = useState<Record<string, string>>({});
  const [savingPlanOrgId, setSavingPlanOrgId] = useState<string | null>(null);
  const [creatingName, setCreatingName] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingOrg, setDeletingOrg] = useState<Organization | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const limit = 10;
  const permissions = session?.user?.superAdmin?.permissions ?? [];
  const canManageOrganizations = permissions.includes("manage_organizations");
  const canManageBilling = permissions.includes("manage_billing");

  const { data, error, isLoading, mutate } = useSWR<{
    organizations: Organization[];
    pagination: PaginationInfo;
  }>(`/api/super-admin/organizations?page=${page}&limit=${limit}&search=${search}`);
  const { data: plansResponse } = useSWR<PlansResponse>(
    canManageBilling ? "/api/super-admin/plans?page=1&limit=200" : null
  );

  const organizations = data?.organizations ?? [];
  const plans = plansResponse?.plans ?? [];

  useEffect(() => {
    setPlanDrafts((current) => {
      const next = { ...current };
      for (const org of organizations) {
        next[org.id] = org.planId || "none";
      }
      return next;
    });
  }, [organizations]);

  const summary = useMemo(() => {
    const organizationsWithPlans = organizations.filter((org) => Boolean(org.planId)).length;
    const totalMembers = organizations.reduce((sum, org) => sum + org.memberCount, 0);

    return {
      organizationsWithPlans,
      totalMembers,
    };
  }, [organizations]);

  const planCoverage =
    organizations.length > 0 ? Math.round((summary.organizationsWithPlans / organizations.length) * 100) : 0;

  const handleCreateOrganization = async () => {
    if (!creatingName.trim()) {
      toast.error("Church name is required");
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch("/api/super-admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: creatingName.trim() }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to create church");
      }

      toast.success("Church created");
      setCreatingName("");
      setIsCreateDialogOpen(false);
      await mutate();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to create church");
    } finally {
      setIsCreating(false);
    }
  };

  const handlePlanSave = async (organizationId: string) => {
    const planId = planDrafts[organizationId];

    setSavingPlanOrgId(organizationId);
    try {
      const response = await fetch(`/api/super-admin/organizations/${organizationId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: planId === "none" ? null : planId }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update plan");
      }

      toast.success("Church plan updated");
      await mutate();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to update plan");
    } finally {
      setSavingPlanOrgId(null);
    }
  };

  const handleDeleteOrganization = async () => {
    if (!deletingOrg) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/super-admin/organizations/${deletingOrg.id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to delete church");
      }

      toast.success("Church deleted");
      setDeletingOrg(null);
      await mutate();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to delete church");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        eyebrow="Church Directory"
        eyebrowIcon={Building2}
        title="Organizations"
        description="Open church records, inspect member counts, and move directly into onboarding, access, and integrations work."
        actions={
          canManageOrganizations ? (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add church
            </Button>
          ) : undefined
        }
        stats={[
          {
            label: "Total",
            value: data?.pagination.total ?? 0,
            detail: "Across all churches",
          },
          {
            label: "On This Page",
            value: organizations.length,
            detail: `${summary.organizationsWithPlans} with plans`,
          },
          {
            label: "Visible Members",
            value: summary.totalMembers,
            detail: "Summed for current page",
          },
        ]}
      />

      <SuperAdminToolbar>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.9fr)]">
          <SuperAdminToolbarGroup className="justify-between">
            <div className="relative w-full">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search churches by name..."
                className="border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0 dark:bg-transparent"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <Badge variant="outline" className="hidden shrink-0 md:inline-flex">
              Page {page}
            </Badge>
          </SuperAdminToolbarGroup>

          <div className="grid gap-3 sm:grid-cols-2">
            <SuperAdminInlineStat label="Plan Coverage" value={`${planCoverage}%`} />
            <SuperAdminToolbarGroup className="justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  Operating Note
                </div>
                <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                  Open the church record for onboarding, access, and integrations.
                </div>
              </div>
            </SuperAdminToolbarGroup>
          </div>
        </div>
      </SuperAdminToolbar>

      <SuperAdminTableShell className="p-0">
        <div className="border-b border-slate-200/70 px-5 py-4 dark:border-slate-800/80">
          <SuperAdminSectionHeading
            eyebrow="Directory"
            title="Church control records"
            description="Plans, member footprint, and escalation paths stay visible in one operating table."
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[320px]">Church</TableHead>
              <TableHead className="min-w-[220px]">Plan</TableHead>
              <TableHead className="min-w-[180px]">Footprint</TableHead>
              <TableHead className="w-[180px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  Loading organizations...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-destructive">
                  Error loading organizations
                </TableCell>
              </TableRow>
            ) : organizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  No organizations found.
                </TableCell>
              </TableRow>
            ) : (
              organizations.map((org) => (
                <TableRow key={org.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/40">
                  <TableCell>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/super-admin/organizations/${org.id}`}
                          className="font-semibold text-slate-900 hover:text-slate-700 hover:underline dark:text-white dark:hover:text-slate-200"
                        >
                          {org.name}
                        </Link>
                        <Badge variant="outline">{org.slug}</Badge>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Control record {org.id.slice(0, 8)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canManageBilling ? (
                      <div className="space-y-2">
                        <Select
                          value={planDrafts[org.id] ?? (org.planId || "none")}
                          onValueChange={(value) =>
                            setPlanDrafts((current) => ({ ...current, [org.id]: value }))
                          }
                        >
                          <SelectTrigger className="w-[180px] border-slate-200/80 bg-white/90 dark:border-slate-700 dark:bg-slate-900/80">
                            <SelectValue placeholder="Select plan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No plan</SelectItem>
                            {plans.map((plan) => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            savingPlanOrgId === org.id ||
                            (planDrafts[org.id] ?? (org.planId || "none")) === (org.planId || "none")
                          }
                          onClick={() => void handlePlanSave(org.id)}
                        >
                          {savingPlanOrgId === org.id ? "Saving..." : "Save plan"}
                        </Button>
                      </div>
                    ) : org.planId ? (
                      <Badge variant="secondary">{org.planName}</Badge>
                    ) : (
                      <Badge variant="outline">No plan</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                        <Users className="h-4 w-4 text-slate-400" />
                        {org.memberCount} members
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Created {formatDistanceToNow(new Date(org.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/super-admin/organizations/${org.id}`}>Open</Link>
                      </Button>
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
                          <DropdownMenuItem onClick={() => router.push(`/super-admin/organizations/${org.id}`)}>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Open control record
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/super-admin/organizations/${org.id}/access`)}>
                            <Users className="mr-2 h-4 w-4" />
                            Access policy
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            disabled={!canManageOrganizations}
                            onClick={() => setDeletingOrg(org)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete church
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-xl rounded-[28px] border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95">
          <DialogHeader>
            <DialogTitle>Add Church</DialogTitle>
            <DialogDescription>
              Create a new church directly from the Organizations tab. The current super-admin account will be the initial owner record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organization-name">Church name</Label>
              <Input
                id="organization-name"
                value={creatingName}
                onChange={(event) => setCreatingName(event.target.value)}
                placeholder="Grace Community Church"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => void handleCreateOrganization()} disabled={isCreating}>
                {isCreating ? "Creating..." : "Create church"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingOrg} onOpenChange={(open) => !open && setDeletingOrg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete church</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingOrg
                ? `Delete ${deletingOrg.name} and all of its related records? This cannot be undone.`
                : "Delete this church and all of its related records?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} onClick={() => void handleDeleteOrganization()}>
              {isDeleting ? "Deleting..." : "Delete church"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
