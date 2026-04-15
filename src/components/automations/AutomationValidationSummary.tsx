"use client";

type AutomationValidationSummaryProps = {
  errors: string[];
};

export function AutomationValidationSummary({
  errors,
}: AutomationValidationSummaryProps) {
  if (errors.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
        Workflow is valid and publish-ready.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
      <p className="text-xs font-semibold text-red-700">Publish blockers</p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-red-700">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
