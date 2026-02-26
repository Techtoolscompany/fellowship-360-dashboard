"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plug } from "lucide-react";

export default function IntegrationsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <p className="text-muted-foreground mb-1 text-base">Connect your favorite tools</p>
        <h1 className="text-3xl font-bold text-foreground">Integrations</h1>
      </div>
      
      <Card className="mt-8 border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Plug className="w-6 h-6 text-muted-foreground" />
          </div>
          <CardTitle className="mb-2">Coming Soon</CardTitle>
          <CardDescription className="max-w-md">
            We are working on integrating with popular tools like MailChimp, Planning Center, and Quickbooks. Check back soon!
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
