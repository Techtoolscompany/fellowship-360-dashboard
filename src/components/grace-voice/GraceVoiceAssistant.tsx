"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleGenAI,
  Modality,
  type FunctionCall,
  type LiveServerMessage,
} from "@google/genai";
import {
  Loader2,
  Mic,
  RefreshCcw,
  Send,
  Sparkles,
  Square,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import {
  ManualAudioVisualizerAura,
  type ManualAudioVisualizerAuraPhase,
} from "@/components/agents-ui/agent-audio-visualizer-aura";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  GRACE_LIVE_TOOL_NAME,
  graceLiveToolDeclaration,
} from "@/lib/grace/live-config";
import type { GraceActionOutcome } from "@/lib/grace/types";
import { cn } from "@/lib/utils";

type GraceMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source: "voice" | "text";
  outcomes?: GraceActionOutcome[];
};

type GraceChatResponse = {
  response?: string;
  threadId?: string;
  sessionId?: string;
  actionOutcomes?: GraceActionOutcome[];
  intent?: string;
  error?: string;
};

type GraceLiveSessionResponse = {
  token?: string;
  model?: string;
  voiceName?: string;
  error?: string;
};

type GraceLiveSession = {
  sendRealtimeInput: (params: {
    audio?: {
      data: string;
      mimeType: string;
    };
    audioStreamEnd?: boolean;
  }) => void;
  sendToolResponse: (params: {
    functionResponses: Array<{
      id?: string;
      name?: string;
      response?: Record<string, unknown>;
    }>;
  }) => void;
  close: () => void;
};

type AudioContextWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export interface GraceVoiceAssistantProps {
  autoStart?: boolean;
  hideTitle?: boolean;
  onActionComplete?: () => void | Promise<void>;
  setupHref?: string;
  startSignal?: number;
}

const QUICK_PROMPTS = [
  "Who needs follow-up today?",
  "What should I handle before Sunday?",
  "Show me the biggest staff bottleneck.",
];

const IDLE_ACTIVITY_LEVEL = 0.08;
const LIVE_AUDIO_INPUT_SAMPLE_RATE = 16_000;
const LIVE_AUDIO_SAMPLE_RATE = 24_000;
const LIVE_AUDIO_CHANNELS = 1;
const LIVE_AUDIO_BYTES_PER_SAMPLE = 2;

function decodeBase64ToBytes(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeBytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return window.btoa(binary);
}

function convertFloat32ToPcm16(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate = LIVE_AUDIO_INPUT_SAMPLE_RATE
) {
  if (input.length === 0) {
    return new Int16Array(0);
  }

  if (inputSampleRate === outputSampleRate) {
    const output = new Int16Array(input.length);

    for (let index = 0; index < input.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, input[index] ?? 0));
      output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    return output;
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.round(input.length / sampleRateRatio));
  const output = new Int16Array(outputLength);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * sampleRateRatio);
    const end = Math.min(input.length, Math.floor((outputIndex + 1) * sampleRateRatio));

    let sum = 0;
    let count = 0;

    for (let inputIndex = start; inputIndex < Math.max(start + 1, end); inputIndex += 1) {
      sum += input[inputIndex] ?? 0;
      count += 1;
    }

    const average = Math.max(-1, Math.min(1, sum / Math.max(1, count)));
    output[outputIndex] = average < 0 ? average * 0x8000 : average * 0x7fff;
  }

  return output;
}

function encodePcm16ChunkToBase64(
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate = LIVE_AUDIO_INPUT_SAMPLE_RATE
) {
  const pcm16 = convertFloat32ToPcm16(input, inputSampleRate, outputSampleRate);
  const buffer = new ArrayBuffer(pcm16.length * 2);
  const view = new DataView(buffer);

  for (let index = 0; index < pcm16.length; index += 1) {
    view.setInt16(index * 2, pcm16[index] ?? 0, true);
  }

  return encodeBytesToBase64(new Uint8Array(buffer));
}

function writeAsciiString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function wrapPcm16AsWav(pcmData: Uint8Array) {
  const buffer = new ArrayBuffer(44 + pcmData.byteLength);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const byteRate =
    LIVE_AUDIO_SAMPLE_RATE * LIVE_AUDIO_CHANNELS * LIVE_AUDIO_BYTES_PER_SAMPLE;
  const blockAlign = LIVE_AUDIO_CHANNELS * LIVE_AUDIO_BYTES_PER_SAMPLE;

  writeAsciiString(view, 0, "RIFF");
  view.setUint32(4, 36 + pcmData.byteLength, true);
  writeAsciiString(view, 8, "WAVE");
  writeAsciiString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, LIVE_AUDIO_CHANNELS, true);
  view.setUint32(24, LIVE_AUDIO_SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, LIVE_AUDIO_BYTES_PER_SAMPLE * 8, true);
  writeAsciiString(view, 36, "data");
  view.setUint32(40, pcmData.byteLength, true);
  bytes.set(pcmData, 44);

  return bytes;
}

function createPlayableLiveAudioBlob(base64Data: string, mimeType?: string | null) {
  const normalizedMimeType =
    mimeType?.trim().toLowerCase().split(";", 1)[0] ?? "audio/wav";
  const bytes = decodeBase64ToBytes(base64Data);

  if (
    normalizedMimeType === "audio/pcm" ||
    normalizedMimeType === "audio/l16" ||
    normalizedMimeType === "audio/raw"
  ) {
    return new Blob([wrapPcm16AsWav(bytes)], { type: "audio/wav" });
  }

  return new Blob([bytes], { type: normalizedMimeType });
}

function isPermissionDeniedError(error: unknown) {
  return error instanceof DOMException && error.name === "NotAllowedError";
}

function isPlaybackBlockedError(error: unknown) {
  return error instanceof DOMException && error.name === "NotAllowedError";
}

function needsGraceOnboarding(message?: string | null) {
  const value = message?.toLowerCase() ?? "";
  return value.includes("finish onboarding") || value.includes("not configured");
}

function buildOutcomeLabel(outcome: GraceActionOutcome) {
  const toolName = outcome.tool.split(".").pop() ?? outcome.tool;
  return `${toolName} · ${outcome.status}`;
}

export function GraceVoiceAssistant({
  autoStart = false,
  hideTitle = false,
  onActionComplete,
  setupHref = "/app/get-started/concierge",
  startSignal = 0,
}: GraceVoiceAssistantProps) {
  const [messages, setMessages] = useState<GraceMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [voicePhase, setVoicePhase] = useState<ManualAudioVisualizerAuraPhase>("idle");
  const [activityLevel, setActivityLevel] = useState(IDLE_ACTIVITY_LEVEL);
  const [micPermission, setMicPermission] = useState<PermissionState | "unsupported" | "unknown">(
    "unknown"
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [isSendingText, setIsSendingText] = useState(false);
  const [latestTranscript, setLatestTranscript] = useState("");
  const [latestReply, setLatestReply] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainNodeRef = useRef<GainNode | null>(null);
  const activityFrameRef = useRef<number | null>(null);
  const autoStartedRef = useRef(false);
  const lastStartSignalRef = useRef(0);
  const threadIdRef = useRef<string | null>(null);
  const liveSessionRef = useRef<GraceLiveSession | null>(null);
  const liveQueueRef = useRef<string[]>([]);
  const liveCurrentAudioUrlRef = useRef<string | null>(null);
  const liveInputTranscriptRef = useRef("");
  const liveOutputTranscriptRef = useRef("");
  const pendingLiveActionOutcomesRef = useRef<GraceActionOutcome[]>([]);
  const deliberateSessionCloseRef = useRef(false);

  useEffect(() => {
    threadIdRef.current = threadId;
  }, [threadId]);

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant") ?? null,
    [messages]
  );

  const runActionRefresh = useCallback(
    async (outcomes?: GraceActionOutcome[]) => {
      if (!onActionComplete || !outcomes?.length) return;
      try {
        await onActionComplete();
      } catch (error) {
        console.error("Failed to refresh Grace workspace after action execution:", error);
      }
    },
    [onActionComplete]
  );

  const stopActivityLoop = useCallback(() => {
    if (activityFrameRef.current !== null) {
      window.cancelAnimationFrame(activityFrameRef.current);
      activityFrameRef.current = null;
    }
  }, []);

  const stopMicAnalysis = useCallback(() => {
    stopActivityLoop();
    processorNodeRef.current?.disconnect();
    processorNodeRef.current = null;
    silentGainNodeRef.current?.disconnect();
    silentGainNodeRef.current = null;
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    const currentContext = audioContextRef.current;
    audioContextRef.current = null;
    if (currentContext && currentContext.state !== "closed") {
      void currentContext.close().catch(() => undefined);
    }
  }, [stopActivityLoop]);

  const releaseMediaStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const clearLiveAudioQueue = useCallback(() => {
    if (liveCurrentAudioUrlRef.current) {
      URL.revokeObjectURL(liveCurrentAudioUrlRef.current);
      liveCurrentAudioUrlRef.current = null;
    }

    for (const queuedUrl of liveQueueRef.current) {
      URL.revokeObjectURL(queuedUrl);
    }
    liveQueueRef.current = [];
  }, []);

  const playNextQueuedAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (liveCurrentAudioUrlRef.current || liveQueueRef.current.length === 0) {
      return;
    }

    const nextUrl = liveQueueRef.current.shift();
    if (!nextUrl) return;

    liveCurrentAudioUrlRef.current = nextUrl;
    audio.src = nextUrl;

    try {
      await audio.play();
      setVoicePhase("speaking");
    } catch (error) {
      if (isPlaybackBlockedError(error)) {
        setErrorMessage("Grace voice playback was blocked by the browser.");
        setVoicePhase("error");
      }

      URL.revokeObjectURL(nextUrl);
      liveCurrentAudioUrlRef.current = null;

      if (liveQueueRef.current.length > 0) {
        void playNextQueuedAudio();
      } else if (isRecording) {
        setVoicePhase("listening");
      } else if (!isProcessingVoice) {
        setVoicePhase("idle");
      }
    }
  }, [isProcessingVoice, isRecording]);

  const enqueueLiveAudioChunk = useCallback(
    (base64Data: string, mimeType?: string | null) => {
      try {
        const audioBlob = createPlayableLiveAudioBlob(base64Data, mimeType);
        const audioUrl = URL.createObjectURL(audioBlob);
        liveQueueRef.current.push(audioUrl);
        void playNextQueuedAudio();
      } catch (error) {
        console.error("Grace live audio playback chunk failed:", error);
      }
    },
    [playNextQueuedAudio]
  );

  const interruptPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    }

    clearLiveAudioQueue();

    if (isRecording) {
      setVoicePhase("listening");
      return;
    }

    if (!isProcessingVoice) {
      setVoicePhase("idle");
    }
  }, [clearLiveAudioQueue, isProcessingVoice, isRecording]);

  const startMicAnalysis = useCallback(
    async (stream: MediaStream) => {
      stopMicAnalysis();
      const AudioContextCtor =
        window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;

      if (!AudioContextCtor) {
        return;
      }

      const context = new AudioContextCtor();
      await context.resume().catch(() => undefined);

      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;

      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const silentGain = context.createGain();
      silentGain.gain.value = 0;

      source.connect(analyser);
      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);

      processor.onaudioprocess = (event) => {
        const outputChannel = event.outputBuffer.getChannelData(0);
        outputChannel.fill(0);

        if (!liveSessionRef.current || deliberateSessionCloseRef.current) {
          return;
        }

        const inputChannel = event.inputBuffer.getChannelData(0);
        if (!inputChannel?.length) {
          return;
        }

        try {
          const pcmBase64 = encodePcm16ChunkToBase64(inputChannel, context.sampleRate);
          liveSessionRef.current.sendRealtimeInput({
            audio: {
              data: pcmBase64,
              mimeType: `audio/pcm;rate=${LIVE_AUDIO_INPUT_SAMPLE_RATE}`,
            },
          });
        } catch (error) {
          console.error("Grace live PCM encoding failed:", error);
          setErrorMessage("Grace live voice could not stream your microphone audio.");
          setVoicePhase("error");
        }
      };

      audioContextRef.current = context;
      analyserRef.current = analyser;
      sourceNodeRef.current = source;
      processorNodeRef.current = processor;
      silentGainNodeRef.current = silentGain;
    },
    [stopMicAnalysis]
  );

  const cancelActiveRecording = useCallback(() => {
    deliberateSessionCloseRef.current = true;

    try {
      liveSessionRef.current?.sendRealtimeInput({ audioStreamEnd: true });
    } catch {
      // Ignore shutdown ordering failures.
    }

    try {
      liveSessionRef.current?.close();
    } catch {
      // Ignore shutdown ordering failures.
    }

    liveSessionRef.current = null;

    clearLiveAudioQueue();
    stopMicAnalysis();
    releaseMediaStream();
    setIsRecording(false);
    setIsProcessingVoice(false);
    setVoicePhase("idle");
    setActivityLevel(IDLE_ACTIVITY_LEVEL);
  }, [clearLiveAudioQueue, releaseMediaStream, stopMicAnalysis]);

  const resetThread = useCallback(() => {
    interruptPlayback();
    cancelActiveRecording();
    setMessages([]);
    setTextInput("");
    setThreadId(null);
    setErrorMessage(null);
    setLatestTranscript("");
    setLatestReply("");
    setVoicePhase("idle");
    setActivityLevel(IDLE_ACTIVITY_LEVEL);
  }, [cancelActiveRecording, interruptPlayback]);

  const handleLiveToolCalls = useCallback(
    async (functionCalls: FunctionCall[]) => {
      if (functionCalls.length === 0) return;

      setIsProcessingVoice(true);
      setVoicePhase("thinking");

      const functionResponses: Array<{
        id?: string;
        name?: string;
        response?: Record<string, unknown>;
      }> = [];
      const collectedActionOutcomes: GraceActionOutcome[] = [];

      for (const functionCall of functionCalls) {
        const toolName = functionCall.name?.trim();
        const requestedMessage =
          typeof functionCall.args?.message === "string"
            ? functionCall.args.message.trim()
            : "";

        if (toolName !== GRACE_LIVE_TOOL_NAME || !requestedMessage) {
          functionResponses.push({
            id: functionCall.id,
            name: toolName ?? GRACE_LIVE_TOOL_NAME,
            response: {
              error:
                toolName !== GRACE_LIVE_TOOL_NAME
                  ? `Unsupported live tool request: ${toolName ?? "unknown"}`
                  : "Grace live tool call was missing a message argument.",
            },
          });
          continue;
        }

        try {
          const response = await fetch("/api/grace/live/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              threadId: threadIdRef.current ?? undefined,
              message: requestedMessage,
            }),
          });

          const payload = (await response.json()) as GraceChatResponse;
          const nextThreadId = payload.threadId ?? payload.sessionId ?? null;
          if (nextThreadId) {
            threadIdRef.current = nextThreadId;
            setThreadId(nextThreadId);
          }

          if (!response.ok) {
            functionResponses.push({
              id: functionCall.id,
              name: toolName,
              response: {
                error: payload.error || "Grace live tool execution failed.",
              },
            });
            continue;
          }

          const actionOutcomes = payload.actionOutcomes ?? [];
          collectedActionOutcomes.push(...actionOutcomes);
          functionResponses.push({
            id: functionCall.id,
            name: toolName,
            response: {
              response: payload.response ?? "",
              intent: payload.intent ?? null,
              actionOutcomes,
              threadId: nextThreadId,
            },
          });
        } catch (error) {
          functionResponses.push({
            id: functionCall.id,
            name: toolName ?? GRACE_LIVE_TOOL_NAME,
            response: {
              error:
                error instanceof Error
                  ? error.message
                  : "Grace live tool execution failed.",
            },
          });
        }
      }

      pendingLiveActionOutcomesRef.current = collectedActionOutcomes;
      await runActionRefresh(collectedActionOutcomes);

      if (liveSessionRef.current && functionResponses.length > 0) {
        liveSessionRef.current.sendToolResponse({ functionResponses });
      }

      setIsProcessingVoice(false);
      if (isRecording) {
        setVoicePhase("listening");
      }
    },
    [isRecording, runActionRefresh]
  );

  const handleLiveServerMessage = useCallback(
    (event: LiveServerMessage) => {
      if (event.toolCall?.functionCalls?.length) {
        void handleLiveToolCalls(event.toolCall.functionCalls);
      }

      const serverContent = event.serverContent;
      if (!serverContent) {
        return;
      }

      if (serverContent.interrupted) {
        interruptPlayback();
        liveOutputTranscriptRef.current = "";
      }

      const inputTranscription = serverContent.inputTranscription;
      if (typeof inputTranscription?.text === "string") {
        liveInputTranscriptRef.current = inputTranscription.text;
        setLatestTranscript(inputTranscription.text);
      }

      if (inputTranscription?.finished) {
        const transcript = liveInputTranscriptRef.current.trim();
        if (transcript) {
          setMessages((current) => [
            ...current,
            {
              id: `voice-user-${Date.now()}`,
              role: "user",
              content: transcript,
              source: "voice",
            },
          ]);
        }
        liveInputTranscriptRef.current = "";
      }

      const outputTranscription = serverContent.outputTranscription;
      if (typeof outputTranscription?.text === "string") {
        liveOutputTranscriptRef.current = outputTranscription.text;
        setLatestReply(outputTranscription.text);
      }

      for (const part of serverContent.modelTurn?.parts ?? []) {
        if (part.inlineData?.data) {
          enqueueLiveAudioChunk(part.inlineData.data, part.inlineData.mimeType ?? null);
          continue;
        }

        if (
          !outputTranscription?.text &&
          typeof part.text === "string" &&
          part.text.trim().length > 0
        ) {
          liveOutputTranscriptRef.current = `${liveOutputTranscriptRef.current}${part.text}`;
          setLatestReply(liveOutputTranscriptRef.current);
        }
      }

      if (outputTranscription?.finished) {
        const replyText = liveOutputTranscriptRef.current.trim();
        if (replyText) {
          const actionOutcomes = pendingLiveActionOutcomesRef.current;
          pendingLiveActionOutcomesRef.current = [];

          setMessages((current) => [
            ...current,
            {
              id: `voice-assistant-${Date.now()}`,
              role: "assistant",
              content: replyText,
              source: "voice",
              outcomes: actionOutcomes,
            },
          ]);
        }
        liveOutputTranscriptRef.current = "";
      }

      if (
        serverContent.turnComplete &&
        !liveCurrentAudioUrlRef.current &&
        liveQueueRef.current.length === 0 &&
        isRecording
      ) {
        setVoicePhase("listening");
      }
    },
    [enqueueLiveAudioChunk, handleLiveToolCalls, interruptPlayback, isRecording]
  );

  const startVoiceRecording = useCallback(async () => {
    if (isRecording || isProcessingVoice || isSendingText) return;

    const AudioContextCtor =
      typeof window === "undefined"
        ? null
        : window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;

    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      !AudioContextCtor
    ) {
      setErrorMessage("This browser cannot capture voice for Grace.");
      setVoicePhase("error");
      toast.error("This browser cannot capture voice for Grace.");
      return;
    }

    interruptPlayback();
    setErrorMessage(null);
    setLatestTranscript("");
    setLatestReply("");
    setVoicePhase("connecting");
    setIsProcessingVoice(true);

    let stream: MediaStream | null = null;
    let session: GraceLiveSession | null = null;

    try {
      const liveSessionResponse = await fetch("/api/grace/live/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const livePayload = (await liveSessionResponse.json()) as GraceLiveSessionResponse;

      if (!liveSessionResponse.ok || !livePayload.token || !livePayload.model) {
        throw new Error(livePayload.error || "Grace live voice is unavailable.");
      }

      const ai = new GoogleGenAI({
        apiKey: livePayload.token,
        httpOptions: { apiVersion: "v1alpha" },
      });

      deliberateSessionCloseRef.current = false;
      session = (await ai.live.connect({
        model: livePayload.model,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{ functionDeclarations: [graceLiveToolDeclaration] }],
          ...(livePayload.voiceName
            ? {
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: livePayload.voiceName,
                    },
                  },
                },
              }
            : {}),
        },
        callbacks: {
          onmessage: (event) => {
            handleLiveServerMessage(event);
          },
          onerror: (event) => {
            const message =
              event.error instanceof Error
                ? event.error.message
                : "Grace live voice encountered a connection error.";
            setErrorMessage(message);
            setVoicePhase("error");
          },
          onclose: () => {
            liveSessionRef.current = null;
            clearLiveAudioQueue();
            stopMicAnalysis();
            releaseMediaStream();
            setIsRecording(false);
            setIsProcessingVoice(false);
            setActivityLevel(IDLE_ACTIVITY_LEVEL);

            if (deliberateSessionCloseRef.current) {
              deliberateSessionCloseRef.current = false;
              setVoicePhase("idle");
              return;
            }

            if (voicePhase !== "error") {
              setVoicePhase("idle");
            }
          },
        },
      })) as GraceLiveSession;
      liveSessionRef.current = session;

      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission("granted");
      await startMicAnalysis(stream);
      mediaStreamRef.current = stream;
      setIsRecording(true);
      setIsProcessingVoice(false);
      setVoicePhase("listening");
      setActivityLevel(0.18);
    } catch (error) {
      deliberateSessionCloseRef.current = true;

      try {
        session?.close();
      } catch {
        // Ignore shutdown ordering failures.
      }
      liveSessionRef.current = null;

      stream?.getTracks().forEach((track) => track.stop());
      clearLiveAudioQueue();
      const blocked = isPermissionDeniedError(error);
      if (blocked) {
        setMicPermission("denied");
      }
      const message = blocked
        ? "Microphone access was blocked. Allow microphone access for this site and try again."
        : error instanceof Error
          ? error.message
          : "Grace could not start a live voice session.";
      setErrorMessage(message);
      setVoicePhase("error");
      stopMicAnalysis();
      releaseMediaStream();
      setIsRecording(false);
      setIsProcessingVoice(false);
      toast.error(message);
    }
  }, [
    clearLiveAudioQueue,
    handleLiveServerMessage,
    interruptPlayback,
    isProcessingVoice,
    isRecording,
    isSendingText,
    releaseMediaStream,
    startMicAnalysis,
    stopMicAnalysis,
    voicePhase,
  ]);

  const stopVoiceRecording = useCallback(() => {
    deliberateSessionCloseRef.current = true;

    try {
      liveSessionRef.current?.sendRealtimeInput({ audioStreamEnd: true });
    } catch {
      // Ignore shutdown ordering failures.
    }

    try {
      liveSessionRef.current?.close();
    } catch {
      // Ignore shutdown ordering failures.
    }
    liveSessionRef.current = null;

    clearLiveAudioQueue();
    stopMicAnalysis();
    releaseMediaStream();
    setIsRecording(false);
    setIsProcessingVoice(false);
    setVoicePhase("idle");
    setActivityLevel(IDLE_ACTIVITY_LEVEL);
  }, [clearLiveAudioQueue, releaseMediaStream, stopMicAnalysis]);

  const handleVoiceOrbPress = useCallback(() => {
    if (isRecording || liveSessionRef.current || voicePhase === "connecting") {
      stopVoiceRecording();
      return;
    }

    if (isProcessingVoice) {
      stopVoiceRecording();
      return;
    }

    void startVoiceRecording();
  }, [isProcessingVoice, isRecording, startVoiceRecording, stopVoiceRecording, voicePhase]);

  const handleSendText = useCallback(
    async (seedMessage?: string) => {
      const message = (seedMessage ?? textInput).trim();
      if (!message || isSendingText || isProcessingVoice) return;

      interruptPlayback();
      setErrorMessage(null);
      setLatestReply("");
      setLatestTranscript("");
      setIsSendingText(true);
      setTextInput(seedMessage ? textInput : "");

      const userMessage: GraceMessage = {
        id: `text-user-${Date.now()}`,
        role: "user",
        content: message,
        source: "text",
      };

      setMessages((current) => [...current, userMessage]);
      if (!seedMessage) {
        setTextInput("");
      }

      try {
        const response = await fetch("/api/grace/copilot/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId: threadId ?? undefined,
            message,
          }),
        });

        const payload = (await response.json()) as GraceChatResponse;

        if (!response.ok) {
          throw new Error(payload.error || "Grace is temporarily unavailable.");
        }

        if (payload.threadId || payload.sessionId) {
          setThreadId(payload.threadId ?? payload.sessionId ?? null);
        }

        const replyText =
          payload.response?.trim() || "I couldn't generate a response. Please try again.";

        setLatestReply(replyText);
        setMessages((current) => [
          ...current,
          {
            id: `text-assistant-${Date.now()}`,
            role: "assistant",
            content: replyText,
            source: "text",
            outcomes: payload.actionOutcomes ?? [],
          },
        ]);

        await runActionRefresh(payload.actionOutcomes);
      } catch (error) {
        setMessages((current) => current.filter((entry) => entry.id !== userMessage.id));
        const messageText =
          error instanceof Error ? error.message : "Grace is temporarily unavailable.";
        setErrorMessage(messageText);
        setVoicePhase("error");
        toast.error(messageText);
      } finally {
        setIsSendingText(false);
      }
    },
    [interruptPlayback, isProcessingVoice, isSendingText, runActionRefresh, textInput, threadId]
  );

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      setMicPermission("unsupported");
      return;
    }

    let permissionStatus: PermissionStatus | null = null;

    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((status) => {
        permissionStatus = status;
        setMicPermission(status.state);
        status.onchange = () => setMicPermission(status.state);
      })
      .catch(() => setMicPermission("unknown"));

    return () => {
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlaying = () => {
      setVoicePhase("speaking");
    };

    const handleEnded = () => {
      if (liveCurrentAudioUrlRef.current) {
        URL.revokeObjectURL(liveCurrentAudioUrlRef.current);
        liveCurrentAudioUrlRef.current = null;
      }

      if (liveQueueRef.current.length > 0) {
        void playNextQueuedAudio();
        return;
      }

      setVoicePhase(isRecording ? "listening" : "idle");
      setActivityLevel(IDLE_ACTIVITY_LEVEL);
    };

    const handlePause = () => {
      if (!liveCurrentAudioUrlRef.current && !isRecording && !isProcessingVoice) {
        setVoicePhase("idle");
        setActivityLevel(IDLE_ACTIVITY_LEVEL);
      }
    };

    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
    };
  }, [isProcessingVoice, isRecording, playNextQueuedAudio]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startVoiceRecording();
  }, [autoStart, startVoiceRecording]);

  useEffect(() => {
    if (startSignal <= 0 || startSignal === lastStartSignalRef.current) return;
    lastStartSignalRef.current = startSignal;
    void startVoiceRecording();
  }, [startSignal, startVoiceRecording]);

  useEffect(() => {
    stopActivityLoop();

    const tick = (timestamp: number) => {
      if (voicePhase === "listening" && analyserRef.current) {
        const analyser = analyserRef.current;
        const data = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(data);

        let sumSquares = 0;
        for (const sample of data) {
          const normalized = (sample - 128) / 128;
          sumSquares += normalized * normalized;
        }

        const rms = Math.sqrt(sumSquares / data.length);
        const nextLevel = Math.min(1, 0.16 + rms * 3.6);
        setActivityLevel(nextLevel);
      } else if (voicePhase === "thinking") {
        setActivityLevel(0.26 + (Math.sin(timestamp / 260) + 1) * 0.05);
      } else if (voicePhase === "speaking") {
        setActivityLevel(0.4 + (Math.sin(timestamp / 145) + 1) * 0.12);
      } else if (voicePhase === "connecting") {
        setActivityLevel(0.22 + (Math.sin(timestamp / 300) + 1) * 0.07);
      } else if (voicePhase === "error") {
        setActivityLevel(0.12);
      } else {
        setActivityLevel(IDLE_ACTIVITY_LEVEL);
      }

      activityFrameRef.current = window.requestAnimationFrame(tick);
    };

    activityFrameRef.current = window.requestAnimationFrame(tick);
    return stopActivityLoop;
  }, [stopActivityLoop, voicePhase]);

  // Unmount-only cleanup — use refs to avoid re-running this effect
  // whenever the callback identities change (which was cancelling active recordings).
  const cancelActiveRecordingRef = useRef(cancelActiveRecording);
  cancelActiveRecordingRef.current = cancelActiveRecording;
  const interruptPlaybackRef = useRef(interruptPlayback);
  interruptPlaybackRef.current = interruptPlayback;
  const stopMicAnalysisRef = useRef(stopMicAnalysis);
  stopMicAnalysisRef.current = stopMicAnalysis;
  const releaseMediaStreamRef = useRef(releaseMediaStream);
  releaseMediaStreamRef.current = releaseMediaStream;

  useEffect(() => {
    return () => {
      interruptPlaybackRef.current();
      cancelActiveRecordingRef.current();
      stopMicAnalysisRef.current();
      releaseMediaStreamRef.current();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setupRequired = needsGraceOnboarding(errorMessage);

  const statusLabel = useMemo(() => {
    if (voicePhase === "speaking") return "Speaking";
    if (isProcessingVoice || voicePhase === "thinking" || voicePhase === "connecting") {
      return voicePhase === "connecting" ? "Connecting" : "Thinking";
    }
    if (isRecording || voicePhase === "listening") return "Listening";
    if (voicePhase === "error") return "Needs attention";
    return "Ready";
  }, [isProcessingVoice, isRecording, voicePhase]);

  const statusDetail = useMemo(() => {
    if (errorMessage) return errorMessage;
    if (voicePhase === "speaking") return latestReply || "Speaking...";
    if (voicePhase === "connecting") return "Connecting Grace live voice...";
    if (isProcessingVoice || voicePhase === "thinking") return "Working...";
    if (isRecording || voicePhase === "listening") return "Listening...";
    if (micPermission === "denied") return "Microphone blocked";
    return latestAssistantMessage?.content || "Ready";
  }, [
    errorMessage,
    isProcessingVoice,
    isRecording,
    latestAssistantMessage?.content,
    latestReply,
    micPermission,
    voicePhase,
  ]);

  const primaryActionLabel =
    isRecording || liveSessionRef.current || voicePhase === "connecting" ? "End" : "Talk";

  return (
    <section className="mx-auto w-full max-w-6xl">
      {!hideTitle ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Grace Live</h2>
          </div>
          <Badge className="border-[#bbff00]/40 bg-[#bbff00]/10 text-[#6f8800] dark:text-[#d7ff6f]">
            {messages.length} messages
          </Badge>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[30px] border border-slate-900/10 bg-white shadow-[0_30px_120px_-40px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#09101f]">
        <div className="grid gap-0 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
          <div className="relative overflow-hidden border-b border-slate-900/8 bg-[radial-gradient(circle_at_top,#d7ff6f_0%,rgba(215,255,111,0.18)_16%,rgba(255,255,255,0)_42%),linear-gradient(180deg,#0e1727_0%,#07111e_100%)] px-5 py-5 text-white xl:border-b-0 xl:border-r xl:border-white/10 xl:px-6 xl:py-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_80%_15%,rgba(31,213,249,0.18),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(187,255,0,0.14),transparent_36%)]" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/10 backdrop-blur">
                    <Sparkles className="h-4 w-4 text-[#d7ff6f]" />
                  </span>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.28em] text-white/55">Grace</p>
                    <p className="text-sm font-semibold text-white">Voice command center</p>
                  </div>
                </div>
                <Badge className="border-white/15 bg-white/10 text-white/85 backdrop-blur">
                  {statusLabel}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full border border-white/10 bg-white/8 text-white hover:bg-white/15"
                  onClick={resetThread}
                  type="button"
                >
                  <RefreshCcw className="h-4 w-4" />
                  <span className="sr-only">Reset Grace thread</span>
                </Button>
              </div>
            </div>

            <div className="relative mt-4 flex flex-col items-center justify-center text-center">
              <button
                type="button"
                onClick={handleVoiceOrbPress}
                disabled={isProcessingVoice || isSendingText}
                className="group relative flex h-[208px] w-[208px] items-center justify-center rounded-full outline-none transition-transform duration-300 focus-visible:scale-[1.02] focus-visible:ring-4 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-70 sm:h-[228px] sm:w-[228px]"
                aria-label={isRecording ? "Stop Grace recording" : "Talk with Grace"}
              >
                <div className="absolute inset-0 rounded-full bg-white/6 blur-2xl transition-opacity duration-300 group-hover:opacity-90" />
                <ManualAudioVisualizerAura
                  size="lg"
                  phase={voicePhase}
                  activityLevel={activityLevel}
                  className="h-full w-full opacity-95 pointer-events-none"
                />
                <div className="absolute inset-[27%] rounded-full border border-white/15 bg-slate-950/55 backdrop-blur-xl shadow-[0_25px_80px_-25px_rgba(0,0,0,0.85)] pointer-events-none" />
                <div className="absolute inset-[34%] flex flex-col items-center justify-center rounded-full border border-white/10 bg-white/6 backdrop-blur pointer-events-none">
                  {isRecording ? (
                    <Square className="h-8 w-8 fill-[#d7ff6f] text-[#d7ff6f]" />
                  ) : isProcessingVoice ? (
                    <Loader2 className="h-8 w-8 animate-spin text-[#d7ff6f]" />
                  ) : voicePhase === "speaking" ? (
                    <Volume2 className="h-8 w-8 text-[#d7ff6f]" />
                  ) : (
                    <Mic className="h-8 w-8 text-[#d7ff6f]" />
                  )}
                  <span className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">
                    {primaryActionLabel}
                  </span>
                </div>
              </button>

              <div className="mt-5 max-w-md space-y-2">
                <p className="text-sm font-medium text-white/92">{statusDetail}</p>
                <p className="text-xs uppercase tracking-[0.28em] text-white/42">{statusLabel}</p>
              </div>
            </div>

            <div className="relative mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-white/10 bg-white/8 p-4 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Last heard</p>
                <p className="mt-2 min-h-[44px] text-sm text-white/90">
                  {latestTranscript || "Grace will show your latest voice transcript here."}
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/8 p-4 backdrop-blur">
                <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                  Latest reply
                </p>
                <p className="mt-2 min-h-[44px] text-sm text-white/90">
                  {latestReply || "Grace replies in voice first and keeps the answer here."}
                </p>
              </div>
            </div>

            <div className="relative mt-4 flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void handleSendText(prompt)}
                  disabled={isSendingText || isProcessingVoice}
                  className="rounded-full border border-white/12 bg-white/7 px-3 py-2 text-left text-xs font-medium text-white/82 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {errorMessage ? (
              <div className="relative mt-4 rounded-[22px] border border-rose-400/35 bg-rose-500/10 p-4 text-left">
                <p className="text-sm font-semibold text-rose-100">Grace needs attention</p>
                <p className="mt-1 text-sm text-rose-50/90">{errorMessage}</p>
                {setupRequired ? (
                  <div className="mt-3">
                    <Button
                      asChild
                      variant="secondary"
                      className="rounded-full bg-white text-slate-950 hover:bg-white/90"
                    >
                      <Link href={setupHref}>Finish Grace onboarding</Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex min-h-[520px] flex-col bg-slate-50/90 dark:bg-[#07101c]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-900/8 px-5 py-4 dark:border-white/10">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-slate-500">
                  Grace thread
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Conversation</p>
              </div>
              {threadId ? (
                <Badge variant="outline" className="rounded-full">
                  {threadId.slice(0, 8)}
                </Badge>
              ) : null}
            </div>

            <ScrollArea className="h-[300px] flex-1 px-5 py-5">
              {messages.length === 0 ? (
                <div className="flex h-full min-h-[180px] items-center justify-center text-center">
                  <div>
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
                      <Sparkles className="h-4 w-4 text-[#95b500]" />
                    </div>
                    <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                      Waiting for the first turn
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "max-w-[90%] rounded-[24px] px-4 py-3 shadow-sm",
                        message.role === "assistant"
                          ? "mr-auto border border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-white/6 dark:text-white"
                          : "ml-auto bg-slate-900 text-white dark:bg-[#c9ff4d] dark:text-slate-950"
                      )}
                    >
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] opacity-70">
                        <span>{message.role === "assistant" ? "Grace" : "You"}</span>
                        <span>•</span>
                        <span>{message.source}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                      {message.outcomes?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.outcomes.slice(0, 3).map((outcome) => (
                            <Badge
                              key={outcome.actionId}
                              variant="outline"
                              className="rounded-full bg-transparent text-[11px]"
                            >
                              {buildOutcomeLabel(outcome)}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <div ref={conversationEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="border-t border-slate-900/8 px-5 py-4 dark:border-white/10">
              <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
                <Textarea
                  ref={composerRef}
                  value={textInput}
                  onChange={(event) => setTextInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSendText();
                    }
                  }}
                  placeholder="Type a message to Grace"
                  className="min-h-[76px] resize-none border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <Button
                    variant="ghost"
                    className="h-8 rounded-full px-3"
                    onClick={() => void startVoiceRecording()}
                    disabled={isRecording || isProcessingVoice || isSendingText}
                    type="button"
                  >
                    <Mic className="h-4 w-4" />
                    Talk
                  </Button>

                  <Button
                    className="rounded-full bg-slate-950 text-white hover:bg-slate-800 dark:bg-[#d7ff6f] dark:text-slate-950 dark:hover:bg-[#c0f040]"
                    onClick={() => void handleSendText()}
                    disabled={!textInput.trim() || isSendingText || isProcessingVoice}
                    type="button"
                  >
                    {isSendingText ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send
                  </Button>
                </div>
              </div>

              {micPermission === "denied" ? (
                <p className="mt-3 text-xs text-rose-600 dark:text-rose-300">Microphone blocked</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <audio ref={audioRef} className="hidden" preload="none" />
    </section>
  );
}
