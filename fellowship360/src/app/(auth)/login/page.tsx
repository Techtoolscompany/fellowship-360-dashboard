"use client";

import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      <div className="rounded-card border border-border bg-card p-8">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-400">
            <span className="text-lg font-bold text-[#343330]">F</span>
          </div>
          <span className="text-xl font-semibold text-foreground">
            Fellowship 360
          </span>
        </div>

        <h1 className="mb-2 text-center text-2xl font-semibold text-foreground">
          Welcome back
        </h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Sign in to your account to continue
        </p>

        <form className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-lime-400"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" className="rounded border-border" />
              Remember me
            </label>
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <Link
            href="/home"
            className="flex items-center justify-center rounded-pill bg-[#343330] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#343330]/90"
          >
            Sign In
          </Link>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-foreground hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
