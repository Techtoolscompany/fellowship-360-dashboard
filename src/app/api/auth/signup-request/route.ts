import { NextRequest, NextResponse } from "next/server";
import { signUpRequestSchema } from "@/lib/validations/auth.schema";
import { encryptJson } from "@/lib/encryption/edge-jwt";
import { render } from "@react-email/components";
import SignUpEmail from "@/emails/SignUpEmail";
import sendMail from "@/lib/email/sendMail";
import { appConfig } from "@/lib/config";
import { db } from "@/db";
import { users } from "@/db/schema/user";
import { sql } from "drizzle-orm";
import { rateLimitKeyed } from "@/lib/grace/channels/webhooks";
import { getClientIp } from "@/lib/security/request";
import { resolveAppUrl } from "@/lib/security/app-url";

interface SignUpToken {
  name: string;
  email: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!appConfig.auth?.enablePasswordAuth) {
      return NextResponse.json(
        { error: "Password authentication is disabled" },
        { status: 403 }
      );
    }

    const ip = getClientIp(request);
    if (!(await rateLimitKeyed(`auth:signup:${ip}`, 5, 15 * 60_000))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const validation = signUpRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { name, email } = validation.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1)
      .then((users) => users[0]);

    if (existingUser) {
      return NextResponse.json({
        success: true,
        message: "Check your email to complete account setup",
      });
    }

    const appUrl = resolveAppUrl(request);
    if (!appUrl) {
      console.error("[signup-request] App URL not configured");
      return NextResponse.json(
        { error: "Authentication is temporarily unavailable" },
        { status: 503 }
      );
    }

    // Create signup token
    const signUpToken: SignUpToken = {
      name,
      email: normalizedEmail,
    };

    const token = await encryptJson(signUpToken, {
      purpose: "signup",
      expiresIn: "30m",
    });

    // Generate set password URL
    const setPasswordUrl = new URL("/sign-up/set-password", appUrl);
    setPasswordUrl.searchParams.append("token", token);

    // Send email
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    const html = await render(
      SignUpEmail({ name, url: setPasswordUrl.toString(), expiresAt })
    );

    await sendMail(
      normalizedEmail,
      `Complete your ${appConfig.projectName} account setup`,
      html
    );

    return NextResponse.json({ 
      success: true,
      message: "Check your email to complete account setup" 
    });
  } catch (error) {
    console.error("Error in signup request:", error);
    return NextResponse.json(
      { error: "Failed to process signup request" },
      { status: 500 }
    );
  }
}
