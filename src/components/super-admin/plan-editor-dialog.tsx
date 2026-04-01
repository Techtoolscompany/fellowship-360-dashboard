"use client";

import useSWR from "swr";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
import { PlanForm } from "@/components/forms/plan-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PlanFormValues } from "@/lib/validations/plan.schema";

interface PlanEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  planId?: string | null;
  onSaved?: () => Promise<unknown> | unknown;
}

export function PlanEditorDialog({
  open,
  onOpenChange,
  mode,
  planId,
  onSaved,
}: PlanEditorDialogProps) {
  const isEditing = mode === "edit";
  const { data: plan, isLoading } = useSWR<PlanFormValues>(
    open && isEditing && planId ? `/api/super-admin/plans/${planId}` : null
  );

  const handleSubmit = async (data: PlanFormValues) => {
    try {
      const response = await fetch("/api/super-admin/plans", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(isEditing ? { ...data, id: planId } : data),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || `Failed to ${isEditing ? "update" : "create"} plan`);
      }

      toast.success(isEditing ? "Plan updated" : "Plan created");
      await onSaved?.();
      onOpenChange(false);
    } catch (requestError) {
      toast.error(
        requestError instanceof Error
          ? requestError.message
          : `Failed to ${isEditing ? "update" : "create"} plan`
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto rounded-[28px] border-slate-200/80 bg-white/95 dark:border-slate-700 dark:bg-slate-900/95">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            {isEditing ? "Edit plan" : "Create plan"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update pricing, quotas, and billing identifiers without leaving the Plans tab."
              : "Add a commercial plan directly from the Plans tab."}
          </DialogDescription>
        </DialogHeader>

        {isEditing && !plan ? (
          <div className="flex h-64 items-center justify-center rounded-[24px] border border-slate-200/80 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-950/50">
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isLoading ? "Loading plan..." : "Plan not found"}
            </div>
          </div>
        ) : (
          <PlanForm
            initialData={plan}
            onSubmit={handleSubmit}
            submitLabel={isEditing ? "Update Plan" : "Create Plan"}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
