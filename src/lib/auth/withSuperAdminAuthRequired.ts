import { auth } from "@/auth";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema/user";
import { NextRequest, NextResponse } from "next/server";
import { WithAuthHandler } from "./withAuthRequired";

const withSuperAdminAuthRequired = (handler: WithAuthHandler) => {
  return async (
    req: NextRequest,
    context: {
      params: Promise<Record<string, unknown>>;
    }
  ) => {
    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "You are not authorized to perform this action",
        },
        { status: 401 }
      );
    }

    if (!process.env.SUPER_ADMIN_EMAILS) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "No super admins configured",
        },
        { status: 403 }
      );
    }

    if (
      !process.env.SUPER_ADMIN_EMAILS?.split(",").includes(session.user?.email)
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Only super admins can access this resource",
        },
        { status: 403 }
      );
    }

    const sessionObject = {
      ...session,
      get user() {
        return (async () => {
          const user = await db
            .select()
            .from(users)
            .where(eq(users.id, session.user.id))
            .then((users) => users[0]);
          return {
            ...session.user,
            ...user,
          };
        })();
      },
    };

    return await handler(req, {
      ...context,
      session: sessionObject,
    });
  };
};

export default withSuperAdminAuthRequired;
