"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";
import { Loader2, RefreshCcw, Sparkles, Webhook } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  SuperAdminInlineStat,
  SuperAdminSectionHeading,
  SuperAdminSurface,
} from "@/components/super-admin/primitives";

type DittofeedSecretMap = Record<string, boolean>;

type DittofeedProviderRow = {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  workspaceName: string | null;
  externalId: string | null;
  writeKey: string | null;
  baseUrl: string;
  smsWebhookSecret: string | null;
  resendApiKey: string | null;
  resendWebhookKey: string | null;
  mode: "agency_managed" | "byo" | "disabled";
  isActive: boolean;
  configJson: Record<string, unknown>;
  secretStatus?: DittofeedSecretMap;
  validation?: {
    isValid: boolean;
    missing: string[];
  };
  updatedAt?: string | Date;
};

type DittofeedCatalogItem = {
  key: string;
  name: string;
  description: string;
  resourceCounts: {
    userProperties: number;
    componentConfigurations: number;
    templates: number;
    segments: number;
    journeys: number;
  };
};

type DittofeedProvisionResponse = {
  success: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  provider: DittofeedProviderRow | null;
};

type DittofeedPublishResponse = {
  success: boolean;
  organization: {
    id: string;
    name: string;
  };
  catalog: DittofeedCatalogItem[];
  workspaceId: string | null;
  adminApiKeyConfigured: boolean;
  provider: DittofeedProviderRow | null;
  packKey?: string | null;
  result?: {
    emailProviderConfigured: boolean;
    userProperties: number;
    componentConfigurations: number;
    templates: number;
    segments: number;
    journeys: number;
  };
};

type ProvisionDraft = {
  workspaceName: string;
  externalId: string;
  adminApiKey: string;
  smsWebhookSecret: string;
  configureManagedEmail: boolean;
};

type PublishDraft = {
  packKey: string;
  configureManagedEmail: boolean;
};

const DEFAULT_PACK_KEY = "church_messaging_baseline";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || `Failed to load ${url}`);
  }
  return payload as T;
}

function formatPresence(isPresent: boolean) {
  return isPresent ? "Saved" : "Missing";
}

function providerFieldValue(provider: DittofeedProviderRow | null | undefined, key: string) {
  const value = provider?.configJson?.[key];
  return typeof value === "string" ? value : "";
}

function providerSecretPresent(provider: DittofeedProviderRow | null | undefined, key: string) {
  return Boolean(provider?.secretStatus?.[key]);
}

export function SuperAdminDittofeedManagement({ organizationId }: { organizationId: string }) {
  const provisionUrl = `/api/super-admin/organizations/${organizationId}/dittofeed/provision`;
  const publishUrl = `/api/super-admin/organizations/${organizationId}/dittofeed/publish`;

  const {
    data: provisionData,
    isLoading: isProvisionLoading,
    mutate: mutateProvision,
  } = useSWR<DittofeedProvisionResponse>(provisionUrl, fetchJson);
  const {
    data: publishData,
    isLoading: isPublishLoading,
    mutate: mutatePublish,
  } = useSWR<DittofeedPublishResponse>(publishUrl, fetchJson);

  const provider = provisionData?.provider ?? publishData?.provider ?? null;
  const catalog = publishData?.catalog ?? [];
  const selectedPack =
    catalog.find((pack) => pack.key === DEFAULT_PACK_KEY) ?? catalog[0] ?? null;

  const [provisionDraft, setProvisionDraft] = useState<ProvisionDraft>({
    workspaceName: "",
    externalId: "",
    adminApiKey: "",
    smsWebhookSecret: "",
    configureManagedEmail: true,
  });
  const [publishDraft, setPublishDraft] = useState<PublishDraft>({
    packKey: DEFAULT_PACK_KEY,
    configureManagedEmail: true,
  });
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    if (!provisionData?.organization || provisionDraft.workspaceName) return;

    setProvisionDraft((current) => ({
      ...current,
      workspaceName:
        providerFieldValue(provisionData.provider, "workspaceName") ||
        provisionData.organization.name,
      externalId:
        providerFieldValue(provisionData.provider, "externalId") ||
        provisionData.organization.id,
    }));
  }, [provisionData, provisionDraft.workspaceName]);

  useEffect(() => {
    if (!publishData?.catalog?.length) return;

    setPublishDraft((current) => {
      const packKey = catalog.some((pack) => pack.key === current.packKey)
        ? current.packKey
        : catalog[0]?.key ?? DEFAULT_PACK_KEY;

      if (packKey === current.packKey) {
        return current;
      }

      return {
        ...current,
        packKey,
      };
    });
  }, [catalog, publishData?.catalog?.length]);

  const workspaceReady = Boolean(provider?.workspaceId && provider?.writeKey && provider?.isActive);
  const adminKeyReady = providerSecretPresent(provider, "adminApiKey");
  const webhookReady = providerSecretPresent(provider, "smsWebhookSecret");
  const writeKeyReady = providerSecretPresent(provider, "writeKey");
  const managedEmailReady = Boolean(providerSecretPresent(provider, "resendApiKey") && adminKeyReady);

  const summaryText = useMemo(() => {
    if (!provider) return "Dittofeed is not provisioned for this organization yet.";
    if (!provider.workspaceId || !provider.writeKey) {
      return "A provider row exists, but the workspace identifier or write key is still missing.";
    }
    return `Workspace ${provider.workspaceName ?? provider.workspaceId} is connected and ready for template publishing.`;
  }, [provider]);

  const handleProvision = async () => {
    setIsProvisioning(true);
    try {
      const response = await fetch(provisionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: provisionDraft.workspaceName.trim() || undefined,
          externalId: provisionDraft.externalId.trim() || undefined,
          adminApiKey: provisionDraft.adminApiKey.trim() || undefined,
          smsWebhookSecret: provisionDraft.smsWebhookSecret.trim() || undefined,
          configureManagedEmail: provisionDraft.configureManagedEmail,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to provision Dittofeed");
      }

      toast.success(payload.createdWorkspace ? "Dittofeed workspace provisioned" : "Dittofeed workspace updated", {
        description: payload.emailStatus === "configured"
          ? "Managed email provider configured during provisioning."
          : undefined,
      });
      await Promise.all([mutateProvision(), mutatePublish()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to provision Dittofeed");
    } finally {
      setIsProvisioning(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const response = await fetch(publishUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packKey: publishDraft.packKey,
          configureManagedEmail: publishDraft.configureManagedEmail,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to publish Dittofeed pack");
      }

      const result = payload.result as DittofeedPublishResponse["result"] | undefined;
      toast.success(
        `${payload.packKey ?? publishDraft.packKey} published`,
        result
          ? {
              description: `${result.userProperties} user properties, ${result.componentConfigurations} component configs, ${result.templates} templates, ${result.segments} segments, ${result.journeys} journeys.`,
            }
          : undefined
      );
      await Promise.all([mutateProvision(), mutatePublish()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish Dittofeed pack");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <SuperAdminSurface>
      <div className="border-b border-slate-200/80 px-6 py-5 dark:border-slate-700">
        <SuperAdminSectionHeading
          eyebrow="Messaging Control Plane"
          title="Dittofeed"
          description={summaryText}
          action={
            <Button
              variant="outline"
              onClick={() => void Promise.all([mutateProvision(), mutatePublish()])}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          }
        />
      </div>

      <div className="space-y-6 px-6 py-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SuperAdminInlineStat
            label="Workspace"
            value={provider?.workspaceName ?? provider?.workspaceId ?? "Not provisioned"}
          />
          <SuperAdminInlineStat
            label="Admin API key"
            value={formatPresence(adminKeyReady)}
            tone={adminKeyReady ? "success" : "warning"}
          />
          <SuperAdminInlineStat
            label="SMS webhook"
            value={formatPresence(webhookReady)}
            tone={webhookReady ? "success" : "warning"}
          />
          <SuperAdminInlineStat
            label="Managed email"
            value={formatPresence(managedEmailReady)}
            tone={managedEmailReady ? "success" : "warning"}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-slate-700">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Provider State
                </div>
                <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">
                  Current Dittofeed configuration
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={workspaceReady ? "secondary" : "outline"}>
                  {workspaceReady ? "Ready" : "Not ready"}
                </Badge>
                <Badge variant={provider?.isActive ? "default" : "secondary"}>
                  {provider?.isActive ? "Active" : "Inactive"}
                </Badge>
                <Badge variant={provider?.mode === "disabled" ? "destructive" : "outline"}>
                  {provider?.mode ?? "agency_managed"}
                </Badge>
              </div>
            </div>

            {isProvisionLoading || isPublishLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <StateRow label="Workspace ID" value={provider?.workspaceId ?? "Missing"} />
                <StateRow label="Write key" value={writeKeyReady ? "Stored" : "Missing"} />
                <StateRow label="Workspace name" value={provider?.workspaceName ?? "Missing"} />
                <StateRow label="External ID" value={provider?.externalId ?? "Missing"} />
                <StateRow label="Base URL" value={provider?.baseUrl ?? "Missing"} />
                <StateRow label="Managed Resend key" value={providerSecretPresent(provider, "resendApiKey") ? "Stored" : "Missing"} />
                <StateRow label="Resend webhook key" value={providerSecretPresent(provider, "resendWebhookKey") ? "Stored" : "Missing"} />
                <StateRow
                  label="Validation"
                  value={
                    provider?.validation?.isValid === false
                      ? `Missing ${(provider.validation?.missing ?? []).join(", ")}`
                      : "Valid"
                  }
                />
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-slate-700">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              Baseline Pack
            </div>
            <div className="mt-1 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {selectedPack?.name ?? "Church Messaging Baseline"}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {selectedPack?.description ?? "Publish the starter Dittofeed setup for this organization."}
                </p>
              </div>
              <Sparkles className="mt-1 h-5 w-5 text-lime-500" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StateRow label="User properties" value={selectedPack?.resourceCounts.userProperties ?? 0} />
              <StateRow label="Component configs" value={selectedPack?.resourceCounts.componentConfigurations ?? 0} />
              <StateRow label="Templates" value={selectedPack?.resourceCounts.templates ?? 0} />
              <StateRow label="Journeys" value={selectedPack?.resourceCounts.journeys ?? 0} />
            </div>

            <div className="mt-4 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <Webhook className="h-4 w-4 text-lime-500" />
                Managed email publishing
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Uses the Dittofeed admin API key plus the managed Resend key stored on the provider.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Switch
                  checked={publishDraft.configureManagedEmail}
                  onCheckedChange={(checked) =>
                    setPublishDraft((current) => ({ ...current, configureManagedEmail: checked }))
                  }
                />
                <Label className="text-sm font-medium">Include managed email</Label>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-slate-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Provision
                </div>
                <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">
                  Provision or update workspace secrets
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Creates the Dittofeed child workspace if needed, then stores the admin API key and webhook secret.
                </p>
              </div>
              <Badge variant="outline">POST /provision</Badge>
            </div>

            <div className="mt-4 grid gap-4">
              <Field
                label="Workspace name"
                value={provisionDraft.workspaceName}
                onChange={(value) =>
                  setProvisionDraft((current) => ({ ...current, workspaceName: value }))
                }
                placeholder={provisionData?.organization.name ?? "Organization name"}
              />
              <Field
                label="External ID"
                value={provisionDraft.externalId}
                onChange={(value) =>
                  setProvisionDraft((current) => ({ ...current, externalId: value }))
                }
                placeholder={provisionData?.organization.id ?? "Organization ID"}
              />
              <Field
                label="Admin API key"
                value={provisionDraft.adminApiKey}
                onChange={(value) =>
                  setProvisionDraft((current) => ({ ...current, adminApiKey: value }))
                }
                placeholder="Bearer admin key"
                secret
              />
              <Field
                label="SMS webhook secret"
                value={provisionDraft.smsWebhookSecret}
                onChange={(value) =>
                  setProvisionDraft((current) => ({ ...current, smsWebhookSecret: value }))
                }
                placeholder="Shared gateway secret"
                secret
              />

              <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/40">
                <Switch
                  checked={provisionDraft.configureManagedEmail}
                  onCheckedChange={(checked) =>
                    setProvisionDraft((current) => ({ ...current, configureManagedEmail: checked }))
                  }
                />
                <div>
                  <Label className="text-sm font-medium">Configure managed email during provisioning</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Requires a stored Resend API key on the Dittofeed provider.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button disabled={isProvisioning} onClick={handleProvision}>
                  {isProvisioning ? "Provisioning..." : "Provision workspace"}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 p-4 dark:border-slate-700">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Publish
                </div>
                <h3 className="mt-1 text-base font-black text-slate-900 dark:text-white">
                  Publish baseline pack
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Pushes the starter resources into the workspace and optionally wires the managed email provider.
                </p>
              </div>
              <Badge variant="outline">POST /publish</Badge>
            </div>

            <div className="mt-4 grid gap-4">
              <div>
                <Label>Template pack</Label>
                <Select
                  value={publishDraft.packKey}
                  onValueChange={(value) =>
                    setPublishDraft((current) => ({ ...current, packKey: value }))
                  }
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select a pack" />
                  </SelectTrigger>
                  <SelectContent>
                    {(publishData?.catalog ?? []).map((pack) => (
                      <SelectItem key={pack.key} value={pack.key}>
                        {pack.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {selectedPack?.description ?? "Choose the baseline pack for this workspace."}
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/40">
                <Switch
                  checked={publishDraft.configureManagedEmail}
                  onCheckedChange={(checked) =>
                    setPublishDraft((current) => ({ ...current, configureManagedEmail: checked }))
                  }
                />
                <div>
                  <Label className="text-sm font-medium">Include managed email</Label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {providerSecretPresent(provider, "resendApiKey")
                      ? "Will use the stored Resend API key during publishing."
                      : "Turn this on only after provisioning stores the managed Resend secret."}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-950/40">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Requirements</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <RequirementBadge label="Workspace" ok={Boolean(provider?.workspaceId)} />
                  <RequirementBadge label="Admin API key" ok={publishData?.adminApiKeyConfigured ?? false} />
                  <RequirementBadge label="Workspace active" ok={Boolean(provider?.isActive)} />
                  <RequirementBadge label="Managed Resend key" ok={providerSecretPresent(provider, "resendApiKey")} />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  disabled={isPublishing || !publishData?.workspaceId || !publishData?.adminApiKeyConfigured}
                  onClick={handlePublish}
                >
                  {isPublishing ? "Publishing..." : "Publish pack"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SuperAdminSurface>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  secret = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  secret?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-1.5"
        type={secret ? "password" : "text"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function StateRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/40">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

function RequirementBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/50">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <Badge variant={ok ? "secondary" : "destructive"}>{ok ? "Ready" : "Missing"}</Badge>
    </div>
  );
}
