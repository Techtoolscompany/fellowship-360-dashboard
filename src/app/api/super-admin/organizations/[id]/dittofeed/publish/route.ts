import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import { db } from "@/db";
import { organizations } from "@/db/schema/organization";
import { appConfig } from "@/lib/config";
import { publishDittofeedTemplatePack } from "@/lib/dittofeed/client";
import {
  getDittofeedTemplatePackByKey,
  getDittofeedTemplatePackCatalog,
  mergeDittofeedTemplatePackResources,
  materializeDittofeedTemplatePackResources,
  dittofeedTemplatePackResourcesSchema,
} from "@/lib/dittofeed/template-packs";
import {
  getRedactedDittofeedProviderForClient,
  resolveDittofeedProviderForOrganization,
} from "@/lib/dittofeed/provider";
import { resolveAppUrl } from "@/lib/security/app-url";

const publishSchema = z
  .object({
    packKey: z.string().trim().min(1).optional().default("church_messaging_baseline"),
    resources: dittofeedTemplatePackResourcesSchema.optional(),
    configureManagedEmail: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.packKey && !value.resources) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "packKey or resources is required",
      });
    }
  });

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

function hasWebhookTemplates(
  resources: ReturnType<typeof mergeDittofeedTemplatePackResources>
) {
  return Boolean(
    resources.templates?.some((template) => template.definition?.type === "Webhook")
  );
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

  const provider = await resolveDittofeedProviderForOrganization(id);

  return NextResponse.json({
    success: true,
    organization,
    catalog: getDittofeedTemplatePackCatalog(),
    workspaceId: provider?.workspaceId ?? null,
    adminApiKeyConfigured: Boolean(provider?.adminApiKey),
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
    const body = publishSchema.parse(await req.json());
    const provider = await resolveDittofeedProviderForOrganization(id);

    if (!provider?.workspaceId) {
      return NextResponse.json(
        { success: false, error: "Dittofeed workspace is not provisioned" },
        { status: 409 }
      );
    }

    if (!provider.adminApiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Dittofeed admin API key is not configured for this organization. Provision the workspace with an admin API key first.",
        },
        { status: 409 }
      );
    }

    const pack = body.packKey ? getDittofeedTemplatePackByKey(body.packKey) : null;
    if (body.packKey && !pack) {
      return NextResponse.json(
        { success: false, error: `Unknown Dittofeed pack: ${body.packKey}` },
        { status: 404 }
      );
    }

    let resources = mergeDittofeedTemplatePackResources(
      pack?.resources,
      body.resources
    );

    if (body.configureManagedEmail && provider.resendApiKey && !resources.emailProvider) {
      resources.emailProvider = {
        config: {
          type: "Resend",
          apiKey: provider.resendApiKey,
          ...(provider.resendWebhookKey
            ? { webhookKey: provider.resendWebhookKey }
            : {}),
        },
        setDefault: true,
      };
    }

    if (
      body.configureManagedEmail &&
      !resources.emailProvider &&
      !provider.resendApiKey
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Managed email was requested but no Resend API key is configured for Dittofeed",
        },
        { status: 409 }
      );
    }

    if (hasWebhookTemplates(resources)) {
      if (!provider.smsWebhookSecret) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Dittofeed SMS webhook secret is missing for this organization. Provision the workspace with an SMS webhook secret first.",
          },
          { status: 409 }
        );
      }

      const appUrl = resolveAppUrl(req);
      if (!appUrl) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A public app URL is required to publish Dittofeed SMS webhook templates. Set NEXT_PUBLIC_APP_URL or NEXTAUTH_URL.",
          },
          { status: 409 }
        );
      }

      resources = materializeDittofeedTemplatePackResources(resources, {
        appUrl,
        workspaceId: provider.workspaceId,
        smsWebhookSecret: provider.smsWebhookSecret,
        emailFrom:
          process.env.DITTOFEED_MANAGED_FROM_EMAIL?.trim() ||
          process.env.RESEND_FROM_EMAIL?.trim() ||
          `${appConfig.email.senderName} <${appConfig.email.senderEmail}>`,
        emailReplyTo:
          process.env.DITTOFEED_MANAGED_REPLY_TO_EMAIL?.trim() ||
          process.env.RESEND_REPLY_TO_EMAIL?.trim() ||
          appConfig.legal.email,
      });
    } else {
      resources = materializeDittofeedTemplatePackResources(resources, {
        emailFrom:
          process.env.DITTOFEED_MANAGED_FROM_EMAIL?.trim() ||
          process.env.RESEND_FROM_EMAIL?.trim() ||
          `${appConfig.email.senderName} <${appConfig.email.senderEmail}>`,
        emailReplyTo:
          process.env.DITTOFEED_MANAGED_REPLY_TO_EMAIL?.trim() ||
          process.env.RESEND_REPLY_TO_EMAIL?.trim() ||
          appConfig.legal.email,
      });
    }

    const result = await publishDittofeedTemplatePack({
      workspaceId: provider.workspaceId,
      adminApiKey: provider.adminApiKey,
      baseUrl: provider.baseUrl,
      resources,
    });

    return NextResponse.json({
      success: true,
      organization,
      packKey: pack?.key ?? null,
      result,
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
      error instanceof Error ? error.message : "Failed to publish Dittofeed pack";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}, "manage_integrations");
