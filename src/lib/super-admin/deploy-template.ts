import { db } from "@/db";
import {
  actionAuditLogs,
  automationWorkflowVersions,
  automationWorkflows,
  organizations,
} from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import {
  DEFAULT_AUTOMATION_COMPLIANCE_POLICY,
  type AutomationDefinition,
} from "@/lib/automations/types";
import { normalizeAutomationDefinition } from "@/lib/automations/editor";
import { getResolvedAutomationTemplateByKey } from "@/lib/automations/template-registry";
import { validateAutomationDefinition } from "@/lib/automations/validation";
import type {
  BulkTemplateDeployOrgResult,
  BulkTemplateDeployRequest,
  BulkTemplateDeployResult,
} from "./agency-launch-contracts";

const bulkTemplateDeployRequestSchema = z.object({
  templateKey: z.string().min(1),
  organizationIds: z.array(z.string().min(1)).min(1),
  skipIfInstalled: z.boolean().optional().default(true),
});

type DeployActor = {
  userId: string;
  email?: string | null;
};

type TemplateDefinition = NonNullable<
  Awaited<ReturnType<typeof getResolvedAutomationTemplateByKey>>
>;

function cloneDefinition(definition: AutomationDefinition): AutomationDefinition {
  return JSON.parse(JSON.stringify(definition));
}

function normalizeDefinition(definition: AutomationDefinition): AutomationDefinition {
  return normalizeAutomationDefinition(cloneDefinition(definition));
}

function uniqueOrganizationIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
) {
  if (concurrency < 1) {
    throw new Error("Concurrency must be at least 1");
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  return results;
}

async function writeAuditEntry(params: {
  organizationId: string;
  actor: DeployActor;
  templateKey: string;
  skipIfInstalled: boolean;
  status: BulkTemplateDeployOrgResult["status"];
  workflowId?: string;
  error?: string;
}) {
  await db.insert(actionAuditLogs).values({
    organizationId: params.organizationId,
    userId: params.actor.userId,
    actionType: "install",
    entityName: "automation_template",
    entityId: params.workflowId,
    details: {
      actorScope: "super_admin",
      templateKey: params.templateKey,
      skipIfInstalled: params.skipIfInstalled,
      status: params.status,
      ...(params.actor.email ? { actorEmail: params.actor.email } : {}),
      ...(params.error ? { error: params.error } : {}),
    },
  });
}

async function createWorkflowVersionSnapshot(params: {
  organizationId: string;
  workflow: typeof automationWorkflows.$inferSelect;
  publishedByUserId: string;
}) {
  const [latest] = await db
    .select({
      latestVersionNumber: sql<number>`coalesce(max(${automationWorkflowVersions.versionNumber}), 0)`,
    })
    .from(automationWorkflowVersions)
    .where(
      and(
        eq(automationWorkflowVersions.organizationId, params.organizationId),
        eq(automationWorkflowVersions.workflowId, params.workflow.id)
      )
    );

  const nextVersionNumber = Number(latest?.latestVersionNumber ?? 0) + 1;

  await db.insert(automationWorkflowVersions).values({
    organizationId: params.organizationId,
    workflowId: params.workflow.id,
    versionNumber: nextVersionNumber,
    triggerEvent: params.workflow.triggerEvent,
    definitionJson: params.workflow.definitionJson,
    policyJson: {
      ...DEFAULT_AUTOMATION_COMPLIANCE_POLICY,
    },
    publishedByUserId: params.publishedByUserId,
  });
}

async function loadOrganization(organizationId: string) {
  const [organization] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return organization ?? null;
}

export async function deployAutomationTemplateToOrganization(params: {
  organizationId: string;
  template: TemplateDefinition;
  skipIfInstalled: boolean;
  actor: DeployActor;
}): Promise<BulkTemplateDeployOrgResult> {
  try {
    const organization = await loadOrganization(params.organizationId);
    if (!organization) {
      await writeAuditEntry({
        organizationId: params.organizationId,
        actor: params.actor,
        templateKey: params.template.key,
        skipIfInstalled: params.skipIfInstalled,
        status: "failed",
        error: "Organization not found",
      });
      return {
        organizationId: params.organizationId,
        status: "failed",
        error: "Organization not found",
      };
    }

    const [existing] = await db
      .select({
        id: automationWorkflows.id,
        organizationId: automationWorkflows.organizationId,
        templateKey: automationWorkflows.templateKey,
        status: automationWorkflows.status,
      })
      .from(automationWorkflows)
      .where(
        and(
          eq(automationWorkflows.organizationId, params.organizationId),
          eq(automationWorkflows.mode, "template"),
          eq(automationWorkflows.templateKey, params.template.key),
          ne(automationWorkflows.status, "archived")
        )
      )
      .limit(1);

    if (existing) {
      if (params.skipIfInstalled) {
        const status = "already_installed" as const;
        await writeAuditEntry({
          organizationId: params.organizationId,
          actor: params.actor,
          templateKey: params.template.key,
          skipIfInstalled: params.skipIfInstalled,
          status,
          workflowId: existing.id,
        });

        return {
          organizationId: params.organizationId,
          status,
          workflowId: existing.id,
        };
      }

      const normalized = normalizeDefinition(params.template.definition);
      const validationErrors = validateAutomationDefinition(normalized);

      if (validationErrors.length > 0) {
        const error = `Template ${params.template.name} is invalid: ${validationErrors.join(" ")}`;
        await writeAuditEntry({
          organizationId: params.organizationId,
          actor: params.actor,
          templateKey: params.template.key,
          skipIfInstalled: params.skipIfInstalled,
          status: "failed",
          error,
        });
        return {
          organizationId: params.organizationId,
          status: "failed",
          error,
        };
      }

      const [updated] = await db
        .update(automationWorkflows)
        .set({
          name: params.template.name,
          description: params.template.description,
          status: "published",
          triggerEvent: params.template.triggerEvent,
          definitionJson: normalized,
          validationErrors: [],
          updatedAt: new Date(),
          lastValidatedAt: new Date(),
          publishedAt: new Date(),
        })
        .where(eq(automationWorkflows.id, existing.id))
        .returning();

      if (!updated) {
        throw new Error("Failed to update installed template");
      }

      await createWorkflowVersionSnapshot({
        organizationId: params.organizationId,
        workflow: updated,
        publishedByUserId: params.actor.userId,
      });

      await writeAuditEntry({
        organizationId: params.organizationId,
        actor: params.actor,
        templateKey: params.template.key,
        skipIfInstalled: params.skipIfInstalled,
        status: "updated",
        workflowId: updated.id,
      });

      return {
        organizationId: params.organizationId,
        status: "updated",
        workflowId: updated.id,
      };
    }

    const normalized = normalizeDefinition(params.template.definition);
    const validationErrors = validateAutomationDefinition(normalized);

    if (validationErrors.length > 0) {
      const error = `Template ${params.template.name} is invalid: ${validationErrors.join(" ")}`;
      await writeAuditEntry({
        organizationId: params.organizationId,
        actor: params.actor,
        templateKey: params.template.key,
        skipIfInstalled: params.skipIfInstalled,
        status: "failed",
        error,
      });

      return {
        organizationId: params.organizationId,
        status: "failed",
        error,
      };
    }

    const [created] = await db
      .insert(automationWorkflows)
      .values({
        organizationId: params.organizationId,
        name: params.template.name,
        description: params.template.description,
        mode: "template",
        status: "published",
        templateKey: params.template.key,
        triggerEvent: params.template.triggerEvent,
        definitionJson: normalized,
        validationErrors: [],
        ...DEFAULT_AUTOMATION_COMPLIANCE_POLICY,
        createdByUserId: params.actor.userId,
        lastValidatedAt: new Date(),
        publishedAt: new Date(),
      })
      .onConflictDoNothing({
        target: [
          automationWorkflows.organizationId,
          automationWorkflows.templateKey,
          automationWorkflows.mode,
        ],
      })
      .returning();

    if (!created) {
      const [existingAfterConflict] = await db
        .select({
          id: automationWorkflows.id,
        })
        .from(automationWorkflows)
        .where(
          and(
            eq(automationWorkflows.organizationId, params.organizationId),
            eq(automationWorkflows.mode, "template"),
            eq(automationWorkflows.templateKey, params.template.key),
            ne(automationWorkflows.status, "archived")
          )
        )
        .limit(1);

      const status = "already_installed" as const;
      await writeAuditEntry({
        organizationId: params.organizationId,
        actor: params.actor,
        templateKey: params.template.key,
        skipIfInstalled: params.skipIfInstalled,
        status,
        workflowId: existingAfterConflict?.id,
      });

      return {
        organizationId: params.organizationId,
        status,
        workflowId: existingAfterConflict?.id,
      };
    }

    await createWorkflowVersionSnapshot({
      organizationId: params.organizationId,
      workflow: created,
      publishedByUserId: params.actor.userId,
    });

    await writeAuditEntry({
      organizationId: params.organizationId,
      actor: params.actor,
      templateKey: params.template.key,
      skipIfInstalled: params.skipIfInstalled,
      status: "installed",
      workflowId: created.id,
    });

    return {
      organizationId: params.organizationId,
      status: "installed",
      workflowId: created.id,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to deploy template";

    await writeAuditEntry({
      organizationId: params.organizationId,
      actor: params.actor,
      templateKey: params.template.key,
      skipIfInstalled: params.skipIfInstalled,
      status: "failed",
      error: message,
    });

    return {
      organizationId: params.organizationId,
      status: "failed",
      error: message,
    };
  }
}

export async function deployAutomationTemplateBatch(input: {
  request: BulkTemplateDeployRequest;
  actor: DeployActor;
}): Promise<BulkTemplateDeployResult> {
  const parsed = bulkTemplateDeployRequestSchema.parse(input.request);
  const template = await getResolvedAutomationTemplateByKey(parsed.templateKey, {
    includeDrafts: true,
  });

  if (!template) {
    throw new Error("Automation template not found");
  }

  const organizationIds = uniqueOrganizationIds(parsed.organizationIds);
  const results = await mapWithConcurrency(organizationIds, 5, (organizationId) =>
    deployAutomationTemplateToOrganization({
      organizationId,
      template,
      skipIfInstalled: parsed.skipIfInstalled,
      actor: input.actor,
    })
  );

  return {
    templateKey: parsed.templateKey,
    skipIfInstalled: parsed.skipIfInstalled,
    results,
  };
}
