"use client";

import type { AutomationCompliancePolicy } from "@/lib/automations/types";

type AutomationPolicyFormProps = {
  value: AutomationCompliancePolicy;
  onChange: (value: AutomationCompliancePolicy) => void;
};

export function AutomationPolicyForm({
  value,
  onChange,
}: AutomationPolicyFormProps) {
  return (
    <div className="grid gap-4 md:grid-cols-7">
      <label className="space-y-1 text-xs text-slate-600">
        Enrollment mode
        <select
          className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          value={value.enrollmentMode}
          onChange={(event) =>
            onChange({
              ...value,
              enrollmentMode: event.target.value as AutomationCompliancePolicy["enrollmentMode"],
            })
          }
        >
          <option value="every_trigger">Every trigger</option>
          <option value="once_per_contact">Once per contact</option>
          <option value="cooldown">Cooldown re-entry</option>
        </select>
      </label>

      <label className="space-y-1 text-xs text-slate-600">
        Cooldown (minutes)
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          type="number"
          min={1}
          value={value.reentryCooldownMinutes}
          onChange={(event) =>
            onChange({
              ...value,
              reentryCooldownMinutes: Number(event.target.value || 1),
            })
          }
        />
      </label>

      <label className="space-y-1 text-xs text-slate-600">
        Quiet hours
        <select
          className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          value={value.quietHoursEnabled ? "on" : "off"}
          onChange={(event) =>
            onChange({
              ...value,
              quietHoursEnabled: event.target.value === "on",
            })
          }
        >
          <option value="on">Enabled</option>
          <option value="off">Disabled</option>
        </select>
      </label>

      <label className="space-y-1 text-xs text-slate-600">
        Quiet start
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          value={value.quietHoursStart}
          onChange={(event) =>
            onChange({
              ...value,
              quietHoursStart: event.target.value,
            })
          }
          placeholder="21:00"
        />
      </label>

      <label className="space-y-1 text-xs text-slate-600">
        Quiet end
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          value={value.quietHoursEnd}
          onChange={(event) =>
            onChange({
              ...value,
              quietHoursEnd: event.target.value,
            })
          }
          placeholder="08:00"
        />
      </label>

      <label className="space-y-1 text-xs text-slate-600">
        Daily send cap
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          type="number"
          min={1}
          value={value.dailySendCap}
          onChange={(event) =>
            onChange({
              ...value,
              dailySendCap: Number(event.target.value || 1),
            })
          }
        />
      </label>

      <label className="space-y-1 text-xs text-slate-600">
        Respect opt-out
        <select
          className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          value={value.respectOptOut ? "yes" : "no"}
          onChange={(event) =>
            onChange({
              ...value,
              respectOptOut: event.target.value === "yes",
            })
          }
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
    </div>
  );
}

