"use server";

import { db } from "@/db";
import {
  organizations,
  onboardingDataSchema,
  organizationMemberships,
  providerConfigs,
  churchContacts,
  families,
  conversations,
  tasks,
  appointments,
  messageTemplates,
  pipelineStages,
  serviceTemplates,
  serviceRuns,
  smsDevices,
  graceAuditStream,
  automationWorkflows,
  aiConfig,
} from "@/db/schema";
import { and, count, eq, gte, ne, sql } from "drizzle-orm";
import { auditAction, requireOrgMembership } from "./utils";
import { createServiceTemplate } from "./operations";
import { seedDefaultStages } from "./pipeline";
import { seedDemoData } from "./seed";
import { redactProviderConfigForClient } from "@/lib/grace/providers/security";
import { getResolvedAutomationTemplateByKey } from "@/lib/automations/template-registry";
import { createAutomationWorkflow, installAutomationTemplate } from "./automations";
import { findPotentialDuplicateContacts } from "./contacts";
import * as z from "zod";

type OnboardingStepStatus = "done" | "pending";

type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  status: OnboardingStepStatus;
  href: string;
  blocking: boolean;
};

type BlockingAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  impact: string;
};

type LaunchReadiness = {
  score: number;
  completedCount: number;
  totalCount: number;
  steps: OnboardingStep[];
  blockingActions: BlockingAction[];
  metrics: {
    contacts: number;
    conversations: number;
    tasks: number;
    appointments: number;
    members: number;
    admins: number;
    activeChannels: string[];
    starterTemplateCount: number;
    pipelineStageCount: number;
    serviceTemplateCount: number;
  };
};

type HealthStatus = "healthy" | "degraded" | "critical";

type ProviderHealthCheck = {
  key: string;
  title: string;
  channel: string;
  provider: string;
  required: boolean;
  status: HealthStatus;
  summary: string;
  remediation: {
    label: string;
    href: string;
  };
  runtime: {
    events: number;
    errors: number;
    errorRatePercent: number;
  };
  metadata: {
    mode: "agency_managed" | "byo" | "disabled" | "missing";
    isActive: boolean;
    missingFields: string[];
    smsLastSeenAtIso: string | null;
  };
};

type GuidedSequenceBlueprint = {
  id: string;
  title: string;
  summary: string;
  templateKey: string;
  triggerEvent: string;
  builderName: string;
  builderDescription: string;
  checklist: string[];
};

const PROVIDER_HEALTH_TARGETS = [
  {
    key: "ai-gemini",
    channel: "ai",
    provider: "gemini",
    title: "Gemini AI + Voice",
    required: true,
  },
  {
    key: "sms-fellowship-gateway",
    channel: "sms",
    provider: "fellowship_gateway",
    title: "Fellowship 360 Gateway SMS",
    required: true,
  },
  {
    key: "email-sendgrid",
    channel: "email",
    provider: "sendgrid",
    title: "SendGrid Email",
    required: false,
  },
  {
    key: "voice-retell",
    channel: "voice",
    provider: "retell",
    title: "Retell Voice Webhooks",
    required: false,
  },
] as const;

const GUIDED_SEQUENCE_BLUEPRINTS: GuidedSequenceBlueprint[] = [
  {
    id: "visitor_follow_up",
    title: "Visitor Follow-Up",
    summary: "Welcome new visitors, send timed follow-ups, and escalate to staff if no reply.",
    templateKey: "visitor_follow_up",
    triggerEvent: "contacts.created.v1",
    builderName: "Guided: Visitor Follow-Up",
    builderDescription:
      "Guided onboarding draft for visitor follow-up sequence with trigger, delays, conditions, and escalation.",
    checklist: [
      "Set your welcome message and second-touch copy.",
      "Confirm delay windows (24h and 72h) for your team cadence.",
      "Assign the escalation task owner before publishing.",
    ],
  },
  {
    id: "first_time_guest_appointment",
    title: "First-Time Guest Appointment",
    summary: "Drive first-time guests to appointments with reminders and handoff steps.",
    templateKey: "first_time_guest_appointment",
    triggerEvent: "grace.first_time_guest.appointment.requested.v1",
    builderName: "Guided: First-Time Guest Appointment",
    builderDescription:
      "Guided onboarding draft for appointment conversion with reminders and manual outreach fallback.",
    checklist: [
      "Set booking link content for invite and reminder nodes.",
      "Define conversion condition criteria used in branch checks.",
      "Confirm pastoral handoff owner for no-reply exits.",
    ],
  },
  {
    id: "prayer_request_followup",
    title: "Prayer Request Follow-Up",
    summary: "Acknowledge prayer requests fast and escalate urgent care paths.",
    templateKey: "prayer_request_followup",
    triggerEvent: "grace.prayer_request.followup.requested.v1",
    builderName: "Guided: Prayer Request Follow-Up",
    builderDescription:
      "Guided onboarding draft for urgent and non-urgent prayer care with escalation branches.",
    checklist: [
      "Define urgency threshold for immediate escalation branch.",
      "Add your pastoral on-call routing destination.",
      "Customize follow-up check-in language and response SLAs.",
    ],
  },
  {
    id: "volunteer_onboarding",
    title: "Volunteer Onboarding",
    summary: "Onboard volunteers with role packet delivery and acknowledgment tracking.",
    templateKey: "volunteer_onboarding",
    triggerEvent: "volunteers.created.v1",
    builderName: "Guided: Volunteer Onboarding",
    builderDescription:
      "Guided onboarding draft for volunteer role packet delivery, reminders, and team follow-up tasks.",
    checklist: [
      "Attach role packet and training links in the first action.",
      "Set reminder timing for acknowledgment and follow-up.",
      "Assign ministry leader task owner for escalation path.",
    ],
  },
];

const organizationIdSchema = z.string().trim().min(1);
const guidedSequenceOnboardingSchema = z.object({
  organizationId: organizationIdSchema,
  blueprintId: z.string().trim().min(1),
  installTemplate: z.boolean().optional(),
});
const optionalTrimmedStringSchema = z.string().trim().optional();
const updateOnboardingProfileSchema = z.object({
  organizationId: organizationIdSchema,
  churchName: optionalTrimmedStringSchema,
  denomination: optionalTrimmedStringSchema,
  city: optionalTrimmedStringSchema,
  website: optionalTrimmedStringSchema,
  orgType: onboardingDataSchema.shape.orgType.optional(),
  teamSize: z.coerce.number().int().nonnegative().optional(),
  averageWeeklyAttendance: z.coerce.number().int().nonnegative().optional(),
  industry: optionalTrimmedStringSchema,
  howDidYouHearAboutUs: optionalTrimmedStringSchema,
  primaryContactName: optionalTrimmedStringSchema,
  primaryContactEmail: optionalTrimmedStringSchema,
  primaryContactPhone: optionalTrimmedStringSchema,
  primaryGoal: optionalTrimmedStringSchema,
  notes: optionalTrimmedStringSchema,
  onboardingDone: z.boolean().optional(),
});

function toStep(
  id: string,
  title: string,
  description: string,
  done: boolean,
  href: string,
  blocking: boolean
): OnboardingStep {
  return {
    id,
    title,
    description,
    status: done ? "done" : "pending",
    href,
    blocking,
  };
}

function toBlockingAction(step: OnboardingStep, impact: string): BlockingAction | null {
  if (step.status === "done" || !step.blocking) return null;
  return {
    id: step.id,
    title: step.title,
    description: step.description,
    href: step.href,
    impact,
  };
}

function statusRank(status: HealthStatus) {
  if (status === "critical") return 2;
  if (status === "degraded") return 1;
  return 0;
}

function toRuntimeStats(rows: Array<{ status: string }>) {
  const events = rows.length;
  const errors = rows.filter((row) => row.status === "error").length;
  const errorRatePercent = events > 0 ? Number(((errors / events) * 100).toFixed(1)) : 0;
  return { events, errors, errorRatePercent };
}

export async function updateOrganizationOnboardingProfile(input: {
  organizationId: string;
  churchName?: string;
  denomination?: string;
  city?: string;
  website?: string;
  orgType?: "startup" | "enterprise" | "agency" | "individual";
  teamSize?: number;
  averageWeeklyAttendance?: number;
  industry?: string;
  howDidYouHearAboutUs?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  primaryGoal?: string;
  notes?: string;
  onboardingDone?: boolean;
}) {
  const parsed = updateOnboardingProfileSchema.parse(input);
  const { userId } = await requireOrgMembership(parsed.organizationId, "admin");

  const [organization] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      onboardingDone: organizations.onboardingDone,
      onboardingData: organizations.onboardingData,
    })
    .from(organizations)
    .where(eq(organizations.id, parsed.organizationId))
    .limit(1);

  if (!organization) {
    throw new Error("Organization not found.");
  }

  const currentOnboardingData = onboardingDataSchema.parse(organization.onboardingData ?? {});
  const nextOnboardingData = onboardingDataSchema.parse({
    ...currentOnboardingData,
    ...(parsed.churchName !== undefined ? { orgName: parsed.churchName } : {}),
    ...(parsed.website !== undefined ? { orgWebsite: parsed.website } : {}),
    ...(parsed.orgType !== undefined ? { orgType: parsed.orgType } : {}),
    ...(parsed.teamSize !== undefined ? { teamSize: parsed.teamSize } : {}),
    ...(parsed.averageWeeklyAttendance !== undefined
      ? { averageWeeklyAttendance: parsed.averageWeeklyAttendance }
      : {}),
    ...(parsed.industry !== undefined ? { industry: parsed.industry } : {}),
    ...(parsed.howDidYouHearAboutUs !== undefined
      ? { howDidYouHearAboutUs: parsed.howDidYouHearAboutUs }
      : {}),
    ...(parsed.denomination !== undefined
      ? { churchDenomination: parsed.denomination }
      : {}),
    ...(parsed.city !== undefined ? { churchCity: parsed.city } : {}),
    ...(parsed.primaryContactName !== undefined
      ? { primaryContactName: parsed.primaryContactName }
      : {}),
    ...(parsed.primaryContactEmail !== undefined
      ? { primaryContactEmail: parsed.primaryContactEmail }
      : {}),
    ...(parsed.primaryContactPhone !== undefined
      ? { primaryContactPhone: parsed.primaryContactPhone }
      : {}),
    ...(parsed.primaryGoal !== undefined ? { primaryGoal: parsed.primaryGoal } : {}),
    ...(parsed.notes !== undefined ? { notes: parsed.notes } : {}),
  });

  await db
    .update(organizations)
    .set({
      ...(parsed.churchName !== undefined && parsed.churchName.length > 0
        ? { name: parsed.churchName }
        : {}),
      ...(parsed.onboardingDone !== undefined ? { onboardingDone: parsed.onboardingDone } : {}),
      onboardingData: nextOnboardingData,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, parsed.organizationId));

  const [existingAiConfig] = await db
    .select({ id: aiConfig.id })
    .from(aiConfig)
    .where(eq(aiConfig.organizationId, parsed.organizationId))
    .limit(1);

  const resolvedChurchName =
    parsed.churchName?.trim() || nextOnboardingData.orgName || organization.name;

  if (existingAiConfig) {
    await db
      .update(aiConfig)
      .set({
        ...(parsed.churchName !== undefined ? { churchName: resolvedChurchName } : {}),
        ...(parsed.denomination !== undefined
          ? { churchDenomination: parsed.denomination || null }
          : {}),
        ...(parsed.city !== undefined ? { churchCity: parsed.city || null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(aiConfig.id, existingAiConfig.id));
  } else if (
    parsed.churchName !== undefined ||
    parsed.denomination !== undefined ||
    parsed.city !== undefined
  ) {
    await db.insert(aiConfig).values({
      organizationId: parsed.organizationId,
      churchName: resolvedChurchName,
      churchDenomination: parsed.denomination ?? null,
      churchCity: parsed.city ?? null,
    });
  }

  const updatedFields = Object.entries(parsed)
    .filter(([key, value]) => key !== "organizationId" && value !== undefined)
    .map(([key]) => key);

  await auditAction({
    organizationId: parsed.organizationId,
    userId,
    actionType: "update",
    entityName: "organization_onboarding_profile",
    entityId: parsed.organizationId,
    details: {
      updatedFields,
      onboardingDone:
        parsed.onboardingDone !== undefined
          ? parsed.onboardingDone
          : organization.onboardingDone ?? false,
    },
  });

  return {
    organizationId: parsed.organizationId,
    churchName: resolvedChurchName,
    onboardingDone:
      parsed.onboardingDone !== undefined
        ? parsed.onboardingDone
        : organization.onboardingDone ?? false,
    onboardingData: nextOnboardingData,
    updatedFields,
  };
}

export async function getOrganizationOnboardingProfile(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);

  const [organization] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      onboardingDone: organizations.onboardingDone,
      onboardingData: organizations.onboardingData,
    })
    .from(organizations)
    .where(eq(organizations.id, parsedOrganizationId))
    .limit(1);

  if (!organization) {
    return null;
  }

  return {
    id: organization.id,
    name: organization.name,
    onboardingDone: organization.onboardingDone ?? false,
    onboardingData: onboardingDataSchema.parse(organization.onboardingData ?? {}),
  };
}

export async function getLaunchReadiness(organizationId: string): Promise<LaunchReadiness> {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);

  const [
    [organization],
    [membershipStats],
    activeChannelsRows,
    [contactStats],
    [familyStats],
    [conversationStats],
    [taskStats],
    [appointmentStats],
    [messageTemplateStats],
    [pipelineStageStats],
    [serviceTemplateStats],
    [serviceRunStats],
  ] = await Promise.all([
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        image: organizations.image,
      })
      .from(organizations)
      .where(eq(organizations.id, parsedOrganizationId))
      .limit(1),
    db
      .select({
        members: count(),
        admins: sql<number>`count(*) filter (where ${organizationMemberships.role} in ('owner', 'admin'))`,
      })
      .from(organizationMemberships)
      .where(eq(organizationMemberships.organizationId, parsedOrganizationId)),
    db
      .select({
        channel: providerConfigs.channel,
      })
      .from(providerConfigs)
      .where(
        and(
          eq(providerConfigs.organizationId, parsedOrganizationId),
          eq(providerConfigs.isActive, true),
          ne(providerConfigs.mode, "disabled")
        )
      ),
    db
      .select({ total: count() })
      .from(churchContacts)
      .where(eq(churchContacts.organizationId, parsedOrganizationId)),
    db
      .select({ total: count() })
      .from(families)
      .where(eq(families.organizationId, parsedOrganizationId)),
    db
      .select({ total: count() })
      .from(conversations)
      .where(eq(conversations.organizationId, parsedOrganizationId)),
    db
      .select({ total: count() })
      .from(tasks)
      .where(eq(tasks.organizationId, parsedOrganizationId)),
    db
      .select({ total: count() })
      .from(appointments)
      .where(eq(appointments.organizationId, parsedOrganizationId)),
    db
      .select({ total: count() })
      .from(messageTemplates)
      .where(eq(messageTemplates.organizationId, parsedOrganizationId)),
    db
      .select({ total: count() })
      .from(pipelineStages)
      .where(eq(pipelineStages.organizationId, parsedOrganizationId)),
    db
      .select({ total: count() })
      .from(serviceTemplates)
      .where(eq(serviceTemplates.organizationId, parsedOrganizationId)),
    db
      .select({ total: count() })
      .from(serviceRuns)
      .where(eq(serviceRuns.organizationId, parsedOrganizationId)),
  ]);

  const duplicateGroups = await findPotentialDuplicateContacts(parsedOrganizationId);

  const activeChannels = Array.from(new Set(activeChannelsRows.map((row) => row.channel)));
  const hasSms = activeChannels.includes("sms");

  const profileDone = Boolean(organization?.name?.trim());
  const peopleImportDone = Number(contactStats?.total ?? 0) >= 10;
  const householdCleanupDone =
    Number(contactStats?.total ?? 0) === 0 ||
    (Number(familyStats?.total ?? 0) >= 1 && duplicateGroups.length === 0);
  const providerReadinessDone = hasSms;
  const rolesDone = Number(membershipStats?.members ?? 0) >= 2 && Number(membershipStats?.admins ?? 0) >= 1;
  const templateInstallDone =
    Number(messageTemplateStats?.total ?? 0) >= 4 &&
    Number(pipelineStageStats?.total ?? 0) >= 4 &&
    Number(serviceTemplateStats?.total ?? 0) >= 1;
  const firstLiveServiceDone = Number(serviceRunStats?.total ?? 0) >= 1;
  const sampleDataDone =
    Number(contactStats?.total ?? 0) >= 10 &&
    Number(conversationStats?.total ?? 0) >= 3 &&
    Number(taskStats?.total ?? 0) >= 3 &&
    Number(appointmentStats?.total ?? 0) >= 1;

  const steps: OnboardingStep[] = [
    toStep(
      "profile",
      "Organization Profile",
      "Set church identity, logo, and core organization details.",
      profileDone,
      "/app/settings",
      true
    ),
    toStep(
      "people_import",
      "CSV People Import",
      "Import household-aware people data so Grace and the staff CRM start from one shared record.",
      peopleImportDone,
      "/app/contacts",
      true
    ),
    toStep(
      "household_cleanup",
      "Household Cleanup & Dedupe Review",
      "Assign households and clear likely duplicate contacts before beta traffic starts.",
      householdCleanupDone,
      "/app/contacts",
      true
    ),
    toStep(
      "provider_readiness",
      "Provider Readiness",
      "Confirm SMS routing and provider health before outreach workflows are turned on.",
      providerReadinessDone,
      "/app/settings/integrations",
      true
    ),
    toStep(
      "roles",
      "Team & Roles",
      "Invite at least one teammate and confirm admin ownership coverage.",
      rolesDone,
      "/app/settings/team",
      true
    ),
    toStep(
      "template_install",
      "Workflow Template Install",
      "Install starter message templates, pipeline stages, and service templates for beta operations.",
      templateInstallDone,
      "/app/get-started",
      true
    ),
    toStep(
      "first_live_service",
      "First Live Service Date",
      "Create the first live service run so Sunday staffing and attendance flows can be validated.",
      firstLiveServiceDone,
      "/app/services",
      true
    ),
    toStep(
      "sample_data",
      "Sample Data Bootstrap",
      "Optional but recommended: seed demo records to validate end-to-end workflows fast.",
      sampleDataDone,
      "/app/get-started",
      false
    ),
  ];

  const blockingActions = [
    toBlockingAction(
      steps[0],
      "Without profile setup, member-facing messages and documents remain generic."
    ),
    toBlockingAction(
      steps[1],
      "Without people import, the staff team has no shared system of record."
    ),
    toBlockingAction(
      steps[2],
      "Without household cleanup and duplicate review, follow-up and donor history drift across records."
    ),
    toBlockingAction(
      steps[3],
      "Without SMS provider readiness, outreach and volunteer confirmations will stall."
    ),
    toBlockingAction(
      steps[4],
      "Without team roles, ownership and approvals become a bottleneck."
    ),
    toBlockingAction(
      steps[5],
      "Without installed templates, beta churches will fall back to ad hoc processes."
    ),
    toBlockingAction(
      steps[6],
      "Without a first live service date, Sunday ops and attendance cannot be validated."
    ),
  ].filter((item): item is BlockingAction => Boolean(item));

  const completedCount = steps.filter((step) => step.status === "done").length;
  const totalCount = steps.length;
  const score = Math.round((completedCount / totalCount) * 100);

  return {
    score,
    completedCount,
    totalCount,
    steps,
    blockingActions,
    metrics: {
      contacts: Number(contactStats?.total ?? 0),
      conversations: Number(conversationStats?.total ?? 0),
      tasks: Number(taskStats?.total ?? 0),
      appointments: Number(appointmentStats?.total ?? 0),
      members: Number(membershipStats?.members ?? 0),
      admins: Number(membershipStats?.admins ?? 0),
      activeChannels,
      starterTemplateCount: Number(messageTemplateStats?.total ?? 0),
      pipelineStageCount: Number(pipelineStageStats?.total ?? 0),
      serviceTemplateCount: Number(serviceTemplateStats?.total ?? 0),
    },
  };
}

export async function getProviderHealthChecks(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);
  const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [providerRows, [smsDevice], auditRows] = await Promise.all([
    db
      .select()
      .from(providerConfigs)
      .where(eq(providerConfigs.organizationId, parsedOrganizationId)),
    db
      .select({
        id: smsDevices.id,
        isActive: smsDevices.isActive,
        lastSeenAt: smsDevices.lastSeenAt,
      })
      .from(smsDevices)
      .where(eq(smsDevices.organizationId, parsedOrganizationId))
      .limit(1),
    db
      .select({
        eventType: graceAuditStream.eventType,
        status: graceAuditStream.status,
        channel: graceAuditStream.channel,
        toolName: graceAuditStream.toolName,
        actionName: graceAuditStream.actionName,
      })
      .from(graceAuditStream)
      .where(
        and(
          eq(graceAuditStream.organizationId, parsedOrganizationId),
          gte(graceAuditStream.createdAt, windowStart)
        )
      ),
  ]);

  const aiStats = toRuntimeStats(
    auditRows.filter((row) => row.eventType === "ai_decision")
  );
  const smsStats = toRuntimeStats(
    auditRows.filter(
      (row) =>
        row.eventType === "action_execution" &&
        (row.channel === "sms" ||
          `${row.toolName ?? ""} ${row.actionName ?? ""}`.toLowerCase().includes("sms"))
    )
  );
  const emailStats = toRuntimeStats(
    auditRows.filter(
      (row) =>
        row.eventType === "action_execution" &&
        `${row.toolName ?? ""} ${row.actionName ?? ""}`.toLowerCase().includes("email")
    )
  );
  const voiceStats = toRuntimeStats(
    auditRows.filter(
      (row) =>
        row.eventType === "action_execution" &&
        Boolean(row.channel && row.channel.startsWith("voice"))
    )
  );

  const nowMs = Date.now();
  const checks: ProviderHealthCheck[] = PROVIDER_HEALTH_TARGETS.map((target) => {
    const row = providerRows.find(
      (providerRow) =>
        providerRow.channel === target.channel && providerRow.provider === target.provider
    );
    const runtime =
      target.channel === "ai"
        ? aiStats
        : target.channel === "sms"
          ? smsStats
          : target.channel === "email"
            ? emailStats
            : voiceStats;

    let status: HealthStatus = "healthy";
    let summary = "Configured and healthy.";
    let remediationLabel = "Review Integration";
    let remediationHref = "/app/settings/integrations";
    let missingFields: string[] = [];

    if (!row) {
      status = target.required ? "critical" : "degraded";
      summary = target.required
        ? "Provider is not configured."
        : "Provider has not been configured yet.";
      remediationLabel = "Configure Provider";
    } else if (row.mode === "disabled") {
      status = target.required ? "critical" : "degraded";
      summary = target.required
        ? "Required provider is disabled."
        : "Provider is disabled for this workspace.";
      remediationLabel = "Enable Provider";
    } else {
      const redacted = redactProviderConfigForClient({
        channel: row.channel,
        provider: row.provider,
        config: row.configJson ?? {},
        mode: row.mode,
      });
      missingFields = redacted.validation.missing;

      if (row.mode === "byo" && !redacted.validation.isValid) {
        status = "critical";
        summary = `Managed provider credentials are incomplete (${missingFields.join(", ")}).`;
        remediationLabel = "Fix Credentials";
      } else if (!row.isActive) {
        status = target.required ? "critical" : "degraded";
        summary = "Provider exists but is not routing traffic.";
        remediationLabel = "Activate Provider";
      } else if (runtime.events >= 3 && runtime.errorRatePercent >= 60) {
        status = "critical";
        summary = `Recent runtime failure rate is high (${runtime.errorRatePercent}%).`;
        remediationLabel = "Open Reports";
        remediationHref = "/app/reports";
      } else if (runtime.events >= 3 && runtime.errorRatePercent >= 25) {
        status = "degraded";
        summary = `Recent runtime error rate is elevated (${runtime.errorRatePercent}%).`;
        remediationLabel = "Open Reports";
        remediationHref = "/app/reports";
      }
    }

    if (target.key === "sms-fellowship-gateway" && row && row.mode === "agency_managed") {
      if (!smsDevice || !smsDevice.isActive) {
        status = "critical";
        summary = "Agency-managed SMS device is missing or offline.";
        remediationLabel = "Check SMS Device";
        remediationHref = "/app/settings/integrations";
      } else if (smsDevice.lastSeenAt) {
        const ageMinutes = Math.floor((nowMs - smsDevice.lastSeenAt.getTime()) / (60 * 1000));
        if (ageMinutes > 45 && statusRank(status) < statusRank("critical")) {
          status = "degraded";
          summary = `SMS device heartbeat is stale (${ageMinutes} minutes).`;
          remediationLabel = "Refresh SMS Device";
          remediationHref = "/app/settings/integrations";
        }
      }
    }

    return {
      key: target.key,
      title: target.title,
      channel: target.channel,
      provider: target.provider,
      required: target.required,
      status,
      summary,
      remediation: {
        label: remediationLabel,
        href: remediationHref,
      },
      runtime,
      metadata: {
        mode: (row?.mode ?? "missing") as ProviderHealthCheck["metadata"]["mode"],
        isActive: Boolean(row?.isActive),
        missingFields,
        smsLastSeenAtIso: smsDevice?.lastSeenAt ? smsDevice.lastSeenAt.toISOString() : null,
      },
    };
  }).sort((a, b) => statusRank(b.status) - statusRank(a.status));

  const healthy = checks.filter((check) => check.status === "healthy").length;
  const degraded = checks.filter((check) => check.status === "degraded").length;
  const critical = checks.filter((check) => check.status === "critical").length;

  return {
    generatedAtIso: new Date().toISOString(),
    windowDays: 7,
    summary: {
      total: checks.length,
      healthy,
      degraded,
      critical,
      scorePercent: Math.round((healthy / Math.max(checks.length, 1)) * 100),
    },
    checks,
    nextAction: checks.find((check) => check.status !== "healthy") ?? null,
  };
}

export async function getGuidedSequenceOnboarding(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  await requireOrgMembership(parsedOrganizationId);

  const rows = await db
    .select({
      id: automationWorkflows.id,
      name: automationWorkflows.name,
      mode: automationWorkflows.mode,
      status: automationWorkflows.status,
      templateKey: automationWorkflows.templateKey,
      updatedAt: automationWorkflows.updatedAt,
    })
    .from(automationWorkflows)
    .where(
      and(
        eq(automationWorkflows.organizationId, parsedOrganizationId),
        ne(automationWorkflows.status, "archived")
      )
    );

  const guides = GUIDED_SEQUENCE_BLUEPRINTS.map((blueprint) => {
    const templateWorkflow = rows.find(
      (row) => row.mode === "template" && row.templateKey === blueprint.templateKey
    );
    const builderWorkflow = rows.find(
      (row) => row.mode === "builder" && row.name === blueprint.builderName
    );

    return {
      ...blueprint,
      templateInstalled: Boolean(templateWorkflow),
      templateWorkflowId: templateWorkflow?.id ?? null,
      builderWorkflowId: builderWorkflow?.id ?? null,
      builderStatus: builderWorkflow?.status ?? null,
      updatedAtIso: builderWorkflow?.updatedAt
        ? builderWorkflow.updatedAt.toISOString()
        : templateWorkflow?.updatedAt
          ? templateWorkflow.updatedAt.toISOString()
          : null,
    };
  });

  const nextGuide =
    guides.find((guide) => !guide.builderWorkflowId) ??
    guides.find((guide) => !guide.templateInstalled) ??
    null;

  return {
    guides,
    summary: {
      templateInstalledCount: guides.filter((guide) => guide.templateInstalled).length,
      builderDraftCount: guides.filter((guide) => Boolean(guide.builderWorkflowId)).length,
      total: guides.length,
    },
    nextGuideId: nextGuide?.id ?? null,
  };
}

export async function startGuidedSequenceOnboarding(input: {
  organizationId: string;
  blueprintId: string;
  installTemplate?: boolean;
}) {
  const parsed = guidedSequenceOnboardingSchema.parse(input);
  const { userId } = await requireOrgMembership(parsed.organizationId, "admin");
  const blueprint = GUIDED_SEQUENCE_BLUEPRINTS.find(
    (candidate) => candidate.id === parsed.blueprintId
  );

  if (!blueprint) {
    throw new Error("Unknown guided sequence blueprint.");
  }

  const [existingBuilder] = await db
    .select({
      id: automationWorkflows.id,
      name: automationWorkflows.name,
    })
    .from(automationWorkflows)
    .where(
      and(
        eq(automationWorkflows.organizationId, parsed.organizationId),
        eq(automationWorkflows.mode, "builder"),
        eq(automationWorkflows.name, blueprint.builderName),
        ne(automationWorkflows.status, "archived")
      )
    )
    .limit(1);

  const template = await getResolvedAutomationTemplateByKey(blueprint.templateKey);
  const builderWorkflow =
    existingBuilder ??
    (await createAutomationWorkflow({
      organizationId: parsed.organizationId,
      name: blueprint.builderName,
      description: blueprint.builderDescription,
      mode: "builder",
      triggerEvent: blueprint.triggerEvent,
      definition: template?.definition,
    }));

  let templateResult:
    | Awaited<ReturnType<typeof installAutomationTemplate>>
    | null = null;
  if (parsed.installTemplate) {
    templateResult = await installAutomationTemplate({
      organizationId: parsed.organizationId,
      templateKey: blueprint.templateKey,
    });
  }

  await auditAction({
    organizationId: parsed.organizationId,
    userId,
    actionType: "create",
    entityName: "onboarding_guided_sequence",
    entityId: builderWorkflow.id,
    details: {
      blueprintId: blueprint.id,
      templateKey: blueprint.templateKey,
      createdBuilderDraft: !existingBuilder,
      templateInstalled: templateResult ? !templateResult.alreadyInstalled : null,
      templateAlreadyInstalled: templateResult?.alreadyInstalled ?? null,
    },
  });

  return {
    blueprintId: blueprint.id,
    blueprintTitle: blueprint.title,
    builderWorkflowId: builderWorkflow.id,
    builderWorkflowName: builderWorkflow.name,
    builderCreated: !existingBuilder,
    templateWorkflowId: templateResult?.workflow.id ?? null,
    templateInstalled: templateResult ? !templateResult.alreadyInstalled : null,
    templateAlreadyInstalled: templateResult?.alreadyInstalled ?? null,
  };
}

export async function installStarterTemplates(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  const { userId } = await requireOrgMembership(parsedOrganizationId, "admin");

  const [existingTemplateNames, [stageStats], [serviceTemplateStats]] = await Promise.all([
    db
      .select({ name: messageTemplates.name })
      .from(messageTemplates)
      .where(eq(messageTemplates.organizationId, parsedOrganizationId)),
    db
      .select({ total: count() })
      .from(pipelineStages)
      .where(eq(pipelineStages.organizationId, parsedOrganizationId)),
    db
      .select({ total: count() })
      .from(serviceTemplates)
      .where(eq(serviceTemplates.organizationId, parsedOrganizationId)),
  ]);

  const existingNameSet = new Set(existingTemplateNames.map((row) => row.name.trim().toLowerCase()));
  const starterMessageTemplates = [
    {
      name: "Welcome Visitor",
      content: "Hi {firstName}, thank you for visiting {churchName}. We are grateful to connect with you.",
      category: "Welcome",
      channel: "sms" as const,
      variables: ["firstName", "churchName"],
    },
    {
      name: "Missed Call Follow-up",
      content: "Hi {firstName}, we missed your call. Reply here and our team will follow up shortly.",
      category: "Pastoral Care",
      channel: "sms" as const,
      variables: ["firstName"],
    },
    {
      name: "First-Time Guest Appointment Invite",
      content:
        "Thanks for joining us, {firstName}. Would you like to book a short welcome call with our team this week?",
      category: "Visitors",
      channel: "sms" as const,
      variables: ["firstName"],
    },
    {
      name: "Weekly Church Update",
      content: "This week at {churchName}: {weeklyHighlights}",
      category: "Newsletter",
      channel: "email" as const,
      variables: ["churchName", "weeklyHighlights"],
    },
    {
      name: "First-Time Giver Thank You",
      content:
        "Hi {firstName}, thank you for your first gift to {churchName}. We are grateful for your generosity and are praying for you this week.",
      category: "Donor Care",
      channel: "sms" as const,
      variables: ["firstName", "churchName"],
    },
    {
      name: "Lapsed Giver Check-In",
      content:
        "Hi {firstName}, this is {churchName}. We appreciate your past generosity and wanted to check in. How can we pray for you this week?",
      category: "Donor Care",
      channel: "sms" as const,
      variables: ["firstName", "churchName"],
    },
  ];

  const templatesToInsert = starterMessageTemplates.filter(
    (template) => !existingNameSet.has(template.name.toLowerCase())
  );

  if (templatesToInsert.length > 0) {
    await db.insert(messageTemplates).values(
      templatesToInsert.map((template) => ({
        ...template,
        organizationId: parsedOrganizationId,
      }))
    );
  }

  let pipelineStagesCreated = 0;
  if (Number(stageStats?.total ?? 0) === 0) {
    const stages = await seedDefaultStages(parsedOrganizationId);
    pipelineStagesCreated = stages.length;
  }

  let serviceTemplatesCreated = 0;
  if (Number(serviceTemplateStats?.total ?? 0) === 0) {
    await Promise.all([
      createServiceTemplate({
        organizationId: parsedOrganizationId,
        name: "Sunday AM Service",
        description: "Core Sunday worship flow with pre-service and post-service checkpoints.",
        serviceType: "sunday_am",
        serviceStartTime: "10:00",
      }),
      createServiceTemplate({
        organizationId: parsedOrganizationId,
        name: "Midweek Gathering",
        description: "Teaching + prayer format for Wednesday or midweek ministry nights.",
        serviceType: "midweek",
        serviceStartTime: "19:00",
      }),
      createServiceTemplate({
        organizationId: parsedOrganizationId,
        name: "Special Event Service",
        description: "Flexible template for holiday services, conferences, and guest events.",
        serviceType: "special_event",
      }),
    ]);
    serviceTemplatesCreated = 3;
  }

  await auditAction({
    organizationId: parsedOrganizationId,
    userId,
    actionType: "bootstrap",
    entityName: "onboarding_starter_templates",
    details: {
      messageTemplatesCreated: templatesToInsert.length,
      pipelineStagesCreated,
      serviceTemplatesCreated,
    },
  });

  return {
    messageTemplatesCreated: templatesToInsert.length,
    pipelineStagesCreated,
    serviceTemplatesCreated,
  };
}

export async function bootstrapSampleData(organizationId: string) {
  const parsedOrganizationId = organizationIdSchema.parse(organizationId);
  const { userId } = await requireOrgMembership(parsedOrganizationId, "admin");
  const result = await seedDemoData(parsedOrganizationId);

  await auditAction({
    organizationId: parsedOrganizationId,
    userId,
    actionType: "bootstrap",
    entityName: "onboarding_sample_data",
    details: result,
  });

  return result;
}
