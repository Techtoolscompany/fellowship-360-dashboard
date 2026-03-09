import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { XCircle } from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { PlanProvider, subscribeParams } from "@/lib/plans/getSubscribeUrl";
import { z } from "zod";
import { db } from "@/db";
import { plans } from "@/db/schema/plans";
import { eq } from "drizzle-orm";

// Cancel page parameters (same as subscribe params plus sessionId)
const cancelParams = subscribeParams.extend({
  sessionId: z.string(),
});

type CancelParams = z.infer<typeof cancelParams>;

export default async function SubscribeCancelPage({
  searchParams,
}: {
  searchParams: Promise<CancelParams>;
}) {
  // Get session and validate user is logged in
  const session = await auth();
  if (!session?.user?.email) {
    return redirect("/auth/login");
  }

  try {
    const { provider, codename, type, sessionId } = await searchParams;
    const retryProvider =
      provider === PlanProvider.LEMON_SQUEEZY ? PlanProvider.STRIPE : provider;
    
    // Validate the parameters
    cancelParams.parse({
      codename,
      type,
      provider,
      sessionId,
    });
    
    // Fetch plan details (optional - just for displaying plan name)
    const plan = await db
      .select()
      .from(plans)
      .where(eq(plans.codename, codename))
      .limit(1)
      .then((res) => res[0]);

    return (
      <div className="container max-w-lg mx-auto py-12">
        <Card className="p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <XCircle className="h-12 w-12 text-amber-500" />
            <h1 className="text-2xl font-bold">Subscription Cancelled</h1>
            <div>
              <p>
                You have cancelled the checkout process for {plan ? `the ${plan.name} plan` : 'your subscription'}.
              </p>
              <p className="text-muted-foreground mt-1">
                No charges have been made to your account.
              </p>
            </div>

            <div className="flex flex-row gap-2 items-center mt-4">
              <Button asChild>
                <Link href={`/app/subscribe?codename=${codename}&type=${type}&provider=${retryProvider}`}>
                  Try Again
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/app">Back to Dashboard</Link>
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  } catch (error) {
    console.error('Error in subscription cancel page:', error);
    return redirect('/app');
  }
} 
