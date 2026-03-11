"use client";

import { useRouter } from "next/navigation";
import { PlanForm } from "@/components/forms/plan-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { PlanFormValues } from "@/lib/validations/plan.schema";
import { toast } from "sonner";

export default function CreatePlanPage() {
  const router = useRouter();

  const handleSubmit = async (data: PlanFormValues) => {
    try {
      const response = await fetch("/api/super-admin/plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to create plan");
      }

      toast.success("Plan created");
      router.push("/super-admin/plans");
    } catch (error) {
      console.error("Error creating plan:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create plan");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/super-admin/plans">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">Create Plan</h1>
      </div>

      <div className="border rounded-lg p-4">
        <PlanForm onSubmit={handleSubmit} submitLabel="Create Plan" />
      </div>
    </div>
  );
} 
