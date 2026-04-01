import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema/user";
import {
  resolveSuperAdminAccess,
  superAdminHasPermission,
  type ResolvedSuperAdminAccess,
} from "@/lib/super-admin/auth";
import type { SuperAdminPermission } from "@/lib/super-admin/permissions";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import type { MeResponse } from "@/app/api/app/me/types";

export interface WithSuperAdminHandler {
  (
    req: NextRequest,
    context: {
      session: {
        user: Promise<MeResponse["user"] & { superAdmin: ResolvedSuperAdminAccess }>;
        expires: string;
        superAdmin: ResolvedSuperAdminAccess;
      };
      params: Promise<Record<string, unknown>>;
    }
  ): Promise<NextResponse | Response>;
}

const withSuperAdminAuthRequired = (
  handler: WithSuperAdminHandler,
  requiredPermissions?: SuperAdminPermission | readonly SuperAdminPermission[]
) => {
  return async (
    req: NextRequest,
    context: {
      params: Promise<Record<string, unknown>>;
    }
  ) => {
    const session = await auth();

    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "You are not authorized to perform this action",
        },
        { status: 401 }
      );
    }

    const access = await resolveSuperAdminAccess({
      userId: session.user.id,
      email: session.user.email,
    });

    if (!access?.isActive) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Only active super admins can access this resource",
        },
        { status: 403 }
      );
    }

    if (requiredPermissions && !superAdminHasPermission(access, requiredPermissions)) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "Your super-admin role does not allow this action",
        },
        { status: 403 }
      );
    }

    const sessionObject = {
      expires: session.expires,
      superAdmin: access,
      get user() {
        return (async () => {
          const user = await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
              createdAt: users.createdAt,
              emailVerified: users.emailVerified,
            })
            .from(users)
            .where(eq(users.id, session.user.id))
            .then((rows) => rows[0]);

          return {
            ...session.user,
            ...user,
            superAdmin: access,
          };
        })();
      },
    };

    return handler(req, {
      ...context,
      session: sessionObject,
    });
  };
};

export default withSuperAdminAuthRequired;
