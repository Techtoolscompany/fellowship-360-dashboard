import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PlanProvider,
  PlanType,
  subscribeParams,
} from "@/lib/plans/getSubscribeUrl";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { z } from "zod";
import { redirect } from "next/navigation";
import stripe from "@/lib/stripe";
import { auth } from "@/auth";
import { db } from "@/db";
import { plans } from "@/db/schema/plans";
import { eq } from "drizzle-orm";
import client from "@/lib/dodopayments/client";

// Extended params for success page including sessionId
const successParams = subscribeParams.extend({
  sessionId: z.string().optional(), // STRIPE
  subscription_id: z.string().optional(), // DODO
  status: z.string().optional(), // DODO
  payment_id: z.string().optional(), // DODO
  paypalContextId: z.string().optional(), // PAYPAL
});

type SuccessParams = z.infer<typeof successParams>;

export default async function SubscribeSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SuccessParams>;
}) {
  // Get session and validate user is logged in
  const session = await auth();
  if (!session?.user?.email) {
    return redirect("/auth/login");
  }

  try {
    const { provider, codename, type, sessionId, trialPeriodDays } =
      await searchParams;

    // Validate the parameters
    successParams.parse({
      codename,
      type,
      provider,
      sessionId,
      trialPeriodDays: trialPeriodDays ? Number(trialPeriodDays) : undefined,
    });

    // Fetch plan details
    const plan = await db
      .select()
      .from(plans)
      .where(eq(plans.codename, codename))
      .limit(1)
      .then((res) => res[0]);

    if (!plan) {
      return redirect("/app/subscribe/error?code=PLAN_NOT_FOUND");
    }

    // Different content based on provider
    let successDetails = null;

    if (provider === PlanProvider.STRIPE) {
      try {
        if (!sessionId) {
          return redirect("/app/subscribe/error?code=SESSION_NOT_FOUND");
        }
        // Verify the session exists and was successful
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.status !== "complete") {
          return redirect("/app/subscribe/error?code=PAYMENT_INCOMPLETE");
        }

        let subscriptionDetails = null;
        if (session.subscription) {
          // If it's a subscription, get more details
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          // Check if there's a trial period
          if (subscription.status === "trialing" && subscription.trial_end) {
            const trialEndDate = new Date(subscription.trial_end * 1000);
            subscriptionDetails = (
              <p className="text-muted-foreground mt-1">
                Your free trial ends on {trialEndDate.toLocaleDateString()}.
              </p>
            );
          }
        }

        successDetails = (
          <>
            <p>Your payment was processed successfully.</p>
            {subscriptionDetails}
          </>
        );
      } catch (error) {
        console.error("Error verifying Stripe session:", error);
        return redirect(
          "/app/subscribe/error?code=SESSION_VERIFICATION_FAILED"
        );
      }
    } else if (provider === PlanProvider.LEMON_SQUEEZY) {
      // For Lemon Squeezy, we might not be able to verify the session directly
      // So we just show a generic success message
      successDetails = <p>Your subscription to {plan.name} was successful.</p>;
    } else if (provider === PlanProvider.DODO) {
      const { subscription_id, payment_id } = await searchParams;
      if (subscription_id) {
        const subscription =
          await client.subscriptions.retrieve(subscription_id);

        if (subscription.status !== "active") {
          return (
            <p>
              Oops! Your subscription to {plan.name} was not activated. Please
              retry or{" "}
              <Link href="/contact" className="underline">
                contact support
              </Link>
              .
            </p>
          );
        }
      } else if (payment_id) {
        const payment = await client.payments.retrieve(payment_id);
        if (payment.status !== "succeeded") {
          return (
            <p>
              Oops! Your payment to {plan.name} was not successful. Please retry
              or{" "}
              <Link href="/contact" className="underline">
                contact support
              </Link>
              .
            </p>
          );
        }
      }
    }

    // Get billing cycle text
    let billingText = "";
    switch (type) {
      case PlanType.MONTHLY:
        billingText = "monthly billing";
        break;
      case PlanType.YEARLY:
        billingText = "annual billing";
        break;
      case PlanType.ONETIME:
        billingText = "one-time payment";
        break;
    }

    return (
      <div className="container max-w-lg mx-auto py-12">
        <Card className="p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h1 className="text-2xl font-bold">Subscription Successful</h1>
            <div>
              <p className="font-medium">
                You are now subscribed to the {plan.name} plan with{" "}
                {billingText}.
              </p>
              <p className="text-muted-foreground">
                Please note that in some cases it can take around upto 5 minutes
                for the subscription to be activated.
              </p>
              {successDetails}
            </div>

            <div className="flex flex-row gap-2 items-center mt-8">
              <Button asChild>
                <Link href="/app/billing">Go to Billing</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/app">Go to Dashboard</Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  } catch (error) {
    console.error("Error in subscription success page:", error);
    if (error instanceof z.ZodError) {
      return redirect(
        `/app/subscribe/error?code=INVALID_PARAMS&message=${error.message}`
      );
    }
    return redirect("/app/subscribe/error");
  }
}
