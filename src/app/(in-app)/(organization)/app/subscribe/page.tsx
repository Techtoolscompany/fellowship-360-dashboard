import { auth } from "@/auth";
import { db } from "@/db";
import { plans } from "@/db/schema/plans";
import { createCheckoutSession, createCustomer } from "@/lib/lemonsqueezy";
import {
  PlanProvider,
  PlanType,
  subscribeParams,
  SubscribeParams,
} from "@/lib/plans/getSubscribeUrl";
import stripe from "@/lib/stripe";
import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import React from "react";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { organizations } from "@/db/schema/organization";
import { organizationMemberships } from "@/db/schema/organization-membership";
import { OrganizationRole } from "@/db/schema";
import OrganizationSelector from "./_components/organization-selector";
import { getUserOrganizations } from "@/lib/organizations/getUserOrganizations";
import {
  createOneTimePaymentCheckout,
  createSubscriptionCheckout,
} from "@/lib/dodopayments";
import {
  createPaypalOrderLink,
  createPaypalSubscriptionLink,
} from "@/lib/paypal/api";

async function SubscribePage({
  searchParams,
}: {
  searchParams: Promise<
    SubscribeParams & {
      billing_country?: string;
      billing_state?: string;
      billing_city?: string;
      billing_street?: string;
      billing_zipcode?: string;
      tax_id?: string;
    }
  >;
}) {
  const { codename, type, provider, trialPeriodDays } = await searchParams;

  try {
    subscribeParams.parse({
      codename,
      type,
      provider,
      trialPeriodDays: trialPeriodDays ? Number(trialPeriodDays) : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/app/subscribe/error?code=INVALID_PARAMS&message=${error.message}`
      );
    }
    throw error;
  }

  const session = await auth();

  if (!session?.user?.email) {
    return redirect("/auth/login");
  }

  // Get current session to check for organization
  const currentSession = await getSession();
  const currentOrganizationId = currentSession.currentOrganizationId;

  let currentOrganization;
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
        `${process.env.NEXT_PUBLIC_APP_URL}/app/subscribe/error?code=NO_ADMIN_ACCESS`
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
      // Show organization selector
      return <OrganizationSelector organizations={adminOrgs} />;
    }
  }

  if (!currentOrganization) {
    throw new Error("Organization not found");
  }

  // Get the plan
  const plansList = await db
    .select()
    .from(plans)
    .where(eq(plans.codename, codename))
    .limit(1);

  if (!plansList?.[0]) {
    return notFound();
  }

  const plan = plansList[0];

  switch (provider) {
    case PlanProvider.STRIPE:
      // Check type and get price id from db
      const key: keyof typeof plan | null =
        type === PlanType.MONTHLY
          ? "monthlyStripePriceId"
          : type === PlanType.YEARLY
            ? "yearlyStripePriceId"
            : type === PlanType.ONETIME
              ? "onetimeStripePriceId"
              : null;

      if (!key) {
        return notFound();
      }
      const priceId = plan[key];
      if (!priceId) {
        return notFound();
      }

      // Check if existing subscription for this organization
      if (currentOrganization.stripeSubscriptionId) {
        // If this is onetime plan then redirect to error page with message to
        // cancel existing subscription
        if (type === PlanType.ONETIME) {
          return redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/app/subscribe/error?code=STRIPE_CANCEL_BEFORE_SUBSCRIBING`
          );
        }
        // If this is monthly or yearly plan then redirect to billing page
        return redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app/billing`);
      }

      // Get or create Stripe customer
      let stripeCustomerId = currentOrganization.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: session.user.email,
          name: currentOrganization.name,
          metadata: {
            organizationId: currentOrganization.id,
          },
        });
        stripeCustomerId = customer.id;

        // Update organization with Stripe customer ID
        await db
          .update(organizations)
          .set({ stripeCustomerId })
          .where(eq(organizations.id, currentOrganization.id));
      }

      // Create checkout session
      const stripeCheckoutSession = await stripe.checkout.sessions.create({
        mode: type === PlanType.ONETIME ? "payment" : "subscription",
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        allow_promotion_codes: true,
        subscription_data: trialPeriodDays
          ? {
              trial_period_days: trialPeriodDays,
            }
          : undefined,
        customer: stripeCustomerId,
        customer_email: stripeCustomerId ? undefined : session.user.email,
        billing_address_collection: "required",
        customer_update: stripeCustomerId
          ? {
              name: "auto",
              address: "auto",
              shipping: "auto",
            }
          : undefined,
        tax_id_collection: {
          enabled: true,
        },
        customer_creation: stripeCustomerId ? undefined : "always",
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/subscribe/success?provider=${provider}&codename=${codename}&type=${type}&sessionId={CHECKOUT_SESSION_ID}&trialPeriodDays=${trialPeriodDays}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/subscribe/cancel?provider=${provider}&codename=${codename}&type=${type}&sessionId={CHECKOUT_SESSION_ID}&trialPeriodDays=${trialPeriodDays}`,
      });

      if (!stripeCheckoutSession.url) {
        throw new Error("Checkout session URL not found");
      }
      return redirect(stripeCheckoutSession.url);

    case PlanProvider.LEMON_SQUEEZY:
      const lemonsqueezyKey: keyof typeof plan | null =
        type === PlanType.MONTHLY
          ? "monthlyLemonSqueezyVariantId"
          : type === PlanType.YEARLY
            ? "yearlyLemonSqueezyVariantId"
            : type === PlanType.ONETIME
              ? "onetimeLemonSqueezyVariantId"
              : null;

      if (!lemonsqueezyKey) {
        return notFound();
      }
      const lemonsqueezyVariantId = plan[lemonsqueezyKey];
      if (!lemonsqueezyVariantId) {
        return notFound();
      }

      // Check if existing subscription for this organization
      if (currentOrganization.lemonSqueezySubscriptionId) {
        // If this is onetime plan then redirect to error page with message to
        // cancel existing subscription
        if (type === PlanType.ONETIME) {
          return redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/app/subscribe/error?code=LEMON_SQUEEZY_CANCEL_BEFORE_SUBSCRIBING`
          );
        }
        // If this is monthly or yearly plan then redirect to billing page
        return redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app/billing`);
      }

      // Get or create LemonSqueezy customer
      let lemonSqueezyCustomerId = currentOrganization.lemonSqueezyCustomerId;
      if (!lemonSqueezyCustomerId) {
        const customer = await createCustomer({
          name: currentOrganization.name,
          email: session.user.email,
          metadata: {
            organizationId: currentOrganization.id,
          },
        });
        lemonSqueezyCustomerId = customer.data.id;

        // Update organization with LemonSqueezy customer ID
        await db
          .update(organizations)
          .set({ lemonSqueezyCustomerId })
          .where(eq(organizations.id, currentOrganization.id));
      }

      const checkoutSession = await createCheckoutSession({
        variantId: lemonsqueezyVariantId,
        customerEmail: session.user.email,
        customerId: lemonSqueezyCustomerId,
      });

      if (!checkoutSession.data.url) {
        throw new Error("Checkout session URL not found");
      }
      return redirect(checkoutSession.data.url);

    case PlanProvider.DODO:
      const dodoKey: keyof typeof plan | null =
        type === PlanType.MONTHLY
          ? "monthlyDodoProductId"
          : type === PlanType.YEARLY
            ? "yearlyDodoProductId"
            : type === PlanType.ONETIME
              ? "onetimeDodoProductId"
              : null;

      if (!dodoKey) {
        return notFound();
      }
      const dodoProductId = plan[dodoKey];
      if (!dodoProductId) {
        return notFound();
      }

      // Check if existing subscription for this user
      if (currentOrganization.dodoSubscriptionId) {
        // If this is onetime plan then redirect to error page with message to
        // cancel existing subscription
        if (type === PlanType.ONETIME) {
          return redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/app/subscribe/error?code=DODO_CANCEL_BEFORE_SUBSCRIBING`
          );
        }
        // If this is monthly or yearly plan then redirect to billing page
        return redirect(`${process.env.NEXT_PUBLIC_APP_URL}/app/billing`);
      }
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
          `/app/subscribe`,
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
      let dodoCheckoutResponse;
      if (type === PlanType.ONETIME) {
        dodoCheckoutResponse = await createOneTimePaymentCheckout({
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
          codename: codename,
          type: type,
        });
      } else {
        dodoCheckoutResponse = await createSubscriptionCheckout({
          productId: dodoProductId,
          customerEmail: session?.user?.email ?? "",
          customerId: currentOrganization.dodoCustomerId ?? undefined,
          organizationName: currentOrganization.name,
          trialPeriodDays: trialPeriodDays
            ? Number(trialPeriodDays)
            : undefined,
          billing: {
            country: billing_country,
            state: billing_state,
            city: billing_city,
            street: billing_street,
            zipcode: billing_zipcode,
          },
          taxId: taxId,
          codename: codename,
          type: type,
        });
      }

      if (!dodoCheckoutResponse.payment_link) {
        throw new Error("DodoPayments checkout link not found");
      }
      return redirect(dodoCheckoutResponse.payment_link);

    case PlanProvider.PAYPAL:
      // If this is one time plan then create Order
      // else create subscription
      if (type === PlanType.ONETIME) {
        const orderLink = await createPaypalOrderLink(
          plan.id,
          session.user.id,
          currentOrganization.id
        );
        return redirect(orderLink);
      } else {
        const subscriptionLink = await createPaypalSubscriptionLink(
          plan.id,
          session.user.id,
          type,
          currentOrganization.id
        );
        return redirect(subscriptionLink);
      }

    default:
      return <div>Provider not found</div>;
  }
}

export default SubscribePage;
