import { NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";
import { eq } from "drizzle-orm";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { db } from "@/db";
import { aiConfig } from "@/db/schema";
import { resolveGeminiApiKey } from "@/lib/grace/providers/resolver";
import {
  buildGraceLiveSystemInstruction,
  DEFAULT_GEMINI_LIVE_MODEL,
  DEFAULT_GEMINI_LIVE_VOICE_NAME,
  graceLiveToolDeclaration,
  supportsAffectiveDialog,
} from "@/lib/grace/live-config";

export const POST = withOrganizationAuthRequired(async (_req, context) => {
  try {
    const organization = await context.session.organization;
    const geminiKey = await resolveGeminiApiKey(organization.id);

    if (!geminiKey) {
      return NextResponse.json(
        {
          error:
            "Grace AI is not configured for this organization yet. Finish onboarding to enable chat and voice.",
        },
        { status: 503 }
      );
    }

    const [orgAiConfig] = await db
      .select()
      .from(aiConfig)
      .where(eq(aiConfig.organizationId, organization.id))
      .limit(1);

    if (orgAiConfig && !orgAiConfig.graceEnabled) {
      return NextResponse.json(
        { error: "Grace AI is disabled for this organization." },
        { status: 503 }
      );
    }

    const model = DEFAULT_GEMINI_LIVE_MODEL;
    const voiceName = DEFAULT_GEMINI_LIVE_VOICE_NAME;
    const systemInstruction = buildGraceLiveSystemInstruction({
      churchName: orgAiConfig?.churchName ?? "your church",
      denomination: orgAiConfig?.churchDenomination ?? null,
      city: orgAiConfig?.churchCity ?? null,
      customPrompt: orgAiConfig?.customSystemPrompt ?? null,
    });

    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: { apiVersion: "v1alpha" },
    });

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        newSessionExpireTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction,
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            tools: [{ functionDeclarations: [graceLiveToolDeclaration] }],
            temperature: 0.5,
            ...(supportsAffectiveDialog(model)
              ? { enableAffectiveDialog: true }
              : {}),
          },
        },
      },
    });

    if (!token.name) {
      throw new Error("Gemini did not return an ephemeral token.");
    }

    return NextResponse.json({
      token: token.name,
      model,
      voiceName,
    });
  } catch (error) {
    console.error("Grace live session setup failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create live session." },
      { status: 500 }
    );
  }
}, OrganizationRole.enum.user);
