import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify HMAC-SHA256 webhook signature.
 * Returns true if the signature is valid.
 */
export function verifyHmacSha256(
  payload: string | Buffer,
  signatureHeader: string,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false;

  try {
    const expected = createHmac("sha256", secret)
      .update(typeof payload === "string" ? payload : payload)
      .digest("hex");

    // Strip common prefixes like "sha256=" if present
    const provided = signatureHeader.replace(/^sha256=/, "");

    if (expected.length !== provided.length) return false;

    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(provided, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Verify a webhook request with an API key header.
 * Returns true if the key matches.
 */
export function verifyApiKey(
  headerValue: string | null,
  expectedKey: string
): boolean {
  if (!headerValue || !expectedKey) return false;

  try {
    return timingSafeEqual(
      Buffer.from(headerValue),
      Buffer.from(expectedKey)
    );
  } catch {
    return false;
  }
}
