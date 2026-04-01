import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiConfig, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runGraceMessage } from "@/lib/grace/runtime";
import { rateLimitKeyed, verifyWebhookSignature } from "@/lib/grace/channels/webhooks";
import { getClientIp } from "@/lib/security/request";

export const runtime = "nodejs";

/**
 * ElevenLabs Custom LLM endpoint for the public Grace widget.
 * Authenticates by org ID query param + DB existence check, then routes through
 * the shared Grace runtime with public policy (actorType: "public", channel: "web_public").
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
    const signature = req.headers.get("x-grace-signature");
    const validSignature = verifyWebhookSignature(rawBody, signature, secret);
    if (!validSignature) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    const key = `${getClientIp(req)}:elevenlabs-chat`;
    if (!(await rateLimitKeyed(key, 30, 60_000))) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId query parameter." }, { status: 400 });
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
        publicGraceEnabled: aiConfig.publicGraceEnabled,
        publicWidgetEnabled: aiConfig.publicWidgetEnabled,
      })
      .from(aiConfig)
      .where(eq(aiConfig.organizationId, org.id))
      .limit(1);

    if (!config?.graceEnabled || !config.publicGraceEnabled || !config.publicWidgetEnabled) {
      return NextResponse.json(
        { error: "Public Grace widget is disabled for this organization." },
        { status: 403 }
      );
    }

    const body = JSON.parse(rawBody) as {
      messages?: Array<{ role: string; content: string }>;
    };
    const messages: Array<{ role: string; content: string }> = body.messages ?? [];

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
      return NextResponse.json({ error: "Invalid messages format." }, { status: 400 });
    }

    const result = await runGraceMessage({
      organizationId: org.id,
      channel: "web_public",
      actorType: "public",
      message: lastMessage.content,
    });

    const encoder = new TextEncoder();
    const responseText = result.response;

    const readableStream = new ReadableStream({
      start(controller) {
        const chunk = {
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: "grace-public",
          choices: [
            {
              delta: { content: responseText },
              index: 0,
              finish_reason: null,
            },
          ],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
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
