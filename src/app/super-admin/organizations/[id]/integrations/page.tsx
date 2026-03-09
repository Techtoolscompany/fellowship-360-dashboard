"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Loader2, RefreshCcw, Shield } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

type ProviderMode = "agency_managed" | "byo" | "disabled";

type ProviderField = {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
};

type ProviderDefinition = {
  key: string;
  channel: string;
  provider: string;
  title: string;
  summary: string;
  fields: ProviderField[];
};

type ProviderRow = {
  id: string;
  channel: string;
  provider: string;
  mode: ProviderMode;
  isActive: boolean;
  configJson: Record<string, unknown> | null;
  secretStatus?: Record<string, boolean>;
  validation?: {
    isValid: boolean;
    missing: string[];
  };
  updatedAt: string | Date;
};

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
  providers: ProviderRow[];
  smsDevices: SmsDeviceRow[];
  assignedSmsDeviceId: string | null;
};

type ProviderDraft = {
  mode: ProviderMode;
  isActive: boolean;
  values: Record<string, string>;
};

const PROVIDERS: ProviderDefinition[] = [
  {
    key: "ai-gemini",
    channel: "ai",
    provider: "gemini",
    title: "Gemini (AI Brain)",
    summary: "Core reasoning for Grace command, workflows, and assistant responses.",
    fields: [{ key: "apiKey", label: "Gemini API Key", secret: true, placeholder: "AIza..." }],
  },
  {
    key: "sms-textbee",
    channel: "sms",
    provider: "textbee",
    title: "TextBee (SMS)",
    summary: "Outbound broadcasts, assignment offers, and inbound member text workflows.",
    fields: [
      { key: "apiKey", label: "TextBee API Key", secret: true, placeholder: "tb_..." },
      { key: "baseUrl", label: "Base URL", placeholder: "https://api.textbee.dev" },
      { key: "webhookSecret", label: "Webhook Secret", secret: true, placeholder: "shared secret" },
    ],
  },
  {
    key: "voice-elevenlabs",
    channel: "voice",
    provider: "elevenlabs",
    title: "ElevenLabs (Voice Output)",
    summary: "Converts Grace text responses into spoken audio for in-app voice experiences.",
    fields: [{ key: "apiKey", label: "ElevenLabs API Key", secret: true, placeholder: "eleven_..." }],
  },
  {
    key: "voice-retell",
    channel: "voice",
    provider: "retell",
    title: "Retell (Voice Inbound)",
    summary: "Validates inbound Grace call webhooks and powers call automation handoff.",
    fields: [{ key: "webhookSecret", label: "Retell Webhook Secret", secret: true }],
  },
  {
    key: "email-sendgrid",
    channel: "email",
    provider: "sendgrid",
    title: "SendGrid (Email)",
    summary: "Transactional and broadcast email delivery for follow-up and communication.",
    fields: [
      { key: "apiKey", label: "SendGrid API Key", secret: true, placeholder: "SG...." },
      { key: "fromEmail", label: "Default From Email", placeholder: "grace@yourchurch.org" },
    ],
  },
];

function findProviderRow(rows: ProviderRow[], definition: ProviderDefinition) {
  return rows.find(
    (row) => row.channel === definition.channel && row.provider === definition.provider
  );
}

function buildProviderDraft(row: ProviderRow | undefined, definition: ProviderDefinition): ProviderDraft {
  const values: Record<string, string> = {};
  for (const field of definition.fields) {
    if (field.secret) {
      values[field.key] = "";
      continue;
    }
    const value = row?.configJson?.[field.key];
    values[field.key] = typeof value === "string" ? value : "";
  }
  return {
    mode: row?.mode ?? "agency_managed",
    isActive: row?.isActive ?? true,
    values,
  };
}

export default function OrganizationIntegrationsPage() {
  const { id } = useParams() as { id: string };
  const [drafts, setDrafts] = useState<Record<string, ProviderDraft>>({});
  const [selectedSmsDeviceId, setSelectedSmsDeviceId] = useState<string>("unassigned");
  const [savingProviderKey, setSavingProviderKey] = useState<string | null>(null);
  const [savingSmsDevice, setSavingSmsDevice] = useState(false);

  const { data, isLoading, mutate } = useSWR<IntegrationsResponse>(
    `/api/super-admin/organizations/${id}/integrations`
  );

  useEffect(() => {
    if (!data) return;
    const nextDrafts: Record<string, ProviderDraft> = {};
    for (const definition of PROVIDERS) {
      nextDrafts[definition.key] = buildProviderDraft(
        findProviderRow(data.providers, definition),
        definition
      );
    }
    setDrafts(nextDrafts);
    setSelectedSmsDeviceId(data.assignedSmsDeviceId ?? "unassigned");
  }, [data]);

  const providerRows = data?.providers ?? [];
  const smsDevices = data?.smsDevices ?? [];

  const smsStatusLabel = useMemo(() => {
    if (selectedSmsDeviceId === "unassigned") return "Unassigned";
    const row = smsDevices.find((device) => device.id === selectedSmsDeviceId);
    if (!row) return "Unknown";
    return `${row.deviceName}${row.phoneNumber ? ` (${row.phoneNumber})` : ""}`;
  }, [selectedSmsDeviceId, smsDevices]);

  const handleFieldChange = (providerKey: string, fieldKey: string, value: string) => {
    setDrafts((current) => ({
      ...current,
      [providerKey]: {
        ...(current[providerKey] ?? { mode: "agency_managed", isActive: true, values: {} }),
        values: { ...(current[providerKey]?.values ?? {}), [fieldKey]: value },
      },
    }));
  };

  const handleModeChange = (providerKey: string, mode: ProviderMode) => {
    setDrafts((current) => ({
      ...current,
      [providerKey]: {
        ...(current[providerKey] ?? { mode: "agency_managed", isActive: true, values: {} }),
        mode,
        isActive: mode === "disabled" ? false : (current[providerKey]?.isActive ?? true),
      },
    }));
  };

  const handleActiveChange = (providerKey: string, isActive: boolean) => {
    setDrafts((current) => ({
      ...current,
      [providerKey]: {
        ...(current[providerKey] ?? { mode: "agency_managed", isActive: true, values: {} }),
        isActive,
      },
    }));
  };

  const handleSaveProvider = async (definition: ProviderDefinition) => {
    const draft = drafts[definition.key];
    if (!draft) return;

    const configJson: Record<string, unknown> = {};
    for (const field of definition.fields) {
      const value = draft.values[field.key] ?? "";
      if (field.secret) {
        if (value.trim()) configJson[field.key] = value.trim();
      } else {
        configJson[field.key] = value.trim();
      }
    }

    setSavingProviderKey(definition.key);
    try {
      const response = await fetch(`/api/super-admin/organizations/${id}/integrations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: {
            channel: definition.channel,
            provider: definition.provider,
            mode: draft.mode,
            isActive: draft.mode === "disabled" ? false : draft.isActive,
            configJson,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to save provider");
      }

      await mutate();
      toast.success(`${definition.title} updated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save provider");
    } finally {
      setSavingProviderKey(null);
    }
  };

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
      const payload = await response.json();
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/super-admin/organizations/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Organization Integrations</h1>
            <p className="text-sm text-muted-foreground">
              Super-admin control for provider credentials and SMS gateway assignment.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => mutate()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>SMS Device Assignment</CardTitle>
          <CardDescription>Choose which Android gateway phone handles this organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <p className="text-sm text-muted-foreground">Current: {smsStatusLabel}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provider Configuration</CardTitle>
          <CardDescription>
            Manage channel providers for this organization. Secret inputs are write-only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            PROVIDERS.map((definition) => {
              const row = findProviderRow(providerRows, definition);
              const draft = drafts[definition.key] ?? buildProviderDraft(undefined, definition);
              const isSaving = savingProviderKey === definition.key;

              return (
                <div key={definition.key} className="rounded-xl border p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{definition.title}</h3>
                      <p className="text-sm text-muted-foreground">{definition.summary}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{draft.mode}</Badge>
                      <Badge variant={draft.isActive ? "default" : "secondary"}>
                        {draft.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {row?.validation?.isValid === false ? (
                        <Badge variant="destructive">Missing {row.validation.missing.join(", ")}</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="mb-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <Label>Mode</Label>
                      <Select
                        value={draft.mode}
                        onValueChange={(value) =>
                          handleModeChange(definition.key, value as ProviderMode)
                        }
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="agency_managed">Agency Managed</SelectItem>
                          <SelectItem value="byo">Bring Your Own</SelectItem>
                          <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3 pt-7">
                      <Switch
                        checked={draft.isActive}
                        disabled={draft.mode === "disabled"}
                        onCheckedChange={(checked) => handleActiveChange(definition.key, checked)}
                      />
                      <Label>Active Provider</Label>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {definition.fields.map((field) => {
                      const hasSecret = row?.secretStatus?.[field.key] ?? false;
                      return (
                        <div key={field.key}>
                          <Label>{field.label}</Label>
                          <Input
                            className="mt-1.5"
                            type={field.secret ? "password" : "text"}
                            placeholder={field.secret && hasSecret ? "•••••••• (stored)" : field.placeholder}
                            value={draft.values[field.key] ?? ""}
                            onChange={(event) =>
                              handleFieldChange(definition.key, field.key, event.target.value)
                            }
                          />
                          {field.secret && hasSecret ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              <Shield className="mr-1 inline h-3 w-3" />
                              Secret is already saved. Leave blank to keep current value.
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button disabled={isSaving} onClick={() => handleSaveProvider(definition)}>
                      {isSaving ? "Saving..." : "Save Provider"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
