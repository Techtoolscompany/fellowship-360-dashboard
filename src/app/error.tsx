"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  }) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("App segment error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-lg text-center space-y-4">
        <h2 className="text-2xl font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          We hit an unexpected error while loading this page.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button
            variant="outline"
            onClick={() => window.location.assign("/app/grace?tab=home")}
          >
            Go to Grace
          </Button>
        </div>
      </div>
    </div>
  );
}
