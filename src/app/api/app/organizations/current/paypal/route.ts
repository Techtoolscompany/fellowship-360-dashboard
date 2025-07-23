import { NextResponse } from "next/server";
import { db } from "@/db";
import { paypalContext } from "@/db/schema/paypal";
import { desc, eq } from "drizzle-orm";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { cancelPaypalSubscription } from "@/lib/paypal/api";
import { z } from "zod";
import { plans } from "@/db/schema/plans";
import { OrganizationRole } from "@/db/schema/organization";

export const GET = withOrganizationAuthRequired(async (req, context) => {
  try {
    const organization = await context.session.organization;
    const contexts = await db
      .select({
        id: paypalContext.id,
        createdAt: paypalContext.createdAt,
        planId: paypalContext.planId,
        userId: paypalContext.userId,
        organizationId: paypalContext.organizationId,
        frequency: paypalContext.frequency,
        paypalOrderId: paypalContext.paypalOrderId,
        paypalSubscriptionId: paypalContext.paypalSubscriptionId,
        status: paypalContext.status,
        planName: plans.name,
      })
      .from(paypalContext)
      .leftJoin(plans, eq(paypalContext.planId, plans.id))
      .where(eq(paypalContext.organizationId, organization.id))
      .orderBy(desc(paypalContext.createdAt));
    return NextResponse.json({ contexts });
  } catch (error) {
    console.error("Failed to fetch PayPal contexts", error);
    return NextResponse.json({ error: "Failed to fetch PayPal contexts" }, { status: 500 });
  }
}, OrganizationRole.enum.user); // Allow any organization member to view

const cancelSchema = z.object({
  contextId: z.string().min(1),
  action: z.literal("cancel"),
});

export const POST = withOrganizationAuthRequired(async (req, context) => {
  try {
    const body = await req.json();
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.format() }, { status: 400 });
    }
    const { contextId, action } = parsed.data;
    if (action !== "cancel") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }
    
    const organization = await context.session.organization;
    const currentUser = await context.session.user;
    
    // Ensure the context belongs to the organization
    const [ctx] = await db.select().from(paypalContext).where(eq(paypalContext.id, contextId)).limit(1);
    if (!ctx || ctx.organizationId !== organization.id) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }
    
    // Authorization check: User must be admin OR creator of the subscription
    const isAdmin = organization.role === "admin" || organization.role === "owner";
    const isCreator = ctx.userId === currentUser.id;
    
    if (!isAdmin && !isCreator) {
      return NextResponse.json({ 
        error: "Forbidden", 
        message: "You must be an admin or the creator of this subscription to cancel it" 
      }, { status: 403 });
    }
    
    const success = await cancelPaypalSubscription(contextId);
    if (!success) {
      return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: "Subscription cancelled" });
  } catch (error) {
    console.error("Failed to cancel subscription", error);
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 });
  }
}, OrganizationRole.enum.user); // Allow any organization member to attempt cancellation (with authorization check) 