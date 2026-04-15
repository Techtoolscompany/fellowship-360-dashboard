import { inngest } from "../client";
import { db } from "@/db";
import {
  organizations,
  churchContacts,
  prayerRequests,
  tasks,
  appointments,
  graceMemory,
  graceFollowupProposals,
  graceAuditStream,
} from "@/db/schema";
import { graceGoals } from "@/db/schema/grace-goals";
import { aiConfig } from "@/db/schema/ai-config";
import { and, desc, eq, gte, inArray, lt, lte } from "drizzle-orm";
import { INNGEST_RETRY_PROFILES } from "../policy";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { resolveGeminiApiKey } from "@/lib/grace/providers/resolver";
import { executePlannedActions } from "@/lib/grace/router/executor";
import { getOrCreateGraceSession, loadOrgPolicy } from "@/lib/grace/runtime";
import {
  writeGraceAuditStreamSafe,
  normalizeAuditUsage,
  estimateModelCostUsd,
} from "@/lib/grace/audit-stream";
import type {
  GraceProactiveMode,
  GraceSessionContext,
  OrgPolicyOverride,
  ProposedAction,
} from "@/lib/grace/types";

// ---------------------------------------------------------------------------
// Proactive Thinker — Grace notices things and acts on them
// ---------------------------------------------------------------------------
// Runs every 30 minutes. For each organization:
// 1. Scans operational state (stale contacts, unanswered prayers, empty slots)
// 2. Asks the LLM: "What should I do right now?"
// 3. 🟢 Autonomous actions execute immediately
// 4. 🟡 Suggest actions create followup proposals for staff
// ---------------------------------------------------------------------------

const proactiveObservationSchema = z.object({
  reasoning: z
    .string()
    .describe("A brief operator-facing rationale explaining what you noticed and why it matters."),
  observations: z
    .array(
      z.object({
        category: z.enum([
          "visitor_followup",
          "prayer_care",
          "volunteer_staffing",
          "task_escalation",
          "giving_milestone",
          "engagement_concern",
          "service_preparation",
          "data_quality",
          "general",
        ]),
        summary: z.string().describe("Brief description of what Grace noticed"),
        urgency: z.enum(["low", "medium", "high"]).default("medium"),
        tier: z
          .enum(["autonomous", "suggest"])
          .describe(
            "autonomous = Grace should handle immediately (routine ops). suggest = Grace should propose to staff for confirmation."
          ),
        proposedTools: z
          .array(
            z.object({
              tool: z.string().describe("Tool name from the available tools list"),
              input: z.record(z.unknown()).describe("Tool input parameters"),
              reason: z.string().describe("Why this tool should be called"),
            })
          )
          .optional()
          .describe("Tools to execute for this observation"),
        suggestedMessage: z
          .string()
          .optional()
          .describe(
            "For suggest-tier items: the message Grace would show staff. e.g. 'Maria hasn't attended in 60 days — should I reach out?'"
          ),
      })
    )
    .describe("What Grace noticed that needs attention. Return empty array if nothing needs action."),
});

function buildProactiveSystemPrompt(params: {
  churchName: string;
  operationalSummary: string;
  proactiveMode: GraceProactiveMode;
  customSystemPrompt?: string | null;
}): string {
  return `You are Grace, the AI assistant for ${params.churchName}. You are running a periodic operational check to see if anything in the church needs attention right now.

You are a proactive team member who notices things before staff has to ask. Review the operational data below and identify actions that should be taken.

## Agency Tiers
- tier=autonomous: Routine operations you should handle immediately WITHOUT asking staff:
  - Visitor follow-up (welcome texts, check-in messages)
  - Thank-you texts for first-time givers
  - Prayer request follow-ups (acknowledgment, care check-ins)
  - Task escalation for overdue items
  - Volunteer staffing for upcoming services with empty slots
  - Service confirmation reminders
  - Data quality flags (duplicates, missing info)

- tier=suggest: Less routine actions where you should PROPOSE to staff and wait:
  - Re-engagement campaigns for inactive members (60+ days absent)
  - Individual pastoral outreach for sensitive situations
  - Suggestions that affect many people at once
  - Anything you're not confident about

## Operating Mode
- proactiveMode=${params.proactiveMode}
- If proactiveMode=quiet, only return autonomous housekeeping actions. Do not return suggest-tier observations.
- If proactiveMode=normal, you may return autonomous and suggest-tier observations.

## Rules
- Only produce observations for things that ACTUALLY need action right now.
- Do NOT re-create actions for things already being handled. Existing event-driven workflows may already be active.
- The reasoning field must be a short, factual operator-facing rationale. Do not write hidden chain-of-thought.
- Be specific: use real contact names and IDs from the data.
- For autonomous actions, propose the exact tools to call.
- For suggest actions, write a clear suggestedMessage that explains what you noticed and what you'd do.
- Return an EMPTY observations array if everything looks good.

## Available Tools
contacts.search(query, status?, limit?), contacts.upsert(firstName, lastName, email?, phone?, memberStatus?), contacts.update(contactId, firstName?, lastName?, email?, phone?, memberStatus?, notes?), tasks.create(title, description?, assigneeId?, dueDate?, priority?), tasks.update(taskId, title?, status?, priority?, assigneeId?, dueDate?), tasks.complete(taskId), memory.write(type, summary, details?, tags?, contactId?), messages.sendSMS(to, message), messages.sendEmail(to, subject, html), staff.alert(reason, details?), prayerRequests.update(requestId, status?, urgency?, assignedTeam?, response?), serviceRuns.autoStaff(serviceRunId), serviceAssignments.sendOfferSMS(serviceRunId), appointments.book(contactId, title, dateTime, duration?, type?, staffId?)

# Current Church State
${params.operationalSummary}

${params.customSystemPrompt?.trim() ? `# Organization Guidance\n${params.customSystemPrompt.trim()}` : ""}`;
}

type OperationalGoalSnapshot = {
  id: string;
  goalType: string;
  workflowKey: string;
  status: string;
  objectiveText: string;
  subjectContactId: string | null;
  subjectEntityType: string | null;
  subjectEntityId: string | null;
  serviceRunId: string | null;
  lastDecisionSummary: string | null;
  contextJson: Record<string, unknown> | null;
};

type PendingProposalSnapshot = {
  id: string;
  reason: string | null;
  contactId: string | null;
  metadataJson: Record<string, unknown> | null;
};

type OperationalSummarySnapshot = {
  summary: string;
  activeGoals: OperationalGoalSnapshot[];
  pendingProposals: PendingProposalSnapshot[];
};

async function buildOperationalSummary(organizationId: string): Promise<OperationalSummarySnapshot> {
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const threeDaysAhead = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const [
    recentVisitors,
    unansweredPrayers,
    overdueTasks,
    upcomingAppointments,
    activeGoals,
    recentMemories,
    pendingProposals,
  ] = await Promise.all([
    // Visitors from last 7 days without follow-up tasks
    db
      .select({
        id: churchContacts.id,
        firstName: churchContacts.firstName,
        lastName: churchContacts.lastName,
        phone: churchContacts.phone,
        email: churchContacts.email,
        createdAt: churchContacts.createdAt,
      })
      .from(churchContacts)
      .where(
        and(
          eq(churchContacts.organizationId, organizationId),
          eq(churchContacts.memberStatus, "visitor"),
          gte(churchContacts.createdAt, sevenDaysAgo)
        )
      )
      .orderBy(desc(churchContacts.createdAt))
      .limit(20),
    // Unanswered prayer requests (48h+ old)
    db
      .select({
        id: prayerRequests.id,
        contactName: prayerRequests.contactName,
        content: prayerRequests.content,
        urgency: prayerRequests.urgency,
        createdAt: prayerRequests.createdAt,
      })
      .from(prayerRequests)
      .where(
        and(
          eq(prayerRequests.organizationId, organizationId),
          eq(prayerRequests.status, "new"),
          lt(prayerRequests.createdAt, twoDaysAgo)
        )
      )
      .orderBy(desc(prayerRequests.createdAt))
      .limit(10),
    // Overdue tasks (past due date, still open)
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.organizationId, organizationId),
          inArray(tasks.status, ["todo", "in_progress"]),
          lt(tasks.dueDate, now)
        )
      )
      .orderBy(tasks.dueDate)
      .limit(10),
    // Upcoming appointments (next 3 days)
    db
      .select({
        id: appointments.id,
        title: appointments.title,
        dateTime: appointments.dateTime,
        status: appointments.status,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, organizationId),
          gte(appointments.dateTime, now),
          lte(appointments.dateTime, threeDaysAhead),
          inArray(appointments.status, ["scheduled", "confirmed"])
        )
      )
      .orderBy(appointments.dateTime)
      .limit(10),
    // Active Grace goals (to avoid duplicating work)
    db
      .select({
        id: graceGoals.id,
        goalType: graceGoals.goalType,
        workflowKey: graceGoals.workflowKey,
        status: graceGoals.status,
        objectiveText: graceGoals.objectiveText,
        subjectContactId: graceGoals.subjectContactId,
        subjectEntityType: graceGoals.subjectEntityType,
        subjectEntityId: graceGoals.subjectEntityId,
        serviceRunId: graceGoals.serviceRunId,
        lastDecisionSummary: graceGoals.lastDecisionSummary,
        contextJson: graceGoals.contextJson,
      })
      .from(graceGoals)
      .where(
        and(
          eq(graceGoals.organizationId, organizationId),
          inArray(graceGoals.status, ["queued", "in_progress", "waiting"])
        )
      )
      .limit(10),
    // Recent org patterns (to avoid re-flagging)
    db
      .select({
        summary: graceMemory.summary,
        createdAt: graceMemory.createdAt,
      })
      .from(graceMemory)
      .where(
        and(
          eq(graceMemory.organizationId, organizationId),
          eq(graceMemory.memoryType, "org_pattern"),
          gte(graceMemory.createdAt, sevenDaysAgo)
        )
      )
      .orderBy(desc(graceMemory.createdAt))
      .limit(5),
    // Pending proposals (to avoid duplicates)
    db
      .select({
        id: graceFollowupProposals.id,
        reason: graceFollowupProposals.reason,
        contactId: graceFollowupProposals.contactId,
        metadataJson: graceFollowupProposals.metadataJson,
      })
      .from(graceFollowupProposals)
      .where(
        and(
          eq(graceFollowupProposals.organizationId, organizationId),
          eq(graceFollowupProposals.status, "pending"),
          gte(graceFollowupProposals.createdAt, sevenDaysAgo)
        )
      )
      .limit(20),
  ]);

  const sections: string[] = [];

  if (recentVisitors.length > 0) {
    sections.push(
      `## Recent Visitors (last 7 days)\n${recentVisitors
        .map(
          (v) =>
            `- [id:${v.id}] ${v.firstName} ${v.lastName}${v.phone ? ` | ${v.phone}` : ""}${v.email ? ` | ${v.email}` : ""} | joined ${new Date(v.createdAt).toLocaleDateString()}`
        )
        .join("\n")}`
    );
  } else {
    sections.push("## Recent Visitors\nNone in the last 7 days.");
  }

  if (unansweredPrayers.length > 0) {
    sections.push(
      `## Unanswered Prayer Requests (48h+ old, still "new")\n${unansweredPrayers
        .map(
          (p) =>
            `- [id:${p.id}] ${p.contactName || "Anonymous"} — ${p.urgency} | "${p.content?.slice(0, 100)}" | submitted ${new Date(p.createdAt).toLocaleDateString()}`
        )
        .join("\n")}`
    );
  } else {
    sections.push("## Unanswered Prayer Requests\nAll prayer requests are being addressed.");
  }

  if (overdueTasks.length > 0) {
    sections.push(
      `## Overdue Tasks\n${overdueTasks
        .map(
          (t) =>
            `- [id:${t.id}] "${t.title}" — ${t.priority} priority | due ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "no date"}`
        )
        .join("\n")}`
    );
  } else {
    sections.push("## Overdue Tasks\nNo overdue tasks.");
  }

  if (upcomingAppointments.length > 0) {
    sections.push(
      `## Upcoming Appointments (next 3 days)\n${upcomingAppointments
        .map(
          (a) =>
            `- [id:${a.id}] "${a.title}" — ${new Date(a.dateTime).toLocaleString()} | ${a.status}`
        )
        .join("\n")}`
    );
  }

  if (activeGoals.length > 0) {
    sections.push(
      `## Active Grace Goals (DO NOT duplicate these)\n${activeGoals
        .map(
          (g) =>
            `- [id:${g.id}] ${g.workflowKey || g.goalType}: ${g.objectiveText?.slice(0, 120)} [${g.status}]`
        )
        .join("\n")}`
    );
  }

  if (pendingProposals.length > 0) {
    sections.push(
      `## Pending Proposals (DO NOT duplicate these)\n${pendingProposals
        .map((p) => `- [id:${p.id}] ${p.reason?.slice(0, 100)} | contact: ${p.contactId ?? "none"}`)
        .join("\n")}`
    );
  }

  if (recentMemories.length > 0) {
    sections.push(
      `## Recent Patterns\n${recentMemories
        .map((m) => `- ${m.summary?.slice(0, 160)}`)
        .join("\n")}`
    );
  }

  sections.push(`\n## Current Time\n${now.toLocaleString()}`);

  return {
    summary: sections.join("\n\n"),
    activeGoals,
    pendingProposals,
  };
}

function buildProactiveContext(params: {
  organizationId: string;
  sessionId: string;
  policy?: OrgPolicyOverride;
}): GraceSessionContext {
  return {
    organizationId: params.organizationId,
    sessionId: params.sessionId,
    channel: "in_app",
    actorType: "system",
    policy: params.policy,
  };
}

function normalizeProactiveText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getStringFingerprintValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function getPrimaryToolInputValue(
  proposedTools: Array<{ input: Record<string, unknown> }> | undefined,
  keys: string[]
): string | null {
  if (!proposedTools?.length) return null;
  for (const tool of proposedTools) {
    const input = tool.input ?? {};
    for (const key of keys) {
      const value = getStringFingerprintValue(input[key]);
      if (value) {
        return `${key}:${value}`;
      }
      if (Array.isArray(input[key])) {
        const listValues = (input[key] as unknown[])
          .map((entry) => getStringFingerprintValue(entry))
          .filter((entry): entry is string => Boolean(entry));
        if (listValues.length > 0) {
          return `${key}:${listValues.join(",")}`;
        }
      }
    }
  }
  return null;
}

function extractObservationSubjectKey(
  observation: z.infer<typeof proactiveObservationSchema>["observations"][number]
): string {
  const entityKey =
    getPrimaryToolInputValue(observation.proposedTools, [
      "contactId",
      "requestId",
      "serviceRunId",
      "taskId",
      "appointmentId",
      "itemId",
      "conversationId",
      "volunteerId",
      "assignmentId",
      "assignmentIds",
    ]) ??
    getPrimaryToolInputValue(observation.proposedTools, [
      "to",
      "recipient",
      "phone",
      "email",
    ]);

  if (entityKey) {
    return entityKey;
  }

  const summaryKey = normalizeProactiveText(observation.summary).slice(0, 80);
  return summaryKey || "general";
}

function extractObservationContactId(
  observation: z.infer<typeof proactiveObservationSchema>["observations"][number]
): string | null {
  const raw = getPrimaryToolInputValue(observation.proposedTools, ["contactId"]);
  if (!raw) return null;
  return raw.replace(/^contactId:/, "");
}

function buildObservationFingerprint(
  organizationId: string,
  observation: z.infer<typeof proactiveObservationSchema>["observations"][number]
): string {
  const subjectKey = extractObservationSubjectKey(observation);
  const actionKey = (observation.proposedTools ?? [])
    .map((tool) => normalizeProactiveText(tool.tool))
    .filter(Boolean)
    .join("+") || normalizeProactiveText(observation.suggestedMessage ?? observation.summary).slice(0, 80);

  return [
    organizationId,
    observation.category,
    observation.tier,
    subjectKey,
    actionKey,
  ].join("::");
}

function getFingerprintFromMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  const value = metadata.fingerprint;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function loadExistingFingerprints(organizationId: string): Promise<Set<string>> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [proposalRows, auditRows, memoryRows] = await Promise.all([
    db
      .select({
        metadataJson: graceFollowupProposals.metadataJson,
      })
      .from(graceFollowupProposals)
      .where(
        and(
          eq(graceFollowupProposals.organizationId, organizationId),
          eq(graceFollowupProposals.status, "pending"),
          gte(graceFollowupProposals.createdAt, since)
        )
      ),
    db
      .select({
        metadataJson: graceAuditStream.metadataJson,
      })
      .from(graceAuditStream)
      .where(
        and(
          eq(graceAuditStream.organizationId, organizationId),
          eq(graceAuditStream.eventType, "action_execution"),
          gte(graceAuditStream.createdAt, since)
        )
      )
      .orderBy(desc(graceAuditStream.createdAt))
      .limit(200),
    db
      .select({
        metadataJson: graceMemory.metadataJson,
      })
      .from(graceMemory)
      .where(
        and(
          eq(graceMemory.organizationId, organizationId),
          eq(graceMemory.memoryType, "org_pattern"),
          gte(graceMemory.createdAt, since)
        )
      )
      .orderBy(desc(graceMemory.createdAt))
      .limit(25),
  ]);

  const fingerprints = new Set<string>();
  for (const row of proposalRows) {
    const fingerprint = getFingerprintFromMetadata(row.metadataJson);
    if (fingerprint) fingerprints.add(fingerprint);
  }
  for (const row of auditRows) {
    const fingerprint = getFingerprintFromMetadata(row.metadataJson);
    if (fingerprint) fingerprints.add(fingerprint);
  }
  for (const row of memoryRows) {
    const rawFingerprints = row.metadataJson?.fingerprints;
    if (!Array.isArray(rawFingerprints)) continue;
    for (const entry of rawFingerprints) {
      if (typeof entry === "string" && entry.trim().length > 0) {
        fingerprints.add(entry.trim());
      }
    }
  }
  return fingerprints;
}

function hasActiveGoalConflict(
  observation: z.infer<typeof proactiveObservationSchema>["observations"][number],
  activeGoals: OperationalGoalSnapshot[]
): boolean {
  const subjectContactId = getPrimaryToolInputValue(observation.proposedTools, ["contactId"])?.replace(
    /^contactId:/,
    ""
  );
  const serviceRunId = getPrimaryToolInputValue(observation.proposedTools, ["serviceRunId"])?.replace(
    /^serviceRunId:/,
    ""
  );
  const requestId = getPrimaryToolInputValue(observation.proposedTools, ["requestId"])?.replace(
    /^requestId:/,
    ""
  );
  const normalizedSummary = normalizeProactiveText(observation.summary);

  const categoryWorkflowKeys: Record<string, string[]> = {
    visitor_followup: ["guest_followup", "communications_followup"],
    prayer_care: ["prayer_care", "communications_followup"],
    volunteer_staffing: ["volunteer_staffing", "service_staffing"],
    service_preparation: ["volunteer_staffing", "service_staffing"],
  };

  return activeGoals.some((goal) => {
    if (subjectContactId && goal.subjectContactId === subjectContactId) {
      return true;
    }
    if (serviceRunId && (goal.serviceRunId === serviceRunId || goal.subjectEntityId === serviceRunId)) {
      return true;
    }
    if (requestId && goal.subjectEntityId === requestId) {
      return true;
    }

    const workflowCandidates = categoryWorkflowKeys[observation.category] ?? [];
    if (workflowCandidates.includes(goal.workflowKey)) {
      const goalText = normalizeProactiveText(
        `${goal.objectiveText ?? ""} ${goal.lastDecisionSummary ?? ""}`
      );
      if (goalText && normalizedSummary && (goalText.includes(normalizedSummary) || normalizedSummary.includes(goalText))) {
        return true;
      }
    }

    return false;
  });
}

export const graceProactiveThinker = inngest.createFunction(
  {
    id: "grace-proactive-thinker",
    retries: INNGEST_RETRY_PROFILES.SCHEDULED,
    concurrency: [{ limit: 1 }], // Only one proactive run at a time globally
  },
  { cron: "*/30 * * * *" }, // Every 30 minutes
  async ({ step, logger }) => {
    // 1. Fetch all active organizations
    const orgs = await step.run("fetch-organizations", async () => {
      return await db
        .select({
          id: organizations.id,
          name: organizations.name,
        })
        .from(organizations);
    });

    // 2. Process each org
    const results = [];
    for (const org of orgs) {
      const result = await step.run(`proactive-scan-${org.id}`, async () => {
        // Resolve org settings up front
        const [config] = await db
          .select({
            customSystemPrompt: aiConfig.customSystemPrompt,
            proactiveMode: aiConfig.proactiveMode,
          })
          .from(aiConfig)
          .where(eq(aiConfig.organizationId, org.id))
          .limit(1);

        const proactiveMode = (config?.proactiveMode ?? "normal") as GraceProactiveMode;
        if (proactiveMode === "off") {
          logger.info("Skipping proactive scan — proactive mode is off", { orgId: org.id });
          return { orgId: org.id, skipped: true, reason: "proactive_mode_off" };
        }

        // Resolve API key — skip if not configured
        const geminiApiKey = await resolveGeminiApiKey(org.id);
        if (!geminiApiKey) {
          logger.info("Skipping proactive scan — no Gemini key", { orgId: org.id });
          return { orgId: org.id, skipped: true, reason: "no_api_key" };
        }

        const [session, orgPolicy, operationalSnapshot, existingFingerprints] = await Promise.all([
          getOrCreateGraceSession({
            organizationId: org.id,
            channel: "in_app",
            actorType: "system",
          }),
          loadOrgPolicy(org.id),
          buildOperationalSummary(org.id),
          loadExistingFingerprints(org.id),
        ]);

        const proactiveContext = buildProactiveContext({
          organizationId: org.id,
          sessionId: session.id,
          policy: orgPolicy,
        });

        const systemPrompt = buildProactiveSystemPrompt({
          churchName: org.name ?? "our church",
          operationalSummary: operationalSnapshot.summary,
          proactiveMode,
          customSystemPrompt: config?.customSystemPrompt ?? null,
        });

        // Ask the LLM what needs attention
        const google = createGoogleGenerativeAI({ apiKey: geminiApiKey });
        const startedAt = Date.now();

        try {
          const llmResult = await generateObject({
            model: google("gemini-2.5-flash"),
            output: "object",
            system: systemPrompt,
            prompt:
              "Review the church's current state. What needs attention right now? Only flag things that actually need action. Return an empty observations array if everything is fine.",
            schema: proactiveObservationSchema,
          });

          const usage = normalizeAuditUsage(
            (llmResult as { usage?: unknown }).usage
          );
          await writeGraceAuditStreamSafe({
            organizationId: org.id,
            eventType: "ai_decision",
            source: "grace_router",
            actorType: "system",
            channel: "in_app",
            sessionId: session.id,
            status: "success",
            intent: "proactive_scan",
            model: "gemini-2.5-flash",
            latencyMs: Date.now() - startedAt,
            inputTokens: usage.inputTokens ?? null,
            outputTokens: usage.outputTokens ?? null,
            totalTokens: usage.totalTokens ?? null,
            estimatedCostUsd: estimateModelCostUsd({
              inputTokens: usage.inputTokens ?? null,
              outputTokens: usage.outputTokens ?? null,
            }),
            metadataJson: {
              source: "proactive_thinker",
              proactiveMode,
              observationCount: llmResult.object.observations.length,
              reasoning: llmResult.object.reasoning,
            },
          });

          const observations = llmResult.object.observations;
          if (observations.length === 0) {
            logger.info("Proactive scan: all clear", { orgId: org.id });
            return { orgId: org.id, observationCount: 0, actionsExecuted: 0, suggestionsMade: 0 };
          }

          let actionsExecuted = 0;
          let suggestionsMade = 0;
          let approvalsQueued = 0;
          const recordedFingerprints: string[] = [];
          const recordedObservations: Array<{
            category: string;
            tier: "autonomous" | "suggest";
            urgency: "low" | "medium" | "high";
            summary: string;
            fingerprint: string;
          }> = [];

          for (const obs of observations) {
            const fingerprint = buildObservationFingerprint(org.id, obs);
            if (existingFingerprints.has(fingerprint)) {
              logger.info("Skipping proactive observation — duplicate fingerprint", {
                orgId: org.id,
                fingerprint,
                category: obs.category,
              });
              continue;
            }

            if (hasActiveGoalConflict(obs, operationalSnapshot.activeGoals)) {
              logger.info("Skipping proactive observation — already covered by active goal", {
                orgId: org.id,
                category: obs.category,
                summary: obs.summary,
              });
              continue;
            }

            if (proactiveMode === "quiet" && obs.tier === "suggest") {
              logger.info("Skipping proactive suggestion — quiet mode", {
                orgId: org.id,
                category: obs.category,
              });
              continue;
            }

            if (obs.tier === "autonomous" && obs.proposedTools && obs.proposedTools.length > 0) {
              // 🟢 Execute tools directly
              const actions: ProposedAction[] = obs.proposedTools.map((t) => ({
                id: crypto.randomUUID(),
                tool: t.tool,
                input: t.input,
                reason: t.reason,
                requiresApproval: false,
              }));

              const execution = await executePlannedActions({
                actions,
                context: proactiveContext,
              });

              actionsExecuted += execution.actionOutcomes.filter(
                (outcome) => outcome.status === "executed" || outcome.status === "retried"
              ).length;
              approvalsQueued += execution.actionOutcomes.filter(
                (outcome) => outcome.status === "queued"
              ).length;
              const shouldPersistFingerprint = execution.actionOutcomes.some(
                (outcome) =>
                  outcome.status === "executed" ||
                  outcome.status === "retried" ||
                  outcome.status === "queued" ||
                  outcome.status === "suggested"
              );
              if (shouldPersistFingerprint) {
                existingFingerprints.add(fingerprint);
                recordedFingerprints.push(fingerprint);
                recordedObservations.push({
                  category: obs.category,
                  tier: obs.tier,
                  urgency: obs.urgency,
                  summary: obs.summary,
                  fingerprint,
                });
              }
            } else if (
              obs.tier === "suggest" ||
              (obs.tier === "autonomous" && (!obs.proposedTools || obs.proposedTools.length === 0))
            ) {
              if (proactiveMode === "quiet") {
                logger.info("Skipping proactive observation without direct action — quiet mode", {
                  orgId: org.id,
                  category: obs.category,
                });
                continue;
              }

              // 🟡 Create a suggestion for staff
              try {
                await db.insert(graceFollowupProposals).values({
                  organizationId: org.id,
                  sessionId: session.id,
                  contactId: extractObservationContactId(obs),
                  actorType: "system",
                  channel: "in_app",
                  proposedChannel: "system",
                  reason: obs.summary,
                  messageText: obs.suggestedMessage ?? obs.summary,
                  status: "pending",
                  metadataJson: {
                    source: "proactive_thinker",
                    category: obs.category,
                    urgency: obs.urgency,
                    tier: obs.tier,
                    reasoning: llmResult.object.reasoning,
                    proposedTools: obs.proposedTools ?? null,
                    fingerprint,
                  },
                });
                await writeGraceAuditStreamSafe({
                  organizationId: org.id,
                  sessionId: session.id,
                  eventType: "action_execution",
                  source: "grace_executor",
                  actorType: "system",
                  channel: "in_app",
                  status: "skipped",
                  actionName: obs.summary,
                  metadataJson: {
                    source: "proactive_thinker",
                    category: obs.category,
                    urgency: obs.urgency,
                    tier: obs.tier,
                    activityType: "suggestion_created",
                    suggestedMessage: obs.suggestedMessage ?? obs.summary,
                    fingerprint,
                  },
                });
                suggestionsMade++;
                existingFingerprints.add(fingerprint);
                recordedFingerprints.push(fingerprint);
                recordedObservations.push({
                  category: obs.category,
                  tier: obs.tier,
                  urgency: obs.urgency,
                  summary: obs.summary,
                  fingerprint,
                });
              } catch (err) {
                logger.error("Failed to create proactive suggestion", {
                  orgId: org.id,
                  error: err instanceof Error ? err.message : "unknown",
                });
                await writeGraceAuditStreamSafe({
                  organizationId: org.id,
                  sessionId: session.id,
                  eventType: "action_execution",
                  source: "grace_executor",
                  actorType: "system",
                  channel: "in_app",
                  status: "error",
                  actionName: obs.summary,
                  errorText: err instanceof Error ? err.message : "proactive_suggestion_failed",
                  metadataJson: {
                    source: "proactive_thinker",
                    category: obs.category,
                    urgency: obs.urgency,
                    tier: obs.tier,
                    fingerprint,
                  },
                });
              }
            }
          }

          // Write a memory entry summarizing what the proactive scan found
          if (recordedObservations.length > 0) {
            await db.insert(graceMemory).values({
              organizationId: org.id,
              sessionId: session.id,
              memoryType: "org_pattern",
              summary: `Proactive scan: ${actionsExecuted} actions taken, ${approvalsQueued} approvals queued, ${suggestionsMade} suggestions created. Categories: ${recordedObservations.map((o) => o.category).join(", ")}`,
              details: llmResult.object.reasoning,
              tags: ["proactive_scan", ...recordedObservations.map((o) => o.category)],
              metadataJson: {
                source: "proactive_thinker",
                proactiveMode,
                actionsExecuted,
                approvalsQueued,
                suggestionsMade,
                fingerprints: recordedFingerprints,
                observations: recordedObservations,
              },
              createdByActorType: "system",
            });
          }

          return {
            orgId: org.id,
            observationCount: observations.length,
            actionsExecuted,
            suggestionsMade,
          };
        } catch (llmError) {
          logger.error("Proactive scan LLM call failed", {
            orgId: org.id,
            error: llmError instanceof Error ? llmError.message : "unknown",
          });

          await writeGraceAuditStreamSafe({
            organizationId: org.id,
            eventType: "ai_decision",
            source: "grace_router",
            actorType: "system",
            status: "error",
            intent: "proactive_scan",
            model: "gemini-2.5-flash",
            latencyMs: Date.now() - startedAt,
            errorText: llmError instanceof Error ? llmError.message : "proactive_scan_failed",
            metadataJson: { source: "proactive_thinker", proactiveMode },
          });

          return { orgId: org.id, skipped: true, reason: "llm_error" };
        }
      });

      results.push(result);
    }

    return {
      message: "Proactive scan complete",
      processedOrgs: results.length,
      results,
    };
  }
);
