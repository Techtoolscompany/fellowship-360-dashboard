import { NextResponse } from "next/server";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import { db } from "@/db";
import { users } from "@/db/schema/user";
import { eq } from "drizzle-orm";
import { encryptJson } from "@/lib/encryption/edge-jwt";
import { resolveAppUrl } from "@/lib/security/app-url";
import { getClientIp } from "@/lib/security/request";
import { logSuperAdminAudit } from "@/lib/super-admin/auth";

export const POST = withSuperAdminAuthRequired(async (req, context) => {
  const { id } = (await context.params) as { id: string };
  const currentUser = await context.session?.user;

  if (!currentUser?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  try {
    // Get target user to be impersonated
    const targetUser = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
      .then((users) => users[0]);

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create impersonation token with the new structure
    const impersonationData = {
      impersonateIntoId: targetUser.id,
      impersonateIntoEmail: targetUser.email,
      impersonator: currentUser.id, // Using the session user's ID
    };

    const token = await encryptJson(impersonationData, {
      purpose: "impersonation",
      expiresIn: "30m",
    });

    const appUrl = resolveAppUrl(req);
    if (!appUrl) {
      return NextResponse.json(
        { error: "App URL is not configured" },
        { status: 503 }
      );
    }

    // Generate sign-in URL with token
    const signInUrl = new URL("/sign-in", appUrl);
    signInUrl.searchParams.append("impersonateToken", token);

    await logSuperAdminAudit({
      actorUserId: currentUser.id,
      actionType: "impersonation_link_created",
      entityName: "app_user",
      entityId: targetUser.id,
      details: {
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email,
        ip: getClientIp(req),
      },
    });

    return NextResponse.json({ url: signInUrl.toString() });
  } catch (error) {
    console.error("Error creating impersonation token:", error);
    return NextResponse.json(
      { error: "Failed to create impersonation token" },
      { status: 500 }
    );
  }
}, "impersonate_users");
