"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import useOrganization from "@/lib/organizations/useOrganization";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createGraceKnowledge,
  deleteGraceKnowledge,
  getGraceCalls,
  getGraceFollowupProposals,
  getGraceKnowledge,
  getGraceKnowledgeVersions,
  getGraceProviderConfigs,
  getGraceToolAudit,
  updateGraceKnowledge,
} from "@/app/actions/grace";
import { getGraceSettings, updateGraceSettings } from "@/app/actions/grace-settings";
import { computeRuntimeHealth } from "@/lib/grace/ops-health";

const graceSettingsSchema = z.object({
  graceEnabled: z.boolean(),
  proactiveMode: z.enum(["off", "quiet", "normal"]),
  churchName: z.string().min(2, "Church name must be at least 2 characters."),
  churchDenomination: z.string().optional(),
  churchCity: z.string().optional(),
  customSystemPrompt: z.string().optional(),
});

type KnowledgeRow = Awaited<ReturnType<typeof getGraceKnowledge>>[number];
type KnowledgeVersionRow = Awaited<ReturnType<typeof getGraceKnowledgeVersions>>[number];
type ProviderConfigRow = Awaited<ReturnType<typeof getGraceProviderConfigs>>[number];
type ToolAuditRow = Awaited<ReturnType<typeof getGraceToolAudit>>[number];
type GraceCallRow = Awaited<ReturnType<typeof getGraceCalls>>[number];
type FollowupProposalRow = Awaited<ReturnType<typeof getGraceFollowupProposals>>[number];

function fmtDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function formatJsonPreview(value: unknown, maxLength = 220) {
  if (value === null || value === undefined) return "No payload";
  try {
    const json = JSON.stringify(value);
    return json.length > maxLength ? `${json.slice(0, maxLength)}...` : json;
  } catch {
    return "Unable to render payload";
  }
}

function isProviderConfigValid(row: ProviderConfigRow) {
  const validation = (row as { validation?: { isValid?: boolean } }).validation;
  if (validation && validation.isValid === false) {
    return false;
  }
  return true;
}

export default function GraceSettingsPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [loading, setLoading] = useState(true);
  const [knowledge, setKnowledge] = useState<KnowledgeRow[]>([]);
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfigRow[]>([]);
  const [toolAuditRows, setToolAuditRows] = useState<ToolAuditRow[]>([]);
  const [graceCalls, setGraceCalls] = useState<GraceCallRow[]>([]);
  const [followupProposals, setFollowupProposals] = useState<FollowupProposalRow[]>([]);

  const [kbTitle, setKbTitle] = useState("");
  const [kbContent, setKbContent] = useState("");
  const [kbVisibility, setKbVisibility] = useState<"public" | "internal">("internal");
  const [kbUseForGrace, setKbUseForGrace] = useState(true);
  const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null);
  const [knowledgeMutatingId, setKnowledgeMutatingId] = useState<string | null>(null);
  const [knowledgeHistoryOpenId, setKnowledgeHistoryOpenId] = useState<string | null>(null);
  const [knowledgeHistoryLoadingId, setKnowledgeHistoryLoadingId] = useState<string | null>(null);
  const [knowledgeVersionsByEntryId, setKnowledgeVersionsByEntryId] = useState<
    Record<string, KnowledgeVersionRow[]>
  >({});

  const form = useForm<z.infer<typeof graceSettingsSchema>>({
    resolver: zodResolver(graceSettingsSchema),
    defaultValues: {
      graceEnabled: true,
      proactiveMode: "normal",
      churchName: "",
      churchDenomination: "",
      churchCity: "",
      customSystemPrompt: "",
    },
  });

  const loadPage = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [settings, knowledgeRows, providerRows, auditRows, callRows, proposalRows] =
        await Promise.all([
          getGraceSettings(orgId),
          getGraceKnowledge(orgId),
          getGraceProviderConfigs(orgId),
          getGraceToolAudit(orgId),
          getGraceCalls(orgId),
          getGraceFollowupProposals(orgId),
        ]);

      form.reset({
        graceEnabled: settings?.graceEnabled ?? true,
        proactiveMode: settings?.proactiveMode ?? "normal",
        churchName: settings?.churchName || organization?.name || "",
        churchDenomination: settings?.churchDenomination || "",
        churchCity: settings?.churchCity || "",
        customSystemPrompt: settings?.customSystemPrompt || "",
      });

      setKnowledge(knowledgeRows);
      setProviderConfigs(providerRows);
      setToolAuditRows(auditRows);
      setGraceCalls(callRows);
      setFollowupProposals(proposalRows);
    } catch (error) {
      console.error("Failed to load Grace settings:", error);
      toast.error("Failed to load Grace settings");
    } finally {
      setLoading(false);
    }
  }, [form, orgId, organization?.name]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const runtimeHealth = useMemo(() => computeRuntimeHealth(toolAuditRows), [toolAuditRows]);

  const providerSummary = useMemo(() => {
    const activeProviders = providerConfigs.filter(
      (row) => row.isActive && row.mode !== "disabled"
    );
    return {
      total: providerConfigs.length,
      active: activeProviders.length,
      invalid: activeProviders.filter((row) => !isProviderConfigValid(row)).length,
      channels: new Set(activeProviders.map((row) => row.channel)).size,
    };
  }, [providerConfigs]);

  const sequenceStats = useMemo(() => {
    const totals = { pending: 0, sent: 0, approved: 0, rejected: 0 };
    for (const proposal of followupProposals) {
      if (proposal.status === "pending") totals.pending += 1;
      if (proposal.status === "sent") totals.sent += 1;
      if (proposal.status === "approved") totals.approved += 1;
      if (proposal.status === "rejected") totals.rejected += 1;
    }
    return totals;
  }, [followupProposals]);

  async function onSubmit(values: z.infer<typeof graceSettingsSchema>) {
    if (!orgId) return;
    try {
      await updateGraceSettings(orgId, values);
      toast.success("Grace settings updated.");
    } catch {
      toast.error("Failed to update settings.");
    }
  }

  const resetKnowledgeComposer = () => {
    setKbTitle("");
    setKbContent("");
    setKbVisibility("internal");
    setKbUseForGrace(true);
    setEditingKnowledgeId(null);
  };

  const handleSubmitKnowledge = async () => {
    if (!orgId || !kbTitle.trim() || !kbContent.trim()) return;
    try {
      setKnowledgeMutatingId(editingKnowledgeId ?? "new");
      if (editingKnowledgeId) {
        await updateGraceKnowledge({
          organizationId: orgId,
          knowledgeId: editingKnowledgeId,
          title: kbTitle.trim(),
          content: kbContent.trim(),
          visibility: kbVisibility,
          useForGrace: kbUseForGrace,
        });
        toast.success("Knowledge updated");
      } else {
        await createGraceKnowledge({
          organizationId: orgId,
          title: kbTitle.trim(),
          content: kbContent.trim(),
          visibility: kbVisibility,
          useForGrace: kbUseForGrace,
        });
        toast.success("Knowledge added");
      }

      resetKnowledgeComposer();
      await loadPage();
    } catch (error) {
      console.error("Failed to save knowledge:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save knowledge");
    } finally {
      setKnowledgeMutatingId(null);
    }
  };

  const handleEditKnowledge = (entry: KnowledgeRow) => {
    setEditingKnowledgeId(entry.id);
    setKbTitle(entry.title);
    setKbContent(entry.content);
    setKbVisibility(entry.visibility ?? "internal");
    setKbUseForGrace(Boolean(entry.useForGrace));
  };

  const handleDeleteKnowledge = async (entry: KnowledgeRow) => {
    if (!orgId) return;
    const confirmed = window.confirm(
      `Delete "${entry.title}"? Version history will still be kept.`
    );
    if (!confirmed) return;

    try {
      setKnowledgeMutatingId(entry.id);
      await deleteGraceKnowledge({
        organizationId: orgId,
        knowledgeId: entry.id,
      });
      toast.success("Knowledge deleted");
      if (editingKnowledgeId === entry.id) {
        resetKnowledgeComposer();
      }
      if (knowledgeHistoryOpenId === entry.id) {
        setKnowledgeHistoryOpenId(null);
      }
      await loadPage();
    } catch (error) {
      console.error("Failed to delete knowledge:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete knowledge");
    } finally {
      setKnowledgeMutatingId(null);
    }
  };

  const handleToggleKnowledgeHistory = async (entryId: string) => {
    if (!orgId) return;
    if (knowledgeHistoryOpenId === entryId) {
      setKnowledgeHistoryOpenId(null);
      return;
    }

    setKnowledgeHistoryOpenId(entryId);
    if (knowledgeVersionsByEntryId[entryId]) {
      return;
    }

    try {
      setKnowledgeHistoryLoadingId(entryId);
      const versions = await getGraceKnowledgeVersions({
        organizationId: orgId,
        knowledgeId: entryId,
        limit: 12,
      });
      setKnowledgeVersionsByEntryId((current) => ({
        ...current,
        [entryId]: versions,
      }));
    } catch (error) {
      console.error("Failed to load knowledge versions:", error);
      toast.error("Failed to load version history");
    } finally {
      setKnowledgeHistoryLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-lime-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Grace settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Keep Grace aligned with your church, your voice, and the tools it depends on.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="h-auto w-fit rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <TabsTrigger value="profile" className="rounded-xl px-4 py-2 text-sm font-semibold">
            Profile
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="rounded-xl px-4 py-2 text-sm font-semibold">
            Knowledge
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="rounded-xl px-4 py-2 text-sm font-semibold">
            Diagnostics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Grace basics</CardTitle>
                  <CardDescription>
                    These details help Grace speak in a way that feels grounded in your church.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="graceEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable Grace</FormLabel>
                          <FormDescription>
                            When turned off, Grace will stop showing up across the app.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="proactiveMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proactive mode</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose how proactive Grace should be" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="quiet">Quiet</SelectItem>
                            <SelectItem value="off">Off</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Normal lets Grace act and suggest. Quiet limits her to autonomous housekeeping. Off disables proactive scans.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="churchName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Church name</FormLabel>
                          <FormControl>
                            <Input placeholder="Grace Community Church" {...field} />
                          </FormControl>
                          <FormDescription>How Grace refers to your church.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="churchCity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input placeholder="Baltimore, MD" {...field} />
                          </FormControl>
                          <FormDescription>Helps Grace stay locally grounded.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="churchDenomination"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Denomination or affiliation</FormLabel>
                          <FormControl>
                            <Input placeholder="Non-denominational" {...field} />
                          </FormControl>
                          <FormDescription>Guides tone and church context.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Advanced instructions</CardTitle>
                  <CardDescription>
                    Use this only if you need to override Grace’s default behavior.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="customSystemPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom prompt</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="You are Grace, a pastoral assistant for..."
                            className="min-h-[200px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Leave blank unless you need a very specific override.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Saving..." : "Save settings"}
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Service planning</CardTitle>
                  <CardDescription>
                    Role setup and staff availability live in their own settings pages now.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Use Role Matrix for service roles and Scheduling Matrix for availability and assignment prep.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" asChild>
                      <Link href="/app/settings/role-matrix">Open Role Matrix</Link>
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link href="/app/settings/scheduling-matrix">Open Scheduling Matrix</Link>
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link href="/app/services">Open Services</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Grace knowledge</CardTitle>
              <CardDescription>
                Save the details Grace should remember about your church, your rhythms, and your ministry context.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 lg:flex lg:items-start lg:gap-8">
              <div className="lg:w-1/3 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                <h3 className="mb-4 font-bold text-slate-900 dark:text-white">
                  {editingKnowledgeId ? "Edit entry" : "Add entry"}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Title
                    </label>
                    <Input
                      placeholder="Sunday service times"
                      value={kbTitle}
                      onChange={(event) => setKbTitle(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Content
                    </label>
                    <Textarea
                      className="min-h-[160px]"
                      placeholder="Details Grace should keep in mind..."
                      value={kbContent}
                      onChange={(event) => setKbContent(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Visibility
                    </label>
                    <Select
                      value={kbVisibility}
                      onValueChange={(value) =>
                        setKbVisibility(value === "public" ? "public" : "internal")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Internal</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-900/50">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Use in Grace
                      </p>
                      <p className="text-xs text-slate-500">Include this in Grace’s context</p>
                    </div>
                    <Switch checked={kbUseForGrace} onCheckedChange={setKbUseForGrace} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => void handleSubmitKnowledge()}
                      disabled={Boolean(knowledgeMutatingId)}
                    >
                      {editingKnowledgeId ? "Save changes" : "Add entry"}
                    </Button>
                    {editingKnowledgeId ? (
                      <Button variant="outline" onClick={resetKnowledgeComposer}>
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3 lg:mt-0 lg:w-2/3">
                {knowledge.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                    No knowledge entries yet.
                  </div>
                ) : (
                  knowledge.map((entry) => {
                    const historyOpen = knowledgeHistoryOpenId === entry.id;
                    const historyLoading = knowledgeHistoryLoadingId === entry.id;
                    const versions = knowledgeVersionsByEntryId[entry.id] ?? [];
                    const mutating = knowledgeMutatingId === entry.id;

                    return (
                      <div
                        key={entry.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/40"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-bold text-slate-900 dark:text-white">
                                {entry.title}
                              </h4>
                              <Badge variant="outline">{entry.visibility}</Badge>
                              <Badge variant="outline">
                                {entry.useForGrace ? "Grace enabled" : "Excluded"}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                              {entry.content}
                            </p>
                            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                              Updated {fmtDateTime(entry.updatedAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditKnowledge(entry)}>
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleToggleKnowledgeHistory(entry.id)}
                              disabled={historyLoading}
                            >
                              {historyLoading ? "Loading..." : historyOpen ? "Hide history" : "History"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-rose-700 border-rose-200 hover:bg-rose-50 dark:text-rose-300 dark:border-rose-800"
                              onClick={() => void handleDeleteKnowledge(entry)}
                              disabled={mutating || Boolean(knowledgeMutatingId)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>

                        {historyOpen ? (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                              Version history
                            </p>
                            {versions.length === 0 ? (
                              <p className="text-xs text-slate-500">No versions recorded yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {versions.map((version) => (
                                  <div
                                    key={version.id}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                        v{version.versionNumber} · {version.changeType}
                                      </p>
                                      <p className="text-[11px] text-slate-400">
                                        {fmtDateTime(version.createdAt)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostics" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Provider stack</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {providerSummary.active}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {providerSummary.channels} active channel{providerSummary.channels === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Provider issues</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {providerSummary.invalid}
                </p>
                <p className="mt-1 text-sm text-slate-500">Active providers failing validation</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Runtime failure rate</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {runtimeHealth.failureRatePercent.toFixed(1)}%
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {runtimeHealth.last24hFailures}/{runtimeHealth.last24hRuns} runs in the last 24h
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Pending sequences</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {sequenceStats.pending}
                </p>
                <p className="mt-1 text-sm text-slate-500">Follow-up steps still waiting on a decision</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Grace actions</CardTitle>
              <CardDescription>
                A quick look at what Grace tried to do and how it turned out.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {toolAuditRows.length === 0 ? (
                <p className="text-sm text-slate-500">No action logs yet.</p>
              ) : (
                toolAuditRows.slice(0, 12).map((row) => (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {row.toolName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{fmtDateTime(row.createdAt)}</p>
                        {row.outputJson ? (
                          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60">
                            {formatJsonPreview(row.outputJson)}
                          </pre>
                        ) : null}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          row.status === "error"
                            ? "border-rose-300 text-rose-700 dark:border-rose-700 dark:text-rose-300"
                            : "border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300"
                        }
                      >
                        {row.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Voice activity</CardTitle>
                <CardDescription>Recent Grace voice sessions and their outcomes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {graceCalls.length === 0 ? (
                  <p className="text-sm text-slate-500">No Grace voice calls yet.</p>
                ) : (
                  graceCalls.slice(0, 8).map((row) => {
                    const call = row.call;
                    const contactName = row.contact
                      ? `${row.contact.firstName} ${row.contact.lastName}`.trim()
                      : "Unknown caller";

                    return (
                      <div
                        key={call.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40"
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {contactName}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {call.fromNumber || "Unknown"} → {call.toNumber || "Unknown"}
                        </p>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          {call.summaryText || call.transcriptText || "No summary yet"}
                        </p>
                        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          {fmtDateTime(call.createdAt)}
                        </p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sequence activity</CardTitle>
                <CardDescription>Visitor follow-up and other Grace-driven message activity.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {followupProposals.length === 0 ? (
                  <p className="text-sm text-slate-500">No sequence activity yet.</p>
                ) : (
                  followupProposals.slice(0, 8).map((proposal) => (
                    <div
                      key={proposal.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {proposal.reason || "Follow-up step"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {proposal.proposedChannel || proposal.channel} · {fmtDateTime(proposal.createdAt)}
                          </p>
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            {proposal.messageText}
                          </p>
                        </div>
                        <Badge variant="outline">{proposal.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
