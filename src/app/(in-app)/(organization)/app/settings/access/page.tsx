"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import useOrganization from "@/lib/organizations/useOrganization";
import {
  getOrganizationRoleAccess,
  updateOrganizationRoleAccess,
} from "@/app/actions/access";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

type RoleAccessPayload = Awaited<ReturnType<typeof getOrganizationRoleAccess>>;

export default function SettingsAccessPage() {
  const { organization } = useOrganization();
  const organizationId = organization?.id;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payload, setPayload] = useState<RoleAccessPayload | null>(null);
  const [matrix, setMatrix] = useState<RoleAccessPayload["matrix"] | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const data = await getOrganizationRoleAccess(organizationId);
      setPayload(data);
      setMatrix(data.matrix);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load access settings");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canManage = payload?.role === "admin" || payload?.role === "owner";
  const sectionEntries = payload ? Object.entries(payload.sectionMetadata) : [];

  const toggle = (role: "admin" | "user", section: string, enabled: boolean) => {
    if (!matrix) return;
    const current = new Set(matrix[role]);
    if (enabled) current.add(section as (typeof matrix)[typeof role][number]);
    else current.delete(section as (typeof matrix)[typeof role][number]);
    setMatrix({
      ...matrix,
      [role]: Array.from(current),
    });
  };

  const save = async () => {
    if (!organizationId || !matrix || !canManage) return;
    setSaving(true);
    try {
      const result = await updateOrganizationRoleAccess({
        organizationId,
        matrix,
      });
      setMatrix(result.matrix);
      toast.success("Access settings updated");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Failed to update access settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!payload || !matrix) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Unable to load access configuration.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/70">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Access Control</h1>
        <p className="mt-2 text-sm text-slate-500">
          Control which parts of the app are available for each organization role.
        </p>
      </div>

      {!canManage ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
          You need admin or owner access to update role permissions.
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                App Section
              </th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                Admin
              </th>
              <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                User
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sectionEntries.map(([section, meta]) => (
              <tr key={section}>
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{meta.label}</p>
                  <p className="text-xs text-slate-500">{meta.description}</p>
                </td>
                <td className="px-4 py-3">
                  <Switch
                    checked={matrix.admin.includes(section as (typeof matrix.admin)[number])}
                    onCheckedChange={(enabled) => toggle("admin", section, enabled)}
                    disabled={!canManage || saving}
                  />
                </td>
                <td className="px-4 py-3">
                  <Switch
                    checked={matrix.user.includes(section as (typeof matrix.user)[number])}
                    onCheckedChange={(enabled) => toggle("user", section, enabled)}
                    disabled={!canManage || saving}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => void save()} disabled={!canManage || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Access Rules
        </Button>
      </div>
    </div>
  );
}

