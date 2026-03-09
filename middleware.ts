import { proxy } from "./src/proxy";

export const middleware = proxy;

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
