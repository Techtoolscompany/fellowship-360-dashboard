import { NextResponse } from "next/server";
import { auth } from "./auth";
import type { NextRequest } from "next/server";
import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import { applyRateLimit, getRateLimitHeaders } from "@/lib/rate-limiter";

const { rewrite: rewriteLLM } = rewritePath("/docs/*path", "/llms.mdx/*path");

// ── Security Headers applied to all responses ──
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

function secureNext(): NextResponse {
  return applySecurityHeaders(NextResponse.next());
}

export async function proxy(req: NextRequest) {
  // ── Rate limiting for API routes ──
  if (req.nextUrl.pathname.startsWith("/api")) {
    const rateLimitResponse = await applyRateLimit(req);
    if (rateLimitResponse) return applySecurityHeaders(rateLimitResponse);
  }

  if (isMarkdownPreferred(req)) {
    const result = rewriteLLM(req.nextUrl.pathname);
    if (result) {
      return applySecurityHeaders(
        NextResponse.rewrite(new URL(result, req.nextUrl))
      );
    }
  }

  const session = await auth();
  const isAuth = !!session?.user;

  const isAuthPage =
    req.nextUrl.pathname.startsWith("/sign-in") ||
    req.nextUrl.pathname.startsWith("/sign-up") ||
    req.nextUrl.pathname.startsWith("/sign-out");

  if (isAuthPage) {
    return secureNext();
  }

  if (req.nextUrl.pathname.startsWith("/app")) {
    if (!isAuth) {
      let callbackUrl = req.nextUrl.pathname;
      if (req.nextUrl.search) {
        callbackUrl += req.nextUrl.search;
      }
      return applySecurityHeaders(
        NextResponse.redirect(
          new URL(
            `/sign-in?error=unauthorized&callbackUrl=${encodeURIComponent(callbackUrl)}`,
            req.url
          )
        )
      );
    }
    return secureNext();
  }
  
  // ── Auth-gated internal API routes ──
  const isAppAPI = req.nextUrl.pathname.startsWith("/api/app");
  const isGraceAPI = req.nextUrl.pathname.startsWith("/api/grace");
  const isElevenLabsAPI = req.nextUrl.pathname.startsWith("/api/elevenlabs");

  if (isAppAPI || isGraceAPI || isElevenLabsAPI) {
    if (!isAuth) {
      return applySecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }
    const response = secureNext();
    const headers = getRateLimitHeaders(req);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
    return response;
  }

  // ── Webhook routes: no session auth (validated by signature in handler) ──
  if (req.nextUrl.pathname.startsWith("/api/webhooks") ||
      req.nextUrl.pathname.startsWith("/api/sms-gateway")) {
    const response = secureNext();
    const headers = getRateLimitHeaders(req);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
    return response;
  }

  if (req.nextUrl.pathname.startsWith("/super-admin")) {
    const email = session?.user?.email;
    if (!email) {
      return applySecurityHeaders(
        NextResponse.redirect(
          new URL("/sign-in?error=unauthorized", req.url)
        )
      );
    }
    const isSuperAdmin =
      process.env.SUPER_ADMIN_EMAILS?.split(",").includes(email);
    const hasAccess = isSuperAdmin && !!email;

    if (!hasAccess) {
      return applySecurityHeaders(
        NextResponse.redirect(
          new URL("/sign-in?error=unauthorized", req.url)
        )
      );
    }
    // Allow access to super admin pages
    return secureNext();
  }

  if (req.nextUrl.pathname.startsWith("/api")) {
    const response = secureNext();
    const headers = getRateLimitHeaders(req);
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
    return response;
  }

  return secureNext();
}

export const config = {
  matcher: [
    "/docs/:path*",
    "/api/:path*",
    "/app/:path*",
    "/sign-in",
    "/sign-up",
    "/sign-out",
    "/super-admin/:path*",
  ],
};
