"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

export default function DeleteOrganizationPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: org, error, isLoading } = useSWR<Organization>(
    `/api/super-admin/organizations/${id}`
  );

  const handleDelete = async () => {
    if (!org) return;
    if (confirmation !== `delete-${org.slug}`) {
      toast.error("Please enter the correct confirmation text");
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/super-admin/organizations/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete organization");
      }

      toast.success("Organization deleted successfully");
      router.push("/super-admin/organizations");
    } catch (error) {
      toast.error("Failed to delete organization");
      console.error(error);
      setIsDeleting(false);
    }
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/super-admin/organizations/${id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Delete Organization</h1>
      </div>

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Warning: This action cannot be undone</AlertTitle>
        <AlertDescription>
          Deleting this organization will permanently remove all associated data,
          including members, invitations, and content.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Confirm Deletion</CardTitle>
          <CardDescription>
            Please review the information below carefully.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium">Organization Name:</p>
            <p className="text-sm">{org?.name}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Organization Slug:</p>
            <p className="text-sm">{org?.slug}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Organization ID:</p>
            <p className="text-sm font-mono">{org?.id}</p>
          </div>

          <div className="pt-4">
            <p className="text-sm font-medium mb-2">
              To confirm deletion, type &quot;{`delete-${org?.slug}`}&quot; below:
            </p>
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={`delete-${org?.slug}`}
              className="max-w-md"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            asChild
          >
            <Link href={`/super-admin/organizations/${id}`}>
              Cancel
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={
              isDeleting || confirmation !== `delete-${org?.slug}`
            }
          >
            {isDeleting ? "Deleting..." : "Delete Organization"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
} 