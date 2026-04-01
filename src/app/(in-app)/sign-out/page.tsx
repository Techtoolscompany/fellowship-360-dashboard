"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { FaSpinner } from "react-icons/fa";

export default function SignOutPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    signOut({ callbackUrl: searchParams?.get("callbackUrl") || "/" });
  }, [searchParams]);

  return (
    <div className="h-full flex flex-col items-center justify-center py-10 space-y-4">
      <FaSpinner className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Signing you out...</p>
    </div>
  );
}
