import crypto from "crypto";

export function verifyWebhookSignature(payload: string, signature: string | null, secret?: string) {
  if (!secret) {
    // Fail closed unless explicitly overridden for local diagnostics.
    return process.env.GRACE_ALLOW_INSECURE_WEBHOOKS === "true";
  }
  if (!signature) return false;

  const hash = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const hashBuf = Buffer.from(hash, "hex");
  // Decode signature from hex so both buffers are always the same byte length.
  // timingSafeEqual throws when lengths differ, so we must guard that here.
  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  if (hashBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(hashBuf, sigBuf);
}

const rateMap = new Map<string, { count: number; ts: number }>();

function rateLimitLocal(key: string, limit = 60, windowMs = 60_000) {
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

async function rateLimitUpstash(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return rateLimitLocal(key, limit, windowMs);
  }

  const redisKey = `grace:ratelimit:${key}`;

  try {
    const response = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PEXPIRE", redisKey, windowMs, "NX"],
      ]),
    });

    if (!response.ok) {
      throw new Error(`Upstash pipeline failed (${response.status})`);
    }

    const payload = (await response.json()) as Array<{ result?: unknown }>;
    const current = Number(payload?.[0]?.result ?? 0);
    if (Number.isNaN(current)) return false;
    return current <= limit;
  } catch (error) {
    console.error("[RateLimit] Upstash unavailable, falling back to local map:", error);
    return rateLimitLocal(key, limit, windowMs);
  }
}

export async function rateLimitKeyed(
  key: string,
  limit = 60,
  windowMs = 60_000
): Promise<boolean> {
  return rateLimitUpstash(key, limit, windowMs);
}
