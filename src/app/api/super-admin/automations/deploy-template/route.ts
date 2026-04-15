import { NextResponse } from "next/server";
import { z } from "zod";
import withSuperAdminAuthRequired from "@/lib/auth/withSuperAdminAuthRequired";
import { listAutomationLibraryTemplates } from "@/lib/automations/template-registry";
import { deployAutomationTemplateBatch } from "@/lib/super-admin/deploy-template";

const deploySchema = z.object({
  templateKey: z.string().min(1),
  organizationIds: z.array(z.string().min(1)).min(1).max(500),
  skipIfInstalled: z.boolean().optional().default(true),
});

export const GET = withSuperAdminAuthRequired(async () => {
  const templates = (await listAutomationLibraryTemplates()).map((template) => ({
    key: template.key,
    name: template.name,
    description: template.description,
    category: template.category,
    triggerEvent: template.triggerEvent,
    nodeCount: template.definition.nodes.length,
    source: template.source,
    status: template.status,
  }));

  return NextResponse.json({
    success: true,
    templates,
  });
}, "deploy_automations");

export const POST = withSuperAdminAuthRequired(async (req, context) => {
  try {
    const parsed = deploySchema.parse(await req.json());
    const actor = await context.session.user;

    const result = await deployAutomationTemplateBatch({
      request: parsed,
      actor: {
        userId: actor.id,
        email: actor.email,
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to deploy automation template";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}, "deploy_automations");
