import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { aiConfig, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runGraceMessage } from "@/lib/grace/runtime";
import { rateLimitKeyed, verifyWebhookSignature } from "@/lib/grace/channels/webhooks";
import { getClientIp } from "@/lib/security/request";
import type { GraceActorType, GraceChannel } from "@/lib/grace/types";

export const runtime = "nodejs";

type OpenAiCompatibleMessage = {
  role?: string;
  content?: unknown;
};

type ElevenLabsCustomLlmBody = {
  messages?: OpenAiCompatibleMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  user_id?: string;
  elevenlabs_extra_body?: Record<string, unknown>;
};

function timingSafeEqualText(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function hasValidElevenLabsAuth(req: NextRequest, rawBody: string, secret: string) {
  const signature = req.headers.get("x-grace-signature");
  if (signature && verifyWebhookSignature(rawBody, signature, secret)) {
    return true;
  }

  const authorization = req.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearer && timingSafeEqualText(bearer, secret)) {
    return true;
  }

  const apiKey = req.headers.get("x-api-key")?.trim();
  return Boolean(apiKey && timingSafeEqualText(apiKey, secret));
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getMessageContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const candidate = part as Record<string, unknown>;
      return typeof candidate.text === "string" ? candidate.text : "";
    })
    .join("\n")
    .trim();
}

function resolveGraceVoiceContext(params: {
  searchParams: URLSearchParams;
  extraBody?: Record<string, unknown>;
}): {
  organizationId: string | null;
  sessionId?: string;
  actorType: GraceActorType;
  channel: GraceChannel;
  originSurface?: "onboarding";
} {
  const organizationId =
    getString(params.extraBody?.organizationId) ?? params.searchParams.get("orgId");
  const actorType =
    getString(params.extraBody?.actorType) === "staff" ? "staff" : "public";
  const requestedChannel = getString(params.extraBody?.channel);
  const channel: GraceChannel =
    actorType === "staff"
      ? requestedChannel === "voice" || requestedChannel === "voice_internal"
        ? requestedChannel
        : "voice_internal"
      : requestedChannel === "voice_public" || requestedChannel === "web_public"
        ? requestedChannel
        : "voice_public";

  return {
    organizationId,
    sessionId: getString(params.extraBody?.graceSessionId) ?? undefined,
    actorType,
    channel,
    originSurface:
      getString(params.extraBody?.originSurface) === "onboarding"
        ? "onboarding"
        : undefined,
  };
}

function buildChatCompletionStream(params: {
  responseText: string;
  model: string;
}) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const chunk = {
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: params.model,
        choices: [
          {
            delta: { content: params.responseText },
            index: 0,
            finish_reason: null,
          },
        ],
      };

      const doneChunk = {
        id: chunk.id,
        object: "chat.completion.chunk",
        created: chunk.created,
        model: params.model,
        choices: [
          {
            delta: {},
            index: 0,
            finish_reason: "stop",
          },
        ],
      };

      controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(doneChunk)}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

/**
 * ElevenLabs Custom LLM endpoint for Grace voice.
 * Authenticates with a shared secret, then routes the user's latest turn through
 * the shared Grace runtime. In-app signed sessions pass organization/session
 * context through elevenlabs_extra_body so the voice call reuses one Grace thread.
 *
 * ElevenLabs expects OpenAI-compatible SSE: one or more `data: {...}` chunks + `data: [DONE]`.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.ELEVENLABS_CHAT_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "ElevenLabs webhook secret is not configured." },
        { status: 503 }
      );
    }

    const rawBody = await req.text();
    if (!hasValidElevenLabsAuth(req, rawBody, secret)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    const key = `${getClientIp(req)}:elevenlabs-chat`;
    if (!(await rateLimitKeyed(key, 30, 60_000))) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const body = JSON.parse(rawBody) as ElevenLabsCustomLlmBody;
    const messages = body.messages ?? [];
    const { searchParams } = new URL(req.url);
    const graceContext = resolveGraceVoiceContext({
      searchParams,
      extraBody: body.elevenlabs_extra_body,
    });
    const orgId = graceContext.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { error: "Missing organization context for Grace voice." },
        { status: 400 }
      );
    }

    // Verify the org exists — prevents arbitrary orgId probing
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    const [config] = await db
      .select({
        graceEnabled: aiConfig.graceEnabled,
        internalGraceEnabled: aiConfig.internalGraceEnabled,
        publicGraceEnabled: aiConfig.publicGraceEnabled,
        publicWidgetEnabled: aiConfig.publicWidgetEnabled,
      })
      .from(aiConfig)
      .where(eq(aiConfig.organizationId, org.id))
      .limit(1);

    if (!config?.graceEnabled) {
      return NextResponse.json(
        { error: "Grace is disabled for this organization." },
        { status: 503 }
      );
    }

    if (graceContext.actorType === "staff" && !config.internalGraceEnabled) {
      return NextResponse.json(
        { error: "Internal Grace voice is disabled for this organization." },
        { status: 403 }
      );
    }

    if (
      graceContext.actorType === "public" &&
      (!config.publicGraceEnabled || !config.publicWidgetEnabled)
    ) {
      return NextResponse.json(
        { error: "Public Grace widget is disabled for this organization." },
        { status: 403 }
      );
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      return NextResponse.json({ error: "Invalid messages format." }, { status: 400 });
    }

    const message = getMessageContent(lastMessage.content);
    if (!message) {
      return NextResponse.json({ error: "Latest user message is empty." }, { status: 400 });
    }

    const result = await runGraceMessage({
      organizationId: org.id,
      channel: graceContext.channel,
      actorType: graceContext.actorType,
      message,
      sessionId: graceContext.sessionId,
      userId: getString(body.user_id) ?? undefined,
      originSurface: graceContext.originSurface,
    });

    const readableStream = buildChatCompletionStream({
      responseText: result.response,
      model: body.model || "grace-voice",
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[ElevenLabs Grace API Error]:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to process chat request." }, { status: 500 });
  }
}
