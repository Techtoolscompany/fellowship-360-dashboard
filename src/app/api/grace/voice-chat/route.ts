import { NextResponse } from "next/server";
import { z } from "zod";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import { OrganizationRole } from "@/db/schema/organization";
import { db } from "@/db";
import { aiConfig } from "@/db/schema";
import { runGraceMessage } from "@/lib/grace/runtime";
import { computeWeeklyGivingReport } from "@/lib/finances/weekly-report";
import {
  buildVoiceWeeklyFinanceReply,
  extractWeeklyGivingReportFromActionOutcomes,
  isVoiceWeeklyFinanceSummaryQuery,
  resolveVoiceWeeklyFinanceRange,
} from "@/lib/finances/voice-query";
import { extractGraceAudioUpload } from "@/lib/grace/audio-upload";
import {
  resolveGeminiApiKey,
} from "@/lib/grace/providers/resolver";
import { buildGraceVoiceTranscriptionMessages } from "@/lib/grace/voice-transcription";
import { eq } from "drizzle-orm";
import { synthesizeSpeechWithGemini } from "@/lib/grace/gemini-tts";

const bodySchema = z.object({
  audioData: z.string().min(1, "Audio data is required"),
  audioMimeType: z.string().optional(),
  sessionId: z.string().optional(),
  originSurface: z.enum(["onboarding"]).optional(),
});

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

    const { base64Data: base64Audio, mimeType: audioMimeType } = extractGraceAudioUpload({
      audioData: body.audioData,
      declaredMimeType: body.audioMimeType,
    });

    const googleAI = createGoogleGenerativeAI({ apiKey: geminiKey });
    const { text: transcript } = await generateText({
      model: googleAI("gemini-2.5-flash"),
      system:
        "Transcribe the spoken audio exactly. Return plain text only with no commentary, markdown, or labels.",
      messages: buildGraceVoiceTranscriptionMessages({
        base64Audio,
        audioMediaType: audioMimeType,
      }),
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
      originSurface: body.originSurface,
    });

    if (result.availabilityStatus) {
      return NextResponse.json(
        {
          error: result.availabilityMessage ?? result.response,
          transcript: normalizedTranscript,
          replyText: result.response,
          sessionId: result.sessionId,
          proposedActionsCount: result.proposedActions.length,
          actionOutcomes: result.actionOutcomes,
          actionOutcomesCount: result.actionOutcomes.length,
          intent: result.intent,
          availabilityStatus: result.availabilityStatus,
        },
        { status: 503 }
      );
    }

    let replyText = result.response;
    const reportFromAction = extractWeeklyGivingReportFromActionOutcomes(
      result.actionOutcomes
    );

    if (reportFromAction) {
      replyText = buildVoiceWeeklyFinanceReply(reportFromAction);
    } else if (isVoiceWeeklyFinanceSummaryQuery(normalizedTranscript)) {
      try {
        const range = resolveVoiceWeeklyFinanceRange(normalizedTranscript);
        const report = await computeWeeklyGivingReport({
          organizationId: organization.id,
          startDate: range.startDate,
          endDate: range.endDate,
        });
        replyText = buildVoiceWeeklyFinanceReply(report);
      } catch (financeError) {
        console.error("Grace Voice weekly finance fallback failed:", financeError);
      }
    }

    let audioUrl: string;
    try {
      audioUrl = await synthesizeSpeechWithGemini({
        apiKey: geminiKey,
        text: replyText,
      });
    } catch (error) {
      console.error("Gemini TTS generation failed:", error);
      return NextResponse.json(
        { error: "Unable to generate GRACE voice response right now. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      transcript: normalizedTranscript,
      replyText,
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
