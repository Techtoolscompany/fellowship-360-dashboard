import { NextResponse } from "next/server";
import { auth } from "./auth";
import type { NextRequest } from "next/server";
import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
const { rewrite: rewriteLLM } = rewritePath("/docs/*path", "/llms.mdx/*path");

export async function proxy(req: NextRequest) {
  if (isMarkdownPreferred(req)) {
    const result = rewriteLLM(req.nextUrl.pathname);
    if (result) {
      return NextResponse.rewrite(new URL(result, req.nextUrl));
    }
  }

  const session = await auth();
  const isAuth = !!session?.user;

  const isAuthPage =
    req.nextUrl.pathname.startsWith("/sign-in") ||
    req.nextUrl.pathname.startsWith("/sign-up") ||
    req.nextUrl.pathname.startsWith("/sign-out");

  if (isAuthPage) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/app")) {
    if (!isAuth) {
      let callbackUrl = req.nextUrl.pathname;
      if (req.nextUrl.search) {
        callbackUrl += req.nextUrl.search;
      }
      return NextResponse.redirect(
        new URL(
          `/sign-in?error=unauthorized&callbackUrl=${encodeURIComponent(callbackUrl)}`,
          req.url
        )
      );
    }
    return NextResponse.next();
  }
  const isAPI = req.nextUrl.pathname.startsWith("/api/app");

  if (isAPI) {
    if (!isAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/super-admin")) {
    const email = session?.user?.email;
    if (!email) {
      return NextResponse.redirect(
        new URL("/sign-in?error=unauthorized", req.url)
      );
    }
    const isSuperAdmin =
      process.env.SUPER_ADMIN_EMAILS?.split(",").includes(email);
    const hasAccess = isSuperAdmin && !!email;

    if (!hasAccess) {
      return NextResponse.redirect(
        new URL("/sign-in?error=unauthorized", req.url)
      );
    }
    // Allow access to super admin pages
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/docs/:path*",
    "/api/app/:path*",
    "/app/:path*",
    "/sign-in",
    "/sign-up",
    "/sign-out",
    "/super-admin/:path*",
  ],
};
