"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { formatDistanceToNow } from "date-fns";
import { ShieldCheck, UserCog, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  SuperAdminEmptyState,
  SuperAdminInlineStat,
  SuperAdminPageHeader,
  SuperAdminSectionHeading,
  SuperAdminSurface,
  SuperAdminToolbar,
  SuperAdminToolbarGroup,
  superAdminInsetClassName,
} from "@/components/super-admin/primitives";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  SUPER_ADMIN_ROLE_DESCRIPTIONS,
  SUPER_ADMIN_ROLE_LABELS,
  SUPER_ADMIN_ROLES,
  SUPER_ADMIN_STATUS_LABELS,
  type SuperAdminMembershipStatus,
  type SuperAdminRole,
} from "@/lib/super-admin/permissions";

interface TeamMemberRow {
  id: string;
  userId: string;
  role: SuperAdminRole;
  status: SuperAdminMembershipStatus;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    createdAt: string | null;
  };
}

interface InvitationRow {
  id: string;
  email: string;
  role: SuperAdminRole;
  status: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  invitedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface TeamResponse {
  success: boolean;
  members: TeamMemberRow[];
  invitations: InvitationRow[];
  summary: {
    activeMembers: number;
    owners: number;
    pendingInvites: number;
  };
}

interface MemberDraft {
  role: SuperAdminRole;
  status: SuperAdminMembershipStatus;
}

const MEMBER_STATUSES: SuperAdminMembershipStatus[] = ["active", "suspended", "revoked"];

function formatRelativeDate(value: string | null) {
  if (!value) return "-";
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function badgeVariantForStatus(status: string) {
  if (status === "active" || status === "accepted") return "outline" as const;
  if (status === "pending") return "secondary" as const;
  return "destructive" as const;
}

function initialsForMember(member: TeamMemberRow) {
  const label = member.user.name || member.user.email;
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function SuperAdminTeamPage() {
  const { data: session, status: sessionStatus } = useSession();
  const canManageTeam =
    session?.user?.superAdmin?.permissions?.includes("manage_super_admin_team") ?? false;

  const { data, isLoading, mutate } = useSWR<TeamResponse>(
    canManageTeam ? "/api/super-admin/team" : null
  );

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SuperAdminRole>("operator");
  const [isInviting, setIsInviting] = useState(false);
  const [memberDrafts, setMemberDrafts] = useState<Record<string, MemberDraft>>({});
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [revokeCandidate, setRevokeCandidate] = useState<InvitationRow | null>(null);

  useEffect(() => {
    if (!data?.members) return;
    setMemberDrafts(
      Object.fromEntries(
        data.members.map((member) => [
          member.id,
          {
            role: member.role,
            status: member.status,
          },
        ])
      )
    );
  }, [data?.members]);

  const activeMembers = data?.members.filter((member) => member.status === "active") ?? [];
  const suspendedMembers = data?.members.filter((member) => member.status === "suspended") ?? [];
  const pendingInvites = data?.invitations.filter((invite) => invite.status === "pending") ?? [];

  const nextAction = useMemo(() => {
    if (pendingInvites.length > 0) {
      return `${pendingInvites.length} invitation${pendingInvites.length === 1 ? "" : "s"} waiting for acceptance`;
    }
    if (suspendedMembers.length > 0) {
      return `${suspendedMembers.length} suspended admin${suspendedMembers.length === 1 ? "" : "s"} to review`;
    }
    return "Team access is fully staffed right now";
  }, [pendingInvites.length, suspendedMembers.length]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("Email is required");
      return;
    }

    setIsInviting(true);
    try {
      const response = await fetch("/api/super-admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to send invitation");
      }

      toast.success("Invitation sent");
      setInviteEmail("");
      setInviteRole("operator");
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invitation");
    } finally {
      setIsInviting(false);
    }
  };

  const handleMemberSave = async (memberId: string) => {
    const draft = memberDrafts[memberId];
    if (!draft) return;

    setSavingMemberId(memberId);
    try {
      const response = await fetch(`/api/super-admin/team/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to update team member");
      }

      toast.success("Team member updated");
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update team member");
    } finally {
      setSavingMemberId(null);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setRevokingInviteId(inviteId);
    try {
      const response = await fetch(`/api/super-admin/team/invitations/${inviteId}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to revoke invitation");
      }

      toast.success("Invitation revoked");
      setRevokeCandidate(null);
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke invitation");
    } finally {
      setRevokingInviteId(null);
    }
  };

  if (sessionStatus === "loading") {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading team access...</div>;
  }

  if (!canManageTeam) {
    return (
      <SuperAdminEmptyState
        title="Owner access required"
        description="Only super-admin owners can manage the internal staff roster, invitations, and platform permissions."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        eyebrow="Internal Control"
        eyebrowIcon={UserCog}
        title="Super Admin Team"
        description="Invite staff, assign platform roles, suspend access, and keep the business control plane out of environment files."
        stats={[
          { label: "Active", value: data?.summary.activeMembers ?? 0, detail: nextAction },
          { label: "Owners", value: data?.summary.owners ?? 0, detail: "At least one required" },
          { label: "Pending", value: data?.summary.pendingInvites ?? 0, detail: "Unaccepted invites" },
        ]}
      />

      <SuperAdminToolbar>
        <div className="grid gap-3 md:grid-cols-3">
          <SuperAdminInlineStat label="Operating Status" value={activeMembers.length} />
          <SuperAdminInlineStat label="Suspended" value={suspendedMembers.length} tone="warning" />
          <SuperAdminToolbarGroup>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Next Review
              </div>
              <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">{nextAction}</div>
            </div>
          </SuperAdminToolbarGroup>
        </div>
      </SuperAdminToolbar>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <SuperAdminSurface className="p-0">
          <div className="border-b border-slate-200/70 px-5 py-4 dark:border-slate-800/80">
            <SuperAdminSectionHeading
              eyebrow="Roster"
              title="Internal operators"
              description="Edit roles and membership state directly on the operating card instead of managing staff through a plain table."
              action={<Badge variant="outline">{data?.members.length ?? 0} team members</Badge>}
            />
          </div>

          <div className="space-y-4 p-5">
            {isLoading ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">Loading super-admin team...</div>
            ) : data?.members.length ? (
              data.members.map((member) => {
                const draft = memberDrafts[member.id] ?? {
                  role: member.role,
                  status: member.status,
                };
                const hasChanges = draft.role !== member.role || draft.status !== member.status;

                return (
                  <div key={member.id} className={superAdminInsetClassName + " p-4 md:p-5"}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-11 w-11 border border-slate-200/70 dark:border-slate-700/80">
                          {member.user.image ? <AvatarImage src={member.user.image} alt={member.user.name || member.user.email} /> : null}
                          <AvatarFallback>{initialsForMember(member)}</AvatarFallback>
                        </Avatar>
                        <div className="space-y-2">
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {member.user.name || member.user.email}
                            </div>
                            <div className="text-sm text-slate-500 dark:text-slate-400">{member.user.email}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <Badge variant={badgeVariantForStatus(member.status)}>
                              {SUPER_ADMIN_STATUS_LABELS[member.status]}
                            </Badge>
                            <Badge variant="outline">{SUPER_ADMIN_ROLE_LABELS[member.role]}</Badge>
                            <span>Updated {formatRelativeDate(member.updatedAt)}</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => void handleMemberSave(member.id)}
                        disabled={savingMemberId === member.id || !hasChanges}
                      >
                        {savingMemberId === member.id ? "Saving..." : "Save changes"}
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select
                          value={draft.role}
                          onValueChange={(value: SuperAdminRole) =>
                            setMemberDrafts((current) => ({
                              ...current,
                              [member.id]: { ...draft, role: value },
                            }))
                          }
                        >
                          <SelectTrigger className="border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-950/70">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SUPER_ADMIN_ROLES.map((role) => (
                              <SelectItem key={role} value={role}>
                                {SUPER_ADMIN_ROLE_LABELS[role]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {SUPER_ADMIN_ROLE_DESCRIPTIONS[draft.role]}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select
                          value={draft.status}
                          onValueChange={(value: SuperAdminMembershipStatus) =>
                            setMemberDrafts((current) => ({
                              ...current,
                              [member.id]: { ...draft, status: value },
                            }))
                          }
                        >
                          <SelectTrigger className="border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-950/70">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEMBER_STATUSES.map((membershipStatus) => (
                              <SelectItem key={membershipStatus} value={membershipStatus}>
                                {SUPER_ADMIN_STATUS_LABELS[membershipStatus]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Joined {formatRelativeDate(member.user.createdAt)}. Membership created {formatRelativeDate(member.createdAt)}.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <SuperAdminEmptyState
                title="No team members found"
                description="Super-admin access has not been provisioned yet. Invite the first internal operator from the panel on the right."
              />
            )}
          </div>
        </SuperAdminSurface>

        <div className="space-y-6">
          <SuperAdminSurface className="p-6">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white">
              <UserPlus className="h-5 w-5 text-lime-500" />
              <h2 className="text-lg font-bold">Invite teammate</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Send a one-time invite and let the person sign in with their own account before access becomes active.
            </p>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="operator@fellowship360.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={(value: SuperAdminRole) => setInviteRole(value)}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPER_ADMIN_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {SUPER_ADMIN_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {SUPER_ADMIN_ROLE_DESCRIPTIONS[inviteRole]}
                </p>
              </div>
              <Button className="w-full" onClick={() => void handleInvite()} disabled={isInviting}>
                Send invitation
              </Button>
            </div>
          </SuperAdminSurface>

          <SuperAdminSurface className="p-0">
            <div className="border-b border-slate-200/70 px-5 py-4 dark:border-slate-800/80">
              <SuperAdminSectionHeading
                eyebrow="Invitations"
                title="Pending access"
                description="Track who still needs to accept their invite and revoke stale access before it lingers."
                action={<Badge variant="outline">{pendingInvites.length} pending</Badge>}
              />
            </div>
            <div className="space-y-3 p-5">
              {pendingInvites.length ? (
                pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-900 dark:text-white">{invite.email}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {SUPER_ADMIN_ROLE_LABELS[invite.role]} invited {formatRelativeDate(invite.createdAt)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Expires {formatRelativeDate(invite.expiresAt)}
                        </div>
                      </div>
                      <Badge variant={badgeVariantForStatus(invite.status)}>{invite.status}</Badge>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Invited by {invite.invitedBy?.name || invite.invitedBy?.email || "Unknown"}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setRevokeCandidate(invite)}>
                        Revoke
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200/80 p-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No pending invitations.
                </div>
              )}
            </div>
          </SuperAdminSurface>
        </div>
      </div>

      <AlertDialog open={!!revokeCandidate} onOpenChange={(open) => !open && setRevokeCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invitation</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeCandidate
                ? `Revoke the pending invite for ${revokeCandidate.email}? They will need a new invitation to gain access later.`
                : "Revoke this invitation?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!revokingInviteId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!revokeCandidate || revokingInviteId === revokeCandidate.id}
              onClick={() => revokeCandidate && handleRevokeInvite(revokeCandidate.id)}
            >
              {revokeCandidate && revokingInviteId === revokeCandidate.id ? "Revoking..." : "Revoke invite"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
