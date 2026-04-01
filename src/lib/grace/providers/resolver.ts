import { db } from "@/db";
import { providerConfigs } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { decryptValue, isEncryptedValue } from "./security";

export type ResolvedSmsProvider = {
  apiKey: string;
  baseUrl: string;
};

export type ResolvedEmailProvider =
  | { mode: "disabled" }
  | { mode: "managed" }
  | { mode: "sendgrid"; apiKey: string; fromEmail: string };

function getStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function decryptConfigFields(
  config: Record<string, unknown>,
  secretFields: string[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(config)) {
    if (typeof value !== "string") continue;
    result[key] =
      secretFields.includes(key) && isEncryptedValue(value)
        ? decryptValue(value)
        : value;
  }
  return result;
}

async function getActiveProviderRow(params: {
  organizationId: string;
  channel: string;
  provider?: string;
}) {
  const clauses = [
    eq(providerConfigs.organizationId, params.organizationId),
    eq(providerConfigs.channel, params.channel),
    eq(providerConfigs.isActive, true),
  ];
  if (params.provider) {
    clauses.push(eq(providerConfigs.provider, params.provider));
  }

  const [row] = await db
    .select()
    .from(providerConfigs)
    .where(and(...clauses))
    .orderBy(desc(providerConfigs.updatedAt))
    .limit(1);

  return row;
}

async function getLatestProviderRow(params: {
  organizationId: string;
  channel: string;
  provider?: string;
}) {
  const clauses = [
    eq(providerConfigs.organizationId, params.organizationId),
    eq(providerConfigs.channel, params.channel),
  ];
  if (params.provider) {
    clauses.push(eq(providerConfigs.provider, params.provider));
  }

  const [row] = await db
    .select()
    .from(providerConfigs)
    .where(and(...clauses))
    .orderBy(desc(providerConfigs.updatedAt))
    .limit(1);

  return row;
}

/**
 * Returns decrypted SMS credentials for the org.
 * Platform-managed orgs may use per-org stored credentials, with env fallback.
 * Returns null if SMS is disabled or not configured.
 */
export async function resolveSmsProvider(
  organizationId: string
): Promise<ResolvedSmsProvider | null> {
  const latestRow = await getLatestProviderRow({
    organizationId,
    channel: "sms",
    provider: "textbee",
  });
  if (latestRow?.mode === "disabled") return null;

  const row = await getActiveProviderRow({
    organizationId,
    channel: "sms",
    provider: "textbee",
  });

  if (row?.mode === "disabled") return null;

  const config = decryptConfigFields(row?.configJson ?? {}, ["apiKey", "webhookSecret"]);
  const apiKey = getStringOrNull(config.apiKey) ?? getStringOrNull(process.env.TEXTBEE_API_KEY);
  const baseUrl =
    getStringOrNull(config.baseUrl) ?? getStringOrNull(process.env.TEXTBEE_BASE_URL);

  return apiKey && baseUrl ? { apiKey, baseUrl } : null;
}

/**
 * Returns email provider config for the org.
 * Returns { mode: "managed" } when using the platform's shared mailer.
 * Returns { mode: "sendgrid", ... } when this org has stored managed SendGrid credentials.
 */
export async function resolveEmailProvider(
  organizationId: string
): Promise<ResolvedEmailProvider> {
  const latestRow = await getLatestProviderRow({
    organizationId,
    channel: "email",
  });
  if (latestRow?.mode === "disabled") {
    return { mode: "disabled" };
  }

  const row = await getActiveProviderRow({
    organizationId,
    channel: "email",
  });

  const config = decryptConfigFields(row.configJson ?? {}, ["apiKey"]);
  const apiKey = getStringOrNull(config.apiKey);
  const fromEmail = getStringOrNull(config.fromEmail);

  if (!apiKey || !fromEmail) return { mode: "managed" };
  return { mode: "sendgrid", apiKey, fromEmail };
}

/**
 * Resolve Gemini API key for a specific organization.
 * Prefers active org provider config and falls back to env.
 * Returns null when explicitly disabled or missing.
 */
export async function resolveGeminiApiKey(
  organizationId: string
): Promise<string | null> {
  const latestRow = await getLatestProviderRow({
    organizationId,
    channel: "ai",
    provider: "gemini",
  });
  if (latestRow?.mode === "disabled") return null;

  const row = await getActiveProviderRow({
    organizationId,
    channel: "ai",
    provider: "gemini",
  });

  if (row?.mode === "disabled") return null;

  const config = decryptConfigFields(row?.configJson ?? {}, ["apiKey"]);
  const configuredApiKey = getStringOrNull(config.apiKey);
  if (configuredApiKey) return configuredApiKey;

  const fallback = process.env.GEMINI_API_KEY;
  return getStringOrNull(fallback);
}

export async function resolveElevenLabsApiKey(
  organizationId: string
): Promise<string | null> {
  const latestRow = await getLatestProviderRow({
    organizationId,
    channel: "voice",
    provider: "elevenlabs",
  });
  if (latestRow?.mode === "disabled") return null;

  const row = await getActiveProviderRow({
    organizationId,
    channel: "voice",
    provider: "elevenlabs",
  });

  if (row?.mode === "disabled") return null;

  const config = decryptConfigFields(row?.configJson ?? {}, ["apiKey"]);
  const configuredApiKey = getStringOrNull(config.apiKey);
  if (configuredApiKey) return configuredApiKey;

  return getStringOrNull(process.env.ELEVENLABS_API_KEY);
}

export async function resolveProviderWebhookSecret(params: {
  organizationId: string;
  channel: string;
  provider: string;
  fallbackEnvSecret?: string;
}): Promise<string | null> {
  const latestRow = await getLatestProviderRow({
    organizationId: params.organizationId,
    channel: params.channel,
    provider: params.provider,
  });
  if (latestRow?.mode === "disabled") return null;

  const row = await getActiveProviderRow({
    organizationId: params.organizationId,
    channel: params.channel,
    provider: params.provider,
  });

  if (row?.mode === "disabled") return null;

  const decrypted = decryptConfigFields(row?.configJson ?? {}, ["webhookSecret"]);
  const configuredSecret = getStringOrNull(decrypted.webhookSecret);
  if (configuredSecret) return configuredSecret;

  return getStringOrNull(params.fallbackEnvSecret);
}
