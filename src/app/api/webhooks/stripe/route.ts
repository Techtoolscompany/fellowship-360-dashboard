import Stripe from "stripe";
import stripe from "@/lib/stripe";
import { NextRequest, NextResponse } from "next/server";
import APIError from "@/lib/api/errors";
import { plans } from "@/db/schema/plans";
import { db } from "@/db";
import { eq, or } from "drizzle-orm";
import updatePlan from "@/lib/plans/updatePlan";
import downgradeToDefaultPlan from "@/lib/plans/downgradeToDefaultPlan";
import getOrCreateOrganizationByStripeCustomer from "@/lib/organizations/getOrCreateOrganizationByStripeCustomer";
import { organizations, type Organization } from "@/db/schema/organization";
import { addCredits } from "@/lib/credits/recalculate";
import { type CreditType } from "@/lib/credits/credits";
import { creditTypeSchema } from "@/lib/credits/config";
import { allocatePlanCredits } from "@/lib/credits/allocatePlanCredits";

class StripeWebhookHandler {
  private data: Stripe.Event.Data;
  private eventType: string;
  private organization: Organization | null = null; // Will be set by resolveOrganization

  constructor(data: Stripe.Event.Data, eventType: string) {
    this.data = data;
    this.eventType = eventType;
  }

  async resolveOrganization() {
    let customerId: string | null = null;
    let customerEmail: string | null = null;
    let customerName: string | null = null;

    // Check metadata.organizationId if present then that is the organization
    const object = this.data.object as {
      metadata?: { organizationId: string };
    };
    if (object?.metadata?.organizationId) {
      const organization = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, object.metadata.organizationId))
        .limit(1)
        .then((res) => res[0]);
      if (organization) {
        this.organization = organization;
        return;
      }
    }

    // Extract customer information based on event type
    if (this.eventType === "customer.created") {
      const object = this.data.object as Stripe.Customer;
      customerId = object.id;
      customerEmail = object.email || null;
      customerName = object.name || null;
    } else if (this.eventType.startsWith("invoice.")) {
      const object = this.data.object as Stripe.Invoice;
      customerId =
        typeof object.customer === "string"
          ? object.customer
          : object.customer?.id || null;
      customerEmail = object.customer_email || null;
      customerName = object.customer_name || null;
    } else if (this.eventType.startsWith("customer.subscription.")) {
      const object = this.data.object as Stripe.Subscription;
      customerId =
        typeof object.customer === "string"
          ? object.customer
          : object.customer?.id || null;

      if (customerId) {
        // Fetch customer details if we only have the ID
        try {
          const customer = await this._getStripeCustomer(object.customer);
          customerEmail = customer?.email || null;
          customerName = customer?.name || null;
        } catch (error) {
          console.error("Error fetching customer details:", error);
        }
      }
    } else {
      // Try to somehow get the organization from the event data
      const object = this.data.object as {
        customer?: string | Stripe.Customer | Stripe.DeletedCustomer;
        customer_email?: string;
        customer_name?: string;
      };
      customerId = object.customer
        ? typeof object.customer === "string"
          ? object.customer
          : object.customer?.id || null
        : null;
      customerEmail = object.customer_email || null;
      customerName = object.customer_name || null;
    }

    // If we have enough information, get or create the organization
    if (customerId && customerEmail) {
      const { organization } = await getOrCreateOrganizationByStripeCustomer({
        stripeCustomerId: customerId,
        customerEmail,
        customerName,
      });

      this.organization = organization;
    }
  }

  async handleOutsidePlanManagementProductInvoicePaid() {
    // @ts-expect-error Stripe types are not fully compatible with Next.js
    const object: Stripe.Invoice = this.data.object;
    console.log("eventType", this.eventType);
    console.log("Outside plan management product invoice paid", object);
    // TODO: Implement your own logic here ex: update organization credits (if you have a credits system)
  }

  /**
   * Handles credits purchase from checkout session
   * @param checkoutSession - Stripe checkout session
   * @param organization - Organization object
   */
  async handleCreditsPurchase(
    checkoutSession: Stripe.Checkout.Session,
    organization: Organization
  ) {
    const metadata = checkoutSession.metadata;

    if (!metadata || metadata.type !== "credits_purchase") {
      return false; // Not a credits purchase
    }

    const { creditType, amount, userId, organizationId } = metadata;

    // Validate metadata
    if (!creditType || !amount || !organizationId) {
      console.error("Invalid credits purchase metadata", metadata);
      throw new APIError("Invalid credits purchase metadata");
    }

    if (organizationId !== organization.id) {
      console.error(
        "Organization ID mismatch in credits purchase",
        organizationId,
        organization.id
      );
      throw new APIError("Organization ID mismatch in credits purchase");
    }

    // Validate credit type
    const parsedCreditType = creditTypeSchema.safeParse(creditType);
    if (!parsedCreditType.success) {
      console.error("Invalid credit type in credits purchase", creditType);
      throw new APIError(`Invalid credit type: ${creditType}`);
    }

    const creditAmount = parseInt(amount);
    if (isNaN(creditAmount) || creditAmount <= 0) {
      console.error("Invalid credit amount in credits purchase", amount);
      throw new APIError(`Invalid credit amount: ${amount}`);
    }

    try {
      // Use checkout session ID as payment ID for idempotency
      const paymentId = checkoutSession.id;

      // Add credits with idempotency protection
      await addCredits(
        organization.id,
        parsedCreditType.data as CreditType,
        creditAmount,
        paymentId,
        {
          reason: "Purchase via Stripe",
          checkoutSessionId: checkoutSession.id,
          paymentIntentId: checkoutSession.payment_intent,
          amountPaid: checkoutSession.amount_total,
          currency: checkoutSession.currency,
          userId: userId, // Track who initiated the purchase
        }
      );

      console.log(
        `Successfully added ${creditAmount} ${creditType} credits to organization ${organization.id} via payment ${paymentId}`
      );
      return true; // Credits purchase handled
    } catch (error) {
      console.error("Error adding credits:", error);
      // If it's a duplicate payment error, that's okay - idempotency working
      if (error instanceof Error && error.message.includes("already exists")) {
        console.log(
          `Credits purchase already processed for payment ${checkoutSession.id}`
        );
        return true;
      }
      throw new APIError(
        `Failed to add credits: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async onInvoicePaid() {
    const object = this.data.object as Stripe.Invoice;

    if (!this.organization) {
      console.error("Organization not resolved for invoice.paid event");
      return;
    }

    // Get first item
    const item = object.lines.data[0];
    if (!item) {
      throw new APIError("No item found in invoice");
    }

    if (item.subscription) {
      // Subscription is created, skip "customer.subscription.created" or "customer.subscription.updated" will handle this
      return;
    }

    const price = item.price;

    if (price) {
      // Check if item is a subscription
      const dbPlan = await this._getPlanFromStripePriceId(price.id);

      if (!dbPlan) {
        await this.handleOutsidePlanManagementProductInvoicePaid();
      } else {
        await updatePlan({
          organizationId: this.organization.id,
          newPlanId: dbPlan.id,
        });

        // Allocate plan-based credits
        await allocatePlanCredits({
          organizationId: this.organization.id,
          planId: dbPlan.id,
          paymentId: object.id,
          paymentMetadata: {
            source: "stripe_invoice",
            invoiceId: object.id,
            customerId: object.customer,
            subscriptionId: object.subscription,
          },
        });
      }
    } else {
      await this.handleOutsidePlanManagementProductInvoicePaid();
    }
  }

  async _getPlanFromStripePriceId(priceId: string) {
    const plan = await db
      .select()
      .from(plans)
      .where(
        or(
          eq(plans.monthlyStripePriceId, priceId),
          eq(plans.yearlyStripePriceId, priceId),
          eq(plans.onetimeStripePriceId, priceId)
        )
      )
      .limit(1)
      .then((res) => res[0]);

    if (!plan) {
      return null;
    }

    return plan;
  }

  async onSubscriptionUpdated() {
    const object = this.data.object as Stripe.Subscription;

    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.stripeSubscriptionId, object.id))
      .limit(1)
      .then((res) => res[0]);

    if (!org) {
      // Subscription is not for this organization, skip
      return;
    }

    const price = object.items.data[0].price;
    if (!price) {
      throw new APIError("No price found in subscription");
    }

    const isActive = object.status === "active" || object.status === "trialing";

    if (!isActive) {
      // Subscription is cancelled, downgrade to free plan
      await downgradeToDefaultPlan({ organizationId: org.id });
      return;
    }

    const dbPlan = await this._getPlanFromStripePriceId(price.id);
    if (!dbPlan) {
      // TIP: Handle outside plan management subscription
      return;
    }

    await updatePlan({ organizationId: org.id, newPlanId: dbPlan.id });

    // Allocate plan-based credits
    await allocatePlanCredits({
      organizationId: org.id,
      planId: dbPlan.id,
      paymentId: object.id,
      paymentMetadata: {
        source: "stripe_subscription_updated",
        subscriptionId: object.id,
        status: object.status,
      },
    });
  }

  async _getStripeCustomer(
    customer: string | Stripe.Customer | Stripe.DeletedCustomer
  ): Promise<Stripe.Customer | null> {
    if (typeof customer === "string") {
      const response = await stripe.customers.retrieve(customer);
      if (response.deleted) {
        return null;
      }
      return response;
    }
    if (customer.deleted) {
      return null;
    }
    return customer;
  }

  async onSubscriptionCreated() {
    const object = this.data.object as Stripe.Subscription;

    if (!this.organization) {
      console.error("Organization not resolved for subscription.created event");
      return;
    }

    const price = object.items.data[0].price;
    if (!price) {
      throw new APIError("No price found in subscription");
    }

    const dbPlan = await this._getPlanFromStripePriceId(price.id);
    if (!dbPlan) {
      // TIP: Handle outside plan management subscription
      throw new APIError("Plan not found");
    }

    // Update the organization with the subscription ID
    await db
      .update(organizations)
      .set({ stripeSubscriptionId: object.id })
      .where(eq(organizations.id, this.organization.id))
      .returning()
      .then(() => {});

    await updatePlan({
      organizationId: this.organization.id,
      newPlanId: dbPlan.id,
    });

    // Allocate plan-based credits
    await allocatePlanCredits({
      organizationId: this.organization.id,
      planId: dbPlan.id,
      paymentId: object.id,
      paymentMetadata: {
        source: "stripe_subscription_created",
        subscriptionId: object.id,
        customerId:
          typeof object.customer === "string"
            ? object.customer
            : object.customer?.id,
      },
    });
  }

  async onSubscriptionDeleted() {
    const object = this.data.object as Stripe.Subscription;

    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.stripeSubscriptionId, object.id))
      .limit(1)
      .then((res) => res[0]);

    if (!org) {
      // Subscription is not for this organization, skip
      return;
    }

    await downgradeToDefaultPlan({ organizationId: org.id });
  }

  async onCheckoutSessionCompleted() {
    const object = this.data.object as Stripe.Checkout.Session;

    // Only proceed if payment was successful
    if (object.payment_status !== "paid") {
      return;
    }

    // If this is a subscription checkout, let subscription events handle it
    if (object.mode === "subscription") {
      return;
    }

    if (!this.organization) {
      console.error(
        "Organization not resolved for checkout.session.completed event"
      );
      return;
    }

    // First, check if this is a credits purchase
    const isCreditsHandled = await this.handleCreditsPurchase(
      object,
      this.organization
    );
    if (isCreditsHandled) {
      return; // Credits purchase was handled successfully
    }

    // If not credits, handle as plan purchase
    // Get line items to find the plan
    const lineItems = await stripe.checkout.sessions.listLineItems(object.id);

    if (lineItems.data.length === 0) {
      throw new APIError("No line items found in checkout session");
    }

    const firstItem = lineItems.data[0];
    if (!firstItem.price) {
      throw new APIError("No price found in checkout session line item");
    }

    const dbPlan = await this._getPlanFromStripePriceId(firstItem.price.id);

    if (!dbPlan) {
      // Handle outside plan management product - could be credits or other products
      console.log(
        "No plan found for price ID:",
        firstItem.price.id,
        "- may be credits or other product"
      );
      await this.handleOutsidePlanManagementProductInvoicePaid();
      return;
    }

    await updatePlan({
      organizationId: this.organization.id,
      newPlanId: dbPlan.id,
    });

    // Allocate plan-based credits
    await allocatePlanCredits({
      organizationId: this.organization.id,
      planId: dbPlan.id,
      paymentId: object.id,
      paymentMetadata: {
        source: "stripe_checkout",
        checkoutSessionId: object.id,
        paymentIntentId: object.payment_intent,
        customerId:
          typeof object.customer === "string"
            ? object.customer
            : object.customer?.id,
        amountTotal: object.amount_total,
        currency: object.currency,
      },
    });
  }

  async onCustomerCreated() {
    // Organization should already be resolved at this point
    if (!this.organization) {
      console.error("Organization not resolved for customer.created event");
      return;
    }

    console.log(
      "Customer created and organization resolved:",
      this.organization.id
    );
  }
}

async function handler(req: NextRequest) {
  if (req.method === "POST") {
    let data;
    let eventType;
    // Check if webhook signing is configured.
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret) {
      // Retrieve the event by verifying the signature using the raw body and secret.
      let event: Stripe.Event;
      const signature = req.headers.get("stripe-signature") as string;

      try {
        const body = await req.text();
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        console.error(`⚠️ Webhook signature verification failed.`, err);
        return NextResponse.json({
          received: true,
          error: "Webhook signature verification failed",
        });
      }
      // Extract the object from the event.
      data = event.data;
      eventType = event.type;
    } else {
      // Webhook signing is recommended, but if the secret is not configured in `config.js`,
      // retrieve the event data directly from the request body.
      const body = await req.json();
      data = body.data;
      eventType = body.type;
    }

    const handler = new StripeWebhookHandler(data, eventType);

    // Resolve organization before handling any events
    await handler.resolveOrganization();

    try {
      switch (eventType) {
        case "invoice.paid":
          await handler.onInvoicePaid();
          break;
        case "checkout.session.completed":
          await handler.onCheckoutSessionCompleted();
          break;
        case "customer.created":
          await handler.onCustomerCreated();
          break;
        case "customer.subscription.created":
          await handler.onSubscriptionCreated();
          break;
        case "customer.subscription.updated":
          await handler.onSubscriptionUpdated();
          break;
        case "customer.subscription.deleted":
          await handler.onSubscriptionDeleted();
          break;
        default:
          // Unhandled event type
          break;
      }
    } catch (error) {
      if (error instanceof APIError) {
        return NextResponse.json({
          received: true,
          message: error.message,
        });
      }
    }
    // Return a response to acknowledge receipt of the event.
    return NextResponse.json({ received: true });
  }
}

export const POST = handler;

export const maxDuration = 20;
