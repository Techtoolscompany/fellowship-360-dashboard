"use client";

import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { MoreVertical, UserPlus, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateInviteSchema, Invitation, createInviteSchema } from "@/app/api/app/organizations/current/invites/schema";
import { toast } from "sonner";
import useSWR from "swr";
import useOrganization from "@/lib/organizations/useOrganization";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface Member {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: "admin" | "user" | "owner";
}

interface MembersResponse {
  members: Member[];
  success: boolean;
}

interface InvitesResponse {
  invites: Invitation[];
  success: boolean;
}

function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-8 w-8" />
      </TableCell>
    </TableRow>
  );
}

function InviteTableRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-48" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-8 w-8" />
      </TableCell>
    </TableRow>
  );
}

export default function TeamSettingsPage() {
  const { organization } = useOrganization();
  const {
    data: invitesData,
    mutate: mutateInvites,
    isLoading: isLoadingInvites,
  } = useSWR<InvitesResponse>("/api/app/organizations/current/invites");

  const {
    data: membersData,
    mutate: mutateMembers,
    isLoading: isLoadingMembers,
  } = useSWR<MembersResponse>("/api/app/organizations/current/members");

  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [selectedInviteId, setSelectedInviteId] = useState<string | null>(null);
  const [isChangeRoleDialogOpen, setIsChangeRoleDialogOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const inviteForm = useForm<CreateInviteSchema>({
    resolver: zodResolver(createInviteSchema),
    defaultValues: {
      email: "",
      role: "user",
    },
  });

  const roleForm = useForm<{ role: "user" | "admin" }>({
    defaultValues: {
      role: "user",
    },
  });

  const onInviteSubmit = async (values: CreateInviteSchema) => {
    try {
      const response = await fetch("/api/app/organizations/current/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error("Failed to send invite");
      }

      await mutateInvites();
      setIsInviteDialogOpen(false);
      inviteForm.reset();
      toast.success("Invitation sent successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to send invitation");
    }
  };

  const onRevokeInvite = async () => {
    if (!selectedInviteId) return;

    try {
      const response = await fetch(
        `/api/app/organizations/current/invites/${selectedInviteId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to revoke invite");
      }

      await mutateInvites();
      setIsRevokeDialogOpen(false);
      setSelectedInviteId(null);
      toast.success("Invitation revoked successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to revoke invitation");
    }
  };

  const onChangeRole = async (values: { role: "user" | "admin" }) => {
    if (!selectedMemberId) return;

    try {
      const response = await fetch(
        `/api/app/organizations/current/members/${selectedMemberId}/role`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(values),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to change role");
      }

      await mutateMembers();
      setIsChangeRoleDialogOpen(false);
      setSelectedMemberId(null);
      roleForm.reset();
      toast.success("Role updated successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update role");
    }
  };

  const handleRoleChange = (member: Member) => {
    if (member.role === "owner") return;
    setSelectedMemberId(member.id);
    roleForm.setValue("role", member.role === "admin" ? "admin" : "user");
    setIsChangeRoleDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Team Members</h3>
          <p className="text-sm text-muted-foreground">
            Manage your team members and their roles.
          </p>
        </div>
        <Button onClick={() => setIsInviteDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      {/* Invites Section */}
      {(isLoadingInvites ||
        (invitesData?.invites && invitesData.invites.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invites</CardTitle>
            <CardDescription>
              Manage your pending team invitations.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingInvites ? (
                  <>
                    <InviteTableRowSkeleton />
                    <InviteTableRowSkeleton />
                  </>
                ) : (
                  invitesData?.invites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell>{invite.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{invite.role}</Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(invite.expiresAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedInviteId(invite.id);
                            setIsRevokeDialogOpen(true);
                          }}
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Revoke invite</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Team Members Section */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>View and manage your team members.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingMembers ? (
                <>
                  <TableRowSkeleton />
                  <TableRowSkeleton />
                  <TableRowSkeleton />
                </>
              ) : (
                membersData?.members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.image || undefined} alt={member.name || ""} />
                        <AvatarFallback>
                          {member.name
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {member.email}
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
                    <TableCell>
                      {member.role !== "owner" &&
                        organization?.role === "owner" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleRoleChange(member)}
                              >
                                Change Role
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedMemberId(member.id);
                                  setIsRevokeDialogOpen(true);
                                }}
                              >
                                Remove Member
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your team.
            </DialogDescription>
          </DialogHeader>
          <Form {...inviteForm}>
            <form
              onSubmit={inviteForm.handleSubmit(onInviteSubmit)}
              className="space-y-4"
            >
              <FormField
                control={inviteForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="member@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inviteForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={inviteForm.formState.isSubmitting}
                >
                  {inviteForm.formState.isSubmitting
                    ? "Sending..."
                    : "Send Invitation"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <AlertDialog
        open={isRevokeDialogOpen}
        onOpenChange={setIsRevokeDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onRevokeInvite}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Role Dialog */}
      <Dialog
        open={isChangeRoleDialogOpen}
        onOpenChange={setIsChangeRoleDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Change the team member&apos;s role.
            </DialogDescription>
          </DialogHeader>
          <Form {...roleForm}>
            <form
              onSubmit={roleForm.handleSubmit(onChangeRole)}
              className="space-y-4"
            >
              <FormField
                control={roleForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="user">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={roleForm.formState.isSubmitting}
                >
                  {roleForm.formState.isSubmitting
                    ? "Saving..."
                    : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
