import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import stripe from "@/lib/stripe";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { OrganizationRole } from "@/db/schema/organization";
import client from "@/lib/dodopayments/client";
import { db } from "@/db";
import { paypalContext } from "@/db/schema/paypal";
import { eq } from "drizzle-orm";

export const GET = withOrganizationAuthRequired(async (req, context) => {
  const organization = await context.session.organization;

  if (!organization) {
    return NextResponse.json(
      { message: "Organization not found" },
      { status: 404 }
    );
  }

  const dodoCustomerId = organization.dodoCustomerId;
  if (dodoCustomerId) {
    const customerPortalSession = await client.customers.customerPortal.create(
      dodoCustomerId
    );
    return redirect(customerPortalSession.link);
  }

  const stripeCustomerId = organization.stripeCustomerId;

  if (stripeCustomerId) {
    // create customer portal link
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/app`,
    });
    return redirect(portalSession.url);
  }

  const lemonSqueezyCustomerId = organization.lemonSqueezyCustomerId;
  if (lemonSqueezyCustomerId) {
    // TODO: Get lemonSqueezy customer and redirect to lemonSqueezy customer portal
    // Replace with actual implementation when LemonSqueezy is implemented
    return NextResponse.json(
      {
        message: "LemonSqueezy portal integration is not implemented yet.",
        customerId: lemonSqueezyCustomerId,
      },
      { status: 501 }
    );
  }

  // Check if has paypal context
  const paypalContexts = await db
    .select()
    .from(paypalContext)
    .where(eq(paypalContext.organizationId, organization.id));
  if (paypalContexts.length > 0) {
    return redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app/billing/paypal`);
  }

  return NextResponse.json(
    { message: "Your organization is not subscribed to any plan." },
    { status: 400 }
  );
}, OrganizationRole.enum.user); // Allow any organization member to access billing
