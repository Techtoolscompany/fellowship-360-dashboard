import { NextResponse } from "next/server";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import { db } from "@/db";
import { organizations } from "@/db/schema/organization";
import { plans } from "@/db/schema/plans";
import { organizationMemberships } from "@/db/schema/organization-membership";
import { desc, sql, eq, count } from "drizzle-orm";

export const GET = withSuperAdminAuthRequired(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";

    const offset = (page - 1) * limit;

    // Get total count for pagination
    const totalCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(organizations)
      .where(
        search
          ? sql`name LIKE ${`%${search}%`} OR slug LIKE ${`%${search}%`}`
          : sql`1=1`
      );

    const totalCount = totalCountResult[0].count;

    // Get paginated organizations with plan names and member counts
    const organizationsList = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        createdAt: organizations.createdAt,
        planId: organizations.planId,
      })
      .from(organizations)
      .where(
        search
          ? sql`name LIKE ${`%${search}%`} OR slug LIKE ${`%${search}%`}`
          : sql`1=1`
      )
      .orderBy(desc(organizations.createdAt))
      .limit(limit)
      .offset(offset);

    // Get plan names for each organization
    const orgsWithPlans = await Promise.all(
      organizationsList.map(async (org) => {
        let planName = "No Plan";
        
        if (org.planId) {
          const plan = await db
            .select({ name: plans.name })
            .from(plans)
            .where(eq(plans.id, org.planId))
            .limit(1)
            .then(plans => plans[0]);
            
          if (plan && plan.name) {
            planName = plan.name;
          }
        }

        // Count members for each organization
        const [memberResult] = await db
          .select({ count: count() })
          .from(organizationMemberships)
          .where(eq(organizationMemberships.organizationId, org.id));

        return {
          ...org,
          planName,
          memberCount: memberResult ? memberResult.count : 0
        };
      })
    );

    return NextResponse.json({
      organizations: orgsWithPlans,
      pagination: {
        total: totalCount,
        pageCount: Math.ceil(totalCount / limit),
        currentPage: page,
        perPage: limit,
      },
    });
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
}); 