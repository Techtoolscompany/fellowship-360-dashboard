import { NextResponse } from "next/server";
import { z } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import {
  getGracePolicyConfig,
  getGraceProviderConfigs,
  updateGracePolicyConfig,
  upsertGraceProviderConfig,
} from "@/app/actions/grace";

const updateSchema = z.object({
  policy: z
    .object({
      approvalsEnabled: z.boolean().optional(),
      autoEscalateOnEmergency: z.boolean().optional(),
      confidenceThreshold: z.string().optional(),
      highRiskTools: z.array(z.string()).optional(),
      allowedPublicTools: z.array(z.string()).optional(),
    })
    .optional(),
  providers: z
    .array(
      z.object({
        channel: z.string(),
        provider: z.string(),
        mode: z.enum(["agency_managed", "byo", "disabled"]),
        isActive: z.boolean().optional(),
        configJson: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
});

export const GET = withOrganizationAuthRequired(async (_req, context) => {
  const organization = await context.session.organization;
  const [policy, providers] = await Promise.all([
    getGracePolicyConfig(organization.id),
    getGraceProviderConfigs(organization.id),
  ]);

  return NextResponse.json({ policy, providers });
}, OrganizationRole.enum.admin);

export const PATCH = withOrganizationAuthRequired(async (req, context) => {
  const organization = await context.session.organization;
  const body = updateSchema.parse(await req.json());

  const results: { policy?: unknown; providers?: unknown[] } = {};
  try {
    if (body.policy) {
      results.policy = await updateGracePolicyConfig({
        organizationId: organization.id,
        ...body.policy,
      });
    }

    if (body.providers?.length) {
      results.providers = [];
      for (const provider of body.providers) {
        const updated = await upsertGraceProviderConfig({
          organizationId: organization.id,
          ...provider,
        });
        results.providers.push(updated);
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update GRACE config";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}, OrganizationRole.enum.admin);
