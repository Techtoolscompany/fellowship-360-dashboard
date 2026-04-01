"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { toast } from "sonner";
import { PlanForm } from "@/components/forms/plan-form";
import { Button } from "@/components/ui/button";
import {
  SuperAdminPageHeader,
  SuperAdminSurface,
} from "@/components/super-admin/primitives";
import type { PlanFormValues } from "@/lib/validations/plan.schema";

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
    } catch (requestError) {
      console.error("Error creating plan:", requestError);
      toast.error(requestError instanceof Error ? requestError.message : "Failed to create plan");
    }
  };

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        backHref="/super-admin/plans"
        backLabel="Plans"
        eyebrow="Commercial Setup"
        eyebrowIcon={Plus}
        title="Create Plan"
        description="Add a new commercial plan without leaving the super-admin operating shell."
      />

      <SuperAdminSurface className="p-6">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Plan Definition</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Configure pricing, quotas, and the default plan behavior in one form.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/super-admin/plans">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Link>
          </Button>
        </div>
        <PlanForm onSubmit={handleSubmit} submitLabel="Create Plan" />
      </SuperAdminSurface>
    </div>
  );
}
