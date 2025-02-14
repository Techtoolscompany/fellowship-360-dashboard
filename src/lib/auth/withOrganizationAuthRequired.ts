import { auth } from "@/auth";
import { db } from "@/db";
import {
  OrganizationMembership,
  organizationMemberships,
} from "@/db/schema/organization-membership";
import { organizations } from "@/db/schema/organization";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { MeResponse } from "@/app/api/app/me/types";
import { users } from "@/db/schema/user";
import type { InferSelectModel } from "drizzle-orm";
import { getSession } from "../session";
import { hasHigherOrEqualRole } from "../organizations/hasHigherOrEqualRole";
import { plans } from "@/db/schema/plans";

type Organization = InferSelectModel<typeof organizations>;

export interface WithOrganizationAuthHandler {
  (
    req: NextRequest,
    context: {
      session: NonNullable<{
        expires: string;
        user: Promise<MeResponse["user"]>;
        organization: Promise<
          Organization & {
            role: OrganizationMembership["role"];
            plan: InferSelectModel<typeof plans> | null;
          }
        >;
      }>;
      params: Promise<Record<string, unknown>>;
    }
  ): Promise<NextResponse | Response>;
}

const withOrganizationAuthRequired = (
  handler: WithOrganizationAuthHandler,
  requiredRole: OrganizationMembership["role"] = "user"
) => {
  return async (
    req: NextRequest,
    context: {
      params: Promise<Record<string, unknown>>;
    }
  ) => {
    const session = await auth();

    if (!session || !session.user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "You are not authorized to perform this action",
        },
        { status: 401 }
      );
    }

    const browserSession = await getSession();
    const currentOranizationId = browserSession?.currentOrganizationId;

    if (!currentOranizationId) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Current organization ID is required in session.",
        },
        { status: 400 }
      );
    }

    // Check if User belong to the organization
    // This is a lightweight check to see if User belongs to the organization
    const isMember = await db
      .select({ role: organizationMemberships.role })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.userId, session.user.id),
          eq(organizationMemberships.organizationId, currentOranizationId)
        )
      )
      .limit(1)
      .then((memberships) => memberships[0]);

    if (!isMember) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You do not have access to this organization",
        },
        { status: 403 }
      );
    }

    // Role Check
    if (
      !hasHigherOrEqualRole({
        currentRole: isMember.role,
        requiredRole,
      })
    ) {
      return NextResponse.json({
        error: "Forbidden",
        message: "You do not have access to this organization",
      });
    }

    const sessionObject = {
      ...session,
      // Getter for user to keep consistent access of user and organization
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
            id: session.user.id,
          };
        })();
      },
      // Getter for organization to load when needed
      get organization() {
        return (async () => {
          const org = await db
            .select()
            .from(organizations)
            .where(eq(organizations.id, currentOranizationId))
            .limit(1)
            .then((orgs) => orgs[0]);

          const membership = await db
            .select({
              role: organizationMemberships.role,
            })
            .from(organizationMemberships)
            .where(
              and(
                eq(organizationMemberships.userId, session.user.id),
                eq(organizationMemberships.organizationId, org.id)
              )
            )
            .limit(1)
            .then((memberships) => memberships[0]);

          const currentPlan = org.planId
            ? await db
                .select()
                .from(plans)
                .where(eq(plans.id, org.planId))
                .limit(1)
                .then((plans) => plans[0])
            : null;

          return {
            ...org,
            role: membership.role,
            plan: currentPlan,
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

export default withOrganizationAuthRequired;
