"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Loader2, RefreshCcw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SuperAdminPageHeader,
  SuperAdminSurface,
} from "@/components/super-admin/primitives";
import { SuperAdminDittofeedManagement } from "@/components/super-admin/dittofeed-management";

type SmsDeviceRow = {
  id: string;
  deviceName: string;
  phoneNumber: string | null;
  organizationId: string | null;
  isActive: boolean;
  lastSeenAt: string | Date | null;
};

type IntegrationsResponse = {
  success: boolean;
  smsDevices: SmsDeviceRow[];
  assignedSmsDeviceId: string | null;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Failed to load ${url}`);
  }
  return payload as T;
}

export default function OrganizationIntegrationsPage() {
  const { id } = useParams() as { id: string };
  const [selectedSmsDeviceId, setSelectedSmsDeviceId] = useState<string>("unassigned");
  const [savingSmsDevice, setSavingSmsDevice] = useState(false);

  const { data, isLoading, mutate } = useSWR<IntegrationsResponse>(
    `/api/super-admin/organizations/${id}/integrations`,
    fetchJson
  );

  useEffect(() => {
    if (!data) return;
    setSelectedSmsDeviceId(data.assignedSmsDeviceId ?? "unassigned");
  }, [data]);

  const smsDevices = data?.smsDevices ?? [];

  const smsStatusLabel = useMemo(() => {
    if (selectedSmsDeviceId === "unassigned") return "Unassigned";
    const row = smsDevices.find((device) => device.id === selectedSmsDeviceId);
    if (!row) return "Unknown";
    return `${row.deviceName}${row.phoneNumber ? ` (${row.phoneNumber})` : ""}`;
  }, [selectedSmsDeviceId, smsDevices]);

  const handleSaveSmsDevice = async () => {
    setSavingSmsDevice(true);
    try {
      const response = await fetch(`/api/super-admin/organizations/${id}/integrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smsDeviceId: selectedSmsDeviceId === "unassigned" ? null : selectedSmsDeviceId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to update SMS device assignment");
      }
      await mutate();
      toast.success("SMS device assignment updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update SMS device assignment"
      );
    } finally {
      setSavingSmsDevice(false);
    }
  };

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        backHref={`/super-admin/organizations/${id}`}
        backLabel="Organization Details"
        eyebrow="Integrations"
        eyebrowIcon={Smartphone}
        title="Organization Integrations"
        description="Super-admin control for Fellowship 360 Gateway assignment and Dittofeed provisioning."
        actions={
          <Button variant="outline" onClick={() => void mutate()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <SuperAdminSurface>
        <div className="border-b border-slate-200/80 px-6 py-5 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">SMS Device Assignment</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Choose which Fellowship 360 Gateway phone handles this organization.
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <Select value={selectedSmsDeviceId} onValueChange={setSelectedSmsDeviceId}>
                  <SelectTrigger className="w-full md:w-[360px]">
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {smsDevices.map((device) => (
                      <SelectItem key={device.id} value={device.id}>
                        {device.deviceName}
                        {device.phoneNumber ? ` (${device.phoneNumber})` : ""}
                        {device.organizationId && device.organizationId !== id ? " - assigned elsewhere" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button disabled={savingSmsDevice} onClick={handleSaveSmsDevice}>
                  {savingSmsDevice ? "Saving..." : "Save Assignment"}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Current:</span>
                <Badge variant="outline">{smsStatusLabel}</Badge>
              </div>
            </>
          )}
        </div>
      </SuperAdminSurface>

      <SuperAdminDittofeedManagement organizationId={id} />
    </div>
  );
}
