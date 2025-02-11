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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight } from "lucide-react";

const planDetails = {
  name: "Pro Plan",
  price: "$19",
  interval: "month",
  status: "active",
  nextBilling: "March 1, 2024",
};

const quotas = [
  {
    name: "API Requests",
    used: 7532,
    limit: 10000,
    percentage: 75,
  },
  {
    name: "Storage",
    used: 2.1,
    limit: 5,
    unit: "GB",
    percentage: 42,
  },
  {
    name: "Team Members",
    used: 3,
    limit: 5,
    percentage: 60,
  },
];

export default function BillingSettingsPage() {
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
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {planDetails.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {planDetails.price}/{planDetails.interval}
                </div>
              </div>
              <Badge variant="outline" className="capitalize">
                {planDetails.status}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Next billing date: {planDetails.nextBilling}
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline">
              Manage Subscription
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resource Usage</CardTitle>
            <CardDescription>
              Monitor your resource consumption.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {quotas.map((quota) => (
              <div key={quota.name} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-medium">{quota.name}</div>
                  <div className="text-muted-foreground">
                    {quota.used}
                    {quota.unit ? quota.unit : ""} /{" "}
                    {quota.limit}
                    {quota.unit ? quota.unit : ""}
                  </div>
                </div>
                <Progress value={quota.percentage} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 