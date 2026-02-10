"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { seedDemoData } from "@/app/actions/seed";
import { Database, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import useOrganization from "@/lib/organizations/useOrganization";

export default function SeedPage() {
  const { organization, isLoading: isOrgLoading } = useOrganization();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const orgId = organization?.id || "";
  const orgName = organization?.name || "";

  const handleSeed = async () => {
    if (!orgId) {
      setMessage("No organization detected. Please make sure you're logged in.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setMessage("Seeding database...");
    try {
      const result = await seedDemoData(orgId);
      setStatus("success");
      setMessage(`✅ Success! Created ${result.contactCount} contacts and demo data across all tables.`);
    } catch (err: any) {
      setStatus("error");
      setMessage(`❌ Error: ${err.message}`);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-12">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-xl">
            <Database className="text-[#bbff00]" size={24} />
            Seed Demo Data
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Populate your database with realistic demo data for development and testing.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted/30 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-1">Organization</p>
            {isOrgLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : orgId ? (
              <div>
                <p className="text-sm font-semibold text-foreground">{orgName}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{orgId}</p>
              </div>
            ) : (
              <p className="text-sm text-red-400">No organization detected — please log in first.</p>
            )}
          </div>

          <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground mb-2">This will create:</p>
            <p>• 12 church contacts with various statuses</p>
            <p>• 6 pipeline stages with 9 pipeline items</p>
            <p>• 5 tasks, 5 events, 5 prayer requests</p>
            <p>• 30 donations across 5 months + 3 pledges</p>
            <p>• 4 ministries with 7 members</p>
            <p>• 4 appointments, 5 volunteers</p>
            <p>• 4 conversations with messages</p>
            <p>• 3 broadcasts + 4 message templates</p>
          </div>

          <Button
            onClick={handleSeed}
            disabled={status === "loading" || !orgId || isOrgLoading}
            className="w-full gap-2 bg-[#bbff00] text-[#1a1d21] hover:bg-[#a3df00]"
          >
            {status === "loading" ? (
              <><Loader2 size={16} className="animate-spin" /> Seeding...</>
            ) : (
              <><Database size={16} /> Seed Database</>
            )}
          </Button>

          {message && (
            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
              status === "success"
                ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : status === "error"
                ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                : "bg-muted text-muted-foreground"
            }`}>
              {status === "success" ? <CheckCircle size={16} /> : status === "error" ? <AlertCircle size={16} /> : null}
              {message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
