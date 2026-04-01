"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Trash2,
  Edit,
  CreditCard,
  Plus,
  Minus,
  Download,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  RefreshCcw,
} from "lucide-react";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import useSWR from "swr";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { enableCredits } from "@/lib/credits/config";
import {
  buildChurchOnboardingChecklist,
  type ChurchOnboardingChecklistItem,
} from "@/lib/super-admin/onboarding-checklist";
import type { LaunchReportPayload } from "@/lib/super-admin/agency-launch-contracts";
import {
  SuperAdminEmptyState,
  SuperAdminPageHeader,
  SuperAdminSurface,
} from "@/components/super-admin/primitives";

interface OrganizationDetails {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  plan: {
    id: string;
    name: string;
    codename: string;
  } | null;
  members: Array<{
    organizationId: string;
    userId: string;
    role: "owner" | "admin" | "user";
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  }>;
  invites: Array<{
    id: string;
    email: string;
    role: "owner" | "admin" | "user";
    expiresAt: string;
  }>;
}

interface RedeemedCoupon {
  id: string;
  code: string;
  usedAt: string;
  expired: boolean;
}

interface CreditTransaction {
  id: string;
  creditType: string;
  transactionType: "credit" | "debit" | "expired";
  amount: number;
  createdAt: string;
  metadata?: {
    reason?: string;
    adminAction?: boolean;
    adminEmail?: string;
  };
}

interface CreditData {
  currentCredits: Record<string, number>;
  transactions: CreditTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

function checklistStatusVariant(
  status:
    | "complete"
    | "in_progress"
    | "needs_attention"
    | LaunchReportPayload["readiness"]["status"]
) {
  if (status === "complete" || status === "healthy") return "secondary" as const;
  if (status === "in_progress" || status === "degraded") return "outline" as const;
  return "destructive" as const;
}

function checklistStatusIcon(status: "complete" | "in_progress" | "needs_attention") {
  if (status === "complete") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }
  if (status === "in_progress") {
    return <Clock3 className="h-4 w-4 text-amber-600" />;
  }
  return <AlertTriangle className="h-4 w-4 text-destructive" />;
}

export default function OrganizationDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [isRevokingInvite, setIsRevokingInvite] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);

  // Credit management state
  const [creditPage, setCreditPage] = useState(1);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [creditAction, setCreditAction] = useState<"add" | "deduct">("add");
  const [creditType, setCreditType] = useState<
    "image_generation" | "video_generation"
  >("image_generation");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [isProcessingCredit, setIsProcessingCredit] = useState(false);

  const { data: org, error, isLoading, mutate } = useSWR<OrganizationDetails>(
    `/api/super-admin/organizations/${id}`
  );

  const {
    data: launchReport,
    error: launchReportError,
    isLoading: isLoadingLaunchReport,
    mutate: mutateLaunchReport,
  } = useSWR<LaunchReportPayload>(
    `/api/super-admin/organizations/${id}/launch-report`
  );

  const { data: plansList } = useSWR('/api/super-admin/plans?limit=100');
  
  const { data: redeemedCoupons } = useSWR<RedeemedCoupon[]>(
    `/api/super-admin/organizations/${id}/coupons`
  );

  const { data: creditData, mutate: mutateCreditData } = useSWR<CreditData>(
    `/api/super-admin/organizations/${id}/credits?page=${creditPage}&limit=10`
  );

  const onboardingChecklist = useMemo(() => {
    if (!org || !launchReport) {
      return null;
    }

    return buildChurchOnboardingChecklist({
      organizationId: org.id,
      organizationName: org.name,
      hasPlan: Boolean(org.plan),
      memberRoles: org.members.map((member) => member.role),
      launchReport,
    });
  }, [launchReport, org]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setIsChangingRole(true);
    try {
      const response = await fetch(`/api/super-admin/organizations/${id}/members/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        throw new Error("Failed to update role");
      }

      toast.success("Role updated successfully");
      mutate();
    } catch (error) {
      toast.error("Failed to update role");
      console.error(error);
    } finally {
      setIsChangingRole(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setIsRemovingMember(true);
    try {
      const response = await fetch(`/api/super-admin/organizations/${id}/members/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove member");
      }

      toast.success("Member removed successfully");
      mutate();
    } catch (error) {
      toast.error("Failed to remove member");
      console.error(error);
    } finally {
      setIsRemovingMember(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setIsRevokingInvite(true);
    try {
      const response = await fetch(`/api/super-admin/organizations/${id}/invites/${inviteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to revoke invitation");
      }

      toast.success("Invitation revoked successfully");
      mutate();
    } catch (error) {
      toast.error("Failed to revoke invitation");
      console.error(error);
    } finally {
      setIsRevokingInvite(false);
    }
  };

  const handlePlanChange = async (planId: string) => {
    if (!org) return;
    
    setChangingPlan(true);
    try {
      const response = await fetch(`/api/super-admin/organizations/${id}/plan`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ planId: planId === 'null-plan' ? '' : planId }),
      });

      if (!response.ok) {
        throw new Error("Failed to update plan");
      }

      toast.success("Plan updated successfully");
      mutate();
    } catch (error) {
      toast.error("Failed to update plan");
      console.error(error);
    } finally {
      setChangingPlan(false);
    }
  };

  const handleCreditSubmit = async () => {
    if (!creditAmount || !creditReason || parseFloat(creditAmount) <= 0) {
      toast.error("Please provide a valid amount (> 0) and reason");
      return;
    }

    try {
      setIsProcessingCredit(true);
      const response = await fetch(`/api/super-admin/organizations/${id}/credits`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: creditAction,
          creditType,
          amount: parseFloat(creditAmount),
          reason: creditReason,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to manage credits");
      }

      await mutateCreditData();
      toast.success(result.message);

      // Reset form
      setCreditAmount("");
      setCreditReason("");
      setIsCreditModalOpen(false);
    } catch (error) {
      console.error("Error managing credits:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to manage credits"
      );
    } finally {
      setIsProcessingCredit(false);
    }
  };

  const formatCreditType = (type: string) => {
    return type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (error) {
    return (
      <SuperAdminEmptyState
        title="Error loading organization"
        description="Failed to load the church control record. Return to the organization index and try again."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/super-admin/organizations">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to organizations
            </Link>
          </Button>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <SuperAdminEmptyState
        title="Loading organization"
        description="Pulling members, invites, onboarding status, and credits for this church."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        backHref="/super-admin/organizations"
        backLabel="Organizations"
        eyebrow="Church Control Record"
        eyebrowIcon={CheckCircle2}
        title={org?.name ?? "Organization"}
        description={`Slug: ${org?.slug ?? "n/a"}`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/super-admin/organizations/${id}/access`}>Access Policy</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/super-admin/organizations/${id}/integrations`}>Integrations</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/super-admin/organizations/${id}/launch-report?format=csv`}>
                <Download className="mr-2 h-4 w-4" />
                Export Launch Report
              </a>
            </Button>
            {enableCredits ? (
              <Button variant="outline" size="sm" onClick={() => setIsCreditModalOpen(true)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Credits
              </Button>
            ) : null}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => router.push(`/super-admin/organizations/${id}/delete`)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Organization
            </Button>
          </>
        }
        stats={[
          {
            label: "Plan",
            value: org?.plan?.name ?? "No plan",
            detail: org?.plan?.codename ?? "Assign a plan",
          },
          {
            label: "Members",
            value: org?.members.length ?? 0,
            detail: `${org?.invites.length ?? 0} pending invites`,
          },
          {
            label: "Readiness",
            value: onboardingChecklist?.completionPercent ?? 0,
            detail: "Checklist completion %",
          },
        ]}
      />

      <SuperAdminSurface id="organization-checklist">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle>Onboarding Checklist</CardTitle>
              <CardDescription>
                Live launch readiness for {org?.name}. This panel is derived from the launch
                report and the current organization record.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={checklistStatusVariant(
                  onboardingChecklist?.readinessStatus ?? "needs_attention"
                )}
              >
                {onboardingChecklist?.readinessStatus ?? "loading"}
              </Badge>
              <Badge variant="outline">
                {onboardingChecklist
                  ? `${onboardingChecklist.completedItems}/${onboardingChecklist.totalItems} complete`
                  : "Loading checklist"}
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {onboardingChecklist
                  ? `${onboardingChecklist.completionPercent}% complete`
                  : "Loading checklist progress"}
              </span>
              <span className="text-muted-foreground">
                {launchReport
                  ? `Updated ${formatDate(launchReport.generatedAt)}`
                  : "Waiting for launch report"}
              </span>
            </div>
            <Progress value={onboardingChecklist?.completionPercent ?? 0} className="h-2" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingLaunchReport ? (
            <div className="grid gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-lg border border-border/60 p-4">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : launchReportError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Failed to load the launch report for this church. Refresh the page or retry from
              the report link below.
            </div>
          ) : onboardingChecklist ? (
            <div className="grid gap-3">
              {onboardingChecklist.items.map((item: ChurchOnboardingChecklistItem) => (
                <div key={item.id} className="rounded-xl border border-border/60 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {checklistStatusIcon(item.status)}
                        <h3 className="font-semibold">{item.title}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {item.details.map((detail: string) => (
                          <Badge key={detail} variant="outline" className="text-xs">
                            {detail}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Badge variant={checklistStatusVariant(item.status)} className="capitalize">
                      {item.status.replace("_", " ")}
                    </Badge>
                  </div>

                  {item.actionLabel && item.actionHref ? (
                    <div className="mt-3">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={item.actionHref}>{item.actionLabel}</Link>
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {onboardingChecklist?.topNextAction ? (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold">Top next action</p>
                  <p className="text-sm text-muted-foreground">
                    {onboardingChecklist.topNextAction}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void mutateLaunchReport()}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh checklist
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/super-admin/health">Open health board</Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </SuperAdminSurface>

      <SuperAdminSurface id="organization-details">
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>Overview of the organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">ID</dt>
              <dd className="text-sm mt-1 font-mono">{org?.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Created</dt>
              <dd className="text-sm mt-1">{formatDate(org?.createdAt || "")}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Name</dt>
              <dd className="text-sm mt-1">{org?.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Slug</dt>
              <dd className="text-sm mt-1">{org?.slug}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Plan</dt>
              <dd className="text-sm mt-1">
                <div className="flex items-center gap-2">
                  <Select
                    value={org?.plan?.id || 'null-plan'}
                    onValueChange={handlePlanChange}
                    disabled={changingPlan}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Select a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="null-plan">No Plan</SelectItem>
                      {plansList?.plans?.map((plan: { id: string; name: string }) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {org?.plan && (
                    <Badge variant="outline" className="text-xs">
                      {org.plan.codename}
                    </Badge>
                  )}
                </div>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Member Count
              </dt>
              <dd className="text-sm mt-1">{org?.members.length || 0}</dd>
            </div>
          </dl>
        </CardContent>
      </SuperAdminSurface>

      <SuperAdminSurface id="organization-members">
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            People who are part of this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {org?.members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">
                    No members found.
                  </TableCell>
                </TableRow>
              ) : (
                org?.members.map((member) => (
                  <TableRow key={`${member.userId}-${member.organizationId}`}>
                    <TableCell className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.user.image || undefined} />
                        <AvatarFallback>
                          {member.user.name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase() ||
                            member.user.email.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {member.user.name || "Unnamed User"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {member.user.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          member.role === "owner"
                            ? "default"
                            : member.role === "admin"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              disabled={member.role === "owner"}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Change Role
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => handleRoleChange(member.userId, "owner")}
                              disabled={member.role === "owner" || isChangingRole}
                            >
                              Make Owner
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleRoleChange(member.userId, "admin")}
                              disabled={member.role === "admin" || isChangingRole}
                            >
                              Make Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleRoleChange(member.userId, "user")}
                              disabled={member.role === "user" || isChangingRole}
                            >
                              Make User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isRemovingMember || member.role === "owner"}
                          onClick={() => handleRemoveMember(member.userId)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </SuperAdminSurface>

      {org?.invites && org.invites.length > 0 && (
        <SuperAdminSurface>
          <CardHeader>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>
              Invitations that have been sent but not yet accepted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {org.invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invite.role === "owner"
                            ? "default"
                            : invite.role === "admin"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {invite.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(invite.expiresAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isRevokingInvite}
                        onClick={() => handleRevokeInvite(invite.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </SuperAdminSurface>
      )}

      <SuperAdminSurface>
        <CardHeader>
          <CardTitle>Redeemed Coupons</CardTitle>
          <CardDescription>
            Coupons that have been redeemed by this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Redeemed At</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!redeemedCoupons ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">
                    Loading coupons...
                  </TableCell>
                </TableRow>
              ) : redeemedCoupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">
                    No redeemed coupons found.
                  </TableCell>
                </TableRow>
              ) : (
                redeemedCoupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-mono">{coupon.code}</TableCell>
                    <TableCell>
                      {formatDate(coupon.usedAt)} at {new Date(coupon.usedAt).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      {coupon.expired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <Badge variant="outline">Active</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </SuperAdminSurface>

      {/* Credit Management Modal */}
      <Dialog open={isCreditModalOpen} onOpenChange={setIsCreditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Organization Credits</DialogTitle>
            <DialogDescription>
              Add or deduct credits for {org?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="credit-action">Action</Label>
              <RadioGroup
                value={creditAction}
                onValueChange={(value: "add" | "deduct") =>
                  setCreditAction(value)
                }
                className="flex flex-row gap-6 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="add" id="add" />
                  <Label htmlFor="add" className="flex items-center gap-1">
                    <Plus className="h-4 w-4 text-green-600" />
                    Add Credits
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="deduct" id="deduct" />
                  <Label htmlFor="deduct" className="flex items-center gap-1">
                    <Minus className="h-4 w-4 text-red-600" />
                    Deduct Credits
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="credit-type">Credit Type</Label>
              <Select
                value={creditType}
                onValueChange={(
                  value: "image_generation" | "video_generation"
                ) => setCreditType(value)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image_generation">
                    Image Generation
                  </SelectItem>
                  <SelectItem value="video_generation">
                    Video Generation
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="credit-amount">Amount *</Label>
              <Input
                id="credit-amount"
                type="number"
                min="1"
                step="1"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="Enter amount (must be > 0)"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="credit-reason">Reason *</Label>
              <Textarea
                id="credit-reason"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="Enter reason for this credit transaction"
                className="mt-1.5"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setIsCreditModalOpen(false)}
              disabled={isProcessingCredit}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreditSubmit}
              disabled={
                isProcessingCredit ||
                !creditAmount ||
                !creditReason ||
                parseFloat(creditAmount) <= 0
              }
            >
              {isProcessingCredit
                ? "Processing..."
                : `${creditAction === "add" ? "Add" : "Deduct"} Credits`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credits History Section */}
      {enableCredits && (
        <SuperAdminSurface>
          <CardHeader>
            <CardTitle>Credits & History</CardTitle>
            <CardDescription>
              Organization credit balances and transaction history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="balance" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="balance">Current Balance</TabsTrigger>
                <TabsTrigger value="history">Transaction History</TabsTrigger>
              </TabsList>

              <TabsContent value="balance" className="space-y-4">
                {creditData?.currentCredits ? (
                  <div className="flex flex-col gap-3">
                    {Object.entries(creditData.currentCredits).map(
                      ([type, amount]) => (
                        <div
                          key={type}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {formatCreditType(type)}
                            </span>
                          </div>
                          <Badge
                            variant={amount > 0 ? "default" : "secondary"}
                          >
                            {amount} credits
                          </Badge>
                        </div>
                      )
                    )}
                    {Object.keys(creditData.currentCredits).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No credits available
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      Loading credits...
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                {creditData?.transactions ? (
                  <>
                    <div className="space-y-2">
                      {creditData.transactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  transaction.transactionType === "credit"
                                    ? "default"
                                    : transaction.transactionType === "debit"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {transaction.transactionType === "credit"
                                  ? "+"
                                  : "-"}
                                {transaction.amount}
                              </Badge>
                              <span className="text-sm font-medium">
                                {formatCreditType(transaction.creditType)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {transaction.metadata?.reason ||
                                "No reason provided"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(
                                transaction.createdAt
                              ).toLocaleString()}
                            </p>
                          </div>
                          {transaction.metadata?.adminAction && (
                            <Badge variant="outline" className="text-xs">
                              Admin Action
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>

                    {creditData.pagination && (
                      <div className="flex items-center justify-between pt-4">
                        <p className="text-sm text-muted-foreground">
                          Page {creditData.pagination.page} of{" "}
                          {creditData.pagination.totalPages} (
                          {creditData.pagination.total} total)
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCreditPage(creditPage - 1)}
                            disabled={!creditData.pagination.hasPrev}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCreditPage(creditPage + 1)}
                            disabled={!creditData.pagination.hasNext}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground">
                      Loading transaction history...
                    </p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </SuperAdminSurface>
      )}
    </div>
  );
} 
