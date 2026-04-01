import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import { db } from "@/db";
import { organizations } from "@/db/schema/organization";
import {
  configureDittofeedResendEmailProvider,
  createDittofeedChildWorkspace,
} from "@/lib/dittofeed/client";
import {
  getRedactedDittofeedProviderForClient,
  resolveDittofeedProviderForOrganization,
  resolveDittofeedProviderForOrganizationAnyState,
  type ResolvedDittofeedProvider,
  upsertDittofeedProviderConfig,
} from "@/lib/dittofeed/provider";

const provisionSchema = z.object({
  externalId: z.string().trim().min(1).optional(),
  workspaceName: z.string().trim().min(1).optional(),
  adminApiKey: z.string().trim().min(1).optional(),
  smsWebhookSecret: z.string().trim().min(1).optional(),
  configureManagedEmail: z.boolean().optional().default(true),
});

async function loadOrganization(organizationId: string) {
  const [organization] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  return organization ?? null;
}

function getManagedResendConfig(provider: ResolvedDittofeedProvider) {
  if (!provider.resendApiKey) return null;
  return {
    apiKey: provider.resendApiKey,
    webhookKey: provider.resendWebhookKey,
  };
}

export const GET = withSuperAdminAuthRequired(async (_req, context) => {
  const { id } = (await context.params) as { id: string };
  const organization = await loadOrganization(id);

  if (!organization) {
    return NextResponse.json(
      { success: false, error: "Organization not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    organization,
    provider: await getRedactedDittofeedProviderForClient(id),
  });
}, "manage_integrations");

export const POST = withSuperAdminAuthRequired(async (req, context) => {
  const { id } = (await context.params) as { id: string };
  const organization = await loadOrganization(id);

  if (!organization) {
    return NextResponse.json(
      { success: false, error: "Organization not found" },
      { status: 404 }
    );
  }

  try {
    const body = provisionSchema.parse(await req.json());
    const existingProvider = await resolveDittofeedProviderForOrganizationAnyState(id);

    let createdWorkspace = false;
    let workspaceId = existingProvider?.workspaceId ?? null;
    let writeKey = existingProvider?.writeKey ?? null;
    let workspaceName = existingProvider?.workspaceName ?? null;
    let externalId = body.externalId ?? existingProvider?.externalId ?? organization.id;

    if (!workspaceId || !writeKey) {
      const workspace = await createDittofeedChildWorkspace({
        name: body.workspaceName ?? organization.name,
        externalId,
        baseUrl: existingProvider?.baseUrl,
      });

      createdWorkspace = true;
      workspaceId = workspace.id;
      writeKey = workspace.writeKey;
      workspaceName = workspace.name;
      externalId = workspace.externalId ?? externalId;
    }

    await upsertDittofeedProviderConfig({
      organizationId: id,
      isActive: true,
      mode: "agency_managed",
      configJson: {
        baseUrl: existingProvider?.baseUrl ?? process.env.DITTOFEED_BASE_URL,
        workspaceId,
        workspaceName: body.workspaceName ?? workspaceName ?? organization.name,
        externalId,
        writeKey,
        ...(body.adminApiKey ? { adminApiKey: body.adminApiKey } : {}),
        ...(body.smsWebhookSecret ? { smsWebhookSecret: body.smsWebhookSecret } : {}),
      },
    });

    const nextProvider = await resolveDittofeedProviderForOrganization(id);
    let emailStatus:
      | "configured"
      | "skipped_missing_admin_api_key"
      | "skipped_missing_resend_api_key"
      | "skipped_disabled" = "skipped_disabled";

    if (body.configureManagedEmail && nextProvider?.workspaceId) {
      if (!nextProvider.adminApiKey) {
        emailStatus = "skipped_missing_admin_api_key";
      } else {
        const resend = getManagedResendConfig(nextProvider);
        if (!resend) {
          emailStatus = "skipped_missing_resend_api_key";
        } else {
          await configureDittofeedResendEmailProvider({
            workspaceId: nextProvider.workspaceId,
            adminApiKey: nextProvider.adminApiKey,
            apiKey: resend.apiKey,
            webhookKey: resend.webhookKey,
            baseUrl: nextProvider.baseUrl,
          });
          emailStatus = "configured";
        }
      }
    }

    return NextResponse.json({
      success: true,
      organization,
      createdWorkspace,
      emailStatus,
      provider: await getRedactedDittofeedProviderForClient(id),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to provision Dittofeed";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}, "manage_integrations");
