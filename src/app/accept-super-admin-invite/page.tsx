"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AcceptSuperAdminInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const token = searchParams.get("token");
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !token || startedRef.current) {
      return;
    }

    startedRef.current = true;
    setIsSubmitting(true);

    void fetch("/api/super-admin/team/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || "Failed to accept invitation");
        }
        router.replace(payload.redirectTo || "/super-admin/team");
      })
      .catch((nextError: unknown) => {
        setError(
          nextError instanceof Error ? nextError.message : "Failed to accept invitation"
        );
        setIsSubmitting(false);
      });
  }, [router, status, token]);

  if (!token) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4">
        <Card className="w-full rounded-3xl border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <CardHeader>
            <CardTitle>Invite token missing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-500 dark:text-slate-400">
            <p>This link is incomplete. Open the invitation email again and use the full link.</p>
            <Button asChild>
              <Link href="/sign-in">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "unauthenticated") {
    const callbackUrl = `/accept-super-admin-invite?token=${encodeURIComponent(token)}`;

    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4">
        <Card className="w-full rounded-3xl border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <CardHeader className="space-y-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50 text-lime-500 dark:border-slate-700 dark:bg-slate-950/60">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <CardTitle>Sign in to accept access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-500 dark:text-slate-400">
            <p>Use the invited email address, then this page will finish activating your super-admin access.</p>
            <Button asChild>
              <Link href={`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
                Continue to sign in
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-4">
      <Card className="w-full rounded-3xl border-slate-200/80 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <CardHeader className="space-y-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50 text-lime-500 dark:border-slate-700 dark:bg-slate-950/60">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle>Activating super-admin access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-slate-500 dark:text-slate-400">
          <p>
            {isSubmitting
              ? "Checking the invitation and activating access now."
              : "Preparing the invitation acceptance flow."}
          </p>
          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          {error ? (
            <Button asChild>
              <Link href="/super-admin">Open super admin</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
