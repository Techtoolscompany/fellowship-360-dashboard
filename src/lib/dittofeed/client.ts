import type { DittofeedTemplatePackResources } from "./template-packs";

const DEFAULT_DITTOFEED_BASE_URL = "https://app.dittofeed.com";

type DittofeedRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  baseUrl?: string | null;
  authHeader: string;
  body?: Record<string, unknown>;
  expectedStatus?: number | number[];
};

type DittofeedResponse = Record<string, unknown>;

function getString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getBaseUrl(baseUrl?: string | null) {
  return (getString(baseUrl) ??
    getString(process.env.DITTOFEED_BASE_URL) ??
    DEFAULT_DITTOFEED_BASE_URL
  ).replace(/\/+$/, "");
}

function normalizePublicWriteKey(writeKey: string) {
  const trimmed = writeKey.trim();
  if (trimmed.startsWith("Basic ")) {
    return trimmed;
  }
  const value = trimmed.includes(":") ? trimmed : `${trimmed}:`;
  return `Basic ${Buffer.from(value).toString("base64")}`;
}

function normalizeExpectedStatus(expected?: number | number[]) {
  if (!expected) return [200];
  return Array.isArray(expected) ? expected : [expected];
}

async function dittofeedRequest<T extends DittofeedResponse | null>(
  path: string,
  options: DittofeedRequestOptions
): Promise<T> {
  const response = await fetch(`${getBaseUrl(options.baseUrl)}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: options.authHeader,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  const allowedStatuses = normalizeExpectedStatus(options.expectedStatus);
  if (!allowedStatuses.includes(response.status)) {
    const text = await response.text();
    throw new Error(
      `Dittofeed request failed (${response.status}) for ${path}: ${text || response.statusText}`
    );
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

function requireValue(value: string | null, label: string): string {
  if (!value) {
    throw new Error(`Dittofeed ${label} is required`);
  }
  return value;
}

export type DittofeedChildWorkspace = {
  id: string;
  name: string;
  externalId: string | null;
  writeKey: string;
  status: string | null;
  type: string | null;
};

export async function createDittofeedChildWorkspace(params: {
  name: string;
  externalId?: string | null;
  baseUrl?: string | null;
  parentAdminApiKey?: string | null;
  parentWorkspaceId?: string | null;
}) {
  const parentAdminApiKey =
    getString(params.parentAdminApiKey) ??
    getString(process.env.DITTOFEED_PARENT_ADMIN_API_KEY);
  const parentWorkspaceId =
    getString(params.parentWorkspaceId) ??
    getString(process.env.DITTOFEED_PARENT_WORKSPACE_ID);

  if (!parentAdminApiKey || !parentWorkspaceId) {
    throw new Error(
      "DITTOFEED_PARENT_ADMIN_API_KEY and DITTOFEED_PARENT_WORKSPACE_ID are required"
    );
  }

  const payload = await dittofeedRequest<DittofeedResponse>(
    "/api-l/admin/workspaces/child",
    {
      method: "PUT",
      baseUrl: params.baseUrl,
      authHeader: `Bearer ${parentAdminApiKey}`,
      body: {
        name: params.name,
        externalId: params.externalId ?? undefined,
        workspaceId: parentWorkspaceId,
      },
    }
  );

  return {
    id: requireValue(getString(payload.id) ?? getString(payload.workspaceId), "workspace id"),
    name: getString(payload.name) ?? params.name,
    externalId: getString(payload.externalId),
    writeKey: requireValue(getString(payload.writeKey), "write key"),
    status: getString(payload.status),
    type: getString(payload.type),
  } satisfies DittofeedChildWorkspace;
}

export async function createDittofeedSession(params: {
  workspaceId: string;
  writeKey: string;
  baseUrl?: string | null;
}) {
  const payload = await dittofeedRequest<DittofeedResponse>("/api-l/sessions", {
    method: "POST",
    baseUrl: params.baseUrl,
    authHeader: `Bearer ${params.writeKey.trim()}`,
    body: {
      workspaceId: params.workspaceId,
    },
  });

  return {
    token: requireValue(getString(payload.token), "session token"),
  };
}

export async function identifyDittofeedUser(params: {
  baseUrl?: string | null;
  writeKey: string;
  userId: string;
  traits?: Record<string, unknown>;
  messageId?: string;
}) {
  await dittofeedRequest<DittofeedResponse>("/api/public/apps/identify", {
    method: "POST",
    baseUrl: params.baseUrl,
    authHeader: normalizePublicWriteKey(params.writeKey),
    body: {
      userId: params.userId,
      messageId: params.messageId ?? crypto.randomUUID(),
      ...(params.traits ? { traits: params.traits } : {}),
    },
  });
}

export async function trackDittofeedEvent(params: {
  baseUrl?: string | null;
  writeKey: string;
  userId: string;
  event: string;
  properties?: Record<string, unknown>;
  context?: Record<string, unknown>;
  messageId?: string;
}) {
  await dittofeedRequest<DittofeedResponse>("/api/public/apps/track", {
    method: "POST",
    baseUrl: params.baseUrl,
    authHeader: normalizePublicWriteKey(params.writeKey),
    body: {
      type: "track",
      userId: params.userId,
      event: params.event,
      messageId: params.messageId ?? crypto.randomUUID(),
      ...(params.properties ? { properties: params.properties } : {}),
      ...(params.context ? { context: params.context } : {}),
    },
  });
}

export async function configureDittofeedResendEmailProvider(params: {
  workspaceId: string;
  adminApiKey: string;
  apiKey: string;
  webhookKey?: string | null;
  setDefault?: boolean;
  baseUrl?: string | null;
}) {
  await dittofeedRequest<DittofeedResponse | null>(
    "/api/admin/settings/email-providers",
    {
      method: "PUT",
      baseUrl: params.baseUrl,
      authHeader: `Bearer ${params.adminApiKey}`,
      expectedStatus: [200, 201],
      body: {
        workspaceId: params.workspaceId,
        config: {
          type: "Resend",
          apiKey: params.apiKey,
          ...(getString(params.webhookKey) ? { webhookKey: params.webhookKey } : {}),
        },
        setDefault: params.setDefault ?? true,
      },
    }
  );
}

async function upsertAdminResource(params: {
  path: string;
  workspaceId: string;
  adminApiKey: string;
  resource: Record<string, unknown>;
  baseUrl?: string | null;
}) {
  await dittofeedRequest<DittofeedResponse>(params.path, {
    method: "PUT",
    baseUrl: params.baseUrl,
    authHeader: `Bearer ${params.adminApiKey}`,
    body: {
      workspaceId: params.workspaceId,
      ...params.resource,
    },
  });
}

export async function publishDittofeedTemplatePack(params: {
  workspaceId: string;
  adminApiKey: string;
  baseUrl?: string | null;
  resources: DittofeedTemplatePackResources;
}) {
  const counts = {
    emailProviderConfigured: false,
    userProperties: 0,
    componentConfigurations: 0,
    templates: 0,
    segments: 0,
    journeys: 0,
  };

  if (params.resources.emailProvider) {
    await dittofeedRequest<DittofeedResponse | null>(
      "/api/admin/settings/email-providers",
      {
        method: "PUT",
        baseUrl: params.baseUrl,
        authHeader: `Bearer ${params.adminApiKey}`,
        expectedStatus: [200, 201],
        body: {
          workspaceId: params.workspaceId,
          config: params.resources.emailProvider.config,
          setDefault: params.resources.emailProvider.setDefault ?? true,
        },
      }
    );
    counts.emailProviderConfigured = true;
  }

  for (const property of params.resources.userProperties ?? []) {
    await upsertAdminResource({
      path: "/api/admin/user-properties/",
      workspaceId: params.workspaceId,
      adminApiKey: params.adminApiKey,
      baseUrl: params.baseUrl,
      resource: property,
    });
    counts.userProperties += 1;
  }

  for (const configuration of params.resources.componentConfigurations ?? []) {
    await upsertAdminResource({
      path: "/api/admin/component-configurations/",
      workspaceId: params.workspaceId,
      adminApiKey: params.adminApiKey,
      baseUrl: params.baseUrl,
      resource: configuration,
    });
    counts.componentConfigurations += 1;
  }

  for (const template of params.resources.templates ?? []) {
    await upsertAdminResource({
      path: "/api/admin/content/templates",
      workspaceId: params.workspaceId,
      adminApiKey: params.adminApiKey,
      baseUrl: params.baseUrl,
      resource: {
        ...template,
        resourceType: template.resourceType ?? "Declarative",
      },
    });
    counts.templates += 1;
  }

  for (const segment of params.resources.segments ?? []) {
    await upsertAdminResource({
      path: "/api/admin/segments/",
      workspaceId: params.workspaceId,
      adminApiKey: params.adminApiKey,
      baseUrl: params.baseUrl,
      resource: segment,
    });
    counts.segments += 1;
  }

  for (const journey of params.resources.journeys ?? []) {
    await upsertAdminResource({
      path: "/api/admin/journeys/",
      workspaceId: params.workspaceId,
      adminApiKey: params.adminApiKey,
      baseUrl: params.baseUrl,
      resource: journey,
    });
    counts.journeys += 1;
  }

  return counts;
}

export function buildDittofeedEmbeddedUrls(params: {
  token: string;
  workspaceId: string;
  baseUrl?: string | null;
}) {
  const baseUrl = getBaseUrl(params.baseUrl);
  const query = new URLSearchParams({
    token: params.token,
    workspaceId: params.workspaceId,
  });
  const withExtra = (path: string, extra?: Record<string, string>) => {
    const nextQuery = new URLSearchParams(query);
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        nextQuery.set(key, value);
      }
    }
    return `${baseUrl}${path}?${nextQuery.toString()}`;
  };

  return {
    journeys: withExtra("/dashboard-l/embedded/journeys"),
    journeyEditorBase: withExtra("/dashboard-l/embedded/journeys/v2"),
    broadcasts: withExtra("/dashboard-l/embedded/broadcasts"),
    broadcastEditorBase: withExtra("/dashboard-l/embedded/broadcasts/v2"),
    templates: withExtra("/dashboard-l/embedded/templates"),
    emailTemplateEditorBase: withExtra("/dashboard-l/embedded/templates/email"),
    smsTemplateEditorBase: withExtra("/dashboard-l/embedded/templates/sms"),
    segments: withExtra("/dashboard-l/embedded/segments"),
    segmentEditorBase: withExtra("/dashboard-l/embedded/segments/v1"),
    deliveries: withExtra("/dashboard-l/embedded/deliveries/v2"),
  };
}
