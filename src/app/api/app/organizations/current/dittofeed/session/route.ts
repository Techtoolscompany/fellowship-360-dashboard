import { NextResponse } from "next/server";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { createDittofeedSession, buildDittofeedEmbeddedUrls } from "@/lib/dittofeed/client";
import {
  getRedactedDittofeedProviderForClient,
  resolveDittofeedProviderForOrganization,
} from "@/lib/dittofeed/provider";

export const GET = withOrganizationAuthRequired(async (_req, context) => {
  const organization = await context.session.organization;
  const provider = await resolveDittofeedProviderForOrganization(organization.id);

  if (!provider) {
    return NextResponse.json(
      { success: false, error: "Dittofeed is not configured for this organization" },
      { status: 404 }
    );
  }

  if (!provider.workspaceId || !provider.writeKey) {
    return NextResponse.json(
      {
        success: false,
        error: "Dittofeed workspace is missing a workspace ID or write key",
      },
      { status: 409 }
    );
  }

  const session = await createDittofeedSession({
    workspaceId: provider.workspaceId,
    writeKey: provider.writeKey,
    baseUrl: provider.baseUrl,
  });

  return NextResponse.json({
    success: true,
    workspaceId: provider.workspaceId,
    baseUrl: provider.baseUrl,
    token: session.token,
    urls: buildDittofeedEmbeddedUrls({
      token: session.token,
      workspaceId: provider.workspaceId,
      baseUrl: provider.baseUrl,
    }),
    provider: await getRedactedDittofeedProviderForClient(organization.id),
  });
}, OrganizationRole.enum.user);
