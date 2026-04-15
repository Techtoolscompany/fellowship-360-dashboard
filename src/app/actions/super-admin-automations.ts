"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { automationTemplateCatalog } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { validateAutomationDefinition } from "@/lib/automations/validation";
import {
  createBuilderStarterDefinition,
  normalizeAutomationDefinition,
} from "@/lib/automations/editor";
import { getAutomationTemplateCatalog } from "@/lib/automations/templates";
import {
  getResolvedAutomationTemplateByKey,
  isReservedAutomationTemplateKey,
  listManagedAutomationTemplates,
} from "@/lib/automations/template-registry";
import type {
  AutomationRecommendedChannel,
  AutomationTemplateCategory,
} from "@/lib/automations/types";
import {
  logSuperAdminAudit,
  resolveSuperAdminAccess,
  superAdminHasPermission,
} from "@/lib/super-admin/auth";

const templateCategorySchema = z.enum([
  "Follow-Up",
  "Care",
  "Appointments",
  "Service Ops",
]);

const templateChannelSchema = z.enum(["sms", "email", "voice"]);

const templateDefinitionSchema = z.object({
  version: z.coerce.number().int().min(1).default(1),
  startNodeId: z.string().nullable().optional(),
  nodes: z.array(
    z.object({
      id: z.string().min(1),
      type: z.enum(["trigger", "delay", "condition", "action", "stop"]),
      label: z.string().min(1),
      description: z.string().nullable().optional(),
      config: z.record(z.unknown()).optional(),
      nextIds: z.array(z.string().min(1)).optional(),
    })
  ),
});

const createTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  key: z.string().trim().max(120).optional(),
  starterTemplateKey: z.string().trim().min(1).optional(),
});

const updateTemplateSchema = z.object({
  templateId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  key: z.string().trim().min(2).max(120),
  description: z.string().max(5000),
  category: templateCategorySchema,
  triggerEvent: z.string().max(255),
  recommendedChannels: z.array(templateChannelSchema).min(1),
  definition: templateDefinitionSchema,
});

const templateIdSchema = z.object({
  templateId: z.string().min(1),
});

function slugifyTemplateKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

async function requireSuperAdminAutomationAccess() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    throw new Error("Unauthorized");
  }

  const access = await resolveSuperAdminAccess({
    userId: session.user.id,
    email: session.user.email,
  });

  if (!access?.isActive || !superAdminHasPermission(access, "deploy_automations")) {
    throw new Error("Forbidden");
  }

  return {
    userId: session.user.id,
    email: session.user.email,
  };
}

async function ensureTemplateKeyAvailable(
  templateKey: string,
  currentTemplateId?: string
) {
  if (!templateKey) {
    throw new Error("Template key is required");
  }

  if (isReservedAutomationTemplateKey(templateKey)) {
    throw new Error("That template key is reserved by a built-in automation");
  }

  const [existing] = await db
    .select({
      id: automationTemplateCatalog.id,
    })
    .from(automationTemplateCatalog)
    .where(
      currentTemplateId
        ? and(
            eq(automationTemplateCatalog.key, templateKey),
            ne(automationTemplateCatalog.id, currentTemplateId)
          )
        : eq(automationTemplateCatalog.key, templateKey)
    )
    .limit(1);

  if (existing) {
    throw new Error("That template key is already in use");
  }
}

async function suggestAvailableTemplateKey(baseKey: string) {
  const normalizedBase = slugifyTemplateKey(baseKey) || "managed_template";
  let candidate = normalizedBase;
  let suffix = 2;

  while (true) {
    const [existing] = await db
      .select({ id: automationTemplateCatalog.id })
      .from(automationTemplateCatalog)
      .where(eq(automationTemplateCatalog.key, candidate))
      .limit(1);

    if (!existing && !isReservedAutomationTemplateKey(candidate)) {
      return candidate;
    }

    candidate = `${normalizedBase}_${suffix}`;
    suffix += 1;
  }
}

export async function getSuperAdminAutomationTemplates() {
  await requireSuperAdminAutomationAccess();
  return listManagedAutomationTemplates({ includeArchived: true });
}

export async function getSuperAdminAutomationStarters() {
  await requireSuperAdminAutomationAccess();
  return getAutomationTemplateCatalog().map((template) => ({
    key: template.key,
    name: template.name,
    description: template.description,
    category: template.category,
    triggerEvent: template.triggerEvent,
    recommendedChannels: template.recommendedChannels,
    nodeCount: template.definition.nodes.length,
  }));
}

export async function createSuperAdminAutomationTemplate(input: {
  name: string;
  key?: string;
  starterTemplateKey?: string;
}) {
  const actor = await requireSuperAdminAutomationAccess();
  const parsed = createTemplateSchema.parse(input);
  const templateKey = parsed.key
    ? slugifyTemplateKey(parsed.key)
    : await suggestAvailableTemplateKey(parsed.name);

  await ensureTemplateKeyAvailable(templateKey);

  const starter = parsed.starterTemplateKey
    ? await getResolvedAutomationTemplateByKey(parsed.starterTemplateKey, {
        includeDrafts: true,
      })
    : null;

  const definition = normalizeAutomationDefinition(
    starter?.definition ?? createBuilderStarterDefinition()
  );
  const validationErrors = validateAutomationDefinition(definition);

  const [created] = await db
    .insert(automationTemplateCatalog)
    .values({
      key: templateKey,
      name: parsed.name,
      description: starter?.description ?? "",
      category:
        (starter?.category as AutomationTemplateCategory | undefined) ?? "Follow-Up",
      status: "draft",
      triggerEvent: starter?.triggerEvent ?? "",
      recommendedChannels:
        (starter?.recommendedChannels as AutomationRecommendedChannel[] | undefined) ??
        ["sms"],
      definitionJson: definition,
      validationErrors,
      createdByUserId: actor.userId,
      updatedByUserId: actor.userId,
      lastValidatedAt: new Date(),
    })
    .returning();

  await logSuperAdminAudit({
    actorUserId: actor.userId,
    actionType: "create",
    entityName: "automation_template_catalog",
    entityId: created.id,
    details: {
      key: created.key,
      starterTemplateKey: parsed.starterTemplateKey ?? null,
      validationErrors,
    },
  });

  return {
    ...created,
    definitionJson: normalizeAutomationDefinition(created.definitionJson),
    recommendedChannels: [...(created.recommendedChannels ?? [])],
    validationErrors: [...(created.validationErrors ?? [])],
  };
}

export async function updateSuperAdminAutomationTemplate(input: {
  templateId: string;
  name: string;
  key: string;
  description: string;
  category: AutomationTemplateCategory;
  triggerEvent: string;
  recommendedChannels: AutomationRecommendedChannel[];
  definition: ReturnType<typeof normalizeAutomationDefinition>;
}) {
  const actor = await requireSuperAdminAutomationAccess();
  const parsed = updateTemplateSchema.parse(input);
  const templateKey = slugifyTemplateKey(parsed.key);

  await ensureTemplateKeyAvailable(templateKey, parsed.templateId);

  const definition = normalizeAutomationDefinition(parsed.definition);
  const validationErrors = validateAutomationDefinition(definition);

  const [updated] = await db
    .update(automationTemplateCatalog)
    .set({
      key: templateKey,
      name: parsed.name,
      description: parsed.description,
      category: parsed.category,
      triggerEvent: parsed.triggerEvent,
      recommendedChannels: parsed.recommendedChannels,
      definitionJson: definition,
      validationErrors,
      updatedAt: new Date(),
      updatedByUserId: actor.userId,
      lastValidatedAt: new Date(),
    })
    .where(eq(automationTemplateCatalog.id, parsed.templateId))
    .returning();

  if (!updated) {
    throw new Error("Template not found");
  }

  await logSuperAdminAudit({
    actorUserId: actor.userId,
    actionType: "update",
    entityName: "automation_template_catalog",
    entityId: updated.id,
    details: {
      key: updated.key,
      validationErrors,
    },
  });

  return {
    ...updated,
    definitionJson: normalizeAutomationDefinition(updated.definitionJson),
    recommendedChannels: [...(updated.recommendedChannels ?? [])],
    validationErrors: [...(updated.validationErrors ?? [])],
  };
}

export async function publishSuperAdminAutomationTemplate(input: {
  templateId: string;
}) {
  const actor = await requireSuperAdminAutomationAccess();
  const parsed = templateIdSchema.parse(input);

  const [template] = await db
    .select()
    .from(automationTemplateCatalog)
    .where(eq(automationTemplateCatalog.id, parsed.templateId))
    .limit(1);

  if (!template) {
    throw new Error("Template not found");
  }

  const definition = normalizeAutomationDefinition(template.definitionJson);
  const validationErrors = validateAutomationDefinition(definition);

  if (validationErrors.length > 0) {
    throw new Error(`Cannot publish invalid template. ${validationErrors.join(" ")}`);
  }

  const [updated] = await db
    .update(automationTemplateCatalog)
    .set({
      status: "published",
      updatedAt: new Date(),
      publishedAt: new Date(),
      publishedByUserId: actor.userId,
      updatedByUserId: actor.userId,
      definitionJson: definition,
      validationErrors: [],
      lastValidatedAt: new Date(),
    })
    .where(eq(automationTemplateCatalog.id, parsed.templateId))
    .returning();

  await logSuperAdminAudit({
    actorUserId: actor.userId,
    actionType: "publish",
    entityName: "automation_template_catalog",
    entityId: updated.id,
    details: {
      key: updated.key,
    },
  });

  return {
    ...updated,
    definitionJson: normalizeAutomationDefinition(updated.definitionJson),
    recommendedChannels: [...(updated.recommendedChannels ?? [])],
    validationErrors: [],
  };
}

export async function archiveSuperAdminAutomationTemplate(input: {
  templateId: string;
}) {
  const actor = await requireSuperAdminAutomationAccess();
  const parsed = templateIdSchema.parse(input);

  const [updated] = await db
    .update(automationTemplateCatalog)
    .set({
      status: "archived",
      updatedAt: new Date(),
      updatedByUserId: actor.userId,
    })
    .where(eq(automationTemplateCatalog.id, parsed.templateId))
    .returning();

  if (!updated) {
    throw new Error("Template not found");
  }

  await logSuperAdminAudit({
    actorUserId: actor.userId,
    actionType: "archive",
    entityName: "automation_template_catalog",
    entityId: updated.id,
    details: {
      key: updated.key,
    },
  });

  return updated.id;
}
