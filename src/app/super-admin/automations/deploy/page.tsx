"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import { Loader2, RefreshCcw, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SuperAdminMetricCard,
  SuperAdminPageHeader,
  SuperAdminTableShell,
  SuperAdminToolbar,
} from "@/components/super-admin/primitives";

type OrganizationRow = {
  id: string;
  name: string;
  planName: string;
};

type OrganizationsResponse = {
  organizations: OrganizationRow[];
};

type TemplateRow = {
  key: string;
  name: string;
  description: string;
  category: string;
  triggerEvent: string;
  nodeCount: number;
  source: "system" | "managed";
  status: string;
};

type TemplatesResponse = {
  success: boolean;
  templates: TemplateRow[];
  error?: string;
};

type DeployResult = {
  organizationId: string;
  status: "installed" | "updated" | "already_installed" | "failed";
  workflowId?: string;
  error?: string;
};

type DeployResponse = {
  success: boolean;
  templateKey: string;
  skipIfInstalled: boolean;
  results: DeployResult[];
  error?: string;
};

export default function SuperAdminBulkDeployPage() {
  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput);
  const [templateKey, setTemplateKey] = useState<string>("");
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);
  const [skipIfInstalled, setSkipIfInstalled] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployResponse, setDeployResponse] = useState<DeployResponse | null>(null);

  const { data: organizationsData, mutate: mutateOrganizations } = useSWR<OrganizationsResponse>(
    "/api/super-admin/organizations?page=1&limit=250"
  );
  const { data: templatesData, mutate: mutateTemplates } = useSWR<TemplatesResponse>(
    "/api/super-admin/automations/deploy-template"
  );

  const organizations = organizationsData?.organizations ?? [];
  const templates = templatesData?.templates ?? [];

  const filteredOrganizations = useMemo(() => {
    if (!deferredSearch.trim()) return organizations;
    const query = deferredSearch.trim().toLowerCase();
    return organizations.filter((org) => org.name.toLowerCase().includes(query));
  }, [organizations, deferredSearch]);

  const selectedSet = useMemo(() => new Set(selectedOrgIds), [selectedOrgIds]);

  const allFilteredSelected =
    filteredOrganizations.length > 0 &&
    filteredOrganizations.every((org) => selectedSet.has(org.id));

  const deploySummary = useMemo(() => {
    if (!deployResponse?.results) {
      return { installed: 0, updated: 0, alreadyInstalled: 0, failed: 0 };
    }
    return deployResponse.results.reduce(
      (acc, row) => {
        if (row.status === "installed") acc.installed += 1;
        else if (row.status === "updated") acc.updated += 1;
        else if (row.status === "already_installed") acc.alreadyInstalled += 1;
        else acc.failed += 1;
        return acc;
      },
      { installed: 0, updated: 0, alreadyInstalled: 0, failed: 0 }
    );
  }, [deployResponse]);

  const toggleOrganization = (organizationId: string, checked: boolean) => {
    startTransition(() => {
      setSelectedOrgIds((prev) => {
        if (checked) return Array.from(new Set([...prev, organizationId]));
        return prev.filter((id) => id !== organizationId);
      });
    });
  };

  const selectAllFiltered = () => {
    startTransition(() => {
      setSelectedOrgIds((prev) => {
        const next = new Set(prev);
        filteredOrganizations.forEach((org) => next.add(org.id));
        return Array.from(next);
      });
    });
  };

  const clearFiltered = () => {
    const filteredSet = new Set(filteredOrganizations.map((org) => org.id));
    startTransition(() => {
      setSelectedOrgIds((prev) => prev.filter((id) => !filteredSet.has(id)));
    });
  };

  const runDeploy = async () => {
    if (!templateKey) {
      toast.error("Select a template first");
      return;
    }
    if (selectedOrgIds.length === 0) {
      toast.error("Select at least one organization");
      return;
    }

    setIsDeploying(true);
    try {
      const response = await fetch("/api/super-admin/automations/deploy-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey,
          organizationIds: selectedOrgIds,
          skipIfInstalled,
        }),
      });
      const payload = (await response.json()) as DeployResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Bulk deploy failed");
      }
      setDeployResponse(payload);
      toast.success("Bulk deployment finished");
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Bulk deploy failed");
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="space-y-6">
      <SuperAdminPageHeader
        eyebrow="Workflow Rollout"
        eyebrowIcon={Rocket}
        title="Bulk Template Deployment"
        description="Push proven automation templates to many churches in a single run without dropping into separate setup screens."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void mutateOrganizations();
              void mutateTemplates();
            }}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Refresh sources
          </Button>
        }
        stats={[
          { label: "Templates", value: templates.length, detail: "Deployable right now" },
          { label: "Selected", value: selectedOrgIds.length, detail: "Churches queued" },
          {
            label: "Last Run",
            value: deploySummary.installed + deploySummary.updated,
            detail: "Installs + updates",
          },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <SuperAdminMetricCard
          label="Install Success"
          value={deploySummary.installed}
          detail="Installed in the latest run"
          icon={Rocket}
          tone="success"
        />
        <SuperAdminMetricCard
          label="Already Present"
          value={deploySummary.alreadyInstalled}
          detail="Skipped because already installed"
          icon={RefreshCcw}
        />
        <SuperAdminMetricCard
          label="Updated"
          value={deploySummary.updated}
          detail="Existing installs refreshed"
          icon={Rocket}
        />
        <SuperAdminMetricCard
          label="Failures"
          value={deploySummary.failed}
          detail="Rows that need manual follow-up"
          icon={Loader2}
          tone={deploySummary.failed > 0 ? "danger" : "default"}
        />
      </div>

      <SuperAdminToolbar>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-center">
          <Select value={templateKey} onValueChange={setTemplateKey}>
            <SelectTrigger className="border-slate-200/80 bg-white/90 dark:border-slate-700 dark:bg-slate-900/80">
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.key} value={template.key}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search organizations..."
            value={searchInput}
            className="border-slate-200/80 bg-white/90 dark:border-slate-700 dark:bg-slate-900/80"
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={selectAllFiltered} disabled={filteredOrganizations.length === 0 || allFilteredSelected}>
            Select filtered
          </Button>
          <Button variant="outline" size="sm" onClick={clearFiltered} disabled={selectedOrgIds.length === 0}>
            Clear filtered
          </Button>
          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
            <Checkbox
              checked={skipIfInstalled}
              onCheckedChange={(value) => setSkipIfInstalled(value === true)}
            />
            Skip installed
          </label>
          <Badge variant="secondary">Selected: {selectedOrgIds.length}</Badge>
          {templateKey ? <Badge variant="outline">Template ready</Badge> : <Badge variant="outline">Choose template</Badge>}
        </div>
      </SuperAdminToolbar>

      <SuperAdminTableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Nodes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.key}>
                <TableCell>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{template.name}</p>
                    <p className="text-xs text-slate-500">{template.description}</p>
                  </div>
                </TableCell>
                <TableCell>{template.category}</TableCell>
                <TableCell className="text-xs text-slate-500">{template.triggerEvent}</TableCell>
                <TableCell>
                  <Badge variant={template.source === "managed" ? "default" : "secondary"}>
                    {template.source}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={template.status === "published" ? "outline" : "secondary"}>
                    {template.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm font-semibold text-slate-700">
                  {template.nodeCount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SuperAdminTableShell>

      <SuperAdminTableShell>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[48px]">Pick</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Plan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrganizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-slate-500 dark:text-slate-400">
                  No organizations found.
                </TableCell>
              </TableRow>
            ) : (
              filteredOrganizations.map((org) => {
                const checked = selectedSet.has(org.id);
                return (
                  <TableRow key={org.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/40">
                    <TableCell>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleOrganization(org.id, value === true)}
                      />
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900 dark:text-white">{org.name}</TableCell>
                    <TableCell>{org.planName || "No plan"}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </SuperAdminTableShell>

      <div className="flex justify-end">
        <Button onClick={() => void runDeploy()} disabled={isDeploying || templateKey === "" || selectedOrgIds.length === 0}>
          {isDeploying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Deploy template
        </Button>
      </div>

      {deployResponse ? (
        <SuperAdminTableShell>
          <div className="border-b border-slate-200/80 px-6 py-4 dark:border-slate-700">
            <div className="flex flex-wrap gap-2">
              <Badge>Installed: {deploySummary.installed}</Badge>
              <Badge variant="default">Updated: {deploySummary.updated}</Badge>
              <Badge variant="secondary">Already installed: {deploySummary.alreadyInstalled}</Badge>
              <Badge variant={deploySummary.failed > 0 ? "destructive" : "outline"}>
                Failed: {deploySummary.failed}
              </Badge>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployResponse.results.map((row) => {
                const org = organizations.find((item) => item.id === row.organizationId);
                return (
                  <TableRow key={row.organizationId} className="hover:bg-slate-50/70 dark:hover:bg-slate-950/40">
                    <TableCell>{org?.name ?? row.organizationId}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.status === "installed"
                            ? "default"
                            : row.status === "updated"
                              ? "default"
                            : row.status === "already_installed"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {row.status.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.error ?? "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </SuperAdminTableShell>
      ) : null}
    </div>
  );
}
