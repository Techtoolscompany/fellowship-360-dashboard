import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import type { ToolSet } from "ai";
import { z } from "zod";
import { and, desc, eq, gte, ilike, inArray, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { graceKnowledge } from "@/db/schema/grace-knowledge";
import { aiConfig } from "@/db/schema/ai-config";
import { graceFollowupProposals } from "@/db/schema/grace-followup-proposals";
import { graceGoals } from "@/db/schema/grace-goals";
import { graceMemory } from "@/db/schema/grace-memory";
import { churchContacts } from "@/db/schema/church-contacts";
import { tasks, appointments } from "@/db/schema/operations";
import { prayerRequests } from "@/db/schema/prayer";
import { organizations, onboardingDataSchema } from "@/db/schema/organization";
import type {
  GraceActionOutcome,
  GraceIntent,
  GraceRouterInput,
  GraceRouterOutput,
  GraceWorkflowDecision,
  ProposedAction,
  ReasoningStep,
} from "../types";
import { executePlannedActions } from "./executor";
import { resolveGeminiApiKey } from "../providers/resolver";
import {
  buildEmergencyEscalationDetails,
  buildEmergencyResponseText,
  detectEmergencySignal,
} from "../emergency";
import { findGraceTool } from "../tools/registry";
import {
  estimateModelCostUsd,
  normalizeAuditUsage,
  writeGraceAuditStreamSafe,
} from "../audit-stream";
import { startGraceWorkflowFromDecision } from "../workflows/runtime";
import type { GraceTool } from "../tools/types";

// ---------------------------------------------------------------------------
// Zod schema for structured Gemini output
// ---------------------------------------------------------------------------

const intentSchema = z.enum([
  "info_request",
  "prayer_request",
  "appointment_request",
  "follow_up_request",
  "contact_request",
  "report_request",
  "emergency",
  "unknown",
]);

const proposedToolSchema = z.object({
  tool: z.string().describe("Exact tool name from the allowed tool list"),
  input: z.record(z.unknown()).describe("Tool input parameters"),
  reason: z.string().describe("Why this tool is being called"),
  requiresApproval: z.boolean().default(false),
});

const workflowDecisionSchema = z.object({
  decisionType: z
    .enum(["respond_only", "start_workflow", "continue_workflow", "handoff"])
    .default("respond_only"),
  workflowKey: z
    .enum(["volunteer_staffing", "guest_followup", "prayer_care"])
    .optional(),
  workflowVersion: z.number().int().positive().optional(),
  workflowInput: z.record(z.unknown()).optional(),
  missingInputs: z.array(z.string()).optional(),
  kickoffSummary: z.string().optional(),
  nextBestAction: z.string().optional(),
  approvalMode: z.enum(["confirm_once", "approval_required", "none"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const graceOutputSchema = z.object({
  reasoning: z
    .string()
    .describe(
      "A brief operator-facing rationale. Summarize what you observed, what is missing, and why you chose the next step. Do not reveal hidden chain-of-thought."
    ),
  continueThinking: z
    .boolean()
    .default(false)
    .describe(
      "Set to true if you need to execute tools first and then reason about the results before responding to the user. Set to false when you have enough information to give a final response."
    ),
  intent: intentSchema.describe("Classified intent of the user message"),
  response: z.string().describe("Your pastoral, warm response to send to the user. Leave empty if continueThinking is true."),
  workflowDecision: workflowDecisionSchema
    .optional()
    .describe("Workflow orchestration decision for long-running church operations"),
  proposedTools: z
    .array(proposedToolSchema)
    .optional()
    .describe("Tools to execute to fulfil this request"),
  stateUpdates: z
    .object({
      name: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      requestText: z.string().optional(),
      urgency: z.enum(["normal", "urgent", "critical"]).optional(),
      preferredTime: z.string().optional(),
      appointmentTitle: z.string().optional(),
    })
    .optional()
    .describe("Slot state extracted from this message to persist across turns"),
});

type GraceLlmOutput = z.infer<typeof graceOutputSchema>;
type ReasoningLoopExitReason =
  | "completed"
  | "budget_exceeded"
  | "time_budget_exceeded"
  | "no_tools"
  | "no_progress"
  | "max_iterations"
  | "llm_error";

const GRACE_MAX_REASONING_ITERATIONS = 5;
const MAX_TOTAL_TOKENS = 12_000;
const MAX_LOOP_DURATION_MS = 15_000;
const DEFAULT_PUBLIC_CLAUDE_TOOLS = new Set([
  "churchInfo.search",
  "prayerRequests.create",
  "appointments.checkAvailability",
  "handoff.transfer",
]);

type PendingWorkflowConfirmation = GraceWorkflowDecision & {
  requestedAt: string;
  sourceMessage: string;
};

function isAffirmativeMessage(message: string) {
  return /^(yes|yep|yeah|ok|okay|do it|go ahead|proceed|start it|launch it|run it)\b/i.test(
    message.trim()
  );
}

function isNegativeMessage(message: string) {
  return /^(no|nope|cancel|stop|not now|don't|do not)\b/i.test(message.trim());
}

function readPendingWorkflowConfirmation(
  state: GraceRouterInput["state"]
): PendingWorkflowConfirmation | null {
  const candidate = state.pendingWorkflowConfirmation;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const parsed = z
    .object({
      decisionType: z.enum(["respond_only", "start_workflow", "continue_workflow", "handoff"]),
      workflowKey: z.enum(["volunteer_staffing", "guest_followup", "prayer_care"]).optional(),
      workflowVersion: z.number().int().positive().optional(),
      workflowInput: z.record(z.unknown()).optional(),
      missingInputs: z.array(z.string()).optional(),
      kickoffSummary: z.string().optional(),
      nextBestAction: z.string().optional(),
      approvalMode: z.enum(["confirm_once", "approval_required", "none"]).optional(),
      confidence: z.number().min(0).max(1).optional(),
      requestedAt: z.string(),
      sourceMessage: z.string(),
    })
    .safeParse(candidate);

  return parsed.success ? parsed.data : null;
}

function withoutPendingWorkflowConfirmation(state: GraceRouterInput["state"]) {
  const nextState = { ...state };
  delete nextState.pendingWorkflowConfirmation;
  return nextState;
}

// ---------------------------------------------------------------------------
// Knowledge retrieval (visibility-gated)
// ---------------------------------------------------------------------------

async function loadChurchKnowledge(
  organizationId: string,
  actorType: GraceRouterInput["context"]["actorType"]
): Promise<string> {
  const visibilityFilter =
    actorType === "public"
      ? eq(graceKnowledge.visibility, "public")
      : or(
          eq(graceKnowledge.visibility, "public"),
          eq(graceKnowledge.visibility, "internal")
        );

  const entries = await db
    .select({ title: graceKnowledge.title, content: graceKnowledge.content })
    .from(graceKnowledge)
    .where(
      and(
        eq(graceKnowledge.organizationId, organizationId),
        eq(graceKnowledge.useForGrace, true),
        visibilityFilter
      )
    )
    .limit(20);

  if (!entries.length) return "";

  return entries.map((e) => `## ${e.title}\n${e.content}`).join("\n\n");
}

function truncate(text: string, max = 200): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function formatOnboardingValue(value: string | number | null | undefined, fallback = "Not set") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number") {
    return value > 0 ? String(value) : fallback;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

async function loadOnboardingContext(organizationId: string): Promise<string> {
  try {
    const [organization] = await db
      .select({
        name: organizations.name,
        onboardingDone: organizations.onboardingDone,
        onboardingData: organizations.onboardingData,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!organization) {
      return "";
    }

    const { getGuidedSequenceOnboarding, getLaunchReadiness, getProviderHealthChecks } =
      await import("@/app/actions/onboarding");

    const [launchReadiness, providerHealth, guidedSequences] = await Promise.all([
      getLaunchReadiness(organizationId),
      getProviderHealthChecks(organizationId),
      getGuidedSequenceOnboarding(organizationId),
    ]);

    const onboardingData = onboardingDataSchema.parse(organization.onboardingData ?? {});
    const sections: string[] = [];

    sections.push(
      [
        "## Onboarding Profile",
        `- Church name: ${formatOnboardingValue(onboardingData.orgName || organization.name)}`,
        `- Website: ${formatOnboardingValue(onboardingData.orgWebsite)}`,
        `- Denomination: ${formatOnboardingValue(onboardingData.churchDenomination)}`,
        `- City: ${formatOnboardingValue(onboardingData.churchCity)}`,
        `- Team size: ${formatOnboardingValue(onboardingData.teamSize)}`,
        `- Avg weekly attendance: ${formatOnboardingValue(onboardingData.averageWeeklyAttendance)}`,
        `- Primary goal: ${formatOnboardingValue(onboardingData.primaryGoal)}`,
        `- Primary contact: ${formatOnboardingValue(onboardingData.primaryContactName)} | ${formatOnboardingValue(onboardingData.primaryContactEmail)} | ${formatOnboardingValue(onboardingData.primaryContactPhone)}`,
        `- Notes: ${formatOnboardingValue(onboardingData.notes)}`,
        `- Onboarding complete: ${organization.onboardingDone ? "yes" : "no"}`,
      ].join("\n")
    );

    sections.push(
      [
        "## Launch Readiness",
        `- Score: ${launchReadiness.score}%`,
        `- Completed steps: ${launchReadiness.completedCount}/${launchReadiness.totalCount}`,
        ...launchReadiness.steps.map(
          (step) => `- [${step.status}] ${step.id}: ${step.title} — ${step.description}`
        ),
      ].join("\n")
    );

    if (launchReadiness.blockingActions.length > 0) {
      sections.push(
        [
          "## Blocking Actions",
          ...launchReadiness.blockingActions.map(
            (action) =>
              `- ${action.title} — ${action.description} | impact: ${action.impact} | href: ${action.href}`
          ),
        ].join("\n")
      );
    }

    sections.push(
      [
        "## Provider Health",
        `- Summary: ${providerHealth.summary.healthy}/${providerHealth.summary.total} healthy | degraded ${providerHealth.summary.degraded} | critical ${providerHealth.summary.critical}`,
        ...providerHealth.checks.map(
          (check) =>
            `- ${check.key}: ${check.title} — ${check.status} | ${check.summary} | remediation: ${check.remediation.href}`
        ),
      ].join("\n")
    );

    sections.push(
      [
        "## Guided Sequences",
        ...guidedSequences.guides.map(
          (guide) =>
            `- [id:${guide.id}] ${guide.title} — templateInstalled=${guide.templateInstalled ? "yes" : "no"} | builderDraft=${guide.builderWorkflowId ? "yes" : "no"}`
        ),
        guidedSequences.nextGuideId
          ? `- Recommended next guide id: ${guidedSequences.nextGuideId}`
          : "- Recommended next guide id: none",
      ].join("\n")
    );

    return sections.join("\n\n");
  } catch (error) {
    console.error("[Grace] Failed to load onboarding context:", error);
    return "";
  }
}

async function loadOperationalContext(
  organizationId: string,
  contactId?: string | null
): Promise<string> {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [latestBriefing, pendingProposals, pendingGoals, orgPatterns, contactMemories,
    recentContacts, openTasks, activePrayer, upcomingAppts] =
    await Promise.all([
      db
        .select({
          summary: graceMemory.summary,
          details: graceMemory.details,
          createdAt: graceMemory.createdAt,
        })
        .from(graceMemory)
        .where(
          and(
            eq(graceMemory.organizationId, organizationId),
            eq(graceMemory.memoryType, "daily_briefing")
          )
        )
        .orderBy(desc(graceMemory.createdAt))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select({
          id: graceFollowupProposals.id,
          contactId: graceFollowupProposals.contactId,
          channel: graceFollowupProposals.proposedChannel,
          reason: graceFollowupProposals.reason,
          messageText: graceFollowupProposals.messageText,
          createdAt: graceFollowupProposals.createdAt,
        })
        .from(graceFollowupProposals)
        .where(
          and(
            eq(graceFollowupProposals.organizationId, organizationId),
            eq(graceFollowupProposals.status, "pending"),
            gte(graceFollowupProposals.createdAt, threeDaysAgo)
          )
        )
        .orderBy(desc(graceFollowupProposals.createdAt))
        .limit(20),
      db
        .select({
          id: graceGoals.id,
          goalType: graceGoals.goalType,
          workflowKey: graceGoals.workflowKey,
          status: graceGoals.status,
          objectiveText: graceGoals.objectiveText,
          lastDecisionSummary: graceGoals.lastDecisionSummary,
          nextCheckpointAt: graceGoals.nextCheckpointAt,
          createdAt: graceGoals.createdAt,
        })
        .from(graceGoals)
        .where(
          and(
            eq(graceGoals.organizationId, organizationId),
            inArray(graceGoals.status, ["queued", "in_progress", "waiting"])
          )
        )
        .orderBy(desc(graceGoals.createdAt))
        .limit(12),
      db
        .select({
          summary: graceMemory.summary,
          createdAt: graceMemory.createdAt,
        })
        .from(graceMemory)
        .where(
          and(
            eq(graceMemory.organizationId, organizationId),
            eq(graceMemory.memoryType, "org_pattern")
          )
        )
        .orderBy(desc(graceMemory.createdAt))
        .limit(5),
      contactId
        ? db
            .select({
              summary: graceMemory.summary,
              details: graceMemory.details,
              createdAt: graceMemory.createdAt,
            })
            .from(graceMemory)
            .where(
              and(
                eq(graceMemory.organizationId, organizationId),
                eq(graceMemory.memoryType, "contact_memory"),
                eq(graceMemory.contactId, contactId)
              )
            )
            .orderBy(desc(graceMemory.createdAt))
            .limit(8)
        : Promise.resolve([]),
      // Entity quick-reference with IDs for CRUD tool use
      db
        .select({
          id: churchContacts.id,
          firstName: churchContacts.firstName,
          lastName: churchContacts.lastName,
          memberStatus: churchContacts.memberStatus,
          phone: churchContacts.phone,
          email: churchContacts.email,
        })
        .from(churchContacts)
        .where(eq(churchContacts.organizationId, organizationId))
        .orderBy(desc(churchContacts.updatedAt))
        .limit(20),
      db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          priority: tasks.priority,
          dueDate: tasks.dueDate,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.organizationId, organizationId),
            inArray(tasks.status, ["todo", "in_progress"])
          )
        )
        .orderBy(desc(tasks.createdAt))
        .limit(15),
      db
        .select({
          id: prayerRequests.id,
          contactName: prayerRequests.contactName,
          content: prayerRequests.content,
          status: prayerRequests.status,
          urgency: prayerRequests.urgency,
        })
        .from(prayerRequests)
        .where(
          and(
            eq(prayerRequests.organizationId, organizationId),
            inArray(prayerRequests.status, ["new", "praying"])
          )
        )
        .orderBy(desc(prayerRequests.createdAt))
        .limit(10),
      db
        .select({
          id: appointments.id,
          title: appointments.title,
          dateTime: appointments.dateTime,
          status: appointments.status,
          contactId: appointments.contactId,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.organizationId, organizationId),
            gte(appointments.dateTime, new Date()),
            lte(appointments.dateTime, sevenDaysAhead),
            inArray(appointments.status, ["scheduled", "confirmed"])
          )
        )
        .orderBy(appointments.dateTime)
        .limit(10),
    ]);

  const sections: string[] = [];

  if (latestBriefing) {
    sections.push(
      `## Latest Daily Briefing (${new Date(latestBriefing.createdAt).toLocaleDateString()})\n${truncate(
        latestBriefing.details || latestBriefing.summary,
        800
      )}`
    );
  }

  if (pendingProposals.length > 0) {
    sections.push(
      `## Pending Follow-up Proposals (last 3 days)\n${pendingProposals
        .slice(0, 10)
        .map(
          (proposal) =>
            `- ${proposal.channel || "unknown"} | ${truncate(proposal.reason || "no reason", 80)} | ${truncate(
              proposal.messageText,
              120
            )}`
        )
        .join("\n")}`
    );
  }

  if (pendingGoals.length > 0) {
    sections.push(
      `## Pending Grace Goals\n${pendingGoals
        .map(
          (goal) =>
            `- [${goal.status}] ${goal.workflowKey || goal.goalType}: ${truncate(goal.objectiveText, 120)}${
              goal.lastDecisionSummary ? ` | next: ${truncate(goal.lastDecisionSummary, 80)}` : ""
            }${goal.nextCheckpointAt ? ` | checkpoint ${new Date(goal.nextCheckpointAt).toLocaleString()}` : ""}`
        )
        .join("\n")}`
    );
  }

  if (orgPatterns.length > 0) {
    sections.push(
      `## Recent Organizational Patterns\n${orgPatterns
        .map((memory) => `- ${truncate(memory.summary, 160)}`)
        .join("\n")}`
    );
  }

  if (contactMemories.length > 0) {
    sections.push(
      `## Known Context For Current Contact\n${contactMemories
        .map((memory) =>
          `- ${truncate(memory.summary, 160)}${memory.details ? ` (${truncate(memory.details, 120)})` : ""}`
        )
        .join("\n")}`
    );
  }

  // Entity quick-reference with IDs so Grace can call CRUD tools immediately
  if (recentContacts.length > 0) {
    sections.push(
      `## Contacts (use IDs with contacts.update / contacts.search)\n${recentContacts
        .map((c) => `- [id:${c.id}] ${c.firstName} ${c.lastName} — ${c.memberStatus}${c.phone ? ` | ${c.phone}` : ""}${c.email ? ` | ${c.email}` : ""}`)
        .join("\n")}`
    );
  }

  if (openTasks.length > 0) {
    sections.push(
      `## Open Tasks (use IDs with tasks.update / tasks.complete)\n${openTasks
        .map((t) => `- [id:${t.id}] "${truncate(t.title, 60)}" — ${t.priority} priority${t.dueDate ? ` | due ${new Date(t.dueDate).toLocaleDateString()}` : ""}`)
        .join("\n")}`
    );
  }

  if (activePrayer.length > 0) {
    sections.push(
      `## Active Prayer Requests (use IDs with prayerRequests.update)\n${activePrayer
        .map((p) => `- [id:${p.id}] ${p.contactName || "Anonymous"} — ${p.urgency} | "${truncate(p.content || "", 80)}"`)
        .join("\n")}`
    );
  }

  if (upcomingAppts.length > 0) {
    sections.push(
      `## Upcoming Appointments (use IDs with appointments.cancel)\n${upcomingAppts
        .map((a) => `- [id:${a.id}] "${truncate(a.title || "Appointment", 50)}" — ${new Date(a.dateTime).toLocaleString()} | ${a.status}`)
        .join("\n")}`
    );
  }

  return sections.join("\n\n");
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(params: {
  churchName: string;
  denomination: string | null;
  city: string | null;
  customPrompt: string | null;
  knowledge: string;
  operationalContext: string;
  onboardingContext: string;
  actorType: GraceRouterInput["context"]["actorType"];
  channel: GraceRouterInput["context"]["channel"];
  originSurface?: GraceRouterInput["context"]["originSurface"];
  currentState: Record<string, unknown>;
}): string {
  const isPublic = params.actorType === "public";

  const identity = [
    `You are Grace, the AI assistant for ${params.churchName}.`,
    params.denomination ? `Denomination: ${params.denomination}.` : "",
    params.city ? `Location: ${params.city}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const toneGuidance = `
You speak with a warm, pastoral, and welcoming tone. You are never salesy or transactional.
You handle prayer requests, care needs, appointments, service information, and ministry questions.
For emergencies or crisis situations (suicidal ideation, domestic violence, child safety), always escalate immediately using the handoff.transfer tool and encourage the person to contact emergency services.
Never fabricate church schedules, doctrine, staff names, or pastoral promises.
Never claim to be a pastor, counselor, or clergy member.`;

  const channelContext = isPublic
    ? `You are speaking with a visitor or community member via the church's ${params.channel.replace("_", " ")} channel.
You may: answer church questions, receive prayer requests, check appointment availability, and create a handoff to staff.
You may NOT: access member records, send outbound messages, or perform administrative actions.`
    : `You are assisting a church staff member via the internal ${params.channel.replace("_", " ")} interface.
You have access to CRM tools, scheduling, notes, and follow-up workflows.`;

  const stateContext =
    Object.keys(params.currentState).length > 0
      ? `\nCurrent conversation context: ${JSON.stringify(params.currentState)}`
      : "";

  const knowledgeSection = params.knowledge
    ? `\n\n# Church Knowledge Base\n${params.knowledge}`
    : "";

  const operationalContextSection = params.operationalContext
    ? `\n\n# Operational Context\n${params.operationalContext}`
    : "";

  const onboardingContextSection = params.onboardingContext
    ? `\n\n# Onboarding Context\n${params.onboardingContext}`
    : "";

  const onboardingGuidance =
    params.originSurface === "onboarding"
      ? `
# Onboarding Mode
You are acting as Grace's launch concierge for this workspace.
Prioritize capturing missing church profile details, clearing blocking launch steps, resolving provider readiness gaps, and getting the team to their first real workflow.
Ask at most one focused follow-up question at a time when a critical fact is missing.
When the user shares concrete setup facts, persist them with onboarding.profile.update instead of merely acknowledging them.
When the user asks you to install or start something, use the appropriate onboarding tool instead of only describing the steps.
After each response, end with the single best next step based on the onboarding context.

Onboarding tools:
- onboarding.profile.update(churchName?, denomination?, city?, website?, orgType?, teamSize?, averageWeeklyAttendance?, primaryContactName?, primaryContactEmail?, primaryContactPhone?, primaryGoal?, notes?, onboardingDone?)
- onboarding.installStarterTemplates()
- onboarding.bootstrapSampleData()
- onboarding.startGuidedSequence(blueprintId, installTemplate?)`
      : "";

  const customSection = params.customPrompt
    ? `\n\n# Additional Instructions\n${params.customPrompt}`
    : "";

const toolGuidance = `
# Workflow Orchestration
For long-running church operations, populate workflowDecision instead of only proposing tools.

Supported Grace workflows:
- volunteer_staffing: fill open service roles, send offers, watch replies, and escalate gaps
- guest_followup: follow up with first-time guests and move them toward a booked next step
- prayer_care: follow up on prayer requests, apply urgency rules, and escalate to human care when needed

Rules:
- Use decisionType=start_workflow when staff is asking Grace to launch one of these workflows.
- Use missingInputs[] for any blocking details that must be clarified before the workflow can start.
- Use kickoffSummary for the one confirmation Grace will show before starting autonomous execution.
- Use approvalMode=confirm_once for normal staff-initiated workflows unless a stricter mode is clearly required.
- Use decisionType=continue_workflow when the user is clearly referring to an in-flight workflow already shown in context.
- Use decisionType=respond_only when no workflow should be started or resumed.

# Available Tools
Only propose tools that are appropriate for the actor type and channel. Do not invent tool names.
Use the entity IDs from the Operational Context to call update tools directly — no guessing IDs.
If you need to find a contact not in the context, call contacts.search first.
For staff questions about weekly giving performance, call finance.weeklyReport.

Public-safe tools: churchInfo.search, prayerRequests.create, appointments.checkAvailability, handoff.transfer

Staff read/search tools: contacts.search(query, status?, limit?), contacts.findDuplicates(reason?, minGroupSize?, limit?), tasks.search(query?, status?, priority?, assigneeId?, sla?, limit?), finance.weeklyReport(startDate?, endDate?), appointments.search(query?, status?, fromDate?, toDate?, upcomingOnly?, limit?), calls.search(query?, outcome?, escalatedOnly?, fromDate?, toDate?, limit?), pipeline.search(query?, stageId?, priority?, assigneeId?, limit?), pipeline.audit(itemId?, limit?), conversations.search(query?, status?, includeArchived?, limit?)

Staff create tools: contacts.upsert, appointments.book, tasks.create(title, description?, assigneeId?, dueDate?, priority?), prayerRequests.create, pipelines.addToStage, memory.write, serviceRuns.createFromTemplate, serviceRuns.autoStaff, volunteers.create(contactId, role?, status?), volunteerShifts.create(volunteerId, date, hours, eventId?, notes?)

Staff update tools: contacts.update(contactId, firstName?, lastName?, email?, phone?, memberStatus?, notes?), contacts.archive(contactId), contacts.restore(contactId, status?), contacts.delete(contactId), contacts.merge(primaryContactId, duplicateContactId), tasks.update(taskId, title?, status?, priority?, assigneeId?, dueDate?), tasks.complete(taskId), prayerRequests.update(requestId, status?, urgency?, assignedTeam?, response?), appointments.setStatus(appointmentId, status), appointments.reschedule(appointmentId, dateTime, duration?, notes?, resetStatus?), appointments.cancel(appointmentId), appointments.delete(appointmentId), calls.update(callId, transcriptText?, summaryText?, intent?, outcome?, startedAt?, endedAt?, durationSec?, recordingUrl?, contactId?), calls.escalate(callId, reason, summaryText?, assignedTeam?), pipeline.moveStage(itemId, stageId), pipeline.updateItem(itemId, stageId?, order?, priority?, assigneeId?, notes?, lastContactDate?, nextActionDate?), pipeline.deleteItem(itemId), ministries.addMember(ministryId, contactId, role?), conversations.setStatus(conversationId, status), conversations.waiting(conversationId), conversations.resolve(conversationId), conversations.archive(conversationId), conversations.reopen(conversationId), volunteers.update(volunteerId, role?, status?, contactId?), volunteers.delete(volunteerId), volunteerShifts.update(shiftId, date?, hours?, notes?, eventId?), volunteerShifts.delete(shiftId)

Staff communication tools: messages.sendSMS(to, message), messages.sendEmail(to, subject, html), staff.alert(reason, details?)

Staff service tools: serviceAssignments.sendOfferSMS(serviceRunId)

Runtime policy decides whether a proposed tool executes immediately, becomes a suggestion, or queues approval.
- Routine one-to-one operational actions can execute autonomously.
- Less-routine or low-confidence actions become suggestions for staff review.
- Destructive tools and explicit bulk/group-targeted actions always require approval.

# Agentic Reasoning
You are an autonomous agent who can think in multiple steps. Before responding to the user:
1. OBSERVE: Review the operational context. What data do you already have? What's missing?
2. THINK: Use the "reasoning" field for a short, factual rationale. Do not write hidden chain-of-thought.
3. ACT: Propose tools to gather information or take action.
4. DECIDE: Set continueThinking=true if you need to see tool results before forming a response.
   Set continueThinking=false when you have enough information for a complete, helpful response.

Key behaviors:
- When asked about a contact, SEARCH first (contacts.search) before responding. Don't guess.
- When asked to follow up, check if a follow-up already exists (tasks.search) before creating one.
- When asked to staff a service, check the service matrix first before proposing candidates.
- Chain tools: search → analyze results → take action → summarize what you did.
- If a tool fails, reason about why and try an alternative approach.
- You are Grace, a proactive team member. Take initiative on routine operations.
  For visitor follow-ups, thank-you texts, prayer check-ins, and volunteer staffing — act immediately.
  For re-engagement campaigns, complex outreach, or anything affecting many people — propose and wait for confirmation.`;

  return [
    identity,
    toneGuidance,
    channelContext,
    stateContext,
    knowledgeSection,
    operationalContextSection,
    onboardingContextSection,
    onboardingGuidance,
    customSection,
    toolGuidance,
  ]
    .filter(Boolean)
    .join("\n");
}

function hasStateUpdates(
  stateUpdates: z.infer<typeof graceOutputSchema>["stateUpdates"] | undefined
) {
  return Boolean(stateUpdates && Object.keys(stateUpdates).length > 0);
}

function buildReasoningLoopFallbackResponse(params: {
  actionOutcomes: GraceActionOutcome[];
  exitReason: ReasoningLoopExitReason;
}) {
  const executedCount = params.actionOutcomes.filter((outcome) =>
    outcome.status === "executed" || outcome.status === "retried"
  ).length;
  const queuedCount = params.actionOutcomes.filter((outcome) => outcome.status === "queued").length;
  const suggestedCount = params.actionOutcomes.filter((outcome) => outcome.status === "suggested").length;

  const completedParts: string[] = [];
  if (executedCount > 0) {
    completedParts.push(`completed ${executedCount} step${executedCount === 1 ? "" : "s"}`);
  }
  if (queuedCount > 0) {
    completedParts.push(`queued ${queuedCount} approval${queuedCount === 1 ? "" : "s"}`);
  }
  if (suggestedCount > 0) {
    completedParts.push(`logged ${suggestedCount} suggestion${suggestedCount === 1 ? "" : "s"} for review`);
  }

  const handledText =
    completedParts.length > 0
      ? ` I ${completedParts.join(", ")}.`
      : "";

  if (params.exitReason === "no_tools" || params.exitReason === "no_progress") {
    return `I stopped before guessing because I didn't have enough reliable information to keep going automatically.${handledText} Please tell me the specific contact, service, or next step you want me to work on.`;
  }

  if (
    params.exitReason === "budget_exceeded" ||
    params.exitReason === "time_budget_exceeded" ||
    params.exitReason === "max_iterations"
  ) {
    return `I completed what I could and stopped before overextending the decision loop.${handledText} If you want me to keep going, send the next specific instruction.`;
  }

  return `I completed the safe next step and stopped when the model became unavailable.${handledText}`;
}

function mapWorkflowDecision(object: GraceLlmOutput): GraceWorkflowDecision | null {
  return object.workflowDecision
    ? {
        decisionType: object.workflowDecision.decisionType,
        workflowKey: object.workflowDecision.workflowKey,
        workflowVersion: object.workflowDecision.workflowVersion,
        workflowInput: object.workflowDecision.workflowInput,
        missingInputs: object.workflowDecision.missingInputs ?? [],
        kickoffSummary: object.workflowDecision.kickoffSummary,
        nextBestAction: object.workflowDecision.nextBestAction,
        approvalMode: object.workflowDecision.approvalMode,
        confidence: object.workflowDecision.confidence,
      }
    : null;
}

async function finalizeGraceRouterOutput(params: {
  input: GraceRouterInput;
  object: GraceLlmOutput;
  accumulatedStateUpdates: Record<string, unknown>;
  allProposedActions: ProposedAction[];
  allActionOutcomes: GraceActionOutcome[];
  reasoningSteps: ReasoningStep[];
  loopExitReason: ReasoningLoopExitReason;
}): Promise<GraceRouterOutput> {
  const {
    input,
    object,
    accumulatedStateUpdates,
    allProposedActions,
    allActionOutcomes,
    reasoningSteps,
    loopExitReason,
  } = params;
  const { message, state, context } = input;
  const workflowDecision = mapWorkflowDecision(object);

  const updatedState: typeof state = {
    ...state,
    ...accumulatedStateUpdates,
  };

  const finalResponse =
    loopExitReason === "completed" &&
    typeof object.response === "string" &&
    object.response.trim().length > 0
      ? object.response
      : buildReasoningLoopFallbackResponse({
          actionOutcomes: allActionOutcomes,
          exitReason: loopExitReason,
        });

  if (
    context.actorType === "staff" &&
    loopExitReason === "completed" &&
    workflowDecision?.decisionType === "start_workflow" &&
    workflowDecision.workflowKey &&
    (workflowDecision.missingInputs?.length ?? 0) === 0 &&
    workflowDecision.approvalMode !== "none"
  ) {
    updatedState.pendingWorkflowConfirmation = {
      ...workflowDecision,
      requestedAt: new Date().toISOString(),
      sourceMessage: message,
    };

    return {
      response:
        workflowDecision.kickoffSummary && !finalResponse.includes(workflowDecision.kickoffSummary)
          ? `${finalResponse}\n\n${workflowDecision.kickoffSummary}\nReply yes to start or no to cancel.`
          : `${finalResponse}\n\nReply yes to start or no to cancel.`,
      intent: object.intent as GraceIntent,
      state: updatedState,
      proposedActions: allProposedActions,
      actionOutcomes: allActionOutcomes,
      workflowDecision,
      workflowStart: {
        status: "pending_confirmation",
        workflowKey: workflowDecision.workflowKey,
        summary: workflowDecision.kickoffSummary ?? object.response,
      },
      reasoning: reasoningSteps.map((s) => s.reasoning).join("\n---\n"),
      reasoningSteps,
      iterationCount: reasoningSteps.length,
    };
  }

  if (!updatedState.matchedContactId && (updatedState.name || updatedState.phone || updatedState.email)) {
    const names = updatedState.name ? updatedState.name.split(" ") : [];
    const firstName = names[0];
    const lastName = names.slice(1).join(" ");

    const { matchContactForGraceSession } = await import("../contacts/matcher");
    const matchResult = await matchContactForGraceSession(
      context.organizationId,
      context.sessionId,
      {
        firstName,
        lastName: lastName || undefined,
        phone: updatedState.phone,
        email: updatedState.email,
      }
    );

    updatedState.matchedContactId = matchResult.contactId ?? undefined;
    updatedState.matchTier = matchResult.confidenceTier;
  }

  return {
    response: finalResponse,
    intent: object.intent as GraceIntent,
    state: updatedState,
    proposedActions: allProposedActions,
    actionOutcomes: allActionOutcomes,
    workflowDecision,
    workflowStart: null,
    reasoning: reasoningSteps.map((s) => s.reasoning).join("\n---\n"),
    reasoningSteps,
    iterationCount: reasoningSteps.length,
  };
}

function shouldUseClaudeNativeRouter() {
  const provider = process.env.GRACE_ROUTER_PROVIDER?.trim().toLowerCase();
  return provider === "anthropic" || provider === "claude";
}

function getBaseChannel(channel: GraceRouterInput["context"]["channel"]) {
  if (channel === "voice_internal" || channel === "voice_public") return "voice";
  if (channel === "sms_public") return "sms";
  if (channel === "web_public") return "web";
  return channel;
}

function isToolAvailableForContext(
  toolDefinition: GraceTool,
  context: GraceRouterInput["context"]
) {
  const allowedChannels = new Set(toolDefinition.allowedChannels);
  const baseChannel = getBaseChannel(context.channel);
  const channelAllowed =
    allowedChannels.has(context.channel) ||
    allowedChannels.has(baseChannel);

  if (!channelAllowed) {
    return false;
  }

  if (context.actorType !== "public") {
    return true;
  }

  const configuredPublicTools = context.policy?.allowedPublicTools;
  if (configuredPublicTools && configuredPublicTools.length > 0) {
    return configuredPublicTools.includes(toolDefinition.name);
  }

  return DEFAULT_PUBLIC_CLAUDE_TOOLS.has(toolDefinition.name);
}

function toClaudeToolAlias(toolName: string) {
  return toolName.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

function toInputRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

function parseClaudeFinalObject(text: string): GraceLlmOutput | null {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");
  const candidate =
    firstBrace >= 0 && lastBrace > firstBrace
      ? withoutFence.slice(firstBrace, lastBrace + 1)
      : withoutFence;

  try {
    const parsed = JSON.parse(candidate);
    const result = graceOutputSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

async function runClaudeNativeRouter(params: {
  input: GraceRouterInput;
  systemPrompt: string;
}): Promise<GraceRouterOutput | null> {
  const { input, systemPrompt } = params;
  const { message, state, context } = input;
  const { resolveAnthropicApiKey } = await import("../providers/resolver");
  const anthropicApiKey = await resolveAnthropicApiKey(context.organizationId);

  if (!anthropicApiKey) {
    return null;
  }

  const ai = await import("ai");
  const { createGraceAnthropicModel, DEFAULT_GRACE_CLAUDE_MODEL } = await import(
    "../providers/anthropic"
  );
  const { graceTools } = await import("../tools/registry");
  const allProposedActions: ProposedAction[] = [];
  const allActionOutcomes: GraceActionOutcome[] = [];
  const accumulatedStateUpdates: Record<string, unknown> = {};
  const toolsCalled: ReasoningStep["toolsCalled"] = [];
  const toolAliases = new Map<string, string>();
  const claudeTools: ToolSet = {};

  for (const toolDefinition of graceTools) {
    if (!toolDefinition.inputSchema || !isToolAvailableForContext(toolDefinition, context)) {
      continue;
    }

    let alias = toClaudeToolAlias(toolDefinition.name);
    if (toolAliases.has(alias)) {
      alias = `${alias}_${toolAliases.size + 1}`;
    }
    toolAliases.set(alias, toolDefinition.name);

    claudeTools[alias] = ai.tool({
      description: toolDefinition.description ?? toolDefinition.name,
      inputSchema: toolDefinition.inputSchema,
      execute: async (toolInput: unknown) => {
        const action: ProposedAction = {
          id: crypto.randomUUID(),
          tool: toolDefinition.name,
          input: toInputRecord(toolInput),
          reason: `Claude tool call: ${toolDefinition.name}`,
          requiresApproval: Boolean(toolDefinition.requiresApproval),
        };

        const execution = await executePlannedActions({
          actions: [action],
          context,
          returnToolResults: true,
        });
        const result = execution.results[0] ?? {
          success: false,
          error: "Tool did not return a result",
        };

        allProposedActions.push(action);
        allActionOutcomes.push(...(execution.actionOutcomes ?? []));
        toolsCalled.push({
          tool: action.tool,
          input: action.input,
          result,
        });

        return result;
      },
    });
  }

  const startedAt = Date.now();

  try {
    const llmResult = await ai.generateText({
      model: createGraceAnthropicModel(anthropicApiKey),
      system: `${systemPrompt}

# Native Tool Mode
Use native tools directly when current data or an action is needed. Do not invent tool names or include proposedTools for tools you already called.

When you are finished, return only JSON matching this shape:
{
  "reasoning": "brief operator-facing rationale",
  "continueThinking": false,
  "intent": "info_request | prayer_request | appointment_request | follow_up_request | contact_request | report_request | emergency | unknown",
  "response": "the response Grace should say",
  "workflowDecision": null,
  "stateUpdates": {}
}`,
      prompt: message,
      tools: claudeTools,
      toolChoice: "auto",
      stopWhen: ai.stepCountIs(GRACE_MAX_REASONING_ITERATIONS),
      temperature: 0.2,
      maxOutputTokens: 1800,
      maxRetries: 1,
    });

    const parsedObject = parseClaudeFinalObject(llmResult.text);
    const object: GraceLlmOutput =
      parsedObject ??
      graceOutputSchema.parse({
        reasoning:
          "Claude returned a plain-text response after native tool execution, so Grace used it directly.",
        continueThinking: false,
        intent: "unknown",
        response: llmResult.text.trim(),
        proposedTools: [],
        stateUpdates: {},
      });

    if (object.stateUpdates) {
      Object.assign(accumulatedStateUpdates, object.stateUpdates);
    }

    const usage = normalizeAuditUsage((llmResult as { usage?: unknown }).usage);
    await writeGraceAuditStreamSafe({
      organizationId: context.organizationId,
      sessionId: context.sessionId,
      actorType: context.actorType,
      channel: context.channel,
      eventType: "ai_decision",
      source: "grace_router",
      status: "success",
      intent: object.intent,
      model: DEFAULT_GRACE_CLAUDE_MODEL,
      latencyMs: Date.now() - startedAt,
      inputTokens: usage.inputTokens ?? null,
      outputTokens: usage.outputTokens ?? null,
      totalTokens: usage.totalTokens ?? null,
      estimatedCostUsd: estimateModelCostUsd({
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
      }),
      metadataJson: {
        routerProvider: "anthropic",
        nativeToolMode: true,
        parsedFinalJson: Boolean(parsedObject),
        toolCount: Object.keys(claudeTools).length,
        executedToolCount: toolsCalled.length,
      },
    });

    const reasoningSteps: ReasoningStep[] = [
      {
        iteration: 0,
        reasoning: object.reasoning,
        toolsCalled,
        durationMs: Date.now() - startedAt,
      },
    ];

    return finalizeGraceRouterOutput({
      input: {
        message,
        state,
        context,
      },
      object,
      accumulatedStateUpdates,
      allProposedActions,
      allActionOutcomes,
      reasoningSteps,
      loopExitReason: "completed",
    });
  } catch (llmError) {
    console.error("[Grace] Claude native tool routing failed:", llmError);
    await writeGraceAuditStreamSafe({
      organizationId: context.organizationId,
      sessionId: context.sessionId,
      actorType: context.actorType,
      channel: context.channel,
      eventType: "ai_decision",
      source: "grace_router",
      status: "error",
      intent: "unknown",
      model: DEFAULT_GRACE_CLAUDE_MODEL,
      latencyMs: Date.now() - startedAt,
      errorText: llmError instanceof Error ? llmError.message : "claude_router_failed",
      metadataJson: {
        routerProvider: "anthropic",
        fallbackResponse: true,
      },
    });

    return {
      response:
        "I'm temporarily unavailable and unable to process your request right now. " +
        "Please try again in a moment, or contact the church office directly for assistance.",
      intent: "unknown" as GraceIntent,
      state,
      proposedActions: allProposedActions,
      actionOutcomes: allActionOutcomes,
      workflowDecision: null,
      workflowStart: null,
      availabilityStatus: "llm_unavailable",
      availabilityMessage:
        "Grace AI is temporarily unavailable right now. Please try again in a moment.",
    };
  }
}

// ---------------------------------------------------------------------------
// Main router — replaces regex classifier + hardcoded planner
// ---------------------------------------------------------------------------

export async function runClawRouter(input: GraceRouterInput): Promise<GraceRouterOutput> {
  const { message, state, context } = input;
  const matchedStateContactId =
    typeof state.matchedContactId === "string" ? state.matchedContactId : null;
  const activeContactId = context.contactId ?? matchedStateContactId ?? null;
  const emergencySignal = detectEmergencySignal(message);
  const shouldAutoEscalateOnEmergency =
    context.policy?.autoEscalateOnEmergency !== false;

  if (emergencySignal.isEmergency && shouldAutoEscalateOnEmergency) {
    const emergencyAction: ProposedAction = {
      id: crypto.randomUUID(),
      tool: "handoff.transfer",
      input: {
        reason: "deterministic_emergency_auto_escalation",
        details: buildEmergencyEscalationDetails({
          message,
          matchedPatterns: emergencySignal.matchedPatterns,
        }),
      },
      reason:
        "Deterministic emergency policy triggered escalation without relying on model planning",
      requiresApproval: false,
    };

    const execution = await executePlannedActions({
      actions: [emergencyAction],
      context,
      skipApprovals: true,
    });

    const actionOutcomes = [...(execution.actionOutcomes ?? [])];
    const escalatedFromPolicyPath = actionOutcomes.some(
      (outcome) =>
        outcome.tool === "handoff.transfer" &&
        (outcome.status === "executed" ||
          outcome.status === "retried" ||
          outcome.status === "queued")
    );

    if (!escalatedFromPolicyPath) {
      const fallbackTool = findGraceTool("handoff.transfer");
      const occurredAt = new Date().toISOString();

      if (!fallbackTool) {
        actionOutcomes.push({
          actionId: emergencyAction.id,
          tool: emergencyAction.tool,
          reason: emergencyAction.reason,
          requiresApproval: false,
          status: "failed",
          error: "Tool not found: handoff.transfer",
          occurredAt,
        });
      } else {
        try {
          const result = await fallbackTool.execute(emergencyAction.input, context);
          actionOutcomes.push({
            actionId: emergencyAction.id,
            tool: emergencyAction.tool,
            reason: emergencyAction.reason,
            requiresApproval: false,
            status: result.success ? "executed" : "failed",
            output: result.output,
            error: result.error,
            occurredAt,
          });
        } catch (error) {
          actionOutcomes.push({
            actionId: emergencyAction.id,
            tool: emergencyAction.tool,
            reason: emergencyAction.reason,
            requiresApproval: false,
            status: "failed",
            error:
              error instanceof Error
                ? error.message
                : "Emergency escalation failed",
            occurredAt,
          });
        }
      }
    }

    await writeGraceAuditStreamSafe({
      organizationId: context.organizationId,
      sessionId: context.sessionId,
      actorType: context.actorType,
      channel: context.channel,
      eventType: "ai_decision",
      source: "grace_router",
      status: actionOutcomes.some((outcome) => outcome.status === "failed")
        ? "error"
        : "success",
      intent: "emergency",
      model: "deterministic_emergency_policy",
      actionName: "handoff.transfer",
      metadataJson: {
        autoEscalated: true,
        matchedPatterns: emergencySignal.matchedPatterns,
      },
    });

    return {
      response: buildEmergencyResponseText(),
      intent: "emergency",
      state: {
        ...state,
        urgency: "critical",
        requestText:
          typeof state.requestText === "string" && state.requestText.trim().length > 0
            ? state.requestText
            : message,
      },
      proposedActions: [emergencyAction],
      actionOutcomes,
      workflowDecision: null,
      workflowStart: null,
    };
  }

  const pendingWorkflowConfirmation = readPendingWorkflowConfirmation(state);
  if (context.actorType === "staff" && pendingWorkflowConfirmation) {
    if (isAffirmativeMessage(message)) {
      const workflowStart = await startGraceWorkflowFromDecision({
        context,
        decision: pendingWorkflowConfirmation,
      });

      await writeGraceAuditStreamSafe({
        organizationId: context.organizationId,
        sessionId: context.sessionId,
        actorType: context.actorType,
        channel: context.channel,
        eventType: "workflow_execution",
        source: "grace_router",
        status: workflowStart.status === "failed" ? "error" : "success",
        actionName: `${pendingWorkflowConfirmation.workflowKey ?? "unknown"}.kickoff_confirmed`,
        metadataJson: {
          workflowKey: pendingWorkflowConfirmation.workflowKey ?? null,
          workflowStart,
        },
      });

      return {
        response:
          workflowStart.summary ??
          "Grace has started that workflow and will keep it moving automatically.",
        intent: "follow_up_request",
        state: withoutPendingWorkflowConfirmation(state),
        proposedActions: [],
        actionOutcomes: [],
        workflowDecision: pendingWorkflowConfirmation,
        workflowStart,
      };
    }

    if (isNegativeMessage(message)) {
      await writeGraceAuditStreamSafe({
        organizationId: context.organizationId,
        sessionId: context.sessionId,
        actorType: context.actorType,
        channel: context.channel,
        eventType: "workflow_execution",
        source: "grace_router",
        status: "skipped",
        actionName: `${pendingWorkflowConfirmation.workflowKey ?? "unknown"}.kickoff_cancelled`,
        metadataJson: {
          workflowKey: pendingWorkflowConfirmation.workflowKey ?? null,
        },
      });

      return {
        response: "Okay. I won't start that workflow.",
        intent: "unknown",
        state: withoutPendingWorkflowConfirmation(state),
        proposedActions: [],
        actionOutcomes: [],
        workflowDecision: pendingWorkflowConfirmation,
        workflowStart: {
          status: "cancelled",
          workflowKey: pendingWorkflowConfirmation.workflowKey,
          summary: "Kickoff cancelled by staff.",
        },
      };
    }
  }

  // Load org context, knowledge, and provider credentials in parallel.
  const [orgConfig, knowledge, operationalContext, geminiApiKey, onboardingContext] =
    await Promise.all([
    db
      .select({
        churchName: aiConfig.churchName,
        churchDenomination: aiConfig.churchDenomination,
        churchCity: aiConfig.churchCity,
        customSystemPrompt: aiConfig.customSystemPrompt,
      })
      .from(aiConfig)
      .where(eq(aiConfig.organizationId, context.organizationId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    loadChurchKnowledge(context.organizationId, context.actorType),
    loadOperationalContext(context.organizationId, activeContactId),
    resolveGeminiApiKey(context.organizationId),
    context.originSurface === "onboarding"
      ? loadOnboardingContext(context.organizationId)
      : Promise.resolve(""),
  ]);

  const systemPrompt = buildSystemPrompt({
    churchName: orgConfig?.churchName ?? "our church",
    denomination: orgConfig?.churchDenomination ?? null,
    city: orgConfig?.churchCity ?? null,
    customPrompt: orgConfig?.customSystemPrompt ?? null,
    knowledge,
    operationalContext,
    onboardingContext,
    actorType: context.actorType,
    channel: context.channel,
    originSurface: context.originSurface,
    currentState: state,
  });

  if (shouldUseClaudeNativeRouter()) {
    const claudeResult = await runClaudeNativeRouter({ input, systemPrompt });
    if (claudeResult) {
      return claudeResult;
    }
  }

  if (!geminiApiKey) {
    console.error("[Grace] Gemini provider is not configured for organization:", context.organizationId);
    await writeGraceAuditStreamSafe({
      organizationId: context.organizationId,
      sessionId: context.sessionId,
      actorType: context.actorType,
      channel: context.channel,
      eventType: "ai_decision",
      source: "grace_router",
      status: "error",
      intent: "unknown",
      model: "gemini-2.5-flash",
      errorText: "missing_gemini_provider_key",
      metadataJson: {
        fallbackResponse: true,
      },
    });
    return {
      response:
        "I'm temporarily unavailable and unable to process your request right now. " +
        "Please try again in a moment, or contact the church office directly for assistance.",
      intent: "unknown" as GraceIntent,
      state,
      proposedActions: [],
      actionOutcomes: [],
      workflowDecision: null,
      workflowStart: null,
      availabilityStatus: "provider_missing",
      availabilityMessage:
        "Grace AI is not configured for this organization yet. Finish onboarding to enable chat and voice.",
    };
  }

  const google = createGoogleGenerativeAI({ apiKey: geminiApiKey });

  // ---------------------------------------------------------------------------
  // Agentic Reasoning Loop
  // ---------------------------------------------------------------------------
  // Instead of a single LLM call, Grace runs up to MAX_ITERATIONS:
  //   1. LLM reasons about the request and proposes tools
  //   2. If continueThinking=true, tools are executed and results fed back
  //   3. On the next iteration, Grace sees tool results and decides next step
  //   4. Loop ends when continueThinking=false or max iterations reached
  // ---------------------------------------------------------------------------

  const reasoningSteps: ReasoningStep[] = [];
  const allProposedActions: ProposedAction[] = [];
  const allActionOutcomes: GraceActionOutcome[] = [];
  const accumulatedStateUpdates: Record<string, unknown> = {};
  let finalObject: z.infer<typeof graceOutputSchema> | null = null;
  let toolResultsContext = "";
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const loopStartedAt = Date.now();
  let loopExitReason: ReasoningLoopExitReason = "max_iterations";

  for (let iteration = 0; iteration < GRACE_MAX_REASONING_ITERATIONS; iteration++) {
    const iterationStart = Date.now();

    // Build the prompt: original message + accumulated tool results
    const iterationPrompt = iteration === 0
      ? message
      : `${message}\n\n# Tool Results from Previous Steps\n${toolResultsContext}\n\nBased on these results, continue reasoning. If you have enough information, set continueThinking=false and provide your final response.`;

    let object: z.infer<typeof graceOutputSchema>;
    try {
      const llmResult = await generateObject({
        model: google("gemini-2.5-flash"),
        output: "object",
        system: systemPrompt,
        prompt: iterationPrompt,
        schema: graceOutputSchema,
      });
      object = llmResult.object;
      if (object.stateUpdates) {
        Object.assign(accumulatedStateUpdates, object.stateUpdates);
      }

      const usage = normalizeAuditUsage((llmResult as { usage?: unknown }).usage);
      totalInputTokens += usage.inputTokens ?? 0;
      totalOutputTokens += usage.outputTokens ?? 0;

      await writeGraceAuditStreamSafe({
        organizationId: context.organizationId,
        sessionId: context.sessionId,
        actorType: context.actorType,
        channel: context.channel,
        eventType: "ai_decision",
        source: "grace_router",
        status: "success",
        intent: object.intent,
        model: "gemini-2.5-flash",
        latencyMs: Date.now() - iterationStart,
        inputTokens: usage.inputTokens ?? null,
        outputTokens: usage.outputTokens ?? null,
        totalTokens: usage.totalTokens ?? null,
        estimatedCostUsd: estimateModelCostUsd({
          inputTokens: usage.inputTokens ?? null,
          outputTokens: usage.outputTokens ?? null,
        }),
        metadataJson: {
          iteration,
          continueThinking: object.continueThinking,
          reasoning: object.reasoning,
          proposedToolCount: (object.proposedTools ?? []).length,
          workflowDecisionType: object.workflowDecision?.decisionType ?? "respond_only",
          workflowKey: object.workflowDecision?.workflowKey ?? null,
        },
      });
    } catch (llmError) {
      console.error(`[Grace] Gemini call failed on iteration ${iteration}:`, llmError);
      await writeGraceAuditStreamSafe({
        organizationId: context.organizationId,
        sessionId: context.sessionId,
        actorType: context.actorType,
        channel: context.channel,
        eventType: "ai_decision",
        source: "grace_router",
        status: "error",
        intent: "unknown",
        model: "gemini-2.5-flash",
        latencyMs: Date.now() - iterationStart,
        errorText: llmError instanceof Error ? llmError.message : "llm_call_failed",
        metadataJson: {
          iteration,
          fallbackResponse: true,
        },
      });

      // If we have results from previous iterations, use the last good response
      if (finalObject) {
        loopExitReason = "llm_error";
        break;
      }

      return {
        response:
          "I'm temporarily unavailable and unable to process your request right now. " +
          "Please try again in a moment, or contact the church office directly for assistance.",
        intent: "unknown" as GraceIntent,
        state,
        proposedActions: allProposedActions,
        actionOutcomes: allActionOutcomes,
        workflowDecision: null,
        workflowStart: null,
        availabilityStatus: "llm_unavailable",
        availabilityMessage:
          "Grace AI is temporarily unavailable right now. Please try again in a moment.",
      };
    }

    finalObject = object;

    // Convert proposed tools into actions
    const iterationActions: ProposedAction[] = (object.proposedTools ?? []).map((t) => ({
      id: crypto.randomUUID(),
      tool: t.tool,
      input: t.input,
      reason: t.reason,
      requiresApproval: t.requiresApproval,
    }));

    // Execute tools for this iteration
    const stepToolResults: ReasoningStep["toolsCalled"] = [];

    if (iterationActions.length > 0) {
      const execution = await executePlannedActions({
        actions: iterationActions,
        context,
        returnToolResults: true,
      });

      // Collect results for the reasoning step trace
      for (let i = 0; i < iterationActions.length; i++) {
        const action = iterationActions[i];
        const result = execution.results[i];
        if (action && result) {
          stepToolResults.push({
            tool: action.tool,
            input: action.input,
            result,
          });
        }
      }

      allProposedActions.push(...iterationActions);
      allActionOutcomes.push(...(execution.actionOutcomes ?? []));

      // Build tool results context for the next iteration
      if (object.continueThinking && stepToolResults.length > 0) {
        const newResults = stepToolResults
          .map(
            (tr, idx) =>
              `## Tool ${idx + 1}: ${tr.tool}\nInput: ${JSON.stringify(tr.input)}\nResult: ${tr.result.success ? "SUCCESS" : "FAILED"}\nOutput: ${JSON.stringify(tr.result.output ?? tr.result.error ?? "no output")}`
          )
          .join("\n\n");
        toolResultsContext += (toolResultsContext ? "\n\n---\n\n" : "") + `### Iteration ${iteration + 1}\n${newResults}`;
      }
    }

    // Record this reasoning step
    reasoningSteps.push({
      iteration,
      reasoning: object.reasoning,
      toolsCalled: stepToolResults,
      durationMs: Date.now() - iterationStart,
    });

    // If Grace says she's done thinking, break out of the loop
    if (!object.continueThinking) {
      loopExitReason = "completed";
      break;
    }

    // If no tools were proposed but continueThinking is true, force stop to prevent infinite loop
    if (iterationActions.length === 0) {
      console.warn(`[Grace] Iteration ${iteration}: continueThinking=true but no tools proposed. Stopping.`);
      loopExitReason = "no_tools";
      break;
    }

    if (
      Date.now() - loopStartedAt >= MAX_LOOP_DURATION_MS
    ) {
      console.warn(`[Grace] Iteration ${iteration}: loop exceeded time budget. Stopping.`);
      loopExitReason = "time_budget_exceeded";
      break;
    }

    if (totalInputTokens + totalOutputTokens >= MAX_TOTAL_TOKENS) {
      console.warn(`[Grace] Iteration ${iteration}: loop exceeded token budget. Stopping.`);
      loopExitReason = "budget_exceeded";
      break;
    }

    const madeProgress =
      stepToolResults.some((toolResult) => toolResult.result.success) ||
      hasStateUpdates(object.stateUpdates);

    if (!madeProgress) {
      console.warn(`[Grace] Iteration ${iteration}: continueThinking=true but no useful progress. Stopping.`);
      loopExitReason = "no_progress";
      break;
    }
  }

  return finalizeGraceRouterOutput({
    input,
    object: finalObject!,
    accumulatedStateUpdates,
    allProposedActions,
    allActionOutcomes,
    reasoningSteps,
    loopExitReason,
  });
}
