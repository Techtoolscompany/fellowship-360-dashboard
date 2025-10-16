"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, Edit, CreditCard, Plus, Minus } from "lucide-react";
import {
  Card,
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
import { useState } from "react";
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
import { enableCredits } from "@/lib/credits/config";

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

  const { data: plansList } = useSWR('/api/super-admin/plans?limit=100');
  
  const { data: redeemedCoupons } = useSWR<RedeemedCoupon[]>(
    `/api/super-admin/organizations/${id}/coupons`
  );

  const { data: creditData, mutate: mutateCreditData } = useSWR<CreditData>(
    `/api/super-admin/organizations/${id}/credits?page=${creditPage}&limit=10`
  );

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
      <div className="flex items-center justify-center h-[calc(100vh-14rem)]">
        <div className="text-center">
          <h2 className="text-lg font-medium">Error loading organization</h2>
          <p className="text-sm text-muted-foreground">
            Failed to load organization details. Please try again.
          </p>
          <Button variant="ghost" size="sm" asChild className="mt-4">
            <Link href="/super-admin/organizations">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Organizations
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-14rem)]">
        <div className="text-center">
          <h2 className="text-lg font-medium">Loading...</h2>
          <p className="text-sm text-muted-foreground">
            Please wait while we load the organization details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/super-admin/organizations">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{org?.name}</h1>
          <Badge variant="outline">{org?.slug}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {enableCredits && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreditModalOpen(true)}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Manage Credits
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => router.push(`/super-admin/organizations/${id}/delete`)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Organization
          </Button>
        </div>
      </div>

      <Card>
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
      </Card>

      <Card>
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
      </Card>

      {org?.invites && org.invites.length > 0 && (
        <Card>
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
        </Card>
      )}

      <Card>
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
      </Card>

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
        <Card>
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
        </Card>
      )}
    </div>
  );
} 