import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient, ChatMessage } from "@/lib/ai/gemini-client";
import { buildChurchContext } from "@/lib/ai/context-manager";

export const runtime = "nodejs";

/**
 * Handle incoming chat requests from ElevenLabs.
 * This acts as the Custom LLM server.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate or get context org ID
    // Note: For ElevenLabs webhook, it cannot hit an authenticated route easily without a static token.
    // For MVP/Demo: we can pass orgId in the URL query string: ?orgId=... or grab the default org
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get("orgId");
    
    // If not using searchParams, we could verify an API key in headers if configured in ElevenLabs secret
    
    if (!orgId) {
      return NextResponse.json({ error: "Missing orgId." }, { status: 400 });
    }

    // 2. Parse the ElevenLabs request
    const body = await req.json();
    const messages = body.messages || [];
    
    // The last message is the user intent
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user") {
       return NextResponse.json({ error: "Invalid messages format." }, { status: 400 });
    }

    const userMessage = lastMessage.content;
    const history: ChatMessage[] = messages.slice(0, -1).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      content: m.content || "",
    }));

    // 3. Build Church Context
    console.log(`[ElevenLabs] Fetching church context for org: ${orgId}`);
    const contextData = await buildChurchContext(orgId);

    // 4. Stream Response from Gemini back to ElevenLabs
    const client = getGeminiClient();
    const stream = client.chatStream(userMessage, history, contextData);

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Iterate over Gemini stream chunks
          for await (const chunk of stream) {
            // ElevenLabs expects Server-Sent Events (SSE) format identical to OpenAI
            const data = {
              id: "chatcmpl-" + Date.now(),
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: "gemini-2.0-flash", // Our backend model
              choices: [
                {
                  delta: { content: chunk },
                  index: 0,
                  finish_reason: null,
                },
              ],
            };
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          }
          
          // Send final [DONE] message
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("[ElevenLabs Stream Error]:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("[ElevenLabs API Error]:", error);
    return NextResponse.json(
      { error: "Failed to process chat request." },
      { status: 500 }
    );
  }
}
