import { NextResponse } from "next/server";
import { resetPasswordConfirmSchema } from "@/lib/validations/auth.schema";
import { decryptJson, TokenValidationError } from "@/lib/encryption/edge-jwt";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/db";
import { users } from "@/db/schema/user";
import { sql } from "drizzle-orm";
import { rateLimitKeyed } from "@/lib/grace/channels/webhooks";
import { getClientIp } from "@/lib/security/request";

// Force Node.js runtime for argon2 support
export const runtime = "nodejs";

interface ResetPasswordToken {
  email: string;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!(await rateLimitKeyed(`auth:reset-password-confirm:${ip}`, 10, 15 * 60_000))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const { token, password, confirmPassword } = body;

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Validate password
    const validation = resetPasswordConfirmSchema.safeParse({
      password,
      confirmPassword,
    });
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400 }
      );
    }

    // Decrypt and validate token
    const resetToken = await decryptJson<ResetPasswordToken>(token, {
      purpose: "reset-password",
    });
    const normalizedEmail = resetToken.email.trim().toLowerCase();

    // Check if user exists
    const existingUser = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        password: users.password,
      })
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1)
      .then((users) => users[0]);

    if (!existingUser) {
      return NextResponse.json({
        success: true,
        message: "Password reset successfully",
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update user password
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(sql`lower(${users.email}) = ${normalizedEmail}`);

    return NextResponse.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    if (error instanceof TokenValidationError) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 400 }
      );
    }
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "Failed to reset password. Token may be invalid or expired." },
      { status: 500 }
    );
  }
}
