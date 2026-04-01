type RequestWithHeaders = Pick<Request, "headers">;

const MAX_IDENTIFIER_LENGTH = 100;

function normalizeIdentifier(value: string | null | undefined): string {
  if (!value) return "unknown";
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_IDENTIFIER_LENGTH) {
    return "unknown";
  }
  return normalized;
}

export function getClientIp(request: RequestWithHeaders): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return normalizeIdentifier(forwardedFor.split(",")[0]);
  }

  const fallbackHeaders = [
    "cf-connecting-ip",
    "x-real-ip",
    "x-client-ip",
  ] as const;

  for (const header of fallbackHeaders) {
    const value = request.headers.get(header);
    if (value) return normalizeIdentifier(value);
  }

  return "unknown";
}
