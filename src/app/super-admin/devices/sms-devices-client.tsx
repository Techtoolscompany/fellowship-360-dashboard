"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import {
  Building2,
  Copy,
  KeyRound,
  PlusCircle,
  Power,
  RefreshCcw,
  Search,
  Send,
  Signal,
  SignalZero,
  Smartphone,
  Trash2,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SuperAdminInlineStat,
  SuperAdminMetricCard,
  SuperAdminPageHeader,
  SuperAdminSectionHeading,
  SuperAdminTableShell,
  SuperAdminToolbar,
  SuperAdminToolbarGroup,
} from "@/components/super-admin/primitives";
import { SuperAdminDeviceProvisioner } from "@/components/super-admin/device-provisioner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type DeviceRow = {
  device: {
    id: string;
    organizationId: string | null;
    deviceName: string;
    phoneNumber: string | null;
    fcmToken?: string | null;
    isActive: boolean;
    lastSeenAt: string | Date | null;
    enrolledAt?: string | Date | null;
    authTokenIssuedAt?: string | Date | null;
    authTokenLastUsedAt?: string | Date | null;
    authTokenRevokedAt?: string | Date | null;
    statusJson?: Record<string, unknown> | null;
    hasActiveAuthToken?: boolean;
  };
  organization: {
    id: string;
    name: string;
  } | null;
};

type DevicesResponse = {
  devices: DeviceRow[];
};

type EnrollmentDialogState = {
  deviceId: string;
  deviceName: string;
  token: string;
  expiresAt: string;
};

type OrganizationsResponse = {
  organizations: Array<{
    id: string;
    name: string;
  }>;
};

type StatusFilter = "all" | "active" | "inactive";
type AssignmentFilter = "all" | "assigned" | "unassigned";

const EMPTY_DEVICES: DeviceRow[] = [];
const EMPTY_ORGANIZATIONS: OrganizationsResponse["organizations"] = [];

function formatLastSeen(value: string | Date | null) {
  if (!value) return "Never checked in";
  const date = new Date(value);
  return `${format(date, "MMM d, h:mm a")} (${formatDistanceToNow(date, { addSuffix: true })})`;
}

function formatTimestamp(value: string | Date | null | undefined, fallback = "Not yet") {
  if (!value) return fallback;
  return format(new Date(value), "MMM d, h:mm a");
}

function getStatusRecord(statusJson: Record<string, unknown> | null | undefined) {
  return statusJson && typeof statusJson === "object" ? statusJson : {};
}

function getStatusString(statusJson: Record<string, unknown> | null | undefined, key: string) {
  const value = getStatusRecord(statusJson)[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getStatusBoolean(statusJson: Record<string, unknown> | null | undefined, key: string) {
  const value = getStatusRecord(statusJson)[key];
  return typeof value === "boolean" ? value : null;
}

function getStatusNumber(statusJson: Record<string, unknown> | null | undefined, key: string) {
  const value = getStatusRecord(statusJson)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function redirectToSuperAdminSignIn() {
  if (typeof window === "undefined") return;
  const callbackUrl = "/super-admin/devices";
  window.location.assign(
    `/sign-in?error=unauthorized&callbackUrl=${encodeURIComponent(callbackUrl)}`
  );
}

function handleUnauthorizedResponse(response: Response) {
  if (response.status === 401 || response.status === 403) {
    redirectToSuperAdminSignIn();
    return true;
  }

  return false;
}

function buildAssignmentDrafts(rows: DeviceRow[]) {
  const nextDrafts: Record<string, string> = {};

  for (const row of rows) {
    nextDrafts[row.device.id] = row.device.organizationId ?? "unassigned";
  }

  return nextDrafts;
}

function assignmentDraftsEqual(
  left: Record<string, string>,
  right: Record<string, string>
) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

export default function SMSDevicesClient() {
  const {
    data: devicesResponse,
    isLoading,
    mutate,
  } = useSWR<DevicesResponse>("/api/sms-gateway/devices", {
    refreshInterval: 10000,
  });
  const { data: organizationsResponse } = useSWR<OrganizationsResponse>(
    "/api/super-admin/organizations?page=1&limit=200"
  );

  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});
  const [testSmsDrafts, setTestSmsDrafts] = useState<
    Record<string, { to: string; message: string }>
  >({});
  const [savingDeviceId, setSavingDeviceId] = useState<string | null>(null);
  const [deletingDeviceId, setDeletingDeviceId] = useState<string | null>(null);
  const [updatingActiveDeviceId, setUpdatingActiveDeviceId] = useState<string | null>(null);
  const [sendingTestSmsForDeviceId, setSendingTestSmsForDeviceId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>("all");
  const [search, setSearch] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<DeviceRow | null>(null);
  const [issuingEnrollmentForDeviceId, setIssuingEnrollmentForDeviceId] = useState<string | null>(null);
  const [enrollmentDialog, setEnrollmentDialog] = useState<EnrollmentDialogState | null>(null);

  const devices = devicesResponse?.devices ?? EMPTY_DEVICES;
  const organizations = organizationsResponse?.organizations ?? EMPTY_ORGANIZATIONS;

  useEffect(() => {
    const nextDrafts = buildAssignmentDrafts(devices);

    setAssignmentDrafts((current) =>
      assignmentDraftsEqual(current, nextDrafts) ? current : nextDrafts
    );
  }, [devices]);

  useEffect(() => {
    if (!selectedDeviceId || devices.some((row) => row.device.id === selectedDeviceId)) {
      return;
    }
    setSelectedDeviceId(null);
  }, [devices, selectedDeviceId]);

  const summary = useMemo(
    () => ({
      activeCount: devices.filter((row) => row.device.isActive).length,
      assignedCount: devices.filter((row) => row.device.organizationId).length,
      staleCount: devices.filter((row) => !row.device.isActive).length,
    }),
    [devices]
  );

  const filteredDevices = useMemo(() => {
    const searchNeedle = search.trim().toLowerCase();

    return devices.filter((row) => {
      if (statusFilter === "active" && !row.device.isActive) return false;
      if (statusFilter === "inactive" && row.device.isActive) return false;
      if (assignmentFilter === "assigned" && !row.device.organizationId) return false;
      if (assignmentFilter === "unassigned" && row.device.organizationId) return false;
      if (!searchNeedle) return true;

      return [
        row.device.deviceName,
        row.device.phoneNumber,
        row.device.id,
        row.organization?.name,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(searchNeedle));
    });
  }, [assignmentFilter, devices, search, statusFilter]);

  const selectedRow = selectedDeviceId
    ? filteredDevices.find((row) => row.device.id === selectedDeviceId) ??
      devices.find((row) => row.device.id === selectedDeviceId) ??
      null
    : null;

  useEffect(() => {
    if (!selectedRow) return;

    setTestSmsDrafts((current) => {
      if (current[selectedRow.device.id]) {
        return current;
      }

      return {
        ...current,
        [selectedRow.device.id]: {
          to: "",
          message: selectedRow.organization
            ? `Fellowship 360 Gateway test for ${selectedRow.organization.name}.`
            : "Fellowship 360 Gateway test message.",
        },
      };
    });
  }, [selectedRow]);

  const selectedStatus = getStatusRecord(selectedRow?.device.statusJson);
  const selectedGatewayEnabled = getStatusBoolean(selectedRow?.device.statusJson, "gatewayEnabled");
  const selectedReceiveSmsEnabled = getStatusBoolean(
    selectedRow?.device.statusJson,
    "receiveSmsEnabled"
  );
  const selectedPreferredSim = getStatusNumber(selectedRow?.device.statusJson, "preferredSim");
  const selectedManufacturer = getStatusString(selectedRow?.device.statusJson, "manufacturer");
  const selectedModel = getStatusString(selectedRow?.device.statusJson, "model");
  const selectedBuildId = getStatusString(selectedRow?.device.statusJson, "buildId");
  const selectedAppVersionName = getStatusString(
    selectedRow?.device.statusJson,
    "appVersionName"
  );
  const selectedLastDeliveryStatus = getStatusString(
    selectedRow?.device.statusJson,
    "lastDeliveryStatus"
  );
  const selectedLastDeliveryStatusAt = getStatusString(
    selectedRow?.device.statusJson,
    "lastDeliveryStatusAt"
  );
  const selectedLastDeliveryError = getStatusString(
    selectedRow?.device.statusJson,
    "lastDeliveryError"
  );
  const selectedLastDeliveryErrorAt = getStatusString(
    selectedRow?.device.statusJson,
    "lastDeliveryErrorAt"
  );
  const selectedTestSmsDraft = selectedRow
    ? testSmsDrafts[selectedRow.device.id] ?? { to: "", message: "" }
    : { to: "", message: "" };

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

      if (handleUnauthorizedResponse(response)) {
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to update assignment");
      }

      await mutate();
      toast.success("Device assignment updated");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to update assignment");
    } finally {
      setSavingDeviceId(null);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    setDeletingDeviceId(deviceId);
    try {
      const response = await fetch(`/api/sms-gateway/devices?id=${encodeURIComponent(deviceId)}`, {
        method: "DELETE",
      });
      if (handleUnauthorizedResponse(response)) {
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to delete device");
      }
      await mutate();
      setSelectedDeviceId((current) => (current === deviceId ? null : current));
      setDeleteCandidate(null);
      toast.success("Device deleted");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to delete device");
    } finally {
      setDeletingDeviceId(null);
    }
  };

  const handleIssueEnrollmentToken = async (deviceId: string) => {
    setIssuingEnrollmentForDeviceId(deviceId);
    try {
      const response = await fetch("/api/sms-gateway/devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue_enrollment_token",
          deviceId,
        }),
      });

      if (handleUnauthorizedResponse(response)) {
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        device?: { id: string; deviceName: string };
        enrollment?: { token: string; expiresAt: string };
      };

      if (!response.ok || !payload.device || !payload.enrollment) {
        throw new Error(payload.error || "Failed to issue enrollment code");
      }

      setEnrollmentDialog({
        deviceId: payload.device.id,
        deviceName: payload.device.deviceName,
        token: payload.enrollment.token,
        expiresAt: payload.enrollment.expiresAt,
      });
      toast.success("Enrollment code issued");
    } catch (requestError) {
      toast.error(
        requestError instanceof Error ? requestError.message : "Failed to issue enrollment code"
      );
    } finally {
      setIssuingEnrollmentForDeviceId(null);
    }
  };

  const handleSetDeviceActive = async (deviceId: string, isActive: boolean) => {
    setUpdatingActiveDeviceId(deviceId);
    try {
      const response = await fetch("/api/sms-gateway/devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_active",
          deviceId,
          isActive,
        }),
      });

      if (handleUnauthorizedResponse(response)) {
        return;
      }
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Failed to ${isActive ? "reactivate" : "deactivate"} device`);
      }

      await mutate();
      toast.success(isActive ? "Device reactivated" : "Device deactivated");
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : `Failed to ${isActive ? "reactivate" : "deactivate"} device`
      );
    } finally {
      setUpdatingActiveDeviceId(null);
    }
  };

  const handleSendTestSms = async (deviceId: string) => {
    const draft = testSmsDrafts[deviceId];
    if (!draft?.to?.trim()) {
      toast.error("Enter a phone number for the test SMS");
      return;
    }

    if (!draft.message.trim()) {
      toast.error("Enter a message for the test SMS");
      return;
    }

    setSendingTestSmsForDeviceId(deviceId);
    try {
      const response = await fetch("/api/super-admin/devices/test-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          to: draft.to.trim(),
          message: draft.message.trim(),
        }),
      });

      if (handleUnauthorizedResponse(response)) {
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        queuedCount?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to queue test SMS");
      }

      toast.success(
        payload.queuedCount === 1
          ? "Test SMS queued. Tap Sync Now on the gateway phone if it does not send within a few seconds."
          : `Queued ${payload.queuedCount ?? 0} test messages. Tap Sync Now on the gateway phone if they do not send within a few seconds.`
      );
      await mutate();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Failed to queue test SMS");
    } finally {
      setSendingTestSmsForDeviceId(null);
    }
  };

  const handleCopyEnrollmentToken = async () => {
    if (!enrollmentDialog) return;

    try {
      await navigator.clipboard.writeText(enrollmentDialog.token);
      toast.success("Enrollment code copied");
    } catch {
      toast.error("Failed to copy enrollment code");
    }
  };

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        eyebrow="Gateway Control"
        eyebrowIcon={Smartphone}
        title="SMS Devices"
        description="Watch device health, assignment state, and cleanup work from one operations surface instead of treating phones like raw records."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add device
            </Button>
            <Button variant="outline" onClick={() => void mutate()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh devices
            </Button>
          </div>
        }
        stats={[
          { label: "Devices", value: devices.length, detail: "Registered gateway phones" },
          { label: "Active", value: summary.activeCount, detail: `${summary.staleCount} need attention` },
          {
            label: "Unassigned",
            value: Math.max(devices.length - summary.assignedCount, 0),
            detail: "Waiting for church assignment",
          },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SuperAdminMetricCard
          label="Fleet"
          value={devices.length}
          detail="Android gateways registered to the platform"
          icon={Smartphone}
        />
        <SuperAdminMetricCard
          label="Healthy Signals"
          value={summary.activeCount}
          detail={`${summary.staleCount} offline or stale`}
          icon={Signal}
          tone="success"
        />
        <SuperAdminMetricCard
          label="Assigned Coverage"
          value={summary.assignedCount}
          detail={`${Math.max(devices.length - summary.assignedCount, 0)} unassigned`}
          icon={Workflow}
        />
      </div>

      <SuperAdminToolbar>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <SuperAdminToolbarGroup className="justify-between">
            <div className="relative w-full">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search device, phone, church, or ID..."
                className="flex h-10 w-full rounded-md border-0 bg-transparent pl-9 text-sm shadow-none outline-none placeholder:text-slate-400"
              />
            </div>
            <Badge variant="outline" className="hidden shrink-0 lg:inline-flex">
              {filteredDevices.length} visible
            </Badge>
          </SuperAdminToolbarGroup>

          <div className="grid gap-3 sm:grid-cols-3">
            <SuperAdminToolbarGroup>
              <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}>
                <SelectTrigger className="border-0 bg-transparent px-0 shadow-none focus:ring-0 dark:bg-transparent">
                  <SelectValue placeholder="Health" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All health states</SelectItem>
                  <SelectItem value="active">Healthy only</SelectItem>
                  <SelectItem value="inactive">Needs attention</SelectItem>
                </SelectContent>
              </Select>
            </SuperAdminToolbarGroup>
            <SuperAdminToolbarGroup>
              <Select
                value={assignmentFilter}
                onValueChange={(value: AssignmentFilter) => setAssignmentFilter(value)}
              >
                <SelectTrigger className="border-0 bg-transparent px-0 shadow-none focus:ring-0 dark:bg-transparent">
                  <SelectValue placeholder="Assignment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All assignments</SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </SuperAdminToolbarGroup>
            <SuperAdminInlineStat label="Action Queue" value={summary.staleCount} tone="warning" />
          </div>
        </div>
      </SuperAdminToolbar>

      <SuperAdminTableShell className="p-0">
        <div className="border-b border-slate-200/70 px-5 py-4 dark:border-slate-800/80">
          <SuperAdminSectionHeading
            eyebrow="Device Ops"
            title="Gateway fleet"
            description="Rows show signal health first, then church assignment. Open a device to reassign or remove it without leaving the tab."
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[280px]">Device</TableHead>
              <TableHead className="min-w-[180px]">Health</TableHead>
              <TableHead className="min-w-[220px]">Assignment</TableHead>
              <TableHead className="min-w-[220px]">Last Seen</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDevices.map((row) => {
              const device = row.device;
              const appVersionName = getStatusString(device.statusJson, "appVersionName");
              const model = getStatusString(device.statusJson, "model");
              const lastDeliveryError = getStatusString(device.statusJson, "lastDeliveryError");
              const receiveSmsEnabled = getStatusBoolean(device.statusJson, "receiveSmsEnabled");

              return (
                <TableRow key={device.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/40">
                  <TableCell>
                    <div className="space-y-2">
                      <div className="font-semibold text-slate-900 dark:text-white">{device.deviceName}</div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {device.phoneNumber || "Phone number not set"}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{device.id}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {device.isActive ? (
                        <Badge className="gap-1.5">
                          <Signal className="h-3.5 w-3.5" />
                          Healthy
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1.5">
                          <SignalZero className="h-3.5 w-3.5" />
                          Needs attention
                        </Badge>
                      )}
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {device.isActive
                          ? "Heartbeat is reporting from the gateway app"
                          : "No recent heartbeat or device is inactive"}
                      </div>
                      {appVersionName || model ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {[model, appVersionName].filter(Boolean).join(" • ")}
                        </div>
                      ) : null}
                      {lastDeliveryError ? (
                        <div className="text-xs text-red-600 dark:text-red-400">
                          Last error: {lastDeliveryError}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          SMS receive {receiveSmsEnabled ? "enabled" : "not confirmed"}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      {row.organization ? (
                        <>
                          <div className="font-medium text-slate-900 dark:text-white">{row.organization.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Device is assigned and ready for church traffic.
                          </div>
                        </>
                      ) : (
                        <>
                          <Badge variant="outline">Unassigned</Badge>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            This device is not bound to a church yet.
                          </div>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm text-slate-700 dark:text-slate-200">
                        {formatLastSeen(device.lastSeenAt)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setSelectedDeviceId(device.id)}>
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && filteredDevices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  No devices match the current filters.
                </TableCell>
              </TableRow>
            ) : null}
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  Loading devices...
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </SuperAdminTableShell>

      <Sheet open={!!selectedRow} onOpenChange={(open) => !open && setSelectedDeviceId(null)}>
        <SheetContent
          side="right"
          className="w-full overflow-hidden border-l-slate-200/80 bg-slate-50/95 p-0 sm:max-w-xl dark:border-l-slate-700/80 dark:bg-slate-950/95"
        >
          {selectedRow ? (
            <>
              <SheetHeader className="shrink-0 border-b border-slate-200/70 px-6 py-5 dark:border-slate-800/80">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={selectedRow.device.isActive ? "default" : "destructive"}>
                    {selectedRow.device.isActive ? "Healthy" : "Needs attention"}
                  </Badge>
                  {selectedRow.organization ? <Badge variant="outline">Assigned</Badge> : <Badge variant="outline">Unassigned</Badge>}
                </div>
                <SheetTitle className="text-left text-2xl font-black tracking-tight">
                  {selectedRow.device.deviceName}
                </SheetTitle>
                <SheetDescription className="text-left">
                  Reassign the device, inspect its heartbeat state, or remove it from the gateway fleet.
                </SheetDescription>
              </SheetHeader>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Phone
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                      {selectedRow.device.phoneNumber || "Not set"}
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Last Seen
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                      {formatLastSeen(selectedRow.device.lastSeenAt)}
                    </div>
                  </div>
                </div>

                <div className="rounded-[20px] border border-slate-200/70 bg-white/85 p-5 dark:border-slate-800/80 dark:bg-slate-900/65">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Runtime Status
                      </div>
                      <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Heartbeat, app configuration, and latest delivery telemetry from the gateway app.
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={selectedGatewayEnabled === false ? "destructive" : "outline"}>
                        Gateway {selectedGatewayEnabled === false ? "paused" : "enabled"}
                      </Badge>
                      <Badge variant={selectedReceiveSmsEnabled ? "default" : "outline"}>
                        Receive SMS {selectedReceiveSmsEnabled ? "on" : "unknown"}
                      </Badge>
                      {selectedPreferredSim !== null ? (
                        <Badge variant="outline">SIM {selectedPreferredSim}</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/45">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Device Build
                      </div>
                      <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                        {[selectedManufacturer, selectedModel].filter(Boolean).join(" • ") || "Not reported yet"}
                      </div>
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {selectedAppVersionName
                          ? `App ${selectedAppVersionName}${selectedBuildId ? ` • Build ${selectedBuildId}` : ""}`
                          : "App version has not been reported"}
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/45">
                      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        Enrollment State
                      </div>
                      <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                        {selectedRow.device.hasActiveAuthToken ? "Enrolled and authenticated" : "Enrollment pending"}
                      </div>
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        Enrolled {formatTimestamp(selectedRow.device.enrolledAt, "Not enrolled yet")} • Token used{" "}
                        {formatTimestamp(selectedRow.device.authTokenLastUsedAt, "Never")}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[18px] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/45">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      Last Delivery Status
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-900 dark:text-white">
                      {selectedLastDeliveryStatus
                        ? `${selectedLastDeliveryStatus} • ${formatTimestamp(selectedLastDeliveryStatusAt, "Unknown time")}`
                        : "No delivery activity recorded yet"}
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {selectedLastDeliveryError
                        ? `${selectedLastDeliveryError} (${formatTimestamp(selectedLastDeliveryErrorAt, "Unknown time")})`
                        : `Telemetry fields available: ${Object.keys(selectedStatus).length}`}
                    </div>
                  </div>
                </div>

                <div className="rounded-[20px] border border-slate-200/70 bg-white/85 p-5 dark:border-slate-800/80 dark:bg-slate-900/65">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Assignment
                  </div>
                  <div className="mt-3 space-y-4">
                    <Select
                      value={assignmentDrafts[selectedRow.device.id] ?? "unassigned"}
                      onValueChange={(value) =>
                        setAssignmentDrafts((current) => ({
                          ...current,
                          [selectedRow.device.id]: value,
                        }))
                      }
                    >
                      <SelectTrigger className="w-full border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-950/70">
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
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {selectedRow.organization
                        ? `Currently serving ${selectedRow.organization.name}.`
                        : "This device is not attached to a church yet."}
                    </div>
                  </div>
                </div>

                <div className="rounded-[20px] border border-slate-200/70 bg-white/85 p-5 dark:border-slate-800/80 dark:bg-slate-900/65">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Enrollment
                  </div>
                  <div className="mt-3 space-y-3">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Generate the temporary code the church phone enters into the Fellowship 360 Gateway app during setup.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => void handleIssueEnrollmentToken(selectedRow.device.id)}
                      disabled={issuingEnrollmentForDeviceId === selectedRow.device.id}
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      {issuingEnrollmentForDeviceId === selectedRow.device.id
                        ? "Issuing code..."
                        : "Issue enrollment code"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-[20px] border border-slate-200/70 bg-white/85 p-5 dark:border-slate-800/80 dark:bg-slate-900/65">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Test SMS
                  </div>
                  <div className="mt-3 space-y-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Queue a real outbound text through this church’s assigned gateway. The phone sends it after its next push wake-up or when you tap Sync Now in the Fellowship 360 Gateway app.
                    </p>
                    <div className="space-y-2">
                      <Input
                        value={selectedTestSmsDraft.to}
                        placeholder="+1 555 555 5555"
                        onChange={(event) =>
                          setTestSmsDrafts((current) => ({
                            ...current,
                            [selectedRow.device.id]: {
                              ...selectedTestSmsDraft,
                              to: event.target.value,
                            },
                          }))
                        }
                      />
                      <Textarea
                        value={selectedTestSmsDraft.message}
                        rows={4}
                        onChange={(event) =>
                          setTestSmsDrafts((current) => ({
                            ...current,
                            [selectedRow.device.id]: {
                              ...selectedTestSmsDraft,
                              message: event.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {!selectedRow.device.organizationId
                          ? "Assign the device to a church before sending a test."
                          : !selectedRow.device.isActive
                            ? "Reactivate the device before sending a test."
                            : "This queues the text on the server first, then the enrolled phone pulls or receives it and sends it through the SIM."}
                      </div>
                      <Button
                        onClick={() => void handleSendTestSms(selectedRow.device.id)}
                        disabled={
                          sendingTestSmsForDeviceId === selectedRow.device.id ||
                          !selectedRow.device.organizationId ||
                          !selectedRow.device.isActive
                        }
                      >
                        <Send className="mr-2 h-4 w-4" />
                        {sendingTestSmsForDeviceId === selectedRow.device.id
                          ? "Queueing..."
                          : "Send test SMS"}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-[20px] border border-slate-200/70 bg-white/85 p-5 dark:border-slate-800/80 dark:bg-slate-900/65">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Device Record
                  </div>
                  <div className="mt-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {selectedRow.device.id}
                  </div>
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Token issued {formatTimestamp(selectedRow.device.authTokenIssuedAt, "Not issued")} • FCM{" "}
                    {selectedRow.device.fcmToken ? "configured" : "not reported"}
                  </div>
                </div>
              </div>

              <SheetFooter className="shrink-0 border-t border-slate-200/70 bg-white/80 px-6 py-4 dark:border-slate-800/80 dark:bg-slate-950/75">
                <div className="flex w-full flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedRow.device.organizationId ? (
                      <Button variant="outline" asChild>
                        <Link href={`/super-admin/organizations/${selectedRow.device.organizationId}`}>
                          Open church
                        </Link>
                      </Button>
                    ) : null}
                    <AlertDialog
                      open={deleteCandidate?.device.id === selectedRow.device.id}
                      onOpenChange={(open) => setDeleteCandidate(open ? selectedRow : null)}
                    >
                      <Button
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setDeleteCandidate(selectedRow)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete device
                      </Button>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete device</AlertDialogTitle>
                          <AlertDialogDescription>
                            Remove {selectedRow.device.deviceName} from the SMS gateway fleet? Future assignment access for this device will be removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={deletingDeviceId === selectedRow.device.id}>
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            disabled={deletingDeviceId === selectedRow.device.id}
                            onClick={() => void handleDeleteDevice(selectedRow.device.id)}
                          >
                            {deletingDeviceId === selectedRow.device.id ? "Deleting..." : "Delete device"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button
                      variant="outline"
                      onClick={() =>
                        void handleSetDeviceActive(selectedRow.device.id, !selectedRow.device.isActive)
                      }
                      disabled={updatingActiveDeviceId === selectedRow.device.id}
                    >
                      <Power className="mr-2 h-4 w-4" />
                      {updatingActiveDeviceId === selectedRow.device.id
                        ? "Updating..."
                        : selectedRow.device.isActive
                          ? "Deactivate device"
                          : "Reactivate device"}
                    </Button>
                    <Button
                      onClick={() => void handleAssignmentSave(selectedRow.device.id)}
                      disabled={
                        savingDeviceId === selectedRow.device.id ||
                        (assignmentDrafts[selectedRow.device.id] ?? "unassigned") ===
                          (selectedRow.device.organizationId ?? "unassigned")
                      }
                    >
                      {savingDeviceId === selectedRow.device.id ? "Saving..." : "Save assignment"}
                    </Button>
                  </div>
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl rounded-[28px] border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95">
          <DialogHeader>
            <DialogTitle>Add SMS Device</DialogTitle>
            <DialogDescription>
              Provision and optionally pre-assign a gateway phone directly from the SMS Devices tab.
            </DialogDescription>
          </DialogHeader>
          <SuperAdminDeviceProvisioner
            onCreated={async (payload) => {
              await mutate();
              setIsCreateDialogOpen(false);
              if (payload.enrollment) {
                setEnrollmentDialog({
                  deviceId: payload.device.id,
                  deviceName: payload.device.deviceName,
                  token: payload.enrollment.token,
                  expiresAt: payload.enrollment.expiresAt,
                });
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!enrollmentDialog} onOpenChange={(open) => !open && setEnrollmentDialog(null)}>
        <DialogContent className="max-w-xl rounded-[28px] border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95">
          <DialogHeader>
            <DialogTitle>Enrollment code</DialogTitle>
            <DialogDescription>
              Use this one-time code in the Fellowship 360 Gateway app for{" "}
              <span className="font-medium text-slate-900 dark:text-white">
                {enrollmentDialog?.deviceName}
              </span>
              . It expires{" "}
              {enrollmentDialog?.expiresAt
                ? formatDistanceToNow(new Date(enrollmentDialog.expiresAt), { addSuffix: true })
                : "soon"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                One-Time Enrollment Code
              </div>
              <div className="mt-3 break-all rounded-lg bg-white px-3 py-4 font-mono text-sm text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white">
                {enrollmentDialog?.token}
              </div>
              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Expires at{" "}
                {enrollmentDialog?.expiresAt
                  ? format(new Date(enrollmentDialog.expiresAt), "MMM d, h:mm a")
                  : "-"}
              </div>
            </div>

            <div className="rounded-[20px] border border-slate-200/80 bg-white/80 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
              Open Fellowship 360 Gateway on the church phone, paste this code into the enrollment field, and tap <span className="font-semibold">Enroll Device</span>.
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setEnrollmentDialog(null)}>
                Close
              </Button>
              <Button onClick={() => void handleCopyEnrollmentToken()}>
                <Copy className="mr-2 h-4 w-4" />
                Copy code
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
