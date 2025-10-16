import { NextRequest, NextResponse } from "next/server";
import APIError from "@/lib/api/errors";
import { plans } from "@/db/schema/plans";
import { db } from "@/db";
import { eq, or } from "drizzle-orm";
import updatePlan from "@/lib/plans/updatePlan";
import downgradeToDefaultPlan from "@/lib/plans/downgradeToDefaultPlan";
import { Webhook } from "standardwebhooks";
import { organizations, type Organization } from "@/db/schema/organization";
import getOrCreateOrganizationByDodoCustomer from "@/lib/organizations/getOrCreateOrganizationByDodoCustomer";
import { addCredits } from "@/lib/credits/recalculate";
import { type CreditType } from "@/lib/credits/credits";
import { allocatePlanCredits } from "@/lib/credits/allocatePlanCredits";

class DodoPaymentsWebhookHandler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private data: any;
  private eventType: string;
  private organization: Organization | null = null; // Will be set by resolveOrganization

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(data: any, eventType: string) {
    this.data = data;
    this.eventType = eventType;
  }

  async resolveOrganization() {
    let customerId: string | null = null;
    let customerEmail: string | null = null;
    let customerName: string | null = null;

    // Extract customer information based on event type
    if (this.eventType === "customer.created") {
      const customer = this.data;
      customerId = customer.customer_id;
      customerEmail = customer.email || null;
      customerName = customer.name || null;
    } else if (this.eventType.startsWith("payment.")) {
      const payment = this.data;
      customerId = payment.customer?.customer_id || null;
      customerEmail = payment.customer?.email || null;
      customerName = payment.customer?.name || null;
    } else if (this.eventType.startsWith("subscription.")) {
      const subscription = this.data;
      customerId = subscription.customer?.customer_id || null;
      customerEmail = subscription.customer?.email || null;
      customerName = subscription.customer?.name || null;
    } else {
      // Try to somehow get the organization from the event data
      const object = this.data;
      customerId = object.customer?.customer_id || null;
      customerEmail = object.customer?.email || null;
      customerName = object.customer?.name || null;
    }

    // If we have enough information, get or create the organization
    if (customerId && customerEmail) {
      const { organization } = await getOrCreateOrganizationByDodoCustomer({
        dodoCustomerId: customerId,
        customerEmail,
        customerName,
      });

      this.organization = organization;
    }
  }

  async handleOutsidePlanManagementProductPaid() {
    const payment = this.data;

    // Check if this is a credit purchase using metadata
    const metadata = payment.metadata;

    if (metadata?.purchaseType === "credits") {
      // This is a credit purchase - extract info from metadata
      const creditType = metadata.creditType;
      const creditAmount = parseInt(metadata.creditAmount);
      const organizationId = metadata.organizationId;
      const paymentId = payment.payment_id || `payment_${payment.customer.customer_id}_${Date.now()}`;

      if (!creditType || !creditAmount || creditAmount <= 0 || !organizationId) {
        console.error("Invalid credit metadata in DodoPayments webhook:", {
          creditType,
          creditAmount,
          organizationId,
          metadata
        });
        return;
      }

      if (!this.organization) {
        console.error("Organization not resolved for DodoPayments credit purchase");
        return;
      }

      // Verify the organization ID matches (security check)
      if (this.organization.id !== organizationId) {
        console.error("Organization ID mismatch in DodoPayments webhook:", {
          metadataOrganizationId: organizationId,
          actualOrganizationId: this.organization.id,
          email: payment.customer.email
        });
        return;
      }

      try {
        // Add credits with payment ID for idempotency
        await addCredits(
          organizationId,
          creditType as CreditType,
          creditAmount,
          paymentId,
          {
            reason: "Purchase via DodoPayments",
            dodoPaymentId: paymentId,
            dodoCustomerId: payment.customer.customer_id,
            totalPrice: metadata.totalPrice,
          }
        );

        console.log(`Successfully added ${creditAmount} ${creditType} credits to organization ${organizationId} via DodoPayments payment ${paymentId}`);
      } catch (error) {
        console.error("Error adding credits from DodoPayments:", error);
        // If it's a duplicate payment error, that's okay - idempotency working
        if (error instanceof Error && error.message.includes("already exists")) {
          console.log(`Credits purchase already processed for DodoPayments payment ${paymentId}`);
        } else {
          throw error; // Re-throw other errors
        }
      }
    } else {
      // Handle other non-plan products here if needed
      console.log("DodoPayments payment for non-plan, non-credit product. Metadata:", metadata);
    }
  }

  // Payment Events
  async onPaymentSucceeded() {
    const payment = this.data;

    if (!this.organization) {
      console.error("Organization not resolved for payment.succeeded event");
      return;
    }

    try {
      // For one-time payments
      const productId = payment.product_cart?.[0]?.product_id;

      if (!productId) {
        // Must be a subscription payment, so we don't need to handle this
        throw new APIError("No product found in payment");
      }

      const dbPlan = await this._getPlanFromDodoProductId(productId);

      if (!dbPlan) {
        await this.handleOutsidePlanManagementProductPaid();
      } else {
        await updatePlan({
          organizationId: this.organization.id,
          newPlanId: dbPlan.id,
        });

        // Allocate plan-based credits
        await allocatePlanCredits({
          organizationId: this.organization.id,
          planId: dbPlan.id,
          paymentId: payment.payment_id || `payment_${payment.customer.customer_id}_${Date.now()}`,
          paymentMetadata: {
            source: "dodo_payment",
            dodoPaymentId: payment.payment_id,
            dodoCustomerId: payment.customer.customer_id,
          }
        });
      }
    } catch (error) {
      throw error;
    }
  }

  async onPaymentFailed() {
    // Payment failed, no action needed
  }

  async onPaymentProcessing() {
    // Payment is in process, no action needed
  }

  async onPaymentCancelled() {
    // Payment was cancelled, no plan updates needed
  }

  // Refund Events
  async onRefundSucceeded() {
    // No specific action needed for refunds
  }

  async onRefundFailed() {
    // No action needed
  }

  // Dispute Events
  async onDisputeOpened() {
    // Flag the account, may want to notify admin
  }

  async onDisputeExpired() {
    // No action needed
  }

  async onDisputeAccepted() {
    // May need to downgrade the user's plan if dispute was about payment
  }

  async onDisputeCancelled() {
    // No action needed
  }

  async onDisputeChallenged() {
    // No action needed
  }

  async onDisputeWon() {
    // Ensure user's plan is correct
  }

  async onDisputeLost() {
    // May need to downgrade the user's plan
  }

  async _getPlanFromDodoProductId(productId: string) {
    try {
      const plan = await db
        .select()
        .from(plans)
        .where(
          or(
            eq(plans.monthlyDodoProductId, productId),
            eq(plans.yearlyDodoProductId, productId),
            eq(plans.onetimeDodoProductId, productId)
          )
        )
        .limit(1);

      if (plan.length === 0) {
        return null;
      }

      return plan[0];
    } catch (error) {
      throw error;
    }
  }

  // Subscription Events
  async onSubscriptionCreated() {
    const subscription = this.data;

    if (!this.organization) {
      console.error("Organization not resolved for subscription.created event");
      return;
    }

    try {
      // Update organization's subscription ID
      await db
        .update(organizations)
        .set({
          dodoSubscriptionId: subscription.subscription_id,
        })
        .where(eq(organizations.id, this.organization.id));

      // Get the product ID from the subscription
      const productId = subscription.product_id;
      if (!productId) {
        throw new APIError("No product found in subscription");
      }

      const dbPlan = await this._getPlanFromDodoProductId(productId);
      if (!dbPlan) {
        // Handle outside plan management subscription
        return;
      }

      await updatePlan({ 
        organizationId: this.organization.id, 
        newPlanId: dbPlan.id 
      });

      // Allocate plan-based credits
      await allocatePlanCredits({
        organizationId: this.organization.id,
        planId: dbPlan.id,
        paymentId: subscription.subscription_id,
        paymentMetadata: {
          source: "dodo_subscription",
          dodoSubscriptionId: subscription.subscription_id,
          dodoCustomerId: subscription.customer?.customer_id,
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async onSubscriptionActive() {
    // Same handling as created since it's also an active subscription
    await this.onSubscriptionCreated();
  }

  async onSubscriptionOnHold() {
    const subscription = this.data;

    try {
      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.dodoSubscriptionId, subscription.subscription_id))
        .limit(1)
        .then((res) => res[0]);

      if (!org) {
        return;
      }

      // You may want to notify the organization that their subscription is on hold
      // TODO: Send notification to organization
    } catch (error) {
      // Handle error
      console.error(error);
    }
  }

  async onSubscriptionRenewed() {
    const subscription = this.data;

    try {
      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.dodoSubscriptionId, subscription.subscription_id))
        .limit(1)
        .then((res) => res[0]);

      if (!org) {
        return;
      }

      // Ensure the plan is still correctly set
      const productId = subscription.product_id;
      if (!productId) {
        return;
      }

      const dbPlan = await this._getPlanFromDodoProductId(productId);
      if (!dbPlan) {
        return;
      }

      await updatePlan({ 
        organizationId: org.id, 
        newPlanId: dbPlan.id 
      });

      // Allocate plan-based credits
      await allocatePlanCredits({
        organizationId: org.id,
        planId: dbPlan.id,
        paymentId: subscription.subscription_id,
        paymentMetadata: {
          source: "dodo_subscription_renewed",
          dodoSubscriptionId: subscription.subscription_id,
          dodoCustomerId: subscription.customer?.customer_id,
        }
      });
    } catch (error) {
      // Handle error
      console.error(error);
    }
  }

  async onSubscriptionPaused() {
    const subscription = this.data;

    try {
      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.dodoSubscriptionId, subscription.subscription_id))
        .limit(1)
        .then((res) => res[0]);

      if (!org) {
        return;
      }

      // You may want to update the organization's access or notify them
      // TODO: Consider updating organization access or sending notification
    } catch (error) {
      // Handle error
      console.error(error);
    }
  }

  async onSubscriptionCancelled() {
    const subscription = this.data;

    try {
      const org = await db
        .select()
        .from(organizations)
        .where(eq(organizations.dodoSubscriptionId, subscription.subscription_id))
        .limit(1)
        .then((res) => res[0]);

      if (!org) {
        return;
      }

      await downgradeToDefaultPlan({ organizationId: org.id });
    } catch (error) {
      // Handle error
      console.error(error);
    }
  }

  async onSubscriptionFailed() {
    // You may want to notify the organization or admin
  }

  async onSubscriptionExpired() {
    // Handle similar to cancellation
    await this.onSubscriptionCancelled();
  }

  // License Key Events
  async onLicenseKeyCreated() {
    const licenseKey = this.data;
    console.log("License key created", licenseKey);
    // Store the license key info if needed
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
    try {
      const bodyText = await req.text();
      // Check if webhook signing is configured
      const webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;

      if (webhookSecret) {
        // Retrieve the event by verifying the signature using the raw body and secret
        try {
          const webhook = new Webhook(webhookSecret);
          const headers = {
            "webhook-id": req.headers.get("webhook-id") as string,
            "webhook-signature": req.headers.get("webhook-signature") as string,
            "webhook-timestamp": req.headers.get("webhook-timestamp") as string,
          };

          await webhook.verify(bodyText, headers);
        } catch (err) {
          console.error(err);
          return NextResponse.json(
            {
              received: true,
              error: "Webhook signature verification failed",
            },
            { status: 401 }
          );
        }
      } else {
        if (process.env.NODE_ENV !== "development") {
          return NextResponse.json(
            {
              received: true,
              error: "Webhook secret not configured",
            },
            { status: 500 }
          );
        }
      }

      const data = JSON.parse(bodyText);
      const eventType = data.type;
      const eventData = data.data;

      const handler = new DodoPaymentsWebhookHandler(eventData, eventType);
      
      // Resolve organization before handling any events
      await handler.resolveOrganization();
      
      try {
        switch (eventType) {
          // Payment Events
          case "payment.succeeded":
            await handler.onPaymentSucceeded();
            break;
          case "payment.failed":
            await handler.onPaymentFailed();
            break;
          case "payment.processing":
            await handler.onPaymentProcessing();
            break;
          case "payment.cancelled":
            await handler.onPaymentCancelled();
            break;

          // Refund Events
          case "refund.succeeded":
            await handler.onRefundSucceeded();
            break;
          case "refund.failed":
            await handler.onRefundFailed();
            break;

          // Dispute Events
          case "dispute.opened":
            await handler.onDisputeOpened();
            break;
          case "dispute.expired":
            await handler.onDisputeExpired();
            break;
          case "dispute.accepted":
            await handler.onDisputeAccepted();
            break;
          case "dispute.cancelled":
            await handler.onDisputeCancelled();
            break;
          case "dispute.challenged":
            await handler.onDisputeChallenged();
            break;
          case "dispute.won":
            await handler.onDisputeWon();
            break;
          case "dispute.lost":
            await handler.onDisputeLost();
            break;

          // Subscription Events
          case "subscription.created": // This is for backward compatibility
          case "subscription.active":
            await handler.onSubscriptionActive();
            break;
          case "subscription.on_hold":
            await handler.onSubscriptionOnHold();
            break;
          case "subscription.renewed":
            await handler.onSubscriptionRenewed();
            break;
          case "subscription.paused":
            await handler.onSubscriptionPaused();
            break;
          case "subscription.cancelled":
            await handler.onSubscriptionCancelled();
            break;
          case "subscription.failed":
            await handler.onSubscriptionFailed();
            break;
          case "subscription.expired":
            await handler.onSubscriptionExpired();
            break;

          // License Key Events
          case "license_key.created":
            await handler.onLicenseKeyCreated();
            break;

          // Customer Events
          case "customer.created":
            await handler.onCustomerCreated();
            break;

          default:
            break;
        }

        return NextResponse.json({ received: true });
      } catch (error) {
        if (error instanceof APIError) {
          return NextResponse.json({
            received: true,
            message: error.message,
          });
        }
        return NextResponse.json(
          {
            received: true,
            error: "Unexpected error processing webhook",
          },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error(error);
      return NextResponse.json(
        {
          received: false,
          error: "Invalid webhook payload",
        },
        { status: 400 }
      );
    }
  } else {
    return NextResponse.json(
      {
        received: false,
        error: "Method not allowed",
      },
      { status: 405 }
    );
  }
}

export const POST = handler;

export const maxDuration = 20;
