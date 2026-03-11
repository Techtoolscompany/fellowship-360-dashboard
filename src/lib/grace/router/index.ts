import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
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
import type { GraceIntent, GraceRouterInput, GraceRouterOutput, ProposedAction } from "../types";
import { executePlannedActions } from "./executor";
import { resolveGeminiApiKey } from "../providers/resolver";

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

const graceOutputSchema = z.object({
  intent: intentSchema.describe("Classified intent of the user message"),
  response: z.string().describe("Your pastoral, warm response to send to the user"),
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
          status: graceGoals.status,
          objectiveText: graceGoals.objectiveText,
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
            `- [${goal.status}] ${goal.goalType}: ${truncate(goal.objectiveText, 120)}`
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
  actorType: GraceRouterInput["context"]["actorType"];
  channel: GraceRouterInput["context"]["channel"];
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

  const customSection = params.customPrompt
    ? `\n\n# Additional Instructions\n${params.customPrompt}`
    : "";

const toolGuidance = `
# Available Tools
Only propose tools that are appropriate for the actor type and channel. Do not invent tool names.
Use the entity IDs from the Operational Context to call update tools directly — no guessing IDs.
If you need to find a contact not in the context, call contacts.search first.

Public-safe tools: churchInfo.search, prayerRequests.create, appointments.checkAvailability, handoff.transfer

Staff read/search tools: contacts.search(query, status?, limit?), contacts.findDuplicates(reason?, minGroupSize?, limit?), tasks.search(query?, status?, priority?, assigneeId?, sla?, limit?), finance.weeklyReport(startDate?, endDate?), appointments.search(query?, status?, fromDate?, toDate?, upcomingOnly?, limit?), calls.search(query?, outcome?, escalatedOnly?, fromDate?, toDate?, limit?), pipeline.search(query?, stageId?, priority?, assigneeId?, limit?), pipeline.audit(itemId?, limit?), conversations.search(query?, status?, includeArchived?, limit?)

Staff create tools: contacts.upsert, appointments.book, tasks.create(title, description?, assigneeId?, dueDate?, priority?)✅approval, prayerRequests.create, pipelines.addToStage, memory.write, serviceRuns.createFromTemplate, serviceRuns.autoStaff, volunteers.create(contactId, role?, status?)✅approval, volunteerShifts.create(volunteerId, date, hours, eventId?, notes?)✅approval

Staff update tools: contacts.update(contactId, firstName?, lastName?, email?, phone?, memberStatus?, notes?), contacts.archive(contactId)✅approval, contacts.restore(contactId, status?)✅approval, contacts.delete(contactId)✅approval, contacts.merge(primaryContactId, duplicateContactId)✅approval, tasks.update(taskId, title?, status?, priority?, assigneeId?, dueDate?), tasks.complete(taskId), prayerRequests.update(requestId, status?, urgency?, assignedTeam?, response?), appointments.setStatus(appointmentId, status)✅approval, appointments.reschedule(appointmentId, dateTime, duration?, notes?, resetStatus?)✅approval, appointments.cancel(appointmentId)✅approval, appointments.delete(appointmentId)✅approval, calls.update(callId, transcriptText?, summaryText?, intent?, outcome?, startedAt?, endedAt?, durationSec?, recordingUrl?, contactId?), calls.escalate(callId, reason, summaryText?, assignedTeam?), pipeline.moveStage(itemId, stageId), pipeline.updateItem(itemId, stageId?, order?, priority?, assigneeId?, notes?, lastContactDate?, nextActionDate?), pipeline.deleteItem(itemId)✅approval, ministries.addMember(ministryId, contactId, role?), conversations.setStatus(conversationId, status), conversations.waiting(conversationId), conversations.resolve(conversationId), conversations.archive(conversationId), conversations.reopen(conversationId), volunteers.update(volunteerId, role?, status?, contactId?)✅approval, volunteers.delete(volunteerId)✅approval, volunteerShifts.update(shiftId, date?, hours?, notes?, eventId?)✅approval, volunteerShifts.delete(shiftId)✅approval

Staff communication tools: messages.sendSMS(to, message)✅approval, messages.sendEmail(to, subject, html)✅approval, staff.alert(reason, details?)

Staff service tools: serviceAssignments.sendOfferSMS(serviceRunId)✅approval

Tools marked ✅approval will be queued for human staff approval before executing.`;

  return [
    identity,
    toneGuidance,
    channelContext,
    stateContext,
    knowledgeSection,
    operationalContextSection,
    customSection,
    toolGuidance,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Main router — replaces regex classifier + hardcoded planner
// ---------------------------------------------------------------------------

export async function runClawRouter(input: GraceRouterInput): Promise<GraceRouterOutput> {
  const { message, state, context } = input;
  const matchedStateContactId =
    typeof state.matchedContactId === "string" ? state.matchedContactId : null;
  const activeContactId = context.contactId ?? matchedStateContactId ?? null;

  // Load org context, knowledge, and provider credentials in parallel.
  const [orgConfig, knowledge, operationalContext, geminiApiKey] = await Promise.all([
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
  ]);

  const systemPrompt = buildSystemPrompt({
    churchName: orgConfig?.churchName ?? "our church",
    denomination: orgConfig?.churchDenomination ?? null,
    city: orgConfig?.churchCity ?? null,
    customPrompt: orgConfig?.customSystemPrompt ?? null,
    knowledge,
    operationalContext,
    actorType: context.actorType,
    channel: context.channel,
    currentState: state,
  });

  if (!geminiApiKey) {
    console.error("[Grace] Gemini provider is not configured for organization:", context.organizationId);
    return {
      response:
        "I'm temporarily unavailable and unable to process your request right now. " +
        "Please try again in a moment, or contact the church office directly for assistance.",
      intent: "unknown" as GraceIntent,
      state,
      proposedActions: [],
      actionOutcomes: [],
    };
  }

  const google = createGoogleGenerativeAI({ apiKey: geminiApiKey });

  let object: z.infer<typeof graceOutputSchema>;
  try {
    ({ object } = await generateObject({
      model: google("gemini-2.0-flash"),
      output: "object",
      system: systemPrompt,
      prompt: message,
      schema: graceOutputSchema,
    }));
  } catch (llmError) {
    console.error("[Grace] Gemini call failed, returning fallback response:", llmError);
    return {
      response:
        "I'm temporarily unavailable and unable to process your request right now. " +
        "Please try again in a moment, or contact the church office directly for assistance.",
      intent: "unknown" as GraceIntent,
      state,
      proposedActions: [],
      actionOutcomes: [],
    };
  }

  // Convert Gemini's proposed tools into ProposedAction[] for the executor
  const proposedActions: ProposedAction[] = (object.proposedTools ?? []).map((t) => ({
    id: crypto.randomUUID(),
    tool: t.tool,
    input: t.input,
    reason: t.reason,
    requiresApproval: t.requiresApproval,
  }));

  // Run through the policy engine + approval gating
  const execution = await executePlannedActions({ actions: proposedActions, context });

  // Merge any state updates Gemini extracted from this message
  const updatedState: typeof state = {
    ...state,
    ...(object.stateUpdates ?? {}),
  };

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
        email: updatedState.email
      }
    );

    updatedState.matchedContactId = matchResult.contactId ?? undefined;
    updatedState.matchTier = matchResult.confidenceTier;
  }

  return {
    response: object.response,
    intent: object.intent as GraceIntent,
    state: updatedState,
    proposedActions,
    actionOutcomes: execution.actionOutcomes ?? [],
  };
}
