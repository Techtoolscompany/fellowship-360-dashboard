"use client";

import { SessionProvider } from "next-auth/react";
import React from "react";
import { Suspense } from "react";
import { Next13ProgressBar } from "next13-progressbar";
import { SWRConfig } from "swr";
import { fetcher } from "@/lib/swr/fetcher";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
    >
      <Suspense>
        <SessionProvider>
          <SWRConfig value={{ fetcher }}>
            <Next13ProgressBar
              height="4px"
              color="hsl(var(--primary))"
              options={{ showSpinner: true }}
              showOnShallow
            />

            {children}
            <Toaster position="top-center" richColors />
          </SWRConfig>
        </SessionProvider>
      </Suspense>
    </ThemeProvider>
  );
}

export default Providers;
