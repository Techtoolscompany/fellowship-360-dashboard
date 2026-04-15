import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { Modality } from "@google/genai";
import {
  AutoSubscribe,
  cli,
  defineAgent,
  llm,
  log,
  type JobContext,
  ServerOptions,
  voice,
} from "@livekit/agents";
import * as google from "@livekit/agents-plugin-google";
import { z } from "zod";
import { db } from "../../../db";
import { aiConfig } from "../../../db/schema/ai-config";
import {
  buildGraceLiveSystemInstruction,
  DEFAULT_GEMINI_LIVE_MODEL,
  DEFAULT_GEMINI_LIVE_VOICE_NAME,
  GRACE_LIVE_TOOL_NAME,
  supportsAffectiveDialog,
} from "../live-config";
import { resolveGeminiApiKey } from "../providers/resolver";
import { runGraceMessage } from "../runtime";
import {
  getGraceLivekitParticipantContext,
  GRACE_LIVEKIT_AGENT_NAME,
} from "./shared";

async function loadGraceLivekitRuntimeContext(organizationId: string) {
  const [orgAiConfig] = await db
    .select()
    .from(aiConfig)
    .where(eq(aiConfig.organizationId, organizationId))
    .limit(1);

  if (orgAiConfig && (!orgAiConfig.graceEnabled || !orgAiConfig.internalGraceEnabled)) {
    throw new Error("Grace AI is disabled for this organization.");
  }

  const geminiApiKey = await resolveGeminiApiKey(organizationId);
  if (!geminiApiKey) {
    throw new Error(
      "Grace AI is not configured for this organization yet. Finish onboarding to enable voice."
    );
  }

  return {
    geminiApiKey,
    orgAiConfig: orgAiConfig ?? null,
  };
}

async function runGraceLivekitEntry(ctx: JobContext) {
  const logger = log().child({
    agent: GRACE_LIVEKIT_AGENT_NAME,
    room: ctx.job.room?.name ?? null,
  });

  await ctx.connect(undefined, AutoSubscribe.AUDIO_ONLY);

  const participant = await ctx.waitForParticipant();
  const participantContext = getGraceLivekitParticipantContext({
    metadata: participant.metadata,
    attributes: participant.attributes,
  });

  if (!participantContext) {
    throw new Error("Grace LiveKit participant metadata is missing organization context.");
  }

  const { geminiApiKey, orgAiConfig } = await loadGraceLivekitRuntimeContext(
    participantContext.organizationId
  );

  let graceThreadId = participantContext.graceThreadId ?? null;
  const systemInstruction = buildGraceLiveSystemInstruction({
    churchName:
      orgAiConfig?.churchName ??
      ctx.job.room?.name ??
      "your church",
    denomination: orgAiConfig?.churchDenomination ?? null,
    city: orgAiConfig?.churchCity ?? null,
    customPrompt: orgAiConfig?.customSystemPrompt ?? null,
  });

  const realtimeModel = new google.beta.realtime.RealtimeModel({
    apiKey: geminiApiKey,
    model: DEFAULT_GEMINI_LIVE_MODEL,
    voice: DEFAULT_GEMINI_LIVE_VOICE_NAME,
    modalities: [Modality.AUDIO, Modality.TEXT],
    instructions: systemInstruction,
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    temperature: orgAiConfig?.temperatureOverride ?? 0.5,
    ...(supportsAffectiveDialog(DEFAULT_GEMINI_LIVE_MODEL)
      ? { enableAffectiveDialog: true }
      : {}),
  });

  const graceCommandTool = llm.tool({
    description:
      "Use this for Fellowship 360 CRM work or church-specific questions, including contact lookups, notes, scheduling, follow-up tasks, workflows, and operational staff requests.",
    parameters: z.object({
      message: z.string().min(1).describe("The user's request as a concise Grace CRM command."),
    }),
    execute: async ({ message }) => {
      const result = await runGraceMessage({
        organizationId: participantContext.organizationId,
        channel: "voice_internal",
        actorType: "staff",
        message,
        sessionId: graceThreadId ?? undefined,
        userId: participantContext.userId,
      });

      if (result.threadId && result.threadId !== graceThreadId) {
        graceThreadId = result.threadId;
        participantContext.graceThreadId = result.threadId;
        await ctx.room.localParticipant?.setAttributes({
          graceThreadId: result.threadId,
          "grace.thread_id": result.threadId,
        });
      }

      return {
        response: result.response,
        intent: result.intent,
        threadId: result.threadId,
        sessionId: result.sessionId,
        actionOutcomes: result.actionOutcomes,
        workflowDecision: result.workflowDecision,
        workflowStart: result.workflowStart,
      };
    },
  });

  const agent = new voice.Agent({
    instructions: [
      systemInstruction,
      `For any church-specific or CRM request, call the ${GRACE_LIVE_TOOL_NAME} tool instead of answering from memory.`,
      "You may answer lightweight conversational turns directly when no CRM or church data is required.",
      "Keep spoken answers concise and natural.",
    ].join("\n\n"),
    tools: {
      [GRACE_LIVE_TOOL_NAME]: graceCommandTool,
    },
  });

  const session = new voice.AgentSession({
    llm: realtimeModel,
    maxToolSteps: 4,
    turnHandling: {
      turnDetection: "realtime_llm",
      interruption: {
        enabled: true,
      },
    },
    userData: participantContext,
  });

  session.on(voice.AgentSessionEventTypes.Error, (event) => {
    logger.error({ error: event.error }, "Grace LiveKit session error");
  });

  ctx.addShutdownCallback(async () => {
    await session.close().catch(() => undefined);
    await realtimeModel.close().catch(() => undefined);
  });

  await session.start({
    agent,
    room: ctx.room,
  });

  await new Promise<void>((resolve) => {
    session.once(voice.AgentSessionEventTypes.Close, () => resolve());
  });
}

export default defineAgent({
  entry: runGraceLivekitEntry,
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(
    new ServerOptions({
      agent: fileURLToPath(import.meta.url),
      agentName: GRACE_LIVEKIT_AGENT_NAME,
    })
  );
}
