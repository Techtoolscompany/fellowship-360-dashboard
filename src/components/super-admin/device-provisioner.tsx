"use client";

import { useState } from "react";
import useSWR from "swr";
import { PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OrganizationsResponse = {
  organizations: Array<{
    id: string;
    name: string;
  }>;
};

type DeviceProvisionResponse = {
  device: {
    id: string;
    deviceName: string;
    organizationId: string | null;
  };
  enrollment?: {
    token: string;
    expiresAt: string;
  };
};

interface SuperAdminDeviceProvisionerProps {
  compact?: boolean;
  onCreated?: (payload: DeviceProvisionResponse) => Promise<unknown> | unknown;
}

export function SuperAdminDeviceProvisioner({
  compact = false,
  onCreated,
}: SuperAdminDeviceProvisionerProps) {
  const { data: organizationsResponse } = useSWR<OrganizationsResponse>(
    "/api/super-admin/organizations?page=1&limit=200"
  );

  const [deviceName, setDeviceName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [organizationId, setOrganizationId] = useState<string>("unassigned");
  const [issueEnrollmentToken, setIssueEnrollmentToken] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const organizations = organizationsResponse?.organizations ?? [];

  const redirectToSuperAdminSignIn = () => {
    if (typeof window === "undefined") return;
    const callbackUrl = "/super-admin/devices";
    window.location.assign(
      `/sign-in?error=unauthorized&callbackUrl=${encodeURIComponent(callbackUrl)}`
    );
  };

  const handleSubmit = async () => {
    if (!deviceName.trim()) {
      toast.error("Device name is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/sms-gateway/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceName: deviceName.trim(),
          phoneNumber: phoneNumber.trim() || null,
          organizationId: organizationId === "unassigned" ? null : organizationId,
          issueEnrollmentToken,
        }),
      });

      const responseText = await response.text();
      let payload: (DeviceProvisionResponse & {
        error?: string;
      }) | null = null;

      if (responseText.trim()) {
        try {
          payload = JSON.parse(responseText) as DeviceProvisionResponse & {
            error?: string;
          };
        } catch {
          payload = null;
        }
      }

      if (response.status === 401 || response.status === 403) {
        redirectToSuperAdminSignIn();
        return;
      }
      if (!response.ok) {
        throw new Error(
          payload?.error || `Failed to provision device (${response.status})`
        );
      }
      if (!payload?.device) {
        throw new Error("Unexpected server response while creating device");
      }

      toast.success("Device created");
      setDeviceName("");
      setPhoneNumber("");
      setOrganizationId("unassigned");
      setIssueEnrollmentToken(true);
      await onCreated?.(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to provision device");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className={compact ? "grid gap-3" : "grid gap-4 md:grid-cols-2"}>
        <div className="space-y-2">
          <Label htmlFor={compact ? "dashboard-device-name" : "device-name"}>Device name</Label>
          <Input
            id={compact ? "dashboard-device-name" : "device-name"}
            value={deviceName}
            onChange={(event) => setDeviceName(event.target.value)}
            placeholder="Front Desk Pixel"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={compact ? "dashboard-device-phone" : "device-phone"}>Phone number</Label>
          <Input
            id={compact ? "dashboard-device-phone" : "device-phone"}
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="+1 555 555 5555"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={compact ? "dashboard-device-org" : "device-org"}>Assign church</Label>
        <Select value={organizationId} onValueChange={setOrganizationId}>
          <SelectTrigger id={compact ? "dashboard-device-org" : "device-org"}>
            <SelectValue placeholder="Assign church" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {organizations.map((organization) => (
              <SelectItem key={organization.id} value={organization.id}>
                {organization.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        This provisions the device record now. The Android gateway app will claim the same device row when it checks in with the matching name and phone number.
      </p>

      <div className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="space-y-1">
          <Label htmlFor={compact ? "dashboard-device-enrollment" : "device-enrollment"}>
            Issue enrollment code now
          </Label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Generate the one-time code the church phone will paste into Fellowship 360 Gateway.
          </p>
        </div>
        <Switch
          id={compact ? "dashboard-device-enrollment" : "device-enrollment"}
          checked={issueEnrollmentToken}
          onCheckedChange={setIssueEnrollmentToken}
        />
      </div>

      <Button className={compact ? "w-full" : undefined} onClick={() => void handleSubmit()} disabled={isSubmitting}>
        <PlusCircle className="mr-2 h-4 w-4" />
        {isSubmitting ? "Creating..." : "Add device"}
      </Button>
    </div>
  );
}
