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

interface User {
  id: string;
  name: string | null;
  email: string;
  organizationsOwned: number;
  organizations: Array<{
    id: string;
    name: string;
    role: "owner" | "admin" | "user";
  }>;
}

export default function DeleteUserPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: user, error, isLoading } = useSWR<User>(
    `/api/super-admin/users/${id}`
  );

  const confirmationText = `delete all organizations and data of this user`;

  const handleDelete = async () => {
    if (!user) return;
    if (confirmation !== confirmationText) {
      toast.error("Please enter the correct confirmation text");
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/super-admin/users/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete user");
      }

      toast.success("User deleted successfully");
      router.push("/super-admin/users");
    } catch (error) {
      toast.error("Failed to delete user");
      console.error(error);
      setIsDeleting(false);
    }
  };

  if (error) {
    return (
      <SuperAdminEmptyState
        title="Error loading user"
        description="Failed to load the user record for deletion review."
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/super-admin/users">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to users
            </Link>
          </Button>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <SuperAdminEmptyState
        title="Loading user"
        description="Pulling the account details needed to confirm a destructive delete."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        backHref={`/super-admin/users/${id}`}
        backLabel="User Details"
        eyebrow="Danger Zone"
        eyebrowIcon={AlertTriangle}
        title="Delete User"
        description="This action permanently removes the account and can cascade into organization deletion when the user is the owner."
      />

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Warning: This action cannot be undone</AlertTitle>
        <AlertDescription>
          Deleting this user will permanently remove their account and all associated data.
          {user && user.organizationsOwned > 0 && (
            <strong className="mt-2 block">
              This user owns {user.organizationsOwned} organization(s). Deleting this user will also delete these organizations and all their content.
            </strong>
          )}
        </AlertDescription>
      </Alert>

      <SuperAdminSurface>
        <div className="border-b border-slate-200/80 px-6 py-5 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Confirm Deletion</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Review the user record carefully before confirming.
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div>
            <p className="text-sm font-medium">Email:</p>
            <p className="text-sm">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Name:</p>
            <p className="text-sm">{user?.name || "Unnamed User"}</p>
          </div>
          <div>
            <p className="text-sm font-medium">User ID:</p>
            <p className="text-sm font-mono">{user?.id}</p>
          </div>

          <div className="pt-4">
            <p className="text-sm font-medium mb-2">
              To confirm deletion, type &quot;{confirmationText}&quot; below:
            </p>
            <Input
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={confirmationText}
              className="max-w-md"
            />
          </div>
        </div>
        <div className="flex justify-between border-t border-slate-200/80 px-6 py-5 dark:border-slate-700">
          <Button 
            variant="outline" 
            asChild
          >
            <Link href={`/super-admin/users/${id}`}>
              Cancel
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={
              isDeleting || 
              confirmation !== confirmationText
            }
          >
            {isDeleting ? "Deleting..." : "Delete User"}
          </Button>
        </div>
      </SuperAdminSurface>
    </div>
  );
}
