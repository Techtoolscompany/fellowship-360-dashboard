"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import useSWR from "swr";

interface UserDetails {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: string;
  emailVerified: string | null;
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: "owner" | "admin" | "user";
  }>;
}

export default function UserDetailsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const { data: user, error, isLoading } = useSWR<UserDetails>(
    `/api/super-admin/users/${id}`
  );

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString();
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-14rem)]">
        <div className="text-center">
          <h2 className="text-lg font-medium">Error loading user</h2>
          <p className="text-sm text-muted-foreground">
            Failed to load user details. Please try again.
          </p>
          <Button variant="ghost" size="sm" asChild className="mt-4">
            <Link href="/super-admin/users">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
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
            Please wait while we load the user details.
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
            <Link href="/super-admin/users">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">User Details</h1>
        </div>
        <div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => router.push(`/super-admin/users/${id}/delete`)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete User
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Profile</CardTitle>
            <CardDescription>Basic information about the user.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.image || undefined} />
                <AvatarFallback>
                  {user?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() ||
                    user?.email.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold">{user?.name || "Unnamed User"}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">User ID</dt>
                <dd className="text-sm font-mono mt-1">{user?.id}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Joined</dt>
                <dd className="text-sm mt-1">{formatDate(user?.createdAt || null)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Email Verified</dt>
                <dd className="text-sm mt-1">{user?.emailVerified ? formatDate(user.emailVerified) : "No"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Organizations</dt>
                <dd className="text-sm mt-1">{user?.organizations?.length || 0}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {user?.organizations && user.organizations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Organizations</CardTitle>
              <CardDescription>
                Organizations this user belongs to.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {user.organizations.map((org) => (
                  <li key={org.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                    <div>
                      <Link 
                        href={`/super-admin/organizations/${org.id}`}
                        className="font-medium hover:underline"
                      >
                        {org.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">{org.slug}</p>
                    </div>
                    <div className="text-sm font-medium">{org.role}</div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 