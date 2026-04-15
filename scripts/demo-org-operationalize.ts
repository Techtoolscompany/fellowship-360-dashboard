import { and, desc, eq, ilike, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "../src/db";
import {
  automationWorkflowVersions,
  automationWorkflows,
  aiConfig,
  churchContacts,
  graceCalls,
  graceMessages,
  graceSessions,
  organizationRoleAccessPolicies,
  organizations,
  providerConfigs,
  smsDevices,
} from "../src/db/schema";
import { ORG_ROLES, defaultRoleAccessMatrix } from "../src/lib/access/role-access.shared";
import { getAutomationTemplateCatalog } from "../src/lib/automations/templates";
import {
  DEFAULT_AUTOMATION_COMPLIANCE_POLICY,
  type AutomationDefinition,
} from "../src/lib/automations/types";
import { validateAutomationDefinition } from "../src/lib/automations/validation";
import { seedDemoDataForOrg } from "../src/lib/seed/demo-data";
import {
  PRIMARY_SMS_GATEWAY_PROVIDER,
} from "../src/lib/sms-gateway/provider";

type CheckLevel = "PASS" | "FIXED" | "WARN" | "FAIL";
type ProviderMode = "agency_managed" | "byo" | "disabled";

type CheckResult = {
  level: CheckLevel;
  label: string;
  detail: string;
};

type Args = {
  apply: boolean;
  seedIfEmpty: boolean;
  orgSlug: string;
  orgNameHint: string;
};

const results: CheckResult[] = [];

function record(level: CheckLevel, label: string, detail: string) {
  results.push({ level, label, detail });
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const getArgValue = (key: string) => {
    const prefix = `${key}=`;
    const match = argv.find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length).trim() : null;
  };

  const hasFlag = (key: string) => argv.includes(key);

  return {
    apply: hasFlag("--apply"),
    seedIfEmpty: !hasFlag("--skip-seed-if-empty"),
    orgSlug:
      getArgValue("--org-slug") ??
      getArgValue("--orgSlug") ??
      process.env.DEMO_ORG_SLUG?.trim() ??
      "fellowship-360-demo",
    orgNameHint:
      getArgValue("--org-name") ??
      getArgValue("--orgName") ??
      process.env.DEMO_ORG_NAME?.trim() ??
      "Fellowship 360",
  };
}

function envValue(key: string) {
  const value = process.env[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function cloneDefinition(definition: AutomationDefinition): AutomationDefinition {
  return JSON.parse(JSON.stringify(definition)) as AutomationDefinition;
}

function normalizeDefinition(definition: AutomationDefinition): AutomationDefinition {
  const cloned = cloneDefinition(definition);
  const normalizedNodes = cloned.nodes.map((node) => ({
    ...node,
    description: node.description ?? null,
    config: node.config ?? {},
    nextIds: Array.from(new Set((node.nextIds ?? []).filter(Boolean))),
  }));

  return {
    version: cloned.version,
    startNodeId: cloned.startNodeId ?? normalizedNodes.find((node) => node.type === "trigger")?.id,
    nodes: normalizedNodes,
  };
}

async function ensureManagedProvider(params: {
  organizationId: string;
  channel: string;
  provider: string;
  apply: boolean;
  configPatch?: Record<string, unknown>;
  label: string;
}) {
  const [existing] = await db
    .select({
      id: providerConfigs.id,
      mode: providerConfigs.mode,
      isActive: providerConfigs.isActive,
      configJson: providerConfigs.configJson,
    })
    .from(providerConfigs)
    .where(
      and(
        eq(providerConfigs.organizationId, params.organizationId),
        eq(providerConfigs.channel, params.channel),
        eq(providerConfigs.provider, params.provider)
      )
    )
    .limit(1);

  if (existing && existing.isActive && existing.mode !== "disabled") {
    record(
      "PASS",
      params.label,
      `mode=${existing.mode}, active=${existing.isActive ? "yes" : "no"}`
    );
    return;
  }

  if (!params.apply) {
    record(
      "WARN",
      params.label,
      existing
        ? `configured as disabled/inactive (mode=${existing.mode}, active=${existing.isActive ? "yes" : "no"})`
        : "missing provider config row"
    );
    return;
  }

  const nextConfig = {
    ...(existing?.configJson ?? {}),
    ...(params.configPatch ?? {}),
  };

  if (existing) {
    await db
      .update(providerConfigs)
      .set({
        mode: "agency_managed" as ProviderMode,
        isActive: true,
        configJson: nextConfig,
        updatedAt: new Date(),
      })
      .where(eq(providerConfigs.id, existing.id));
  } else {
    await db.insert(providerConfigs).values({
      organizationId: params.organizationId,
      channel: params.channel,
      provider: params.provider,
      mode: "agency_managed",
      isActive: true,
      configJson: nextConfig,
    });
  }

  record("FIXED", params.label, "set to active agency-managed");
}

async function ensurePublishedAutomationTemplates(params: {
  organizationId: string;
  apply: boolean;
}) {
  const catalog = getAutomationTemplateCatalog();
  if (catalog.length === 0) {
    record("WARN", "Automation templates", "catalog is empty");
    return;
  }

  const existingWorkflows = await db
    .select({
      id: automationWorkflows.id,
      templateKey: automationWorkflows.templateKey,
      triggerEvent: automationWorkflows.triggerEvent,
      definitionJson: automationWorkflows.definitionJson,
      quietHoursEnabled: automationWorkflows.quietHoursEnabled,
      quietHoursStart: automationWorkflows.quietHoursStart,
      quietHoursEnd: automationWorkflows.quietHoursEnd,
      dailySendCap: automationWorkflows.dailySendCap,
      respectOptOut: automationWorkflows.respectOptOut,
      enrollmentMode: automationWorkflows.enrollmentMode,
      reentryCooldownMinutes: automationWorkflows.reentryCooldownMinutes,
    })
    .from(automationWorkflows)
    .where(
      and(
        eq(automationWorkflows.organizationId, params.organizationId),
        eq(automationWorkflows.mode, "template"),
        ne(automationWorkflows.status, "archived")
      )
    );

  const versionRows =
    existingWorkflows.length === 0
      ? []
      : await db
          .select({
            workflowId: automationWorkflowVersions.workflowId,
          })
          .from(automationWorkflowVersions)
          .where(
            and(
              eq(automationWorkflowVersions.organizationId, params.organizationId),
              inArray(
                automationWorkflowVersions.workflowId,
                existingWorkflows.map((workflow) => workflow.id)
              )
            )
          );

  const versionedWorkflowIds = new Set(versionRows.map((row) => row.workflowId));
  const existingByTemplateKey = new Map(
    existingWorkflows
      .filter((workflow) => workflow.templateKey)
      .map((workflow) => [workflow.templateKey as string, workflow])
  );
  const missingTemplates = catalog.filter((template) => !existingByTemplateKey.has(template.key));
  const workflowsMissingVersions = existingWorkflows.filter(
    (workflow) => !versionedWorkflowIds.has(workflow.id)
  );

  if (missingTemplates.length === 0 && workflowsMissingVersions.length === 0) {
    record(
      "PASS",
      "Automation templates",
      `${existingWorkflows.length} published template workflow(s) ready`
    );
    return;
  }

  if (!params.apply) {
    const gaps: string[] = [];
    if (missingTemplates.length > 0) {
      gaps.push(`${missingTemplates.length}/${catalog.length} templates not installed`);
    }
    if (workflowsMissingVersions.length > 0) {
      gaps.push(`${workflowsMissingVersions.length} workflow(s) missing version snapshots`);
    }
    record("WARN", "Automation templates", gaps.join("; "));
    return;
  }

  let installedCount = 0;
  let versionSnapshotCount = 0;

  for (const template of missingTemplates) {
    const normalizedDefinition = normalizeDefinition(template.definition);
    const validationErrors = validateAutomationDefinition(normalizedDefinition);
    if (validationErrors.length > 0) {
      record(
        "FAIL",
        "Automation templates",
        `Template ${template.key} is invalid: ${validationErrors.join(" ")}`
      );
      return;
    }

    const now = new Date();
    const [createdWorkflow] = await db
      .insert(automationWorkflows)
      .values({
        organizationId: params.organizationId,
        name: template.name,
        description: template.description,
        mode: "template",
        status: "published",
        templateKey: template.key,
        triggerEvent: template.triggerEvent,
        definitionJson: normalizedDefinition,
        validationErrors: [],
        ...DEFAULT_AUTOMATION_COMPLIANCE_POLICY,
        createdByUserId: null,
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
        lastValidatedAt: now,
      })
      .returning({
        id: automationWorkflows.id,
      });

    await db.insert(automationWorkflowVersions).values({
      organizationId: params.organizationId,
      workflowId: createdWorkflow.id,
      versionNumber: 1,
      triggerEvent: template.triggerEvent,
      definitionJson: normalizedDefinition,
      policyJson: {
        ...DEFAULT_AUTOMATION_COMPLIANCE_POLICY,
      },
      publishedByUserId: null,
      createdAt: now,
    });

    installedCount += 1;
    versionSnapshotCount += 1;
  }

  for (const workflow of workflowsMissingVersions) {
    await db.insert(automationWorkflowVersions).values({
      organizationId: params.organizationId,
      workflowId: workflow.id,
      versionNumber: 1,
      triggerEvent: workflow.triggerEvent,
      definitionJson: normalizeDefinition(workflow.definitionJson as AutomationDefinition),
      policyJson: {
        quietHoursEnabled: workflow.quietHoursEnabled,
        quietHoursStart: workflow.quietHoursStart,
        quietHoursEnd: workflow.quietHoursEnd,
        dailySendCap: workflow.dailySendCap,
        respectOptOut: workflow.respectOptOut,
        enrollmentMode: workflow.enrollmentMode,
        reentryCooldownMinutes: workflow.reentryCooldownMinutes,
      },
      publishedByUserId: null,
    });

    versionSnapshotCount += 1;
  }

  record(
    "FIXED",
    "Automation templates",
    `installed ${installedCount} template workflow(s); created ${versionSnapshotCount} version snapshot(s)`
  );
}

function printResults() {
  console.log("\nDemo org operationalization results:");
  for (const result of results) {
    console.log(`[${result.level}] ${result.label} - ${result.detail}`);
  }

  const passCount = results.filter((result) => result.level === "PASS").length;
  const fixedCount = results.filter((result) => result.level === "FIXED").length;
  const warnCount = results.filter((result) => result.level === "WARN").length;
  const failCount = results.filter((result) => result.level === "FAIL").length;
  console.log(
    `\nSummary: ${passCount} pass, ${fixedCount} fixed, ${warnCount} warn, ${failCount} fail`
  );

  if (failCount > 0) {
    process.exit(1);
  }
}

async function run() {
  const args = parseArgs();
  console.log(
    `Preparing demo org readiness for slug="${args.orgSlug}" (${args.apply ? "apply" : "check-only"})`
  );

  const [orgBySlug] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
    })
    .from(organizations)
    .where(eq(organizations.slug, args.orgSlug))
    .limit(1);

  const [orgByName] = !orgBySlug
    ? await db
        .select({
          id: organizations.id,
          name: organizations.name,
          slug: organizations.slug,
        })
        .from(organizations)
        .where(ilike(organizations.name, `%${args.orgNameHint}%`))
        .limit(1)
    : [null];

  const org = orgBySlug ?? orgByName;
  if (!org) {
    record(
      "FAIL",
      "Demo organization",
      `No organization found for slug "${args.orgSlug}" or name hint "${args.orgNameHint}"`
    );
    printResults();
    return;
  }

  record("PASS", "Demo organization", `${org.name} (${org.slug})`);

  const requiredEnv = [
    "GEMINI_API_KEY",
    "RETELL_WEBHOOK_SECRET",
    "SMS_GATEWAY_API_KEY",
  ] as const;
  for (const key of requiredEnv) {
    const value = envValue(key);
    if (value) {
      record("PASS", `Env ${key}`, "set");
    } else {
      record("FAIL", `Env ${key}`, "missing");
    }
  }

  try {
    await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(graceSessions),
      db.select({ count: sql<number>`count(*)` }).from(graceCalls),
      db.select({ count: sql<number>`count(*)` }).from(graceMessages),
      db.select({ count: sql<number>`count(*)` }).from(providerConfigs),
      db.select({ count: sql<number>`count(*)` }).from(smsDevices),
      db.select({ count: sql<number>`count(*)` }).from(aiConfig),
    ]);
    record("PASS", "Core GRACE/SMS tables", "reachable");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown table access error";
    record("FAIL", "Core GRACE/SMS tables", message);
  }

  const [existingAiConfig] = await db
    .select()
    .from(aiConfig)
    .where(eq(aiConfig.organizationId, org.id))
    .limit(1);

  const aiConfigReady = Boolean(
    existingAiConfig &&
      existingAiConfig.graceEnabled &&
      existingAiConfig.publicGraceEnabled &&
      existingAiConfig.publicPhoneEnabled &&
      existingAiConfig.isDemoOrganization &&
      existingAiConfig.churchName?.trim()
  );

  if (aiConfigReady) {
    record("PASS", "Grace settings (ai_config)", "public channels and demo flags enabled");
  } else if (!args.apply) {
    record("WARN", "Grace settings (ai_config)", "missing/partial demo Grace settings");
  } else if (existingAiConfig) {
    await db
      .update(aiConfig)
      .set({
        churchName: existingAiConfig.churchName?.trim() || org.name,
        churchCity: existingAiConfig.churchCity ?? "Demo City",
        graceEnabled: true,
        internalGraceEnabled: true,
        publicGraceEnabled: true,
        publicWidgetEnabled: true,
        publicPhoneEnabled: true,
        isDemoOrganization: true,
        updatedAt: new Date(),
      })
      .where(eq(aiConfig.id, existingAiConfig.id));
    record("FIXED", "Grace settings (ai_config)", "updated existing config for demo readiness");
  } else {
    await db.insert(aiConfig).values({
      organizationId: org.id,
      churchName: org.name,
      churchCity: "Demo City",
      graceEnabled: true,
      internalGraceEnabled: true,
      publicGraceEnabled: true,
      publicWidgetEnabled: true,
      publicPhoneEnabled: true,
      isDemoOrganization: true,
    });
    record("FIXED", "Grace settings (ai_config)", "created config for demo readiness");
  }

  const [policyCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(organizationRoleAccessPolicies)
    .where(eq(organizationRoleAccessPolicies.organizationId, org.id));
  const policyCount = Number(policyCountRow?.count ?? 0);
  if (policyCount >= 3) {
    record("PASS", "Role access policies", `${policyCount} policy row(s) configured`);
  } else if (!args.apply) {
    record("WARN", "Role access policies", `${policyCount} row(s); expected 3`);
  } else {
    const matrix = defaultRoleAccessMatrix();
    await db
      .delete(organizationRoleAccessPolicies)
      .where(
        and(
          eq(organizationRoleAccessPolicies.organizationId, org.id),
          inArray(organizationRoleAccessPolicies.role, [...ORG_ROLES])
        )
      );

    await db.insert(organizationRoleAccessPolicies).values(
      ORG_ROLES.map((role) => ({
        organizationId: org.id,
        role,
        allowedSections: matrix[role],
        updatedAt: new Date(),
      }))
    );
    record("FIXED", "Role access policies", "seeded default owner/admin/user matrix");
  }

  await ensureManagedProvider({
    organizationId: org.id,
    channel: "ai",
    provider: "gemini",
    apply: args.apply,
    label: "Provider ai/gemini",
  });
  await ensureManagedProvider({
    organizationId: org.id,
    channel: "sms",
    provider: PRIMARY_SMS_GATEWAY_PROVIDER,
    apply: args.apply,
    label: "Provider sms/fellowship_gateway",
  });
  await ensureManagedProvider({
    organizationId: org.id,
    channel: "voice",
    provider: "retell",
    apply: args.apply,
    label: "Provider voice/retell",
  });
  await ensureManagedProvider({
    organizationId: org.id,
    channel: "email",
    provider: "managed",
    apply: args.apply,
    label: "Provider email/managed",
  });
  await ensurePublishedAutomationTemplates({
    organizationId: org.id,
    apply: args.apply,
  });

  const [assignedSmsDevice] = await db
    .select({
      id: smsDevices.id,
      deviceName: smsDevices.deviceName,
      phoneNumber: smsDevices.phoneNumber,
      isActive: smsDevices.isActive,
    })
    .from(smsDevices)
    .where(eq(smsDevices.organizationId, org.id))
    .orderBy(desc(smsDevices.isActive), desc(smsDevices.lastSeenAt), desc(smsDevices.createdAt))
    .limit(1);

  if (assignedSmsDevice?.isActive) {
    record(
      "PASS",
      "SMS device assignment",
      `${assignedSmsDevice.deviceName} (${assignedSmsDevice.phoneNumber ?? "no phone"})`
    );
  } else if (!args.apply) {
    record("WARN", "SMS device assignment", "no active device assigned to demo org");
  } else {
    const [unassignedDevice] = await db
      .select({
        id: smsDevices.id,
        deviceName: smsDevices.deviceName,
        phoneNumber: smsDevices.phoneNumber,
      })
      .from(smsDevices)
      .where(and(isNull(smsDevices.organizationId), eq(smsDevices.isActive, true)))
      .orderBy(desc(smsDevices.lastSeenAt), desc(smsDevices.createdAt))
      .limit(1);

    if (!unassignedDevice) {
      const fallbackNumber = envValue("DEMO_SMS_PHONE_NUMBER") ?? "+15550000000";
      const [virtualDevice] = await db
        .insert(smsDevices)
        .values({
          organizationId: org.id,
          deviceName: "Demo Virtual SMS Device",
          phoneNumber: fallbackNumber,
          isActive: true,
          lastSeenAt: new Date(),
        })
        .returning({
          id: smsDevices.id,
          deviceName: smsDevices.deviceName,
          phoneNumber: smsDevices.phoneNumber,
        });
      record(
        "FIXED",
        "SMS device assignment",
        `created ${virtualDevice.deviceName} (${virtualDevice.phoneNumber ?? "no phone"})`
      );
    } else {
      await db
        .update(smsDevices)
        .set({
          organizationId: org.id,
          updatedAt: new Date(),
        })
        .where(eq(smsDevices.id, unassignedDevice.id));
      record(
        "FIXED",
        "SMS device assignment",
        `assigned ${unassignedDevice.deviceName} (${unassignedDevice.phoneNumber ?? "no phone"})`
      );
    }
  }

  const [contactsCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(churchContacts)
    .where(eq(churchContacts.organizationId, org.id));
  const contactCount = Number(contactsCountRow?.count ?? 0);

  if (contactCount > 0) {
    record("PASS", "Demo contact data", `${contactCount} contacts present`);
  } else if (!args.apply || !args.seedIfEmpty) {
    record("WARN", "Demo contact data", "no contacts present (run with --apply to seed)");
  } else {
    const seeded = await seedDemoDataForOrg(org.id);
    record(
      "FIXED",
      "Demo contact data",
      `seeded baseline data (${seeded.contactCount} contacts)`
    );
  }

  printResults();
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[demo-org-operationalize] unexpected failure:", message);
  process.exit(1);
});
