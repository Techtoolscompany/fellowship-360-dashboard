import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/user";
import { NextRequest, NextResponse } from "next/server";
import { MeResponse } from "@/app/api/app/me/types";

export interface WithAuthHandler {
  (
    req: NextRequest,
    context: {
      session: NonNullable<{
        user: Promise<MeResponse["user"]>;
        expires: string;
      }>;
      params: Promise<Record<string, unknown>>;
    }
  ): Promise<NextResponse | Response>;
}

const withAuthRequired = (handler: WithAuthHandler) => {
  return async (
    req: NextRequest,
    context: {
      params: Promise<Record<string, unknown>>;
    }
  ) => {
    const session = await auth();

    if (!session || !session.user?.id || !session.user?.email) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "You are not authorized to perform this action",
        },
        { status: 401 }
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

export default withAuthRequired;
