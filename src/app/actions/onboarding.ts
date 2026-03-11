"use server";

import { db } from "@/db";
import {
  organizations,
  organizationMemberships,
  providerConfigs,
  gracePolicyConfigs,
  churchContacts,
  conversations,
  tasks,
  appointments,
  messageTemplates,
  pipelineStages,
  serviceTemplates,
} from "@/db/schema";
import { and, count, eq, ne, sql } from "drizzle-orm";
import { auditAction, requireOrgMembership } from "./utils";
import { createServiceTemplate } from "./operations";
import { seedDefaultStages } from "./pipeline";
import { seedDemoData } from "./seed";

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

export async function getLaunchReadiness(organizationId: string): Promise<LaunchReadiness> {
  await requireOrgMembership(organizationId);

  const [
    [organization],
    [membershipStats],
    activeChannelsRows,
    [policyConfig],
    [contactStats],
    [conversationStats],
    [taskStats],
    [appointmentStats],
    [messageTemplateStats],
    [pipelineStageStats],
    [serviceTemplateStats],
  ] = await Promise.all([
    db
      .select({
        id: organizations.id,
        name: organizations.name,
        image: organizations.image,
      })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1),
    db
      .select({
        members: count(),
        admins: sql<number>`count(*) filter (where ${organizationMemberships.role} in ('owner', 'admin'))`,
      })
      .from(organizationMemberships)
      .where(eq(organizationMemberships.organizationId, organizationId)),
    db
      .select({
        channel: providerConfigs.channel,
      })
      .from(providerConfigs)
      .where(
        and(
          eq(providerConfigs.organizationId, organizationId),
          eq(providerConfigs.isActive, true),
          ne(providerConfigs.mode, "disabled")
        )
      ),
    db
      .select({
        approvalsEnabled: gracePolicyConfigs.approvalsEnabled,
        autoEscalateOnEmergency: gracePolicyConfigs.autoEscalateOnEmergency,
        highRiskTools: gracePolicyConfigs.highRiskTools,
        allowedPublicTools: gracePolicyConfigs.allowedPublicTools,
      })
      .from(gracePolicyConfigs)
      .where(eq(gracePolicyConfigs.organizationId, organizationId))
      .limit(1),
    db
      .select({ total: count() })
      .from(churchContacts)
      .where(eq(churchContacts.organizationId, organizationId)),
    db
      .select({ total: count() })
      .from(conversations)
      .where(eq(conversations.organizationId, organizationId)),
    db
      .select({ total: count() })
      .from(tasks)
      .where(eq(tasks.organizationId, organizationId)),
    db
      .select({ total: count() })
      .from(appointments)
      .where(eq(appointments.organizationId, organizationId)),
    db
      .select({ total: count() })
      .from(messageTemplates)
      .where(eq(messageTemplates.organizationId, organizationId)),
    db
      .select({ total: count() })
      .from(pipelineStages)
      .where(eq(pipelineStages.organizationId, organizationId)),
    db
      .select({ total: count() })
      .from(serviceTemplates)
      .where(eq(serviceTemplates.organizationId, organizationId)),
  ]);

  const activeChannels = Array.from(new Set(activeChannelsRows.map((row) => row.channel)));
  const hasSms = activeChannels.includes("sms");
  const hasEmail = activeChannels.includes("email");
  const hasVoice = activeChannels.includes("voice");

  const profileDone = Boolean(organization?.name?.trim());
  const channelsDone = hasSms && (hasEmail || hasVoice);
  const rolesDone = Number(membershipStats?.members ?? 0) >= 2 && Number(membershipStats?.admins ?? 0) >= 1;
  const escalationDone = Boolean(
    policyConfig?.approvalsEnabled &&
      policyConfig?.autoEscalateOnEmergency &&
      (policyConfig.allowedPublicTools ?? []).includes("handoff.transfer")
  );
  const starterTemplatesDone =
    Number(messageTemplateStats?.total ?? 0) >= 4 &&
    Number(pipelineStageStats?.total ?? 0) >= 4 &&
    Number(serviceTemplateStats?.total ?? 0) >= 1;
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
      "channels",
      "Channels Configuration",
      "Enable SMS and at least one additional channel (email or voice).",
      channelsDone,
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
      "escalation",
      "Escalation Policy",
      "Enable approvals and emergency auto-escalation policy for Grace.",
      escalationDone,
      "/app/settings/grace",
      true
    ),
    toStep(
      "starter_templates",
      "Starter Templates",
      "Install default pipeline stages, message templates, and service templates.",
      starterTemplatesDone,
      "/app/get-started",
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
      "Without channels, Grace cannot reliably run outreach and follow-up automation."
    ),
    toBlockingAction(
      steps[2],
      "Without team roles, ownership and approvals become a bottleneck."
    ),
    toBlockingAction(
      steps[3],
      "Without escalation policy, high-risk actions are not safely governed."
    ),
    toBlockingAction(
      steps[4],
      "Without starter templates, onboarding velocity and repeatable workflows remain low."
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

export async function installStarterTemplates(organizationId: string) {
  const { userId } = await requireOrgMembership(organizationId, "admin");

  const [existingTemplateNames, [stageStats], [serviceTemplateStats]] = await Promise.all([
    db
      .select({ name: messageTemplates.name })
      .from(messageTemplates)
      .where(eq(messageTemplates.organizationId, organizationId)),
    db
      .select({ total: count() })
      .from(pipelineStages)
      .where(eq(pipelineStages.organizationId, organizationId)),
    db
      .select({ total: count() })
      .from(serviceTemplates)
      .where(eq(serviceTemplates.organizationId, organizationId)),
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
  ];

  const templatesToInsert = starterMessageTemplates.filter(
    (template) => !existingNameSet.has(template.name.toLowerCase())
  );

  if (templatesToInsert.length > 0) {
    await db.insert(messageTemplates).values(
      templatesToInsert.map((template) => ({
        ...template,
        organizationId,
      }))
    );
  }

  let pipelineStagesCreated = 0;
  if (Number(stageStats?.total ?? 0) === 0) {
    const stages = await seedDefaultStages(organizationId);
    pipelineStagesCreated = stages.length;
  }

  let serviceTemplatesCreated = 0;
  if (Number(serviceTemplateStats?.total ?? 0) === 0) {
    await Promise.all([
      createServiceTemplate({
        organizationId,
        name: "Sunday AM Service",
        description: "Core Sunday worship flow with pre-service and post-service checkpoints.",
        serviceType: "sunday_am",
        serviceStartTime: "10:00",
      }),
      createServiceTemplate({
        organizationId,
        name: "Midweek Gathering",
        description: "Teaching + prayer format for Wednesday or midweek ministry nights.",
        serviceType: "midweek",
        serviceStartTime: "19:00",
      }),
      createServiceTemplate({
        organizationId,
        name: "Special Event Service",
        description: "Flexible template for holiday services, conferences, and guest events.",
        serviceType: "special_event",
      }),
    ]);
    serviceTemplatesCreated = 3;
  }

  await auditAction({
    organizationId,
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
  const { userId } = await requireOrgMembership(organizationId, "admin");
  const result = await seedDemoData(organizationId);

  await auditAction({
    organizationId,
    userId,
    actionType: "bootstrap",
    entityName: "onboarding_sample_data",
    details: result,
  });

  return result;
}
