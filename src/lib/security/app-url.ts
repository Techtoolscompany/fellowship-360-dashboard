function normalizeUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function isSecureForEnvironment(value: string): boolean {
  const parsed = new URL(value);
  if (parsed.protocol === "https:") return true;
  return (
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1"
  );
}

export function resolveAppUrl(request?: Request): string | null {
  const configuredCandidates = [
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];

  for (const candidate of configuredCandidates) {
    if (!candidate) continue;
    const normalized = normalizeUrl(candidate);
    if (!normalized) continue;
    if (process.env.NODE_ENV === "production" && !isSecureForEnvironment(normalized)) {
      return null;
    }
    return normalized;
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  if (request?.url) {
    const requestOrigin = normalizeUrl(request.url);
    if (requestOrigin) return requestOrigin;
  }

  return "http://localhost:3000";
}
