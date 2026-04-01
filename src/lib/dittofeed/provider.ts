import { db } from "@/db";
import { providerConfigs } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  decryptValue,
  isEncryptedValue,
  normalizeAndEncryptProviderConfig,
  redactProviderConfigForClient,
} from "@/lib/grace/providers/security";

export const DITTOFEED_PROVIDER_CHANNEL = "messaging";
export const DITTOFEED_PROVIDER_NAME = "dittofeed";

const SECRET_FIELDS = [
  "writeKey",
  "adminApiKey",
  "smsWebhookSecret",
  "resendApiKey",
  "resendWebhookKey",
] as const;

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function decryptConfig(
  config: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const source = config ?? {};
  const decrypted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (
      typeof value === "string" &&
      SECRET_FIELDS.includes(key as (typeof SECRET_FIELDS)[number]) &&
      isEncryptedValue(value)
    ) {
      decrypted[key] = decryptValue(value);
      continue;
    }
    decrypted[key] = value;
  }

  return decrypted;
}

export type ResolvedDittofeedProvider = {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  workspaceName: string | null;
  externalId: string | null;
  writeKey: string | null;
  adminApiKey: string | null;
  baseUrl: string;
  smsWebhookSecret: string | null;
  resendApiKey: string | null;
  resendWebhookKey: string | null;
  mode: "agency_managed" | "byo" | "disabled";
  isActive: boolean;
  rawConfig: Record<string, unknown>;
};

function resolveRow(
  row: typeof providerConfigs.$inferSelect
): ResolvedDittofeedProvider {
  const decrypted = decryptConfig(row.configJson);

  return {
    id: row.id,
    organizationId: row.organizationId,
    workspaceId: getString(decrypted.workspaceId),
    workspaceName: getString(decrypted.workspaceName),
    externalId: getString(decrypted.externalId),
    writeKey: getString(decrypted.writeKey),
    adminApiKey: getString(decrypted.adminApiKey),
    baseUrl:
      getString(decrypted.baseUrl) ??
      getString(process.env.DITTOFEED_BASE_URL) ??
      "https://app.dittofeed.com",
    smsWebhookSecret:
      getString(decrypted.smsWebhookSecret) ??
      getString(process.env.DITTOFEED_SMS_WEBHOOK_SECRET),
    resendApiKey:
      getString(decrypted.resendApiKey) ??
      getString(process.env.DITTOFEED_MANAGED_RESEND_API_KEY) ??
      getString(process.env.RESEND_API_KEY),
    resendWebhookKey:
      getString(decrypted.resendWebhookKey) ??
      getString(process.env.DITTOFEED_MANAGED_RESEND_WEBHOOK_KEY),
    mode: row.mode,
    isActive: row.isActive,
    rawConfig: decrypted,
  };
}

export async function getDittofeedProviderRowForOrganization(
  organizationId: string
) {
  const [row] = await db
    .select()
    .from(providerConfigs)
    .where(
      and(
        eq(providerConfigs.organizationId, organizationId),
        eq(providerConfigs.channel, DITTOFEED_PROVIDER_CHANNEL),
        eq(providerConfigs.provider, DITTOFEED_PROVIDER_NAME)
      )
    )
    .limit(1);

  return row ?? null;
}

export async function resolveDittofeedProviderForOrganization(
  organizationId: string
) {
  const provider = await resolveDittofeedProviderForOrganizationAnyState(organizationId);
  if (!provider || provider.mode === "disabled" || !provider.isActive) {
    return null;
  }
  return provider;
}

export async function resolveDittofeedProviderForOrganizationAnyState(
  organizationId: string
) {
  const row = await getDittofeedProviderRowForOrganization(organizationId);
  return row ? resolveRow(row) : null;
}

export async function resolveDittofeedProviderByWorkspaceId(workspaceId: string) {
  const [row] = await db
    .select()
    .from(providerConfigs)
    .where(
      and(
        eq(providerConfigs.channel, DITTOFEED_PROVIDER_CHANNEL),
        eq(providerConfigs.provider, DITTOFEED_PROVIDER_NAME),
        eq(providerConfigs.isActive, true),
        sql`${providerConfigs.configJson} ->> 'workspaceId' = ${workspaceId}`
      )
    )
    .limit(1);

  if (!row || row.mode === "disabled") {
    return null;
  }

  return resolveRow(row);
}

export async function upsertDittofeedProviderConfig(params: {
  organizationId: string;
  configJson: Record<string, unknown>;
  mode?: "agency_managed" | "disabled";
  isActive?: boolean;
}) {
  const existing = await getDittofeedProviderRowForOrganization(params.organizationId);
  const mode = params.mode ?? "agency_managed";
  const normalized = normalizeAndEncryptProviderConfig({
    channel: DITTOFEED_PROVIDER_CHANNEL,
    provider: DITTOFEED_PROVIDER_NAME,
    mode,
    incoming: params.configJson,
    existing: existing?.configJson ?? {},
  });

  const nextIsActive = mode === "disabled" ? false : (params.isActive ?? true);

  if (existing) {
    const [updated] = await db
      .update(providerConfigs)
      .set({
        mode,
        isActive: nextIsActive,
        configJson: normalized.configJson,
        updatedAt: new Date(),
      })
      .where(eq(providerConfigs.id, existing.id))
      .returning();

    return updated;
  }

  const [created] = await db
    .insert(providerConfigs)
    .values({
      organizationId: params.organizationId,
      channel: DITTOFEED_PROVIDER_CHANNEL,
      provider: DITTOFEED_PROVIDER_NAME,
      mode,
      isActive: nextIsActive,
      configJson: normalized.configJson,
    })
    .returning();

  return created;
}

export async function getRedactedDittofeedProviderForClient(organizationId: string) {
  const row = await getDittofeedProviderRowForOrganization(organizationId);
  if (!row) return null;

  const redacted = redactProviderConfigForClient({
    channel: row.channel,
    provider: row.provider,
    config: row.configJson ?? {},
    mode: row.mode,
  });

  return {
    ...row,
    configJson: redacted.configJson,
    secretStatus: redacted.secretStatus,
    validation: redacted.validation,
  };
}
