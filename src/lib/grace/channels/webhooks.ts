import crypto from "crypto";

export function verifyWebhookSignature(payload: string, signature: string | null, secret?: string) {
  if (!secret) return true;
  if (!signature) return false;

  const hash = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

const rateMap = new Map<string, { count: number; ts: number }>();

export function rateLimitKeyed(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const existing = rateMap.get(key);

  if (!existing || now - existing.ts > windowMs) {
    rateMap.set(key, { count: 1, ts: now });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  existing.count += 1;
  rateMap.set(key, existing);
  return true;
}
