const WEAK_AUTH_SECRET_SUBSTRINGS = [
  "change-in-production",
  "super-secret",
  "replace-me",
  "changeme",
] as const;

const PLACEHOLDER_CRON_USERNAMES = new Set(["your_cron_username"]);
const PLACEHOLDER_CRON_PASSWORDS = new Set(["your_secure_password"]);

function normalizeEnvValue(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function isLocalOrPrivateHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return false;

  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".local")
  ) {
    return true;
  }

  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return true;
  }

  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(normalized)) {
    return true;
  }

  const private172Match = normalized.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (private172Match) {
    const secondOctet = Number(private172Match[1]);
    return secondOctet >= 16 && secondOctet <= 31;
  }

  return false;
}

export function isProductionEnvironment(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === "production";
}

export function isWeakAuthSecret(value: string | null | undefined) {
  const normalized = normalizeEnvValue(value);
  if (!normalized) return true;
  if (normalized.length < 32) return true;

  const lower = normalized.toLowerCase();
  return WEAK_AUTH_SECRET_SUBSTRINGS.some((token) => lower.includes(token));
}

export function assertStrongSecretInProduction(
  name: string,
  value: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env
) {
  const normalized = normalizeEnvValue(value);
  if (!isProductionEnvironment(env)) {
    return normalized;
  }

  if (!normalized) {
    throw new Error(`${name} must be configured in production.`);
  }

  if (isWeakAuthSecret(normalized)) {
    throw new Error(`${name} is using a default or weak value and must be rotated before production.`);
  }

  return normalized;
}

export function requireConfiguredSecret(
  name: string,
  value: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env
) {
  const normalized = normalizeEnvValue(value);
  if (!normalized) {
    throw new Error(`${name} environment variable is not set`);
  }

  assertStrongSecretInProduction(name, normalized, env);
  return normalized;
}

export function isPlaceholderCronUsername(value: string | null | undefined) {
  return PLACEHOLDER_CRON_USERNAMES.has(normalizeEnvValue(value));
}

export function isPlaceholderCronPassword(value: string | null | undefined) {
  return PLACEHOLDER_CRON_PASSWORDS.has(normalizeEnvValue(value));
}

export function hasDistributedRateLimitConfig(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    normalizeEnvValue(env.UPSTASH_REDIS_REST_URL) &&
      normalizeEnvValue(env.UPSTASH_REDIS_REST_TOKEN)
  );
}

export function isLocalOrPrivateAppOrigin(env: NodeJS.ProcessEnv = process.env) {
  for (const key of ["AUTH_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"] as const) {
    const raw = normalizeEnvValue(env[key]);
    if (!raw) continue;

    try {
      const parsed = new URL(raw);
      if (isLocalOrPrivateHostname(parsed.hostname)) {
        return true;
      }
    } catch {
      continue;
    }
  }

  return false;
}

export function resolveServerActionAllowedOrigins(env: NodeJS.ProcessEnv = process.env) {
  const hosts = new Set<string>();

  for (const key of ["AUTH_URL", "NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"] as const) {
    const raw = normalizeEnvValue(env[key]);
    if (!raw) continue;

    try {
      const parsed = new URL(raw);
      if (parsed.host) {
        hosts.add(parsed.host);
      }
    } catch {
      continue;
    }
  }

  return [...hosts];
}
