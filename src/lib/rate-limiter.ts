import { NextResponse, type NextRequest } from "next/server";
import { getClientIp } from "@/lib/security/request";
import {
  hasDistributedRateLimitConfig,
  isLocalOrPrivateAppOrigin,
  isProductionEnvironment,
} from "@/lib/security/production-readiness";

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const ROUTE_LIMITS: Record<string, RateLimitConfig> = {
  "/api/webhooks/voice/grace": { maxRequests: 60, windowMs: 60_000 },
  "/api/webhooks/sms/grace": { maxRequests: 60, windowMs: 60_000 },
  "/api/webhooks/inbound-lead": { maxRequests: 60, windowMs: 60_000 },
  "/api/elevenlabs/chat": { maxRequests: 30, windowMs: 60_000 },
  "/api/grace/voice-chat": { maxRequests: 20, windowMs: 60_000 },
  "/api/grace/copilot/chat": { maxRequests: 120, windowMs: 60_000 },
  "/api/grace/actions/execute": { maxRequests: 60, windowMs: 60_000 },
};

const DEFAULT_LIMIT: RateLimitConfig = { maxRequests: 100, windowMs: 60_000 };

interface WindowEntry {
  count: number;
  resetAt: number;
}

const localStore = new Map<string, WindowEntry>();
const headerSnapshot = new Map<string, WindowEntry & { limit: number }>();

let accessCount = 0;
const CLEANUP_INTERVAL = 500;

function cleanupStaleEntries() {
  const now = Date.now();
  for (const [key, entry] of localStore) {
    if (entry.resetAt <= now) {
      localStore.delete(key);
    }
  }
  for (const [key, entry] of headerSnapshot) {
    if (entry.resetAt <= now) {
      headerSnapshot.delete(key);
    }
  }
}

function checkLocalRateLimit(
  key: string,
  config: RateLimitConfig
): { limited: boolean; remaining: number; resetAt: number } {
  accessCount++;
  if (accessCount % CLEANUP_INTERVAL === 0) {
    cleanupStaleEntries();
  }

  const now = Date.now();
  const entry = localStore.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + config.windowMs;
    localStore.set(key, { count: 1, resetAt });
    return {
      limited: false,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }

  entry.count += 1;
  localStore.set(key, entry);

  return {
    limited: entry.count > config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

async function checkUpstashRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<{ limited: boolean; remaining: number; resetAt: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (
      isProductionEnvironment() &&
      !hasDistributedRateLimitConfig() &&
      !isLocalOrPrivateAppOrigin()
    ) {
      throw new Error(
        "Distributed rate limiting requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in production."
      );
    }
    return checkLocalRateLimit(key, config);
  }

  const redisKey = `middleware:ratelimit:${key}`;

  try {
    const response = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PEXPIRE", redisKey, config.windowMs, "NX"],
        ["PTTL", redisKey],
      ]),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Upstash pipeline failed (${response.status})`);
    }

    const payload = (await response.json()) as Array<{ result?: unknown }>;
    const count = Number(payload?.[0]?.result ?? 0);
    const pttl = Number(payload?.[2]?.result ?? config.windowMs);

    if (Number.isNaN(count) || Number.isNaN(pttl)) {
      throw new Error("Invalid Upstash response payload");
    }

    const resetAt = Date.now() + (pttl > 0 ? pttl : config.windowMs);
    return {
      limited: count > config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetAt,
    };
  } catch (error) {
    if (isProductionEnvironment()) {
      console.error("[MiddlewareRateLimit] Upstash Redis unavailable in production:", error);
      throw error;
    }
    console.error("[MiddlewareRateLimit] Upstash unavailable, falling back to local map:", error);
    return checkLocalRateLimit(key, config);
  }
}

function getClientIdentifier(request: NextRequest): string {
  return getClientIp(request);
}

function findRouteConfig(pathname: string): RateLimitConfig {
  if (ROUTE_LIMITS[pathname]) return ROUTE_LIMITS[pathname];

  for (const [route, config] of Object.entries(ROUTE_LIMITS)) {
    if (pathname.startsWith(route)) return config;
  }

  return DEFAULT_LIMIT;
}

function buildRequestRateKey(request: NextRequest) {
  const pathname = new URL(request.url).pathname;
  const clientId = getClientIdentifier(request);
  return `${pathname}::${clientId}`;
}

export async function applyRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const pathname = new URL(request.url).pathname;

  if (!pathname.startsWith("/api/")) return null;

  const config = findRouteConfig(pathname);
  const key = buildRequestRateKey(request);
  let limited: boolean;
  let remaining: number;
  let resetAt: number;

  try {
    ({ limited, remaining, resetAt } = await checkUpstashRateLimit(key, config));
  } catch (error) {
    console.error("[MiddlewareRateLimit] Rejecting request because rate limiting is unavailable:", {
      pathname,
      error,
    });
    return NextResponse.json(
      { error: "Rate limiting is unavailable. Fix Upstash Redis configuration before production use." },
      { status: 503 }
    );
  }

  headerSnapshot.set(key, {
    count: config.maxRequests - remaining,
    resetAt,
    limit: config.maxRequests,
  });

  if (limited) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, retryAfter)),
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        },
      }
    );
  }

  return null;
}

export function getRateLimitHeaders(request: NextRequest): Record<string, string> {
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith("/api/")) return {};

  const key = buildRequestRateKey(request);
  const snapshot = headerSnapshot.get(key);
  if (!snapshot) return {};

  return {
    "X-RateLimit-Limit": String(snapshot.limit),
    "X-RateLimit-Remaining": String(Math.max(0, snapshot.limit - snapshot.count)),
    "X-RateLimit-Reset": String(Math.ceil(snapshot.resetAt / 1000)),
  };
}
