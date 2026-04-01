"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  }) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("Global app error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-lg text-center space-y-4">
            <h1 className="text-3xl font-semibold">Application Error</h1>
            <p className="text-sm text-muted-foreground">
              An unrecoverable error occurred. Please try again.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={reset}>Try again</Button>
              <Button variant="outline" onClick={() => window.location.assign("/")}>
                Go Home
              </Button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
