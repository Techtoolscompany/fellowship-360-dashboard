import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  AccessToken,
  RoomAgentDispatch,
  RoomConfiguration,
} from "livekit-server-sdk";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { db } from "@/db";
import { aiConfig } from "@/db/schema";
import { resolveGeminiApiKey } from "@/lib/grace/providers/resolver";
import {
  buildGraceLivekitParticipantMetadata,
  GRACE_LIVEKIT_AGENT_NAME,
} from "@/lib/grace/livekit/shared";

type GraceLivekitSessionRequest = {
  roomName?: string;
  participantIdentity?: string;
  participantName?: string;
};

type GraceLivekitAvailability = {
  available: boolean;
  error?: string;
  livekitUrl?: string;
  livekitApiKey?: string;
  livekitApiSecret?: string;
};

function getTrimmedString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeLiveKitUrl(value: string | null) {
  if (!value) return null;
  if (value.startsWith("wss://") || value.startsWith("ws://")) {
    return value;
  }
  if (value.startsWith("https://")) {
    return `wss://${value.slice("https://".length)}`;
  }
  if (value.startsWith("http://")) {
    return `ws://${value.slice("http://".length)}`;
  }
  return null;
}

function getDisplayName(user: Record<string, unknown>) {
  const directName = getTrimmedString(user.name);
  if (directName) return directName;

  const firstName = getTrimmedString(user.firstName);
  const lastName = getTrimmedString(user.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;

  return getTrimmedString(user.email) ?? "Grace operator";
}

async function getGraceLivekitAvailability(organizationId: string): Promise<GraceLivekitAvailability> {
  const livekitUrl = normalizeLiveKitUrl(getTrimmedString(process.env.LIVEKIT_URL));
  const livekitApiKey = getTrimmedString(process.env.LIVEKIT_API_KEY);
  const livekitApiSecret = getTrimmedString(process.env.LIVEKIT_API_SECRET);

  if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
    return {
      available: false,
      error:
        "Grace voice requires LiveKit configuration. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.",
    };
  }

  const geminiKey = await resolveGeminiApiKey(organizationId);
  if (!geminiKey) {
    return {
      available: false,
      error:
        "Grace AI is not configured for this organization yet. Finish onboarding to enable chat and voice.",
    };
  }

  const [orgAiConfig] = await db
    .select()
    .from(aiConfig)
    .where(eq(aiConfig.organizationId, organizationId))
    .limit(1);

  if (orgAiConfig && (!orgAiConfig.graceEnabled || !orgAiConfig.internalGraceEnabled)) {
    return {
      available: false,
      error: "Grace AI is disabled for this organization.",
    };
  }

  return {
    available: true,
    livekitUrl,
    livekitApiKey,
    livekitApiSecret,
  };
}

export const GET = withOrganizationAuthRequired(async (_req, context) => {
  try {
    const organization = await context.session.organization;
    const availability = await getGraceLivekitAvailability(organization.id);

    return NextResponse.json(
      availability.available
        ? { available: true }
        : { available: false, error: availability.error },
      { status: availability.available ? 200 : 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        available: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to verify Grace LiveKit availability.",
      },
      { status: 500 }
    );
  }
}, OrganizationRole.enum.user);

export const POST = withOrganizationAuthRequired(async (req, context) => {
  try {
    const [organization, user] = await Promise.all([
      context.session.organization,
      context.session.user,
    ]);

    const body = (await req.json().catch(() => ({}))) as GraceLivekitSessionRequest;
    const availability = await getGraceLivekitAvailability(organization.id);

    if (!availability.available) {
      return NextResponse.json(
        {
          error: availability.error,
        },
        { status: 503 }
      );
    }

    const roomName =
      getTrimmedString(body.roomName) ?? `grace-${crypto.randomUUID()}`;
    const participantIdentity =
      getTrimmedString(body.participantIdentity) ??
      `grace-user-${user.id}-${crypto.randomUUID().slice(0, 8)}`;
    const participantName =
      getTrimmedString(body.participantName) ?? getDisplayName(user as Record<string, unknown>);

    const participantMetadata = buildGraceLivekitParticipantMetadata({
      organizationId: organization.id,
      userId: user.id,
      userName: participantName,
      graceThreadId: null,
      originSurface: "grace_command_center",
    });

    const token = new AccessToken(availability.livekitApiKey, availability.livekitApiSecret, {
      identity: participantIdentity,
      name: participantName,
      metadata: participantMetadata,
      attributes: {
        organizationId: organization.id,
        userId: user.id,
        userName: participantName,
        originSurface: "grace_command_center",
      },
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });
    token.roomConfig = new RoomConfiguration({
      name: roomName,
      agents: [
        new RoomAgentDispatch({
          agentName: GRACE_LIVEKIT_AGENT_NAME,
        }),
      ],
    });

    return NextResponse.json({
      serverUrl: availability.livekitUrl,
      participantToken: await token.toJwt(),
    });
  } catch (error) {
    console.error("Grace LiveKit session setup failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Grace LiveKit session.",
      },
      { status: 500 }
    );
  }
}, OrganizationRole.enum.user);
