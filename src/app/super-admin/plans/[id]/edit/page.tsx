"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PlanForm } from "@/components/forms/plan-form";
import { Button } from "@/components/ui/button";
import {
  SuperAdminEmptyState,
  SuperAdminPageHeader,
  SuperAdminSurface,
} from "@/components/super-admin/primitives";
import type { PlanFormValues } from "@/lib/validations/plan.schema";

export default function EditPlanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: plan, error } = useSWR<PlanFormValues>(`/api/super-admin/plans/${id}`);

  const handleSubmit = async (data: PlanFormValues) => {
    try {
      const response = await fetch("/api/super-admin/plans", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...data, id }),
      });

      if (response.ok === false) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to update plan");
      }

      toast.success("Plan updated");
      router.push("/super-admin/plans");
    } catch (requestError) {
      console.error("Error updating plan:", requestError);
      toast.error(requestError instanceof Error ? requestError.message : "Failed to update plan");
    }
  };

  if (error) {
    return (
      <SuperAdminEmptyState
        title="Error loading plan"
        description="Failed to load the plan details. Return to the plans index and try again."
        action={
          <Button variant="outline" asChild>
            <Link href="/super-admin/plans">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to plans
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        backHref="/super-admin/plans"
        backLabel="Plans"
        eyebrow="Commercial Setup"
        eyebrowIcon={Pencil}
        title="Edit Plan"
        description="Update commercial settings while staying inside the same super-admin workflow."
      />

      <SuperAdminSurface className="p-6">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-slate-200/80 pb-4 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Plan Definition</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pricing, quota, and billing identifiers for the selected plan.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/super-admin/plans">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Link>
          </Button>
        </div>
        {plan ? (
          <PlanForm initialData={plan} onSubmit={handleSubmit} submitLabel="Update Plan" />
        ) : (
          <div className="flex h-96 items-center justify-center text-center">
            <div>
              <div className="text-lg font-semibold text-slate-900 dark:text-white">Loading plan...</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Pulling the current plan definition into the editor.
              </div>
            </div>
          </div>
        )}
      </SuperAdminSurface>
    </div>
  );
}
