import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { executePlannedActions } from "@/lib/grace/router/executor";
import { getOrCreateGraceSession, loadOrgPolicy } from "@/lib/grace/runtime";
import { findGraceTool } from "@/lib/grace/tools/registry";

const bodySchema = z.object({
  sessionId: z.string().optional(),
  contactId: z.string().nullable().optional(),
  input: z.record(z.string(), z.unknown()).default({}),
  channel: z.enum(["voice", "sms", "web", "in_app"]).optional(),
});

async function handler(
  req: NextRequest,
  context: {
    params: Promise<Record<string, unknown>>;
    session: {
      organization: Promise<{ id: string }>;
      user: Promise<{ id: string }>;
    };
  }
) {
  const params = (await context.params) as { tool?: string[] };
  const tool = params.tool?.join(".");

  if (!tool) {
    return NextResponse.json({ error: "Tool name is required" }, { status: 400 });
  }

  const org = await context.session.organization;
  const user = await context.session.user;

  const body = req.method === "GET"
    ? {
        input: Object.fromEntries(req.nextUrl.searchParams.entries()),
        sessionId: req.nextUrl.searchParams.get("sessionId") ?? undefined,
        contactId: req.nextUrl.searchParams.get("contactId") ?? undefined,
        channel: (req.nextUrl.searchParams.get("channel") as
          | "voice"
          | "sms"
          | "web"
          | "in_app"
          | null) ?? undefined,
      }
    : bodySchema.parse(await req.json());

  const session = await getOrCreateGraceSession({
    organizationId: org.id,
    channel: body.channel ?? "in_app",
    actorType: "staff",
    sessionId: body.sessionId,
    contactId: body.contactId ?? null,
  });

  const resolvedTool = findGraceTool(tool);
  if (!resolvedTool) {
    return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 404 });
  }

  const policy = await loadOrgPolicy(org.id);
  const action = {
    id: crypto.randomUUID(),
    tool,
    input: body.input,
    reason: "direct_tool_api_request",
    requiresApproval: resolvedTool.requiresApproval ?? false,
  };

  const execution = await executePlannedActions({
    actions: [action],
    context: {
      organizationId: org.id,
      sessionId: session.id,
      channel: body.channel ?? "in_app",
      actorType: "staff",
      userId: user.id,
      contactId: body.contactId ?? null,
      policy,
    },
  });

  if (execution.queuedApprovals.length > 0) {
    return NextResponse.json({
      success: true,
      queuedApproval: true,
      approvalIds: execution.queuedApprovals,
      actionOutcomes: execution.actionOutcomes,
      sessionId: session.id,
    });
  }

  const [result] = execution.results;
  if (!result?.success) {
    return NextResponse.json(
      { error: result?.error || "Tool execution failed" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    output: result.output,
    actionOutcomes: execution.actionOutcomes,
    sessionId: session.id,
  });
}

export const GET = withOrganizationAuthRequired(handler, OrganizationRole.enum.user);
export const POST = withOrganizationAuthRequired(handler, OrganizationRole.enum.user);
