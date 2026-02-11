import crypto from "crypto";

type ProviderMode = "agency_managed" | "byo" | "disabled";

type ProviderRule = {
  required: string[];
  secret: string[];
};

const byoAllowedChannels = new Set(["email", "slack", "telegram"]);

const ENCRYPTED_PREFIX = "enc:v1";

const providerRules: Record<string, ProviderRule> = {
  "sms:textbee": {
    required: ["apiKey", "baseUrl"],
    secret: ["apiKey", "webhookSecret"],
  },
  "voice:retell": {
    required: ["apiKey"],
    secret: ["apiKey", "webhookSecret"],
  },
  "email:sendgrid": {
    required: ["apiKey", "fromEmail"],
    secret: ["apiKey"],
  },
  "email:managed": {
    required: [],
    secret: [],
  },
};

function getEncryptionKey() {
  const source = process.env.GRACE_PROVIDER_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!source) {
    throw new Error("Missing GRACE_PROVIDER_ENCRYPTION_KEY or AUTH_SECRET");
  }
  return crypto.createHash("sha256").update(source).digest();
}

export function isEncryptedValue(value: unknown) {
  return typeof value === "string" && value.startsWith(`${ENCRYPTED_PREFIX}:`);
}

export function encryptValue(plainText: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENCRYPTED_PREFIX}:${iv.toString("base64url")}:${encrypted.toString("base64url")}:${tag.toString("base64url")}`;
}

function getRule(channel: string, provider: string): ProviderRule {
  return providerRules[`${channel}:${provider}`] ?? { required: [], secret: [] };
}

function hasValue(value: unknown) {
  return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
}

export function normalizeAndEncryptProviderConfig(input: {
  channel: string;
  provider: string;
  mode: ProviderMode;
  incoming?: Record<string, unknown>;
  existing?: Record<string, unknown> | null;
}) {
  const rule = getRule(input.channel, input.provider);
  const merged: Record<string, unknown> = { ...(input.existing ?? {}) };
  const incoming = input.incoming ?? {};

  for (const [key, value] of Object.entries(incoming)) {
    if (rule.secret.includes(key)) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      merged[key] = isEncryptedValue(trimmed) ? trimmed : encryptValue(trimmed);
      continue;
    }

    if (typeof value === "string") {
      merged[key] = value.trim();
    } else {
      merged[key] = value;
    }
  }

  const missing =
    input.mode === "byo"
      ? rule.required.filter((field) => {
          const value = merged[field];
          if (!hasValue(value)) return true;
          if (!rule.secret.includes(field)) return false;
          if (typeof value !== "string") return true;
          return !isEncryptedValue(value) && value.trim().length === 0;
        })
      : [];

  return {
    configJson: merged,
    validation: {
      isValid: missing.length === 0,
      missing,
    },
  };
}

export function isByoAllowedForChannel(channel: string) {
  return byoAllowedChannels.has(channel);
}

export function redactProviderConfigForClient(input: {
  channel: string;
  provider: string;
  config?: Record<string, unknown> | null;
  mode: ProviderMode;
}) {
  const rule = getRule(input.channel, input.provider);
  const source = input.config ?? {};
  const visible: Record<string, unknown> = {};
  const secretStatus: Record<string, boolean> = {};

  for (const [key, value] of Object.entries(source)) {
    if (rule.secret.includes(key)) {
      secretStatus[key] =
        typeof value === "string" && (isEncryptedValue(value) || value.trim().length > 0);
      continue;
    }
    visible[key] = value;
  }

  const validation = normalizeAndEncryptProviderConfig({
    channel: input.channel,
    provider: input.provider,
    mode: input.mode,
    existing: source,
  }).validation;

  return {
    configJson: visible,
    secretStatus,
    validation,
  };
}
