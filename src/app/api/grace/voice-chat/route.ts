import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { db } from "@/db";
import { aiConfig } from "@/db/schema";
import { runGraceMessage } from "@/lib/grace/runtime";
import {
  resolveElevenLabsApiKey,
  resolveGeminiApiKey,
} from "@/lib/grace/providers/resolver";
import { eq } from "drizzle-orm";

const bodySchema = z.object({
  audioData: z.string().min(1, "Audio data is required"),
  sessionId: z.string().optional(),
});

async function synthesizeSpeech(text: string, apiKey: string) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs API returned ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64Audio = Buffer.from(arrayBuffer).toString("base64");
  return `data:audio/mp3;base64,${base64Audio}`;
}

export const POST = withOrganizationAuthRequired(async (req, context) => {
  try {
    const body = bodySchema.parse(await req.json());
    const organization = await context.session.organization;
    const user = await context.session.user;

    const [orgAiConfig] = await db
      .select()
      .from(aiConfig)
      .where(eq(aiConfig.organizationId, organization.id))
      .limit(1);

    if (orgAiConfig && !orgAiConfig.graceEnabled) {
      return NextResponse.json({ error: "Grace AI is disabled for this organization." }, { status: 503 });
    }

    const [geminiKey, elevenLabsKey] = await Promise.all([
      resolveGeminiApiKey(organization.id),
      resolveElevenLabsApiKey(organization.id),
    ]);

    if (!geminiKey) {
      return NextResponse.json(
        { error: "Gemini is not configured for this organization." },
        { status: 400 }
      );
    }

    const base64Audio = body.audioData.includes(",")
      ? body.audioData.split(",")[1]
      : body.audioData;

    const googleAI = createGoogleGenerativeAI({ apiKey: geminiKey });
    const { text: transcript } = await generateText({
      model: googleAI("gemini-1.5-pro-latest"),
      system:
        "Transcribe the spoken audio exactly. Return plain text only with no commentary, markdown, or labels.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcribe this church staff voice note.",
            },
            {
              type: "file",
              data: base64Audio,
              mimeType: "audio/webm",
            } as never,
          ],
        },
      ],
    });

    const normalizedTranscript = transcript.trim();
    if (!normalizedTranscript) {
      return NextResponse.json(
        { error: "I could not understand that recording. Please try again." },
        { status: 400 }
      );
    }

    const result = await runGraceMessage({
      organizationId: organization.id,
      channel: "voice",
      message: normalizedTranscript,
      sessionId: body.sessionId,
      userId: user.id,
    });

    const audioUrl =
      elevenLabsKey && result.response
        ? await synthesizeSpeech(result.response, elevenLabsKey).catch((error) => {
            console.error("ElevenLabs TTS generation failed:", error);
            return null;
          })
        : null;

    return NextResponse.json({
      transcript: normalizedTranscript,
      replyText: result.response,
      audioUrl,
      sessionId: result.sessionId,
      proposedActionsCount: result.proposedActions.length,
      actionOutcomes: result.actionOutcomes,
      actionOutcomesCount: result.actionOutcomes.length,
      intent: result.intent,
    });
  } catch (error) {
    console.error("Grace Voice API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process voice command." },
      { status: 500 }
    );
  }
}, OrganizationRole.enum.user);
