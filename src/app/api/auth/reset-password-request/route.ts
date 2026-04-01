import { NextRequest, NextResponse } from "next/server";
import { resetPasswordRequestSchema } from "@/lib/validations/auth.schema";
import { encryptJson } from "@/lib/encryption/edge-jwt";
import { render } from "@react-email/components";
import ResetPasswordEmail from "@/emails/ResetPasswordEmail";
import sendMail from "@/lib/email/sendMail";
import { appConfig } from "@/lib/config";
import { db } from "@/db";
import { users } from "@/db/schema/user";
import { sql } from "drizzle-orm";
import { rateLimitKeyed } from "@/lib/grace/channels/webhooks";
import { getClientIp } from "@/lib/security/request";
import { resolveAppUrl } from "@/lib/security/app-url";

interface ResetPasswordToken {
  email: string;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!(await rateLimitKeyed(`auth:reset-password:${ip}`, 5, 15 * 60_000))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const validation = resetPasswordRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { email } = validation.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user exists and has a password (password-based account)
    const existingUser = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1)
      .then((users) => users[0]);

    const appUrl = resolveAppUrl(request);
    if (!appUrl) {
      console.error("[reset-password-request] App URL not configured");
      return NextResponse.json(
        { error: "Authentication is temporarily unavailable" },
        { status: 503 }
      );
    }

    // Always return success to prevent email enumeration
    // But only send email if user exists and has password auth enabled
    if (existingUser && appConfig.auth?.enablePasswordAuth) {
      // Create reset token
      const resetToken: ResetPasswordToken = {
        email: normalizedEmail,
      };

      const token = await encryptJson(resetToken, {
        purpose: "reset-password",
        expiresIn: "30m",
      });

      // Generate reset password URL
      const resetPasswordUrl = new URL("/reset-password/confirm", appUrl);
      resetPasswordUrl.searchParams.append("token", token);

      // Send email
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      const html = await render(
        ResetPasswordEmail({ url: resetPasswordUrl.toString(), expiresAt })
      );

      await sendMail(
        normalizedEmail,
        `Reset your ${appConfig.projectName} password`,
        html
      );
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, you will receive a password reset link",
    });
  } catch (error) {
    console.error("Error in reset password request:", error);
    return NextResponse.json(
      { error: "Failed to process reset password request" },
      { status: 500 }
    );
  }
}
