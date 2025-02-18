"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Invitation } from "@/app/api/app/organizations/current/invites/schema";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface AcceptInviteFormProps {
  invite: Invitation;
}

export default function AcceptInviteForm({ invite }: AcceptInviteFormProps) {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);

  const acceptInvite = async () => {
    setIsAccepting(true);
    try {
      const response = await fetch("/api/app/organizations/accept-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: invite.token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to accept invitation");
      }

      // Switch to the new organization
      const switchResponse = await fetch("/api/app/organizations/current", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ organizationId: data.organizationId }),
      });

      if (!switchResponse.ok) {
        throw new Error("Failed to switch to the new organization");
      }

      toast.success("Successfully joined the organization");
      router.push("/app");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to accept invitation");
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Accept Invitation</CardTitle>
        <CardDescription>
          You have been invited to join an organization.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-sm font-medium">Email</div>
          <div className="text-sm text-muted-foreground">{invite.email}</div>
        </div>
        <div>
          <div className="text-sm font-medium">Role</div>
          <div className="text-sm text-muted-foreground capitalize">{invite.role}</div>
        </div>
        <div>
          <div className="text-sm font-medium">Expires</div>
          <div className="text-sm text-muted-foreground">
            {new Date(invite.expiresAt).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={acceptInvite} disabled={isAccepting}>
          {isAccepting ? "Accepting..." : "Accept Invitation"}
        </Button>
      </CardFooter>
    </Card>
  );
} 