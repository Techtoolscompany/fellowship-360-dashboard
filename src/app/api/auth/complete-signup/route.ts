import { NextResponse } from "next/server";
import { setPasswordSchema } from "@/lib/validations/auth.schema";
import { decryptJson, TokenValidationError } from "@/lib/encryption/edge-jwt";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/db";
import { users } from "@/db/schema/user";
import { sql } from "drizzle-orm";
import onUserCreate from "@/lib/users/onUserCreate";
import { rateLimitKeyed } from "@/lib/grace/channels/webhooks";
import { getClientIp } from "@/lib/security/request";
import { appConfig } from "@/lib/config";

// Force Node.js runtime for argon2 support
export const runtime = "nodejs";

interface SignUpToken {
  name: string;
  email: string;
}

export async function POST(request: Request) {
  try {
    if (!appConfig.auth?.enablePasswordAuth) {
      return NextResponse.json(
        { error: "Password authentication is disabled" },
        { status: 403 }
      );
    }

    const ip = getClientIp(request);
    if (!(await rateLimitKeyed(`auth:complete-signup:${ip}`, 10, 15 * 60_000))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const { token, password, confirmPassword } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 }
      );
    }

    // Validate password
    const validation = setPasswordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400 }
      );
    }

    // Decrypt and validate token
    const signUpToken = await decryptJson<SignUpToken>(token, {
      purpose: "signup",
    });
    const normalizedEmail = signUpToken.email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1)
      .then((users) => users[0]);

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        name: signUpToken.name,
        email: normalizedEmail,
        password: hashedPassword,
        emailVerified: new Date(), // Email is verified through token
      })
      .returning()
      .then((users) => users[0]);

    // Run post-creation hooks (assign default plan, etc.)
    await onUserCreate(newUser);

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
    });
  } catch (error) {
    if (error instanceof TokenValidationError) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }
    console.error("Error completing signup:", error);
    return NextResponse.json(
      { error: "Failed to complete signup. Token may be invalid or expired." },
      { status: 500 }
    );
  }
}
