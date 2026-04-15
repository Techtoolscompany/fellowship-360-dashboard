import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { db } from "@/db";
import { aiConfig } from "@/db/schema";
import { getOrCreateGraceSession } from "@/lib/grace/runtime";
import { resolveElevenLabsVoiceProvider } from "@/lib/grace/providers/resolver";

export const runtime = "nodejs";

export const POST = withOrganizationAuthRequired(async (_req, context) => {
  try {
    const [organization, user] = await Promise.all([
      context.session.organization,
      context.session.user,
    ]);

    const [orgAiConfig] = await db
      .select({
        graceEnabled: aiConfig.graceEnabled,
        internalGraceEnabled: aiConfig.internalGraceEnabled,
      })
      .from(aiConfig)
      .where(eq(aiConfig.organizationId, organization.id))
      .limit(1);

    if (orgAiConfig && (!orgAiConfig.graceEnabled || !orgAiConfig.internalGraceEnabled)) {
      return NextResponse.json(
        { error: "Grace voice is disabled for this organization." },
        { status: 503 }
      );
    }

    const provider = await resolveElevenLabsVoiceProvider(organization.id);
    if (!provider) {
      return NextResponse.json(
        {
          error:
            "Grace ElevenLabs voice is not configured. Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID or configure the ElevenLabs voice provider.",
        },
        { status: 503 }
      );
    }

    const graceSession = await getOrCreateGraceSession({
      organizationId: organization.id,
      channel: "voice_internal",
      actorType: "staff",
    });

    const signedUrlResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(
        provider.agentId
      )}`,
      {
        headers: {
          "xi-api-key": provider.apiKey,
        },
      }
    );

    if (!signedUrlResponse.ok) {
      const text = await signedUrlResponse.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Unable to create ElevenLabs voice session (${signedUrlResponse.status}).`,
          detail: text.slice(0, 300) || null,
        },
        { status: 502 }
      );
    }

    const body = (await signedUrlResponse.json()) as { signed_url?: string };
    if (!body.signed_url) {
      return NextResponse.json(
        { error: "ElevenLabs did not return a signed voice URL." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      signedUrl: body.signed_url,
      agentId: provider.agentId,
      userId: user.id,
      graceSessionId: graceSession.id,
      customLlmExtraBody: {
        organizationId: organization.id,
        graceSessionId: graceSession.id,
        actorType: "staff",
        channel: "voice_internal",
        originSurface: "grace_command_center",
      },
    });
  } catch (error) {
    console.error("[Grace ElevenLabs session] setup failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Grace ElevenLabs voice session.",
      },
      { status: 500 }
    );
  }
}, OrganizationRole.enum.user);
