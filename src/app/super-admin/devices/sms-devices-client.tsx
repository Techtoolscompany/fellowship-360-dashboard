"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { format } from "date-fns";
import {
  Building2,
  RefreshCcw,
  Signal,
  SignalZero,
  Smartphone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type DeviceRow = {
  device: {
    id: string;
    organizationId: string | null;
    deviceName: string;
    phoneNumber: string | null;
    isActive: boolean;
    lastSeenAt: string | Date | null;
  };
  organization: {
    id: string;
    name: string;
  } | null;
};

type DevicesResponse = {
  devices: DeviceRow[];
};

type OrganizationsResponse = {
  organizations: Array<{
    id: string;
    name: string;
  }>;
};

export default function SMSDevicesClient() {
  const {
    data: devicesResponse,
    isLoading,
    mutate,
  } = useSWR<DevicesResponse>("/api/sms-gateway/devices");
  const { data: organizationsResponse } = useSWR<OrganizationsResponse>(
    "/api/super-admin/organizations?page=1&limit=200"
  );

  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [savingDeviceId, setSavingDeviceId] = useState<string | null>(null);
  const [deletingDeviceId, setDeletingDeviceId] = useState<string | null>(null);

  const devices = devicesResponse?.devices ?? [];
  const organizations = organizationsResponse?.organizations ?? [];

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    for (const row of devices) {
      nextDrafts[row.device.id] = row.device.organizationId ?? "unassigned";
    }
    setAssignmentDrafts(nextDrafts);
  }, [devicesResponse?.devices]);

  const activeCount = useMemo(
    () => devices.filter((row) => row.device.isActive).length,
    [devices]
  );
  const assignedCount = useMemo(
    () => devices.filter((row) => row.device.organizationId).length,
    [devices]
  );

  const handleAssignmentSave = async (deviceId: string) => {
    const draft = assignmentDrafts[deviceId] ?? "unassigned";
    const organizationId = draft === "unassigned" ? null : draft;

    setSavingDeviceId(deviceId);
    try {
      const response = await fetch("/api/sms-gateway/devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, organizationId }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to update assignment");
      }

      await mutate();
      toast.success("Device assignment updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update assignment");
    } finally {
      setSavingDeviceId(null);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this device and all future assignment access?")
    ) {
      return;
    }

    setDeletingDeviceId(deviceId);
    try {
      const response = await fetch(
        `/api/sms-gateway/devices?id=${encodeURIComponent(deviceId)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to delete device");
      }
      await mutate();
      toast.success("Device deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete device");
    } finally {
      setDeletingDeviceId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            SMS Gateway Devices
          </h1>
          <p className="text-slate-500">
            Assign Android gateway phones to organizations and keep delivery online.
          </p>
        </div>
        <Button variant="outline" onClick={() => mutate()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Smartphone className="h-4 w-4" />
            <h3 className="font-medium text-sm">Total Devices</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">{devices.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-emerald-500 mb-2">
            <Signal className="h-4 w-4" />
            <h3 className="font-medium text-sm text-slate-500">Active Status</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {activeCount} <span className="text-sm font-normal text-slate-500">active</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-blue-500 mb-2">
            <Building2 className="h-4 w-4" />
            <h3 className="font-medium text-sm text-slate-500">Assigned</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {assignedCount} <span className="text-sm font-normal text-slate-500">to orgs</span>
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-900 dark:text-slate-300">Device</th>
              <th className="px-4 py-3 font-medium text-slate-900 dark:text-slate-300">Phone Number</th>
              <th className="px-4 py-3 font-medium text-slate-900 dark:text-slate-300">Status</th>
              <th className="px-4 py-3 font-medium text-slate-900 dark:text-slate-300">Last Seen</th>
              <th className="px-4 py-3 font-medium text-slate-900 dark:text-slate-300">Assignment</th>
              <th className="px-4 py-3 font-medium text-slate-900 dark:text-slate-300 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {devices.map((row) => {
              const device = row.device;
              const assignedValue = assignmentDrafts[device.id] ?? "unassigned";
              const isSaving = savingDeviceId === device.id;
              const isDeleting = deletingDeviceId === device.id;
              return (
                <tr
                  key={device.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-white">{device.deviceName}</div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-[180px]">
                      {device.id}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {device.phoneNumber || <span className="text-slate-400 italic">Unknown</span>}
                  </td>
                  <td className="px-4 py-3">
                    {device.isActive ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <Signal className="h-3.5 w-3.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                        <SignalZero className="h-3.5 w-3.5" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {device.lastSeenAt
                      ? format(new Date(device.lastSeenAt), "MMM d, h:mm a")
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 min-w-[240px]">
                    <Select
                      value={assignedValue}
                      onValueChange={(value) =>
                        setAssignmentDrafts((current) => ({
                          ...current,
                          [device.id]: value,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Assign organization" />
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
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {device.organizationId ? (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/super-admin/organizations/${device.organizationId}`}>
                            Org
                          </Link>
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isSaving || isDeleting}
                        onClick={() => handleAssignmentSave(device.id)}
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isSaving || isDeleting}
                        className="text-slate-400 hover:text-red-500"
                        onClick={() => handleDeleteDevice(device.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && devices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No devices registered. Install the Android gateway app and register a device.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
