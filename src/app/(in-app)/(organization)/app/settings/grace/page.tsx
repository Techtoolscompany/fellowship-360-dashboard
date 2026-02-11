"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type ProviderMode = "agency_managed" | "byo" | "disabled";
type ProviderValidation = {
  isValid: boolean;
  missing: string[];
};

type ProviderConfig = {
  channel: string;
  provider: string;
  mode: ProviderMode;
  isActive: boolean;
  configJson: Record<string, unknown>;
  secretStatus: Record<string, boolean>;
  validation: ProviderValidation;
};

type PolicyConfig = {
  approvalsEnabled: boolean;
  autoEscalateOnEmergency: boolean;
  confidenceThreshold: string;
  highRiskTools: string[];
  allowedPublicTools: string[];
};

const defaultProviders: ProviderConfig[] = [
  {
    channel: "sms",
    provider: "textbee",
    mode: "agency_managed",
    isActive: true,
    configJson: {},
    secretStatus: {},
    validation: { isValid: true, missing: [] },
  },
  {
    channel: "voice",
    provider: "retell",
    mode: "agency_managed",
    isActive: true,
    configJson: {},
    secretStatus: {},
    validation: { isValid: true, missing: [] },
  },
  {
    channel: "email",
    provider: "managed",
    mode: "agency_managed",
    isActive: true,
    configJson: {},
    secretStatus: {},
    validation: { isValid: true, missing: [] },
  },
];

const agencyManagedOnlyChannels = new Set(["sms", "voice"]);

const providerInputFields: Record<
  string,
  Array<{ key: string; label: string; secret?: boolean; placeholder?: string }>
> = {
  email: [
    { key: "fromEmail", label: "From Email", placeholder: "hello@church.org" },
    { key: "apiKey", label: "Email Provider API Key", secret: true },
  ],
};

export default function GraceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState<ProviderConfig[]>(defaultProviders);
  const [policy, setPolicy] = useState<PolicyConfig>({
    approvalsEnabled: true,
    autoEscalateOnEmergency: true,
    confidenceThreshold: "0.7",
    highRiskTools: ["messages.sendSMS", "messages.sendEmail", "appointments.book", "contacts.upsert"],
    allowedPublicTools: [
      "churchInfo.search",
      "prayerRequests.create",
      "appointments.checkAvailability",
      "handoff.transfer",
    ],
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/app/organizations/current/grace/config");
        const payload = (await res.json()) as {
          providers?: Array<{
            channel: string;
            provider: string;
            mode: ProviderMode;
            isActive: boolean;
            configJson?: Record<string, unknown>;
            secretStatus?: Record<string, boolean>;
            validation?: ProviderValidation;
          }>;
          policy?: PolicyConfig;
        };
        if (res.ok) {
          if (payload.providers) {
            const byChannel = new Map(payload.providers.map((provider) => [provider.channel, provider]));
            setProviders(
              defaultProviders.map((fallback) => {
                const provider = byChannel.get(fallback.channel);
                const channelLocked = agencyManagedOnlyChannels.has(fallback.channel);
                return provider
                  ? {
                      channel: provider.channel,
                      provider: provider.provider,
                      mode: channelLocked ? "agency_managed" : provider.mode,
                      isActive: provider.isActive,
                      configJson: provider.configJson ?? {},
                      secretStatus: provider.secretStatus ?? {},
                      validation: provider.validation ?? { isValid: true, missing: [] },
                    }
                  : fallback;
              })
            );
          }
          if (payload.policy) {
            setPolicy({
              approvalsEnabled: payload.policy.approvalsEnabled,
              autoEscalateOnEmergency: payload.policy.autoEscalateOnEmergency,
              confidenceThreshold: payload.policy.confidenceThreshold,
              highRiskTools: payload.policy.highRiskTools || [],
              allowedPublicTools: payload.policy.allowedPublicTools || [],
            });
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveAll() {
    setSaving(true);
    try {
      const providerPayload = providers.map((provider) => ({
        channel: provider.channel,
        provider: provider.provider,
        mode: agencyManagedOnlyChannels.has(provider.channel) ? "agency_managed" : provider.mode,
        isActive: provider.isActive,
        configJson: Object.fromEntries(
          Object.entries(provider.configJson).filter(([, value]) =>
            typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined
          )
        ),
      }));

      const res = await fetch("/api/app/organizations/current/grace/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy, providers: providerPayload }),
      });
      const payload = (await res.json()) as {
        success: boolean;
        error?: string;
        providers?: ProviderConfig[];
      };

      if (!res.ok || !payload.success) {
        throw new Error(payload.error || "Failed to save GRACE configuration");
      }

      if (payload.providers) {
        setProviders(
          payload.providers.map((provider) => ({
            ...provider,
            configJson: provider.configJson ?? {},
            secretStatus: provider.secretStatus ?? {},
            validation: provider.validation ?? { isValid: true, missing: [] },
          }))
        );
      }

      toast.success("GRACE settings updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading Grace settings...</div>;
  }

  function updateProvider(index: number, updater: (provider: ProviderConfig) => ProviderConfig) {
    setProviders((prev) => {
      const next = [...prev];
      next[index] = updater(next[index]);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Grace AI Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure policies, approvals, and provider ownership for your church.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Policy Controls</CardTitle>
          <CardDescription>Human-in-the-loop and escalation behavior.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="approvals-enabled">Require approvals for high-risk tools</Label>
            <Switch
              id="approvals-enabled"
              checked={policy.approvalsEnabled}
              onCheckedChange={(checked) => setPolicy((prev) => ({ ...prev, approvalsEnabled: checked }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-escalate">Auto-escalate emergency conversations</Label>
            <Switch
              id="auto-escalate"
              checked={policy.autoEscalateOnEmergency}
              onCheckedChange={(checked) =>
                setPolicy((prev) => ({ ...prev, autoEscalateOnEmergency: checked }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confidence-threshold">Confidence threshold</Label>
            <Input
              id="confidence-threshold"
              value={policy.confidenceThreshold}
              onChange={(event) =>
                setPolicy((prev) => ({ ...prev, confidenceThreshold: event.target.value }))
              }
            />
          </div>

          <Separator />
          <div className="space-y-2">
            <p className="text-sm font-medium">High-risk tools</p>
            <div className="flex flex-wrap gap-2">
              {policy.highRiskTools.map((tool) => (
                <Badge key={tool} variant="secondary">{tool}</Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Allowed public tools</p>
            <div className="flex flex-wrap gap-2">
              {policy.allowedPublicTools.map((tool) => (
                <Badge key={tool} variant="outline">{tool}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provider Ownership</CardTitle>
          <CardDescription>
            Agency-managed defaults are enabled. Switch channels to BYO when church credentials are available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {providers.map((provider, index) => (
            <div key={provider.channel} className="grid grid-cols-1 gap-3 rounded border p-3 md:grid-cols-4">
              <div>
                <p className="text-sm font-medium capitalize">{provider.channel}</p>
                <p className="text-xs text-muted-foreground">{provider.provider}</p>
                {agencyManagedOnlyChannels.has(provider.channel) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Managed by agency provider keys
                  </p>
                )}
                {provider.mode === "byo" && !provider.validation.isValid && (
                  <p className="mt-2 text-xs text-destructive">
                    Missing: {provider.validation.missing.join(", ")}
                  </p>
                )}
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <Button
                  size="sm"
                  variant={provider.mode === "agency_managed" ? "default" : "outline"}
                  onClick={() => updateProvider(index, (prev) => ({ ...prev, mode: "agency_managed" }))}
                >
                  Agency Managed
                </Button>
                <Button
                  size="sm"
                  variant={provider.mode === "byo" ? "default" : "outline"}
                  disabled={agencyManagedOnlyChannels.has(provider.channel)}
                  onClick={() => updateProvider(index, (prev) => ({ ...prev, mode: "byo" }))}
                >
                  BYO
                </Button>
                <Button
                  size="sm"
                  variant={provider.mode === "disabled" ? "destructive" : "outline"}
                  onClick={() => updateProvider(index, (prev) => ({ ...prev, mode: "disabled" }))}
                >
                  Disable
                </Button>
              </div>
              <div className="flex items-center justify-end">
                <Switch
                  checked={provider.isActive}
                  onCheckedChange={(checked) => updateProvider(index, (prev) => ({ ...prev, isActive: checked }))}
                />
              </div>

              {providerInputFields[provider.channel]?.length ? (
                <div className="grid grid-cols-1 gap-3 md:col-span-4 md:grid-cols-2">
                  {providerInputFields[provider.channel].map((field) => {
                    const fieldValue = String(provider.configJson[field.key] ?? "");
                    const configured = provider.secretStatus[field.key];
                    return (
                      <div key={field.key} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`${provider.channel}-${field.key}`}>{field.label}</Label>
                          {field.secret && configured && (
                            <Badge variant="secondary" className="text-[10px]">Configured</Badge>
                          )}
                        </div>
                        <Input
                          id={`${provider.channel}-${field.key}`}
                          type={field.secret ? "password" : "text"}
                          value={fieldValue}
                          disabled={provider.mode !== "byo"}
                          placeholder={
                            field.secret
                              ? configured
                                ? "Configured. Enter a new value to rotate."
                                : `Enter ${field.label.toLowerCase()}`
                              : field.placeholder || `Enter ${field.label.toLowerCase()}`
                          }
                          onChange={(event) =>
                            updateProvider(index, (prev) => ({
                              ...prev,
                              configJson: {
                                ...prev.configJson,
                                [field.key]: event.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={saveAll} disabled={saving}>
          {saving ? "Saving..." : "Save GRACE Settings"}
        </Button>
      </div>
    </div>
  );
}
