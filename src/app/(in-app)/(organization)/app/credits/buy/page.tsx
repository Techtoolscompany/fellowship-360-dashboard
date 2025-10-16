"use server";

import { auth, signIn } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema/user";
import { plans, Quotas } from "@/db/schema/plans";
import { Organization, organizations } from "@/db/schema/organization";
import { organizationMemberships } from "@/db/schema/organization-membership";
import { OrganizationRole } from "@/db/schema";
import { PlanProvider } from "@/lib/plans/getSubscribeUrl";
import stripe from "@/lib/stripe";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  creditBuyParams,
  getCreditsPrice,
  type CreditType,
} from "@/lib/credits/credits";
import { createPaypalCreditOrderLink } from "@/lib/paypal/api";
import { createCreditCheckout } from "@/lib/dodopayments";
import { enableCredits } from "@/lib/credits/config";
import { getSession } from "@/lib/session";
import { getUserOrganizations } from "@/lib/organizations/getUserOrganizations";

async function CreditsBuyPage({
  searchParams,
}: {
  searchParams: Promise<{
    creditType: CreditType;
    amount: string;
    provider: PlanProvider;
    billing_country?: string;
    billing_state?: string;
    billing_city?: string;
    billing_street?: string;
    billing_zipcode?: string;
    tax_id?: string;
  }>;
}) {
  if (!enableCredits) {
    return redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/app/credits/buy/error?code=CREDITS_DISABLED&message=Credits are disabled`
    );
  }
  const { creditType, amount, provider } = await searchParams;

  try {
    creditBuyParams.parse({
      creditType,
      amount: Number(amount),
      provider,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/app/credits/buy/error?code=INVALID_PARAMS&message=${error.message}`
      );
    }
    throw error;
  }

  const session = await auth();

  if (!session?.user?.email) {
    return signIn();
  }

  const dbUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!dbUsers?.[0]) {
    return signIn();
  }

  const user = dbUsers[0];
  const creditAmount = Number(amount);

  // Get current session to check for organization
  const currentSession = await getSession();
  const currentOrganizationId = currentSession.currentOrganizationId;

  let currentOrganization: Organization | undefined;
  if (currentOrganizationId) {
    // Verify if user is part of this organization and has admin/owner role
    const membership = await db
      .select({
        role: organizationMemberships.role,
      })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, currentOrganizationId),
          eq(organizationMemberships.userId, session.user.id)
        )
      )
      .limit(1)
      .then((memberships) => memberships[0]);

    if (
      membership &&
      (membership.role === OrganizationRole.enum.admin ||
        membership.role === OrganizationRole.enum.owner)
    ) {
      currentOrganization = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, currentOrganizationId))
        .limit(1)
        .then((orgs) => orgs[0]);
    }
  }

  if (!currentOrganization) {
    // Get all organizations where user is admin or owner
    const userOrgs = await getUserOrganizations(session.user.id);
    const adminOrgs = userOrgs.filter(
      (org) =>
        org.role === OrganizationRole.enum.admin ||
        org.role === OrganizationRole.enum.owner
    );

    if (adminOrgs.length === 0) {
      return redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/app/credits/buy/error?code=NO_ADMIN_ACCESS&message=You need admin access to purchase credits`
      );
    }

    if (adminOrgs.length === 1) {
      currentOrganization = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, adminOrgs[0].id))
        .limit(1)
        .then((orgs) => orgs[0]);
    } else {
      return redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/app/credits/buy/error?code=MULTIPLE_ORGS&message=Please select an organization first`
      );
    }
  }

  if (!currentOrganization) {
    throw new Error("Organization not found");
  }

  // Get organization's current plan for pricing calculation
  let organizationPlan:
    | { id: string; codename: string; quotas: Quotas }
    | undefined = undefined;
  if (currentOrganization.planId) {
    const currentPlan = await db
      .select({
        id: plans.id,
        codename: plans.codename,
        quotas: plans.quotas,
      })
      .from(plans)
      .where(eq(plans.id, currentOrganization.planId))
      .limit(1)
      .then((res) => res[0]);

    if (currentPlan.codename && currentPlan.quotas) {
      organizationPlan = {
        id: currentPlan.id,
        codename: currentPlan.codename,
        quotas: currentPlan.quotas,
      };
    }
  }

  // Calculate the price for the credits with organization's plan
  let totalPrice: number;
  try {
    totalPrice = getCreditsPrice(creditType, creditAmount, organizationPlan);
  } catch (error) {
    return redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/app/credits/buy/error?code=PRICE_CALCULATION_ERROR&message=${encodeURIComponent(
        error instanceof Error ? error.message : "Failed to calculate price"
      )}`
    );
  }

  switch (provider) {
    case PlanProvider.PAYPAL:
      // Create PayPal order for credit purchase

      const paypalOrderUrl = await createPaypalCreditOrderLink(
        creditType,
        creditAmount,
        totalPrice * 100, // Convert to cents
        user.id,
        currentOrganization.id
      );

      // Success: redirect immediately to PayPal checkout
      return redirect(paypalOrderUrl);

    case PlanProvider.STRIPE:
      // Create a one-time payment checkout session
      const stripeCheckoutSession = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `${creditAmount} ${creditType} Credits`,
                description: `Purchase of ${creditAmount} credits for ${creditType}`,
              },
              unit_amount: Math.round(totalPrice * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        allow_promotion_codes: true,
        customer: currentOrganization.stripeCustomerId ?? undefined,
        customer_email: currentOrganization.stripeCustomerId
          ? undefined
          : (session?.user?.email ?? undefined),
        billing_address_collection: "required",
        tax_id_collection: {
          enabled: true,
        },
        customer_update: currentOrganization.stripeCustomerId
          ? {
              name: "auto",
              address: "auto",
            }
          : undefined,
        customer_creation: currentOrganization.stripeCustomerId
          ? undefined
          : "if_required",
        metadata: {
          creditType,
          amount: creditAmount.toString(),
          userId: user.id,
          organizationId: currentOrganization.id,
          type: "credits_purchase",
        },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/credits/buy/success?provider=${provider}&creditType=${creditType}&amount=${creditAmount}&sessionId={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/credits/buy/cancel?provider=${provider}&creditType=${creditType}&amount=${creditAmount}&sessionId={CHECKOUT_SESSION_ID}`,
      });

      if (!stripeCheckoutSession.url) {
        console.error(
          "Checkout session URL not created",
          stripeCheckoutSession
        );
        throw new Error("Checkout session URL not found");
      }

      // Success: redirect immediately to Stripe checkout
      return redirect(stripeCheckoutSession.url);

    case PlanProvider.DODO:
      const {
        billing_country,
        billing_state,
        billing_city,
        billing_street,
        billing_zipcode,
        tax_id,
      } = await searchParams;
      // Check if billing information is provided in the query parameters
      const hasBillingInfo =
        billing_country &&
        billing_state &&
        billing_city &&
        billing_street &&
        billing_zipcode;

      // If not, redirect to the billing form
      if (!hasBillingInfo) {
        // Create the current URL as the callback URL
        const currentUrl = new URL(
          `/app/credits/buy`,
          process.env.NEXT_PUBLIC_APP_URL
        );

        // Add all current search params to the URL
        Object.entries(searchParams).forEach(([key, value]) => {
          if (typeof value === "string") {
            currentUrl.searchParams.set(key, value);
          }
        });

        return redirect(
          `/app/subscribe/billing-form?callbackUrl=${encodeURIComponent(
            currentUrl.toString()
          )}`
        );
      }

      // Extract tax ID from query parameters if available
      const taxId = tax_id;

      // Create checkout session based on plan type
      const dodoProductId = process.env.DODO_CREDITS_PRODUCT_ID;

      if (!dodoProductId) {
        throw new Error("Dodo product ID not found");
      }

      const dodoCheckoutResponse = await createCreditCheckout({
        productId: dodoProductId,
        customerEmail: session?.user?.email ?? "",
        customerId: currentOrganization.dodoCustomerId ?? undefined,
        organizationName: currentOrganization.name,
        billing: {
          country: billing_country,
          state: billing_state,
          city: billing_city,
          street: billing_street,
          zipcode: billing_zipcode,
        },
        taxId: taxId,
        creditAmount: creditAmount,
        creditType: creditType,
        organizationId: currentOrganization.id,
        totalPrice: totalPrice, // Pass the calculated price for pay-what-you-want
      });

      if (!dodoCheckoutResponse.payment_link) {
        throw new Error("DodoPayments checkout link not found");
      }
      return redirect(dodoCheckoutResponse.payment_link);
    default:
      return redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/app/credits/buy/error?code=UNSUPPORTED_PROVIDER&message=Payment provider not supported`
      );
  }
}

export default CreditsBuyPage;
