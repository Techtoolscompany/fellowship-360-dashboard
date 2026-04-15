"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function InAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("In-app route error:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-xl font-semibold">We could not load this workspace page</h2>
        <p className="text-sm text-muted-foreground">
          Please retry. If this keeps happening, contact support.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset}>Retry</Button>
          <Button
            variant="outline"
            onClick={() => window.location.assign("/app/grace?tab=home")}
          >
            Grace
          </Button>
        </div>
      </div>
    </div>
  );
}
