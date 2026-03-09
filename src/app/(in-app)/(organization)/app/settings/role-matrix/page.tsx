"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useOrganization from "@/lib/organizations/useOrganization";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import {
  createServiceTemplate,
  createServiceTemplateRoleSlot,
  deleteServiceTemplateRoleSlot,
  getServiceTemplates,
  updateServiceTemplateRoleSlot,
} from "@/app/actions/operations";

const POSITION_LIBRARY_NAME = "__position_library__";
const DEFAULT_TEMPLATE_NAME = "Default Service";

const PREDEFINED_ROLES = [
  "Worship Leader", "Vocalist", "Drummer", "Guitarist", "Keyboardist",
  "Bass Player", "Sound Tech", "Video / Projection", "Livestream",
  "Greeter", "Usher", "Parking Attendant",
  "Kids Ministry Lead", "Nursery", "Security",
  "Prayer Team", "Offering Team", "First Impressions",
];

type ServiceTemplateData = Awaited<ReturnType<typeof getServiceTemplates>>;
type RoleSlotRow = ServiceTemplateData[number]["roleSlots"][number];

function RoleRow({
  slot,
  disabled,
  onDelete,
  onUpdateCount,
}: {
  slot: RoleSlotRow;
  disabled?: boolean;
  onDelete: (id: string) => void;
  onUpdateCount: (id: string, count: number) => void;
}) {
  const count = slot.requiredCount ?? 1;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
      <p className="flex-1 text-sm font-semibold text-slate-900 dark:text-white">
        {slot.roleName}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onUpdateCount(slot.id, Math.max(1, count - 1))}
          disabled={disabled || count <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <Minus className="h-3 w-3" />
        </button>
        <span className="w-6 text-center text-sm font-bold text-slate-900 dark:text-white">
          {count}
        </span>
        <button
          type="button"
          onClick={() => onUpdateCount(slot.id, count + 1)}
          disabled={disabled}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <Plus className="h-3 w-3" />
        </button>
        <span className="ml-1 text-xs text-slate-400">
          {count === 1 ? "seat" : "seats"}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onDelete(slot.id)}
        disabled={disabled}
        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-900/20 dark:hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function RoleMatrixSettingsPage() {
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<ServiceTemplateData>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [customRoleName, setCustomRoleName] = useState("");

  const mainTemplate = useMemo(
    () => templates.find((t) => t.template.id === templateId) ?? null,
    [templates, templateId]
  );

  const roleSlots = useMemo(() => mainTemplate?.roleSlots ?? [], [mainTemplate]);

  const suggestedRoles = useMemo(() => {
    const added = new Set(roleSlots.map((s) => s.roleName.trim().toLowerCase()));
    return PREDEFINED_ROLES.filter((r) => !added.has(r.trim().toLowerCase()));
  }, [roleSlots]);

  const loadTemplates = useCallback(async () => {
    if (!organization?.id) return;
    setLoading(true);
    try {
      let rows = await getServiceTemplates(organization.id);
      const visible = rows.filter((r) => r.template.name !== POSITION_LIBRARY_NAME);

      if (visible.length === 0) {
        await createServiceTemplate({
          organizationId: organization.id,
          name: DEFAULT_TEMPLATE_NAME,
          serviceType: "sunday_am",
        });
        rows = await getServiceTemplates(organization.id);
      }

      setTemplates(rows);
      setTemplateId((cur) => {
        const vis = rows.filter((r) => r.template.name !== POSITION_LIBRARY_NAME);
        if (cur && vis.some((v) => v.template.id === cur)) return cur;
        return vis[0]?.template.id ?? null;
      });
    } catch {
      toast.error("Failed to load roles");
    } finally {
      setLoading(false);
    }
  }, [organization?.id]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleAddRole = async (roleName: string) => {
    if (!templateId || !roleName.trim()) return;
    setSaving(true);
    try {
      await createServiceTemplateRoleSlot({
        templateId,
        roleName: roleName.trim(),
        assignmentType: "either",
        isEnabled: true,
        requiredCount: 1,
        isRequired: true,
        sortOrder: roleSlots.length,
      });
      setCustomRoleName("");
      await loadTemplates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add role");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCount = async (slotId: string, count: number) => {
    if (count < 1) return;
    setSaving(true);
    try {
      const slot = roleSlots.find((s) => s.id === slotId);
      if (!slot) return;
      await updateServiceTemplateRoleSlot(slotId, {
        roleName: slot.roleName,
        assignmentType: slot.assignmentType,
        isEnabled: slot.isEnabled,
        requiredCount: count,
        isRequired: slot.isRequired,
        notes: slot.notes ?? null,
      });
      await loadTemplates();
    } catch {
      toast.error("Failed to update seat count");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    setSaving(true);
    try {
      await deleteServiceTemplateRoleSlot(slotId);
      await loadTemplates();
    } catch {
      toast.error("Failed to remove role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-100 p-8 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Settings
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          Church Roles
        </h1>
        <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
          Define the positions your church needs to fill at each service. These
          roles appear on the scheduling board when you assign people.
        </p>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-lime-500" />
        </div>
      ) : (
        <>
          {/* Add a role */}
          <section className="rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
            <div className="border-b border-slate-100 p-6 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Add a Role
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Click a common role to add it, or type a custom one below.
              </p>
            </div>

            {suggestedRoles.length > 0 && (
              <div className="flex flex-wrap gap-2 px-6 pt-5 pb-3">
                {suggestedRoles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleAddRole(role)}
                    disabled={saving}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-lime-400 hover:bg-lime-50 hover:text-lime-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-lime-500 dark:hover:bg-lime-900/20 dark:hover:text-lime-400"
                  >
                    + {role}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 p-6 pt-3">
              <Input
                className="flex-1"
                placeholder="Custom role name..."
                value={customRoleName}
                onChange={(e) => setCustomRoleName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customRoleName.trim()) {
                    handleAddRole(customRoleName);
                  }
                }}
                disabled={saving}
              />
              <Button
                type="button"
                onClick={() => handleAddRole(customRoleName)}
                disabled={saving || !customRoleName.trim()}
              >
                {saving ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                Add
              </Button>
            </div>
          </section>

          {/* Your roles */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Your Roles
              </h2>
              {roleSlots.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {roleSlots.length}
                </span>
              )}
            </div>

            {roleSlots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-700">
                <p className="text-sm text-slate-500">
                  No roles added yet. Add some above to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {roleSlots.map((slot) => (
                  <RoleRow
                    key={slot.id}
                    slot={slot}
                    disabled={saving}
                    onDelete={handleDeleteSlot}
                    onUpdateCount={handleUpdateCount}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
