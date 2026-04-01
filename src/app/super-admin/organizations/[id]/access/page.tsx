"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  SuperAdminEmptyState,
  SuperAdminPageHeader,
  SuperAdminSurface,
} from "@/components/super-admin/primitives";
import type { AccessSection, RoleAccessMatrix } from "@/lib/access/role-access.shared";

type AccessResponse = {
  success: boolean;
  organizationId: string;
  matrix: RoleAccessMatrix;
  sectionMetadata: Record<AccessSection, { label: string; description: string }>;
  error?: string;
};

export default function OrganizationAccessPage() {
  const { id } = useParams() as { id: string };
  const { data, isLoading, mutate } = useSWR<AccessResponse>(
    `/api/super-admin/organizations/${id}/access`
  );
  const [matrix, setMatrix] = useState<RoleAccessMatrix | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.success || !data.matrix) return;
    setMatrix(data.matrix);
  }, [data]);

  const toggle = (role: "admin" | "user", section: AccessSection, enabled: boolean) => {
    if (!matrix) return;
    const next = new Set(matrix[role]);
    if (enabled) next.add(section);
    else next.delete(section);
    setMatrix({
      ...matrix,
      [role]: Array.from(next),
    });
  };

  const save = async () => {
    if (!matrix) return;
    setSaving(true);

    try {
      const response = await fetch(`/api/super-admin/organizations/${id}/access`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ matrix }),
      });

      const payload = (await response.json()) as AccessResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to update role access policy");
      }

      setMatrix(payload.matrix);
      await mutate(payload, false);
      toast.success("Role access policy updated");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update role access policy"
      );
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SuperAdminEmptyState
        title="Loading access policy"
        description="Pulling the role matrix for this church."
        action={<Loader2 className="h-5 w-5 animate-spin text-primary" />}
      />
    );
  }

  if (!data?.success || !matrix) {
    return (
      <div className="space-y-6">
        <SuperAdminPageHeader
          backHref={`/super-admin/organizations/${id}`}
          backLabel="Organization Details"
          eyebrow="Access Control"
          title="Role Access Policy"
          description="Agency-level control over church app section access by role."
        />
        <Button variant="outline" size="sm" asChild>
          <Link href={`/super-admin/organizations/${id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to organization
          </Link>
        </Button>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {data?.error || "Failed to load role access policy"}
        </div>
      </div>
    );
  }

  const sections = Object.entries(data.sectionMetadata) as Array<
    [AccessSection, { label: string; description: string }]
  >;

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        backHref={`/super-admin/organizations/${id}`}
        backLabel="Organization Details"
        eyebrow="Access Control"
        title="Role Access Policy"
        description="Agency-level control over church app section access by role."
        actions={
          <Button variant="outline" onClick={() => mutate()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <SuperAdminSurface>
        <div className="border-b border-slate-200/80 px-6 py-5 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Organization Role Matrix</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Owner access is always full. Configure admin and user section access for this church.
          </p>
        </div>
        <div className="px-6 py-5">
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-left">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    App Section
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Admin
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    User
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sections.map(([section, meta]) => (
                  <tr key={section}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold">{meta.label}</p>
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">Always On</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={matrix.admin.includes(section)}
                        onCheckedChange={(enabled) => toggle("admin", section, enabled)}
                        disabled={saving}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={matrix.user.includes(section)}
                        onCheckedChange={(enabled) => toggle("user", section, enabled)}
                        disabled={saving}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Policy
            </Button>
          </div>
        </div>
      </SuperAdminSurface>
    </div>
  );
}
