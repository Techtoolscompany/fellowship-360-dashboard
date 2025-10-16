"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Clock, HelpCircle, TicketCheck } from "lucide-react";
import useOrganization from "@/lib/organizations/useOrganization";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import useCredits from "@/lib/organizations/useCredits";
import { creditsConfig } from "@/lib/credits/config";

export default function BillingSettingsPage() {
  const { organization, isLoading, error } = useOrganization();

  const { credits } = useCredits();

  // Check if organization has a plan with quotas
  const plan = organization?.plan;
  const quotas = plan?.quotas;

  // Determine subscription status
  const hasSubscription = plan && !plan.default;

  // Function to render quota features
  const renderQuotaFeatures = () => {
    if (!quotas) return null;

    // Convert quotas object to array for mapping
    const quotaItems = Object.entries(quotas).map(([key, value]) => {
      // Format the key for display
      const displayName = key
        .replace(/([A-Z])/g, " $1") // Add space before capital letters
        .replace(/^./, (str) => str.toUpperCase()); // Capitalize first letter

      // Format the value based on its type
      let displayValue;
      if (typeof value === "boolean") {
        // Show true/false values as Yes/No
        displayValue = value ? "Yes" : "No";
      } else if (typeof value === "number") {
        // Show numbers as-is
        displayValue = value.toLocaleString();
      } else {
        // Show strings as-is
        displayValue = value;
      }

      return (
        <div
          key={key}
          className="flex items-center justify-between py-2 border-b last:border-hidden"
        >
          <div className="font-medium text-sm">{displayName}</div>
          <div className="text-sm">{displayValue}</div>
        </div>
      );
    });

    return quotaItems.length > 0 ? (
      <div className="space-y-0 divide-y">{quotaItems}</div>
    ) : (
      <p className="text-sm text-muted-foreground">
        No features information available.
      </p>
    );
  };

  // Since UserOrganizationWithPlan doesn't have customer IDs,
  // we'll just show a contact support message instead
  const customerIdSection = (
    <div className="mt-4 pt-4 border-t">
      <p className="text-xs text-muted-foreground">
        Need help with your subscription? Please contact support and mention
        your organization ID:
        <span className="font-mono ml-1 bg-muted px-1 py-0.5 rounded text-xs">
          {organization?.id || "Not available"}
        </span>
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Billing & Usage</h3>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and monitor resource usage.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>
              Your subscription plan and billing details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">
                Error loading plan details. Please refresh the page.
              </p>
            ) : (
              <>
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      {plan?.name || "Free Plan"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {!hasSubscription && (
                        <span>Limited features and capabilities</span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={hasSubscription ? "default" : "outline"}
                    className="capitalize"
                  >
                    {hasSubscription ? "active" : "free"}
                  </Badge>
                </div>
                {customerIdSection}
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/app/billing">
                Manage Subscription
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/contact">
                Get Help
                <HelpCircle className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/app/settings/billing/redeem-ltd">
                Redeem LTD Code
                <TicketCheck className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Plan Includes</CardTitle>
            <CardDescription>
              Features and capabilities included in your current plan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">
                Error loading plan features. Please refresh the page.
              </p>
            ) : (
              renderQuotaFeatures()
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Your Credits</CardTitle>
            <CardDescription>
              Your available credits and their expiration date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* List of all the credits and their count */}
            <div className="space-y-4">
              {Object.entries(credits || {}).map(
                ([creditType, creditCount]) => (
                  <div
                    key={creditType}
                    className="flex items-center justify-between"
                  >
                    <div className="font-medium text-sm">
                      {
                        creditsConfig[creditType as keyof typeof creditsConfig]
                          .name
                      }
                    </div>
                    <div className="text-sm">
                      {creditCount.toLocaleString()}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Button to view history of credits */}
            <Button variant="ghost" className="w-full mt-4" asChild>
              <Link href="/app/credits/history">
                View History
                <Clock className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
