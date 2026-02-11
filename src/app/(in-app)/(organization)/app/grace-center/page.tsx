"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Loader2, MessageSquare, Phone, Shield, BookOpen, Send } from "lucide-react";
import useOrganization from "@/lib/organizations/useOrganization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createGraceKnowledge,
  getGraceApprovals,
  getGraceCalls,
  getGraceKnowledge,
  getGraceSessions,
  updateGraceApproval,
} from "@/app/actions/grace";
import { toast } from "sonner";

type CopilotMessage = {
  role: "user" | "assistant";
  text: string;
};

type GraceSessionRow = {
  id: string;
  channel: string;
  status: string;
  finalSummary: string | null;
};

type GraceCallRow = {
  id: string;
  fromNumber: string | null;
  toNumber: string | null;
  summaryText: string | null;
  transcriptText: string | null;
};

type GraceKnowledgeRow = {
  id: string;
  title: string;
  content: string;
};

type GraceApprovalRow = {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  sessionId: string;
  proposedAction: unknown;
};

export default function GraceCenterPage() {
  const { organization } = useOrganization();
  const orgId = organization?.id;
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<GraceSessionRow[]>([]);
  const [calls, setCalls] = useState<GraceCallRow[]>([]);
  const [knowledge, setKnowledge] = useState<GraceKnowledgeRow[]>([]);
  const [approvals, setApprovals] = useState<GraceApprovalRow[]>([]);

  const [copilotThreadId, setCopilotThreadId] = useState<string | undefined>(undefined);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([]);
  const [copilotInput, setCopilotInput] = useState("");
  const [sending, setSending] = useState(false);

  const [kbTitle, setKbTitle] = useState("");
  const [kbContent, setKbContent] = useState("");

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [sessionRows, callRows, kbRows, approvalRows] = await Promise.all([
        getGraceSessions(orgId),
        getGraceCalls(orgId),
        getGraceKnowledge(orgId),
        getGraceApprovals(orgId),
      ]);
      setSessions(sessionRows as GraceSessionRow[]);
      setCalls(callRows as GraceCallRow[]);
      setKnowledge(kbRows as GraceKnowledgeRow[]);
      setApprovals(approvalRows as GraceApprovalRow[]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      openSessions: sessions.filter((s) => s.status === "open").length,
      escalations: sessions.filter((s) => s.status === "escalated").length,
      calls: calls.length,
      pendingApprovals: approvals.filter((a) => a.status === "pending").length,
    }),
    [sessions, calls, approvals]
  );

  async function sendCopilot() {
    if (!copilotInput.trim()) return;
    const userMessage = copilotInput.trim();
    setCopilotMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setCopilotInput("");
    setSending(true);

    try {
      const response = await fetch("/api/grace/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: copilotThreadId, message: userMessage }),
      });
      const payload = (await response.json()) as {
        error?: string;
        threadId?: string;
        response?: string;
        proposedActions?: unknown[];
      };

      if (!response.ok) {
        throw new Error(payload.error || "Copilot request failed");
      }

      setCopilotThreadId(payload.threadId);
      setCopilotMessages((prev) => [...prev, { role: "assistant", text: payload.response || "" }]);
      if (payload.proposedActions?.length) {
        toast.info(`Grace proposed ${payload.proposedActions.length} action(s)`);
      }
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function approveAndExecute(approval: GraceApprovalRow) {
    try {
      const response = await fetch("/api/grace/actions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: approval.sessionId, actionIds: [approval.id] }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Approval execution failed");
      toast.success("Action approved and executed");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to execute action");
    }
  }

  async function rejectApproval(approval: GraceApprovalRow) {
    if (!orgId) return;
    try {
      await updateGraceApproval({
        organizationId: orgId,
        approvalId: approval.id,
        status: "rejected",
      });
      toast.success("Action rejected");
      load();
    } catch {
      toast.error("Failed to reject action");
    }
  }

  async function addKnowledge() {
    if (!orgId || !kbTitle.trim() || !kbContent.trim()) return;

    try {
      await createGraceKnowledge({ organizationId: orgId, title: kbTitle.trim(), content: kbContent.trim() });
      setKbTitle("");
      setKbContent("");
      toast.success("Knowledge entry added");
      load();
    } catch {
      toast.error("Failed to add knowledge entry");
    }
  }

  if (!orgId) {
    return <div className="text-sm text-muted-foreground">Loading organization...</div>;
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#bbff00]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Grace Center</p>
          <h1 className="text-3xl font-bold">GRACE Operations</h1>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={MessageSquare} label="Open Sessions" value={counts.openSessions} />
        <StatCard icon={Phone} label="Calls" value={counts.calls} />
        <StatCard icon={Shield} label="Escalations" value={counts.escalations} />
        <StatCard icon={Bot} label="Pending Approvals" value={counts.pendingApprovals} />
      </div>

      <Tabs defaultValue="inbox" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="calls">Calls</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="copilot">Talk to Grace</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          <Card>
            <CardHeader><CardTitle>Sessions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {sessions.slice(0, 20).map((session) => (
                <div key={session.id} className="rounded border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{session.channel}</span>
                    <span className="text-muted-foreground">{session.status}</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{session.finalSummary || "No summary yet"}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calls">
          <Card>
            <CardHeader><CardTitle>Voice Calls</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {calls.length === 0 && <p className="text-sm text-muted-foreground">No calls logged yet.</p>}
              {calls.map((call) => (
                <div key={call.id} className="rounded border p-3 text-sm">
                  <div className="font-medium">{call.fromNumber || "Unknown"} → {call.toNumber || "Unknown"}</div>
                  <div className="text-muted-foreground">{call.summaryText || call.transcriptText || "No transcript"}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader><CardTitle>Approval Queue</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {approvals.length === 0 && <p className="text-sm text-muted-foreground">No approvals pending.</p>}
              {approvals.map((approval) => (
                <div key={approval.id} className="rounded border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{approval.status.toUpperCase()}</span>
                    <span className="text-muted-foreground">{new Date(approval.createdAt).toLocaleString()}</span>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(approval.proposedAction, null, 2)}
                  </pre>
                  {approval.status === "pending" && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => approveAndExecute(approval)}>Approve + Execute</Button>
                      <Button size="sm" variant="outline" onClick={() => rejectApproval(approval)}>Reject</Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments">
          <Card>
            <CardHeader><CardTitle>Appointment Workflow Surface</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Appointment execution is wired through GRACE tools (`appointments.checkAvailability`, `appointments.book`) and policy approvals.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="knowledge">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpen className="h-4 w-4" />Knowledge Base</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3">
                <Input placeholder="Entry title" value={kbTitle} onChange={(e) => setKbTitle(e.target.value)} />
                <Textarea placeholder="Entry content" rows={4} value={kbContent} onChange={(e) => setKbContent(e.target.value)} />
                <Button onClick={addKnowledge}>Add Knowledge Entry</Button>
              </div>
              <div className="space-y-2">
                {knowledge.map((entry) => (
                  <div key={entry.id} className="rounded border p-3">
                    <p className="font-medium">{entry.title}</p>
                    <p className="text-sm text-muted-foreground">{entry.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="copilot">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4" />Talk to Grace</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[360px] space-y-2 overflow-auto rounded border bg-muted/20 p-3">
                {copilotMessages.length === 0 && (
                  <p className="text-sm text-muted-foreground">Ask Grace to summarize activity, capture prayer, or schedule appointments.</p>
                )}
                {copilotMessages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`rounded p-2 text-sm ${message.role === "assistant" ? "bg-card" : "bg-[#bbff00]/20"}`}>
                    <span className="font-medium">{message.role === "assistant" ? "Grace" : "You"}: </span>
                    {message.text}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Message Grace..."
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") sendCopilot();
                  }}
                />
                <Button onClick={sendCopilot} disabled={sending || !copilotInput.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className="rounded-lg bg-[#bbff00]/25 p-2 text-[#2e3f00]"><Icon className="h-4 w-4" /></div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
