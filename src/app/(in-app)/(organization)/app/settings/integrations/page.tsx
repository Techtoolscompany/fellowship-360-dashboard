"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Loader2, Mail, Plug, RefreshCcw, Send, Shield } from "lucide-react";
import { getGraceProviderConfigs, upsertGraceProviderConfig } from "@/app/actions/grace";
import { getAssignedSmsDevice } from "@/app/actions/sms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import useOrganization from "@/lib/organizations/useOrganization";

type ProviderMode = "agency_managed" | "disabled";
type ProviderConfigRow = Awaited<ReturnType<typeof getGraceProviderConfigs>>[number];

type ProviderField = {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
  description?: string;
};

type ProviderDefinition = {
  key: string;
  channel: string;
  provider: string;
  title: string;
  summary: string;
  fields: ProviderField[];
  modeDescription: {
    agency_managed: string;
    disabled: string;
  };
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
    fields: [
      {
        key: "apiKey",
        label: "Gemini API Key",
        secret: true,
        placeholder: "AIza...",
      },
    ],
    modeDescription: {
      agency_managed: "Use agency-managed Gemini credentials.",
      disabled: "Disable Grace AI model access for this channel.",
    },
  },
  {
    key: "sms-textbee",
    channel: "sms",
    provider: "textbee",
    title: "Fellowship 360 Gateway (SMS)",
    summary: "Android gateway delivery for broadcasts, assignment offers, and inbound member text workflows.",
    fields: [
      {
        key: "apiKey",
        label: "Gateway API Key",
        secret: true,
        placeholder: "managed internally",
      },
      {
        key: "baseUrl",
        label: "Gateway Base URL",
        placeholder: "https://your-gateway-host",
      },
      {
        key: "webhookSecret",
        label: "Gateway Webhook Secret",
        secret: true,
        placeholder: "shared secret for inbound signature",
      },
    ],
    modeDescription: {
      agency_managed: "Use agency-managed Fellowship 360 Gateway credentials.",
      disabled: "Disable SMS provider for this organization.",
    },
  },
  {
    key: "voice-elevenlabs",
    channel: "voice",
    provider: "elevenlabs",
    title: "ElevenLabs (Voice Output)",
    summary: "Converts Grace text responses into spoken audio for in-app voice experiences.",
    fields: [
      {
        key: "apiKey",
        label: "ElevenLabs API Key",
        secret: true,
        placeholder: "eleven_...",
      },
    ],
    modeDescription: {
      agency_managed: "Use agency-managed voice synthesis credentials.",
      disabled: "Disable voice synthesis output.",
    },
  },
  {
    key: "voice-retell",
    channel: "voice",
    provider: "retell",
    title: "Retell (Voice Inbound Webhooks)",
    summary: "Validates inbound Grace call webhooks and powers missed-call automation handoff.",
    fields: [
      {
        key: "webhookSecret",
        label: "Retell Webhook Secret",
        secret: true,
        placeholder: "retell webhook signing secret",
      },
    ],
    modeDescription: {
      agency_managed: "Use agency-managed inbound call webhook secret.",
      disabled: "Disable inbound voice webhook processing.",
    },
  },
  {
    key: "email-sendgrid",
    channel: "email",
    provider: "sendgrid",
    title: "SendGrid (Email)",
    summary: "Transactional and broadcast email delivery for follow-up and ministry communication.",
    fields: [
      {
        key: "apiKey",
        label: "SendGrid API Key",
        secret: true,
        placeholder: "SG....",
      },
      {
        key: "fromEmail",
        label: "Default From Email",
        placeholder: "grace@yourchurch.org",
      },
    ],
    modeDescription: {
      agency_managed: "Use agency-managed email delivery.",
      disabled: "Disable email provider for this organization.",
    },
  },
];

function findRow(rows: ProviderConfigRow[], definition: ProviderDefinition) {
  return rows.find(
    (row) => row.channel === definition.channel && row.provider === definition.provider
  );
}

function buildDraft(row: ProviderConfigRow | undefined, definition: ProviderDefinition): ProviderDraft {
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
    mode: row?.mode === "disabled" ? "disabled" : "agency_managed",
    isActive: row?.isActive ?? true,
    values,
  };
}

function buildDraftMap(rows: ProviderConfigRow[]) {
  return Object.fromEntries(
    PROVIDERS.map((definition) => {
      const row = findRow(rows, definition);
      return [definition.key, buildDraft(row, definition)];
    })
  ) as Record<string, ProviderDraft>;
}

export default function IntegrationsPage() {
  const { organization } = useOrganization();
  const [rows, setRows] = useState<ProviderConfigRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProviderDraft>>(() => buildDraftMap([]));
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [savingProviderKey, setSavingProviderKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [smsDevice, setSmsDevice] = useState<Awaited<ReturnType<typeof getAssignedSmsDevice>> | null>(null);

  const orgId = organization?.id ?? "";
  const appOrigin = useMemo(
    () => (typeof window === "undefined" ? "" : window.location.origin),
    []
  );

  const loadProviderConfigs = useCallback(
    async (showRefreshing = false) => {
      if (!orgId) return;
      if (showRefreshing) setIsRefreshing(true);
      setErrorMessage(null);

      try {
        const [providerRows, assignedDevice] = await Promise.all([
          getGraceProviderConfigs(orgId),
          getAssignedSmsDevice(orgId),
        ]);
        setRows(providerRows);
        setDrafts(buildDraftMap(providerRows));
        setSmsDevice(assignedDevice);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to load provider configs.";
        setErrorMessage(message);
      } finally {
        setIsLoading(false);
        if (showRefreshing) setIsRefreshing(false);
      }
    },
    [orgId]
  );

  useEffect(() => {
    if (!orgId) {
      setIsLoading(false);
      return;
    }
    loadProviderConfigs();
  }, [orgId, loadProviderConfigs]);

  const handleModeChange = (providerKey: string, mode: ProviderMode) => {
    setDrafts((current) => {
      const next = { ...current };
      const currentDraft = next[providerKey] ?? {
        mode: "agency_managed",
        isActive: true,
        values: {},
      };
      next[providerKey] = {
        ...currentDraft,
        mode,
        isActive: mode === "disabled" ? false : currentDraft.isActive,
      };
      return next;
    });
  };

  const handleActiveChange = (providerKey: string, isActive: boolean) => {
    setDrafts((current) => ({
      ...current,
      [providerKey]: {
        ...(current[providerKey] ?? {
          mode: "agency_managed",
          isActive: true,
          values: {},
        }),
        isActive,
      },
    }));
  };

  const handleFieldChange = (providerKey: string, fieldKey: string, value: string) => {
    setDrafts((current) => ({
      ...current,
      [providerKey]: {
        ...(current[providerKey] ?? {
          mode: "agency_managed",
          isActive: true,
          values: {},
        }),
        values: {
          ...(current[providerKey]?.values ?? {}),
          [fieldKey]: value,
        },
      },
    }));
  };

  const handleSaveProvider = async (definition: ProviderDefinition) => {
    if (!orgId) {
      toast.error("Organization not loaded.");
      return;
    }

    const draft = drafts[definition.key];
    if (!draft) {
      toast.error("Provider form is not ready yet.");
      return;
    }

    const configJson: Record<string, unknown> = {};
    for (const field of definition.fields) {
      const value = draft.values[field.key] ?? "";
      if (field.secret) {
        if (value.trim().length > 0) {
          configJson[field.key] = value.trim();
        }
      } else {
        configJson[field.key] = value.trim();
      }
    }

    setSavingProviderKey(definition.key);
    try {
      await upsertGraceProviderConfig({
        organizationId: orgId,
        channel: definition.channel,
        provider: definition.provider,
        mode: draft.mode,
        isActive: draft.mode === "disabled" ? false : draft.isActive,
        configJson,
      });

      await loadProviderConfigs();
      toast.success(`${definition.title} configuration saved.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save provider config.";
      toast.error(message);
    } finally {
      setSavingProviderKey(null);
    }
  };

  const activeProviderCount = rows.filter((row) => row.isActive && row.mode !== "disabled").length;
  const dittofeedRow = rows.find(
    (row) => row.channel === "messaging" && row.provider === "dittofeed"
  );
  const dittofeedWorkspaceId =
    typeof dittofeedRow?.configJson?.workspaceId === "string"
      ? dittofeedRow.configJson.workspaceId
      : null;
  const dittofeedWorkspaceName =
    typeof dittofeedRow?.configJson?.workspaceName === "string"
      ? dittofeedRow.configJson.workspaceName
      : null;
  const dittofeedReady = Boolean(
    dittofeedRow &&
      dittofeedRow.mode !== "disabled" &&
      dittofeedRow.isActive &&
      dittofeedWorkspaceId
  );
  const dittofeedEmailReady = Boolean(dittofeedRow?.secretStatus?.resendApiKey);
  const dittofeedSmsReady =
    Boolean(smsDevice?.isActive) && Boolean(dittofeedRow?.secretStatus?.smsWebhookSecret);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="mb-1 text-base text-muted-foreground">Grace runtime provider controls</p>
          <h1 className="text-3xl font-bold text-foreground">Integrations</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review platform-managed provider status for this organization. Credentials are controlled by your platform team and encrypted at rest.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{activeProviderCount} active providers</Badge>
          <Button
            variant="outline"
            onClick={() => loadProviderConfigs(true)}
            disabled={isRefreshing || isLoading || !orgId}
            className="gap-2"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Webhook Endpoints
          </CardTitle>
          <CardDescription>
            Use these URLs when configuring Fellowship 360 Gateway and Retell callbacks.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">SMS Inbound Webhook</Label>
            <code className="rounded bg-muted px-3 py-2 text-xs">
              {appOrigin ? `${appOrigin}/api/webhooks/sms/grace` : "/api/webhooks/sms/grace"}
            </code>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Voice Inbound Webhook</Label>
            <code className="rounded bg-muted px-3 py-2 text-xs">
              {appOrigin ? `${appOrigin}/api/webhooks/voice/grace` : "/api/webhooks/voice/grace"}
            </code>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-lime-500/20">
        <CardHeader className="border-b border-border/60 bg-lime-500/5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-4 w-4 text-lime-600" />
                Messaging Studio
              </CardTitle>
              <CardDescription className="mt-1 max-w-2xl">
                Dittofeed powers the staff-facing messaging workspace for journeys, templates,
                broadcasts, and delivery history. SMS still sends through your managed gateway.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={dittofeedReady ? "default" : "secondary"}>
                {dittofeedReady ? "connected" : "not configured"}
              </Badge>
              {dittofeedWorkspaceId ? (
                <Badge variant="outline">{dittofeedWorkspaceName ?? dittofeedWorkspaceId}</Badge>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-6 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Mail className="h-4 w-4 text-lime-600" />
                  Email
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {dittofeedEmailReady
                    ? "Managed email is available for Dittofeed broadcasts and journeys."
                    : "Managed Dittofeed email has not been configured yet."}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Send className="h-4 w-4 text-lime-600" />
                  SMS
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {dittofeedSmsReady
                    ? "Dittofeed can hand SMS sends to the church gateway webhook."
                    : "SMS needs both an assigned gateway phone and Dittofeed webhook secret."}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
              {dittofeedReady
                ? "Open the Messaging Studio to manage journeys, templates, broadcasts, and deliveries for this organization."
                : "Your platform team needs to provision Dittofeed before staff can use the Messaging Studio."}
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-2xl border border-border/60 bg-card p-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Workspace access
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Journeys, templates, broadcasts, and deliveries live in one embedded workspace.</p>
                <p>
                  Current route: <code className="rounded bg-muted px-2 py-1 text-xs">/app/broadcasts</code>
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button asChild disabled={!dittofeedReady}>
                <Link href="/app/broadcasts">Open Messaging Studio</Link>
              </Button>
              <Button asChild variant="outline" disabled={!dittofeedReady}>
                <Link href="/app/templates">Open Templates</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {errorMessage ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {errorMessage}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {PROVIDERS.map((definition) => {
          const row = findRow(rows, definition);
          const draft = drafts[definition.key] ?? buildDraft(row, definition);
          const isSaving = savingProviderKey === definition.key;
          const isDisabled = draft.mode === "disabled";
          const validation = row?.validation;
          const missing = validation?.missing ?? [];
          const validationOk = !validation || validation.isValid;

          return (
            <Card key={definition.key}>
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Plug className="h-4 w-4" />
                    {definition.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{definition.channel}</Badge>
                    <Badge variant={isDisabled ? "secondary" : draft.isActive ? "default" : "outline"}>
                      {isDisabled ? "disabled" : draft.isActive ? "active" : "inactive"}
                    </Badge>
                    <Badge variant={validationOk ? "secondary" : "destructive"}>
                      {validationOk ? "valid" : "missing fields"}
                    </Badge>
                  </div>
                </div>
                <CardDescription>{definition.summary}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-end">
                  <div className="space-y-2">
                    <Label>Provider Mode</Label>
                    <Select value={draft.mode} onValueChange={(value) => handleModeChange(definition.key, value as ProviderMode)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="agency_managed">Agency Managed</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{definition.modeDescription[draft.mode]}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Switch
                      checked={draft.isActive && !isDisabled}
                      onCheckedChange={(checked) => handleActiveChange(definition.key, checked)}
                      disabled={isDisabled}
                    />
                    <span className="text-sm text-muted-foreground">Route traffic here</span>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {definition.provider === "textbee" && draft.mode === "agency_managed" ? (
                    <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${smsDevice?.isActive ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {smsDevice
                              ? "Fellowship 360 Gateway Active"
                              : "Waiting for Device Assignment"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {smsDevice 
                              ? `Sending from ${smsDevice.phoneNumber || "assigned device"}. Managed by your agency.` 
                              : "The agency will assign an Android phone to this organization shortly to enable SMS features."}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    definition.fields.map((field) => {
                      const currentValue = draft.values[field.key] ?? "";
                      const hasSecretStored = Boolean(row?.secretStatus?.[field.key]);
                      const secretPlaceholder =
                        field.secret && hasSecretStored
                          ? "Saved securely (leave blank to keep current value)"
                          : field.placeholder;
  
                      return (
                        <div key={field.key} className="space-y-2">
                          <Label htmlFor={`${definition.key}-${field.key}`}>{field.label}</Label>
                          <Input
                            id={`${definition.key}-${field.key}`}
                            type={field.secret ? "password" : "text"}
                            value={currentValue}
                            placeholder={secretPlaceholder}
                            onChange={(event) =>
                              handleFieldChange(definition.key, field.key, event.target.value)
                            }
                            disabled
                            autoComplete="off"
                          />
                          {field.description ? (
                            <p className="text-xs text-muted-foreground">{field.description}</p>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>

                {!validationOk && missing.length > 0 ? (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                    Missing required fields: {missing.join(", ")}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Secrets are encrypted before storage and only exposed as configured/not-configured state.
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={() => handleSaveProvider(definition)}
                    disabled={isSaving || isLoading || !orgId}
                    className="gap-2"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save {definition.title}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
