"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";
import useSWR from "swr";
import { toast } from "sonner";
import {
  SuperAdminEmptyState,
  SuperAdminPageHeader,
  SuperAdminSurface,
} from "@/components/super-admin/primitives";

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
      <SuperAdminEmptyState
        title="Error loading organization"
        description="Failed to load the organization record for deletion review."
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
        description="Pulling the church record needed to confirm a destructive delete."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        backHref={`/super-admin/organizations/${id}`}
        backLabel="Organization Details"
        eyebrow="Danger Zone"
        eyebrowIcon={AlertTriangle}
        title="Delete Organization"
        description="This action permanently removes the church record, its memberships, invites, and organization data."
      />

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Warning: This action cannot be undone</AlertTitle>
        <AlertDescription>
          Deleting this organization will permanently remove all associated data,
          including members, invitations, and content.
        </AlertDescription>
      </Alert>

      <SuperAdminSurface>
        <div className="border-b border-slate-200/80 px-6 py-5 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Confirm Deletion</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review the organization record carefully before continuing.
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
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
        </div>
        <div className="flex justify-between border-t border-slate-200/80 px-6 py-5 dark:border-slate-700">
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
        </div>
      </SuperAdminSurface>
    </div>
  );
}
