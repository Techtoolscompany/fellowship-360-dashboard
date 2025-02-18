import { auth } from "@/auth";
import { db } from "@/db";
import { invitations } from "@/db/schema/invitation";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import AcceptInviteForm from "./_components/accept-invite-form";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { organizationMemberships } from "@/db/schema";

interface AcceptInvitePageProps {
  searchParams: {
    token?: string;
  };
}

export default async function AcceptInvitePage({
  searchParams,
}: AcceptInvitePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/login");
  }

  if (!searchParams.token) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Invalid Invitation</CardTitle>
          <CardDescription>
            This invitation link is invalid or has expired.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Find the invitation
  const dbInvite = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.token, searchParams.token)))
    .limit(1)
    .then((invites) => invites[0]);

  if (!dbInvite) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Invalid Invitation</CardTitle>
          <CardDescription>
            This invitation link is invalid or has expired.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Check if invitation has expired
  if (new Date() > new Date(dbInvite.expiresAt)) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Invitation Expired</CardTitle>
          <CardDescription>
            This invitation has expired. Please request a new invitation.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Check if user's email matches the invitation
  if (dbInvite.email.toLowerCase() !== session.user.email?.toLowerCase()) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Invalid Email</CardTitle>
          <CardDescription>
            This invitation is for a different email address.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Check if user is already a member
  const existingMembership = await db
    .select()
    .from(organizationMemberships)
    .where(
      and(
        eq(organizationMemberships.userId, session.user.id),
        eq(organizationMemberships.organizationId, dbInvite.organizationId)
      )
    )
    .limit(1)
    .then((memberships) => memberships[0]);

  if (existingMembership) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Already a Member</CardTitle>
          <CardDescription>
            You are already a member of this organization.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return <AcceptInviteForm invite={dbInvite} />;
}
