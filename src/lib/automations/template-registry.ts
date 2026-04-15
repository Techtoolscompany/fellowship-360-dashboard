import { db } from "@/db";
import { automationTemplateCatalog } from "@/db/schema";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import {
  normalizeAutomationDefinition,
} from "./editor";
import { getAutomationTemplateByKey, getAutomationTemplateCatalog } from "./templates";
import type {
  AutomationLibraryTemplate,
  AutomationStatus,
  AutomationTemplateCategory,
} from "./types";

function cloneTemplate<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mapManagedTemplate(
  row: typeof automationTemplateCatalog.$inferSelect
): AutomationLibraryTemplate {
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    category: row.category as AutomationTemplateCategory,
    triggerEvent: row.triggerEvent,
    mode: "template",
    recommendedChannels: cloneTemplate(row.recommendedChannels ?? []),
    definition: normalizeAutomationDefinition(row.definitionJson),
    source: "managed",
    status: row.status,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
  };
}

function mapSystemTemplate(
  template: NonNullable<ReturnType<typeof getAutomationTemplateByKey>>
): AutomationLibraryTemplate {
  return {
    ...cloneTemplate(template),
    source: "system",
    status: "published",
    updatedAt: null,
    publishedAt: null,
  };
}

export async function listManagedAutomationTemplates(options?: {
  statuses?: AutomationStatus[];
  includeArchived?: boolean;
}) {
  const statuses = options?.statuses?.filter(Boolean);

  const whereClause =
    statuses && statuses.length > 0
      ? inArray(automationTemplateCatalog.status, statuses)
      : options?.includeArchived
        ? undefined
        : ne(automationTemplateCatalog.status, "archived");

  const baseQuery = db
    .select()
    .from(automationTemplateCatalog);

  const rows = await (whereClause ? baseQuery.where(whereClause) : baseQuery).orderBy(
    desc(automationTemplateCatalog.updatedAt)
  );

  return rows.map((row) => ({
    ...row,
    recommendedChannels: cloneTemplate(row.recommendedChannels ?? []),
    definitionJson: normalizeAutomationDefinition(row.definitionJson),
    validationErrors: cloneTemplate(row.validationErrors ?? []),
  }));
}

export async function listAutomationLibraryTemplates(options?: {
  includeDrafts?: boolean;
  includeArchived?: boolean;
}) {
  const managedRows = await listManagedAutomationTemplates({
    statuses: options?.includeDrafts
      ? options?.includeArchived
        ? ["draft", "published", "paused", "archived"]
        : ["draft", "published", "paused"]
      : ["published"],
    includeArchived: options?.includeArchived,
  });

  const managedTemplates = managedRows.map((row) => mapManagedTemplate(row));
  const systemTemplates = getAutomationTemplateCatalog().map((template) =>
    mapSystemTemplate(template)
  );

  return [...managedTemplates, ...systemTemplates].sort((left, right) => {
    if (left.source !== right.source) {
      return left.source === "managed" ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

export async function getResolvedAutomationTemplateByKey(
  templateKey: string,
  options?: { includeDrafts?: boolean }
) {
  const normalizedKey = templateKey.trim();
  if (!normalizedKey) return null;

  const [managed] = await db
    .select()
    .from(automationTemplateCatalog)
    .where(
      options?.includeDrafts
        ? and(
            eq(automationTemplateCatalog.key, normalizedKey),
            ne(automationTemplateCatalog.status, "archived")
          )
        : and(
            eq(automationTemplateCatalog.key, normalizedKey),
            eq(automationTemplateCatalog.status, "published")
          )
    )
    .limit(1);

  if (managed) {
    return mapManagedTemplate({
      ...managed,
      recommendedChannels: cloneTemplate(managed.recommendedChannels ?? []),
      definitionJson: normalizeAutomationDefinition(managed.definitionJson),
      validationErrors: cloneTemplate(managed.validationErrors ?? []),
    } as typeof automationTemplateCatalog.$inferSelect);
  }

  const systemTemplate = getAutomationTemplateByKey(normalizedKey);
  if (!systemTemplate) {
    return null;
  }

  return mapSystemTemplate(systemTemplate);
}

export function isReservedAutomationTemplateKey(templateKey: string) {
  return Boolean(getAutomationTemplateByKey(templateKey));
}
