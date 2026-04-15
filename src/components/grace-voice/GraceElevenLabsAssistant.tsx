"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ConversationProvider,
  useConversationControls,
  useConversationInput,
  useConversationMode,
  useConversationStatus,
  type ConversationProviderProps,
} from "@elevenlabs/react";
import {
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCcw,
  Send,
  Sparkles,
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
import { cn } from "@/lib/utils";

type ElevenLabsMessage = Parameters<
  NonNullable<ConversationProviderProps["onMessage"]>
>[0];

type GraceElevenLabsSessionResponse = {
  signedUrl?: string;
  userId?: string;
  graceSessionId?: string;
  customLlmExtraBody?: Record<string, string | number | boolean>;
  error?: string;
  detail?: string | null;
};

type GraceVoiceMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export interface GraceElevenLabsAssistantProps {
  autoStart?: boolean;
  hideTitle?: boolean;
  onActionComplete?: () => void | Promise<void>;
  setupHref?: string;
  startSignal?: number;
}

const QUICK_PROMPTS = [
  "Who needs follow-up today?",
  "What should I handle before Sunday?",
  "Summarize the highest priority Grace work.",
];

function needsGraceVoiceSetup(message?: string | null) {
  const value = message?.toLowerCase() ?? "";
  return (
    value.includes("elevenlabs") ||
    value.includes("not configured") ||
    value.includes("voice is disabled")
  );
}

function mapPhase(params: {
  status: string;
  isSpeaking: boolean;
  isListening: boolean;
  isStarting: boolean;
  errorMessage: string | null;
}): ManualAudioVisualizerAuraPhase {
  if (params.errorMessage) return "error";
  if (params.isStarting || params.status === "connecting") return "thinking";
  if (params.isSpeaking) return "speaking";
  if (params.isListening || params.status === "connected") return "listening";
  return "idle";
}

type GraceElevenLabsAssistantInnerProps = GraceElevenLabsAssistantProps & {
  messages: GraceVoiceMessage[];
  setMessages: Dispatch<SetStateAction<GraceVoiceMessage[]>>;
  conversationId: string | null;
  setConversationId: Dispatch<SetStateAction<string | null>>;
};

function GraceElevenLabsAssistantInner({
  autoStart = false,
  hideTitle = false,
  messages,
  onActionComplete,
  conversationId,
  setConversationId,
  setMessages,
  setupHref = "/app/settings/integrations",
  startSignal = 0,
}: GraceElevenLabsAssistantInnerProps) {
  const { startSession, endSession, sendUserMessage, sendUserActivity } =
    useConversationControls();
  const { status } = useConversationStatus();
  const { isMuted, setMuted } = useConversationInput();
  const { isSpeaking, isListening } = useConversationMode();
  const [textInput, setTextInput] = useState("");
  const [graceSessionId, setGraceSessionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSendingText, setIsSendingText] = useState(false);
  const autoStartedRef = useRef(false);
  const lastStartSignalRef = useRef(0);

  const isConnected = status === "connected";
  const phase = mapPhase({
    status,
    isSpeaking,
    isListening,
    isStarting,
    errorMessage,
  });

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant") ?? null,
    [messages]
  );

  const startGraceVoice = useCallback(async () => {
    if (status === "connected" || status === "connecting" || isStarting) {
      return;
    }

    setIsStarting(true);
    setErrorMessage(null);

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const response = await fetch("/api/grace/elevenlabs/session", {
        method: "POST",
      });
      const payload = (await response.json()) as GraceElevenLabsSessionResponse;

      if (!response.ok || !payload.signedUrl) {
        throw new Error(payload.error || "Unable to start Grace voice.");
      }

      setGraceSessionId(payload.graceSessionId ?? null);
      startSession({
        signedUrl: payload.signedUrl,
        userId: payload.userId,
        customLlmExtraBody: payload.customLlmExtraBody,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start Grace voice.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsStarting(false);
    }
  }, [isStarting, startSession, status]);

  const stopGraceVoice = useCallback(async () => {
    try {
      endSession();
      await onActionComplete?.();
    } catch (error) {
      console.error("Failed to end Grace ElevenLabs session:", error);
    } finally {
      setConversationId(null);
    }
  }, [endSession, onActionComplete]);

  const resetConversation = useCallback(() => {
    endSession();
    setMessages([]);
    setTextInput("");
    setConversationId(null);
    setGraceSessionId(null);
    setErrorMessage(null);
  }, [endSession]);

  const sendText = useCallback(async () => {
    const value = textInput.trim();
    if (!value || !isConnected) return;

    setIsSendingText(true);
    try {
      sendUserMessage(value);
      setTextInput("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to send that message.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSendingText(false);
    }
  }, [isConnected, sendUserMessage, textInput]);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startGraceVoice();
  }, [autoStart, startGraceVoice]);

  useEffect(() => {
    if (startSignal === 0 || startSignal === lastStartSignalRef.current) return;
    lastStartSignalRef.current = startSignal;
    void startGraceVoice();
  }, [startGraceVoice, startSignal]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="grid gap-0 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col items-center justify-center gap-5 border-b border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/60 lg:border-b-0 lg:border-r">
          {!hideTitle ? (
            <div>
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                <Sparkles className="h-4 w-4" />
                Grace Voice
              </div>
              <h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
                Executive assistant mode
              </h3>
            </div>
          ) : null}

          <ManualAudioVisualizerAura phase={phase} activityLevel={0.4} />

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant={isConnected ? "default" : "secondary"}>
              {isConnected ? "Connected" : status}
            </Badge>
            {graceSessionId ? (
              <Badge variant="outline">Grace session active</Badge>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {!isConnected ? (
              <Button onClick={startGraceVoice} disabled={isStarting || status === "connecting"}>
                {isStarting || status === "connecting" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Mic className="mr-2 h-4 w-4" />
                )}
                Wake Grace
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopGraceVoice}>
                <PhoneOff className="mr-2 h-4 w-4" />
                End voice
              </Button>
            )}

            <Button
              variant="outline"
              disabled={!isConnected}
              onClick={() => setMuted(!isMuted)}
            >
              {isMuted ? (
                <MicOff className="mr-2 h-4 w-4" />
              ) : (
                <Volume2 className="mr-2 h-4 w-4" />
              )}
              {isMuted ? "Unmute" : "Mute"}
            </Button>

            <Button variant="ghost" size="icon" onClick={resetConversation}>
              <RefreshCcw className="h-4 w-4" />
              <span className="sr-only">Reset Grace voice</span>
            </Button>
          </div>

          {errorMessage ? (
            <div className="max-w-md rounded-lg border border-rose-200 bg-rose-50 p-3 text-left text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
              <p>{errorMessage}</p>
              {needsGraceVoiceSetup(errorMessage) ? (
                <Button asChild variant="link" className="mt-2 h-auto p-0 text-rose-700 dark:text-rose-200">
                  <Link href={setupHref}>Open voice provider settings</Link>
                </Button>
              ) : null}
            </div>
          ) : latestAssistantMessage ? (
            <p className="max-w-md text-sm text-slate-600 dark:text-slate-300">
              {latestAssistantMessage.content}
            </p>
          ) : (
            <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
              Speak naturally. Grace will use Fellowship 360 data and approvals before taking action.
            </p>
          )}
        </div>

        <div className="flex min-h-[420px] flex-col">
          <ScrollArea className="flex-1 p-5">
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[260px] flex-col justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                <p>Try one of these:</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <Button
                      key={prompt}
                      variant="outline"
                      size="sm"
                      disabled={!isConnected}
                      onClick={() => sendUserMessage(prompt)}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm",
                      message.role === "assistant"
                        ? "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-100"
                        : "ml-auto max-w-[85%] bg-emerald-600 text-white"
                    )}
                  >
                    {message.content}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            <div className="flex gap-2">
              <Textarea
                value={textInput}
                onChange={(event) => {
                  setTextInput(event.target.value);
                  if (isConnected) {
                    sendUserActivity();
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendText();
                  }
                }}
                disabled={!isConnected}
                placeholder={
                  isConnected
                    ? "Type to Grace during the voice session..."
                    : "Start voice to type into the same Grace session"
                }
                className="min-h-[44px] resize-none"
              />
              <Button
                type="button"
                onClick={() => void sendText()}
                disabled={!isConnected || !textInput.trim() || isSendingText}
              >
                {isSendingText ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span className="sr-only">Send message to Grace</span>
              </Button>
            </div>
            {conversationId ? (
              <p className="mt-2 text-xs text-slate-400">
                ElevenLabs conversation {conversationId}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GraceElevenLabsAssistant(props: GraceElevenLabsAssistantProps) {
  const [messages, setMessages] = useState<GraceVoiceMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const innerMessagesRef = useRef(setMessages);
  const conversationIdRef = useRef(setConversationId);

  useEffect(() => {
    innerMessagesRef.current = setMessages;
    conversationIdRef.current = setConversationId;
  }, []);

  const handleMessage = useCallback((payload: ElevenLabsMessage) => {
    const content = payload.message.trim();
    if (!content) return;

    const role = payload.role === "agent" ? "assistant" : "user";
    innerMessagesRef.current((current) => [
      ...current,
      {
        id: `${role}-${Date.now()}-${current.length}`,
        role,
        content,
      },
    ]);
  }, []);

  return (
    <ConversationProvider
      onConnect={({ conversationId: nextConversationId }) => {
        conversationIdRef.current(nextConversationId);
      }}
      onDisconnect={() => {
        void props.onActionComplete?.();
      }}
      onError={(message) => {
        toast.error(message);
      }}
      onMessage={handleMessage}
    >
      <GraceElevenLabsAssistantStateBridge
        {...props}
        messages={messages}
        setMessages={setMessages}
        conversationId={conversationId}
        setConversationId={setConversationId}
      />
    </ConversationProvider>
  );
}

function GraceElevenLabsAssistantStateBridge({
  messages,
  setMessages,
  conversationId,
  setConversationId,
  ...props
}: GraceElevenLabsAssistantInnerProps) {
  return (
    <GraceElevenLabsAssistantInner
      {...props}
      messages={messages}
      setMessages={setMessages}
      conversationId={conversationId}
      setConversationId={setConversationId}
    />
  );
}
