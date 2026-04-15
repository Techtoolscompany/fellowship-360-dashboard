"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mic,
  Send,
  Sparkles,
  StopCircle,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import useOrganization from "@/lib/organizations/useOrganization";
import {
  bootstrapSampleData,
  getGuidedSequenceOnboarding,
  getLaunchReadiness,
  getOrganizationOnboardingProfile,
  getProviderHealthChecks,
  installStarterTemplates,
  startGuidedSequenceOnboarding,
  updateOrganizationOnboardingProfile,
} from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  pickGraceRecorderMimeType,
  resolveGraceRecordedAudioMimeType,
} from "@/lib/grace/audio-upload";
import type { GraceActionOutcome } from "@/lib/grace/types";

type OnboardingProfileSnapshot = Exclude<
  Awaited<ReturnType<typeof getOrganizationOnboardingProfile>>,
  null
>;
type LaunchReadiness = Awaited<ReturnType<typeof getLaunchReadiness>>;
type ProviderHealthSnapshot = Awaited<ReturnType<typeof getProviderHealthChecks>>;
type GuidedSequenceSnapshot = Awaited<ReturnType<typeof getGuidedSequenceOnboarding>>;

type ConciergeMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  outcomes?: GraceActionOutcome[];
};

type FormDraft = {
  churchName: string;
  denomination: string;
  city: string;
  website: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  teamSize: string;
  averageWeeklyAttendance: string;
  primaryGoal: string;
  notes: string;
};

const STEPS = [
  {
    id: "identity",
    label: "Church Identity",
    title: "Tell Grace who this workspace belongs to.",
    description: "This powers voice replies, follow-up copy, and onboarding decisions.",
    fields: ["churchName", "denomination", "city", "website"] as const,
  },
  {
    id: "operator",
    label: "Primary Operator",
    title: "Who is leading launch on your side?",
    description: "Grace uses this to steer approvals, reminders, and next actions.",
    fields: ["primaryContactName", "primaryContactEmail", "primaryContactPhone"] as const,
  },
  {
    id: "launch-plan",
    label: "Launch Plan",
    title: "What does a successful first week look like?",
    description: "Capture team size, church size, and the outcome this onboarding should drive.",
    fields: ["teamSize", "averageWeeklyAttendance", "primaryGoal", "notes"] as const,
  },
] as const;

function buildInitialMessage(params: {
  score: number;
  nextBlockingAction?: string | null;
  nextGuideTitle?: string | null;
}) {
  const lines = [
    "I am your launch concierge.",
    `Workspace readiness is currently ${params.score}%.`,
  ];

  if (params.nextBlockingAction) {
    lines.push(`Current blocker: ${params.nextBlockingAction}.`);
  }

  if (params.nextGuideTitle) {
    lines.push(`Recommended guided sequence: ${params.nextGuideTitle}.`);
  }

  lines.push(
    "You can answer by typing, filling the form, or speaking. I will save profile details, start setup steps, and keep the next move clear."
  );

  return lines.join(" ");
}

function formatAssistantText(text: string) {
  return text.split("\n").map((line, index) => (
    <p key={`${line}-${index}`} className={line.trim().length === 0 ? "h-3" : ""}>
      {line}
    </p>
  ));
}

function isPermissionDeniedError(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return true;
  }

  if (error instanceof Error) {
    return /permission denied|microphone/i.test(error.message);
  }

  return false;
}

function isRecorderNotSupportedError(error: unknown) {
  return error instanceof DOMException && error.name === "NotSupportedError";
}

function outcomeTone(status: GraceActionOutcome["status"]) {
  if (status === "executed" || status === "retried") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "queued") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-rose-200 bg-rose-50 text-rose-700";
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to encode audio."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read audio."));
    reader.readAsDataURL(blob);
  });
}

export function OnboardingConciergeApp() {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<OnboardingProfileSnapshot | null>(null);
  const [readiness, setReadiness] = useState<LaunchReadiness | null>(null);
  const [providerHealth, setProviderHealth] = useState<ProviderHealthSnapshot | null>(null);
  const [guidedSequences, setGuidedSequences] = useState<GuidedSequenceSnapshot | null>(null);
  const [draft, setDraft] = useState<FormDraft>({
    churchName: "",
    denomination: "",
    city: "",
    website: "",
    primaryContactName: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
    teamSize: "",
    averageWeeklyAttendance: "",
    primaryGoal: "",
    notes: "",
  });
  const [activeStep, setActiveStep] = useState(0);
  const [textInput, setTextInput] = useState("");
  const [messages, setMessages] = useState<ConciergeMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [savingStep, setSavingStep] = useState(false);
  const [installingStarters, setInstallingStarters] = useState(false);
  const [bootstrappingData, setBootstrappingData] = useState(false);
  const [startingGuideId, setStartingGuideId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [processingVoice, setProcessingVoice] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seededIntroRef = useRef(false);

  const loadWorkspace = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [profileData, readinessData, providerHealthData, guidedSequenceData] =
        await Promise.all([
          getOrganizationOnboardingProfile(orgId),
          getLaunchReadiness(orgId),
          getProviderHealthChecks(orgId),
          getGuidedSequenceOnboarding(orgId),
        ]);

      setProfile(profileData);
      setReadiness(readinessData);
      setProviderHealth(providerHealthData);
      setGuidedSequences(guidedSequenceData);

      if (profileData) {
        setDraft({
          churchName: profileData.onboardingData.orgName || profileData.name || "",
          denomination: profileData.onboardingData.churchDenomination || "",
          city: profileData.onboardingData.churchCity || "",
          website: profileData.onboardingData.orgWebsite || "",
          primaryContactName: profileData.onboardingData.primaryContactName || "",
          primaryContactEmail: profileData.onboardingData.primaryContactEmail || "",
          primaryContactPhone: profileData.onboardingData.primaryContactPhone || "",
          teamSize:
            profileData.onboardingData.teamSize > 0
              ? String(profileData.onboardingData.teamSize)
              : "",
          averageWeeklyAttendance:
            profileData.onboardingData.averageWeeklyAttendance > 0
              ? String(profileData.onboardingData.averageWeeklyAttendance)
              : "",
          primaryGoal: profileData.onboardingData.primaryGoal || "",
          notes: profileData.onboardingData.notes || "",
        });
      }
    } catch (error) {
      console.error("Failed to load launch concierge state:", error);
      toast.error("Failed to load launch concierge state");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const nextGuide = useMemo(() => {
    const nextGuideId = guidedSequences?.nextGuideId ?? null;
    return guidedSequences?.guides.find((guide) => guide.id === nextGuideId) ?? null;
  }, [guidedSequences]);

  useEffect(() => {
    if (seededIntroRef.current || !readiness) return;
    seededIntroRef.current = true;
    setMessages([
      {
        id: "intro",
        role: "assistant",
        content: buildInitialMessage({
          score: readiness.score,
          nextBlockingAction: readiness.blockingActions[0]?.title ?? null,
          nextGuideTitle: nextGuide?.title ?? null,
        }),
      },
    ]);
  }, [nextGuide?.title, readiness]);

  const completionPercent = readiness?.score ?? 0;
  const providerSummary = providerHealth?.summary ?? {
    total: 0,
    healthy: 0,
    degraded: 0,
    critical: 0,
    scorePercent: 0,
  };

  const suggestionPills = useMemo(() => {
    const suggestions = [
      "Save our church name, city, website, and denomination.",
      "Install the starter templates for launch.",
      "Bootstrap sample data so my team can test this.",
    ];
    if (nextGuide) {
      suggestions.push(`Start the ${nextGuide.title} guided sequence.`);
    }
    return suggestions;
  }, [nextGuide]);

  const persistConversationEffects = useCallback(async () => {
    await loadWorkspace();
  }, [loadWorkspace]);

  const sendTextMessage = useCallback(
    async (message: string) => {
      if (!message.trim()) return;

      const trimmedMessage = message.trim();
      setSending(true);
      setTextInput("");
      setMessages((current) => [
        ...current,
        {
          id: `user-${Date.now()}`,
          role: "user",
          content: trimmedMessage,
        },
      ]);

      try {
        const response = await fetch("/api/grace/copilot/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            threadId,
            message: trimmedMessage,
            originSurface: "onboarding",
          }),
        });

        const payload = (await response.json()) as {
          response?: string;
          threadId?: string;
          actionOutcomes?: GraceActionOutcome[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to send onboarding message.");
        }

        if (payload.threadId) {
          setThreadId(payload.threadId);
        }

        setMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: payload.response?.trim() || "I couldn't complete that request.",
            outcomes: payload.actionOutcomes ?? [],
          },
        ]);

        if ((payload.actionOutcomes ?? []).length > 0) {
          await persistConversationEffects();
        }
      } catch (error) {
        console.error("Failed to send onboarding message:", error);
        toast.error(error instanceof Error ? error.message : "Failed to send onboarding message");
      } finally {
        setSending(false);
      }
    },
    [persistConversationEffects, threadId]
  );

  const stopVoiceRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setRecording(false);
  }, []);

  const startVoiceRecording = useCallback(async () => {
    if (recording || processingVoice) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = pickGraceRecorderMimeType(
        typeof MediaRecorder.isTypeSupported === "function"
          ? MediaRecorder.isTypeSupported.bind(MediaRecorder)
          : undefined
      );
      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setProcessingVoice(true);
        try {
          const uploadMimeType = resolveGraceRecordedAudioMimeType({
            recorderMimeType: recorder.mimeType,
            chunkMimeType: audioChunksRef.current.find((chunk) => chunk.type)?.type,
            fallbackMimeType: preferredMimeType,
          });
          const blob = new Blob(audioChunksRef.current, { type: uploadMimeType });
          const audioData = await blobToDataUrl(blob);
          const response = await fetch("/api/grace/voice-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audioData,
              audioMimeType: uploadMimeType,
              sessionId: threadId ?? undefined,
              originSurface: "onboarding",
            }),
          });

          const payload = (await response.json()) as {
            transcript?: string;
            replyText?: string;
            audioUrl?: string;
            sessionId?: string;
            actionOutcomes?: GraceActionOutcome[];
            error?: string;
          };

          if (!response.ok) {
            throw new Error(payload.error || "Failed to process voice request.");
          }

          if (payload.sessionId) {
            setThreadId(payload.sessionId);
          }

          if (payload.transcript) {
            setMessages((current) => [
              ...current,
              {
                id: `voice-user-${Date.now()}`,
                role: "user",
                content: payload.transcript ?? "",
              },
              {
                id: `voice-assistant-${Date.now() + 1}`,
                role: "assistant",
                content: payload.replyText?.trim() || "I couldn't complete that voice request.",
                outcomes: payload.actionOutcomes ?? [],
              },
            ]);
          }

          if (payload.audioUrl && audioRef.current) {
            audioRef.current.src = payload.audioUrl;
            try {
              await audioRef.current.play();
            } catch {
              // Ignore autoplay issues. The audio element still exposes playback controls.
            }
          }

          if ((payload.actionOutcomes ?? []).length > 0) {
            await persistConversationEffects();
          }
        } catch (error) {
          console.error("Failed to process onboarding voice message:", error);
          toast.error(
            error instanceof Error ? error.message : "Failed to process onboarding voice message"
          );
        } finally {
          setProcessingVoice(false);
        }
      };

      recorder.start();
      setRecording(true);
    } catch (error) {
      if (!isPermissionDeniedError(error)) {
        console.error("Failed to start voice recording:", error);
      }
      toast.error(
        isPermissionDeniedError(error)
          ? "Microphone access was blocked. Allow microphone access for this site and try again."
          : isRecorderNotSupportedError(error)
            ? "This browser could not start a compatible voice recording for Grace."
          : "Microphone access is required for voice onboarding."
      );
    }
  }, [persistConversationEffects, processingVoice, recording, threadId]);

  const handlePrimaryAction = useCallback(async () => {
    const step = STEPS[activeStep];
    setSavingStep(true);
    try {
      if (step.id === "identity") {
        await updateOrganizationOnboardingProfile({
          organizationId: orgId!,
          churchName: draft.churchName,
          denomination: draft.denomination,
          city: draft.city,
          website: draft.website,
        });
      }

      if (step.id === "operator") {
        await updateOrganizationOnboardingProfile({
          organizationId: orgId!,
          primaryContactName: draft.primaryContactName,
          primaryContactEmail: draft.primaryContactEmail,
          primaryContactPhone: draft.primaryContactPhone,
        });
      }

      if (step.id === "launch-plan") {
        await updateOrganizationOnboardingProfile({
          organizationId: orgId!,
          teamSize: draft.teamSize ? Number(draft.teamSize) : 0,
          averageWeeklyAttendance: draft.averageWeeklyAttendance
            ? Number(draft.averageWeeklyAttendance)
            : 0,
          primaryGoal: draft.primaryGoal,
          notes: draft.notes,
        });
      }

      toast.success(`${step.label} saved`);
      await loadWorkspace();
      setActiveStep((current) => Math.min(current + 1, STEPS.length - 1));
    } catch (error) {
      console.error("Failed to save onboarding step:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save onboarding step");
    } finally {
      setSavingStep(false);
    }
  }, [activeStep, draft, loadWorkspace, orgId]);

  const handleInstallStarterTemplates = useCallback(async () => {
    if (!orgId) return;
    setInstallingStarters(true);
    try {
      const result = await installStarterTemplates(orgId);
      toast.success(
        `Starter templates installed (${result.messageTemplatesCreated} templates, ${result.pipelineStagesCreated} stages, ${result.serviceTemplatesCreated} service templates)`
      );
      await loadWorkspace();
    } catch (error) {
      console.error("Failed to install starter templates:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to install starter templates"
      );
    } finally {
      setInstallingStarters(false);
    }
  }, [loadWorkspace, orgId]);

  const handleBootstrapSampleData = useCallback(async () => {
    if (!orgId) return;
    setBootstrappingData(true);
    try {
      const result = await bootstrapSampleData(orgId);
      toast.success(`Sample data bootstrap complete (${result.contactCount ?? 0} contacts created)`);
      await loadWorkspace();
    } catch (error) {
      console.error("Failed to bootstrap sample data:", error);
      toast.error(error instanceof Error ? error.message : "Failed to bootstrap sample data");
    } finally {
      setBootstrappingData(false);
    }
  }, [loadWorkspace, orgId]);

  const handleStartGuidedSequence = useCallback(
    async (blueprintId: string) => {
      if (!orgId) return;
      setStartingGuideId(blueprintId);
      try {
        const result = await startGuidedSequenceOnboarding({
          organizationId: orgId,
          blueprintId,
          installTemplate: true,
        });
        toast.success(`${result.blueprintTitle} is ready`);
        await loadWorkspace();
      } catch (error) {
        console.error("Failed to start guided sequence:", error);
        toast.error(error instanceof Error ? error.message : "Failed to start guided sequence");
      } finally {
        setStartingGuideId(null);
      }
    },
    [loadWorkspace, orgId]
  );

  const step = STEPS[activeStep];

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#84cc16]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(132,204,22,0.12),_transparent_34%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_46%,_#f8fafc_100%)]">
      <audio ref={audioRef} className="hidden" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/app/get-started"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back To Checklist
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-lime-200 bg-lime-50 px-4 py-2 text-xs font-semibold text-lime-800">
            <Sparkles className="h-3.5 w-3.5" />
            Voice-led launch concierge
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-[#0f172a] text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
            <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top,_rgba(132,204,22,0.28),_transparent_42%),linear-gradient(135deg,_rgba(15,23,42,1)_0%,_rgba(30,41,59,1)_58%,_rgba(51,65,85,1)_100%)] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="text-[11px] font-black uppercase tracking-[0.28em] text-lime-300">
                    Launch Concierge
                  </p>
                  <h1 className="mt-3 text-4xl font-black tracking-tight">
                    A separate onboarding app, living inside Fellowship 360.
                  </h1>
                  <p className="mt-3 max-w-xl text-sm text-slate-300">
                    Think voice-guided intake, a guided Typeform-style flow, and direct setup actions
                    in one place. Speak, type, or fill the step you are on.
                  </p>
                </div>

                <div className="grid min-w-[220px] gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 text-sm backdrop-blur">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">
                      Launch Score
                    </p>
                    <p className="mt-1 text-3xl font-black text-white">{completionPercent}%</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#84cc16] transition-all"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-300">
                    {readiness?.completedCount ?? 0}/{readiness?.totalCount ?? 0} launch steps complete
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 md:grid-cols-[0.72fr_1.28fr] md:p-6">
              <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Speak With Grace
                  </p>
                  <h2 className="mt-2 text-xl font-black">Hands-free onboarding</h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Use voice when you want the system to guide the intake like a concierge call.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => (recording ? stopVoiceRecording() : void startVoiceRecording())}
                  disabled={processingVoice}
                  className={`flex w-full flex-col items-center justify-center gap-3 rounded-[24px] border px-4 py-8 text-center transition-all ${
                    recording
                      ? "border-rose-400/50 bg-rose-500/10 text-rose-100"
                      : "border-lime-300/30 bg-lime-400/10 text-white hover:bg-lime-400/15"
                  } disabled:opacity-60`}
                >
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-full ${
                      recording ? "bg-rose-500/20" : "bg-lime-300/20"
                    }`}
                  >
                    {processingVoice ? (
                      <Loader2 className="h-7 w-7 animate-spin" />
                    ) : recording ? (
                      <StopCircle className="h-7 w-7" />
                    ) : (
                      <Mic className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-black">
                      {recording
                        ? "Stop recording"
                        : processingVoice
                          ? "Processing voice request"
                          : "Start voice intake"}
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      {recording
                        ? "Grace is listening."
                        : "Your response is transcribed, routed through onboarding mode, and read back to you."}
                    </p>
                  </div>
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <StatTile label="Providers Healthy" value={`${providerSummary.healthy}/${providerSummary.total}`} />
                  <StatTile label="Guides Ready" value={`${guidedSequences?.summary.builderDraftCount ?? 0}/${guidedSequences?.summary.total ?? 0}`} />
                </div>

                {nextGuide ? (
                  <div className="rounded-2xl border border-lime-300/20 bg-lime-300/10 p-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-lime-200">
                      Recommended Guide
                    </p>
                    <p className="mt-2 text-sm font-black text-white">{nextGuide.title}</p>
                    <p className="mt-1 text-xs text-slate-300">{nextGuide.summary}</p>
                    <Button
                      type="button"
                      onClick={() => void handleStartGuidedSequence(nextGuide.id)}
                      disabled={startingGuideId !== null}
                      className="mt-4 w-full bg-[#84cc16] text-slate-950 hover:bg-[#a3e635]"
                    >
                      {startingGuideId === nextGuide.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="mr-2 h-4 w-4" />
                      )}
                      Start Guided Sequence
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Concierge Thread
                    </p>
                    <h2 className="mt-1 text-xl font-black">Type or speak</h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-300">
                    Thread {threadId ? "active" : "new"}
                  </div>
                </div>

                <div className="flex max-h-[460px] min-h-[460px] flex-col gap-3 overflow-y-auto rounded-[20px] border border-white/10 bg-slate-950/40 p-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[88%] rounded-[20px] px-4 py-3 text-sm ${
                        message.role === "assistant"
                          ? "self-start bg-white text-slate-900"
                          : "self-end bg-[#84cc16] text-slate-950"
                      }`}
                    >
                      <div className="space-y-1">{formatAssistantText(message.content)}</div>
                      {message.outcomes?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.outcomes.map((outcome) => (
                            <span
                              key={`${message.id}-${outcome.actionId}`}
                              className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${outcomeTone(outcome.status)}`}
                            >
                              {outcome.tool} · {outcome.status}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {suggestionPills.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setTextInput(suggestion)}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/10"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                <div className="flex items-end gap-3">
                  <Textarea
                    value={textInput}
                    onChange={(event) => setTextInput(event.target.value)}
                    placeholder="Ask Grace to save profile details, install starters, or guide the next launch step."
                    className="min-h-[104px] border-white/10 bg-white/5 text-white placeholder:text-slate-400"
                  />
                  <Button
                    type="button"
                    onClick={() => void sendTextMessage(textInput)}
                    disabled={sending || !textInput.trim()}
                    className="h-12 shrink-0 bg-[#84cc16] px-5 text-slate-950 hover:bg-[#a3e635]"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Structured Intake
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">
                    Typeform-style steps with direct persistence
                  </h2>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Step {activeStep + 1} of {STEPS.length}
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {STEPS.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveStep(index)}
                    className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                      index === activeStep
                        ? "border-lime-300 bg-lime-50 shadow-sm"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-bold text-slate-900">{item.title}</p>
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">
                  {step.label}
                </p>
                <h3 className="mt-2 text-2xl font-black text-slate-950">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{step.description}</p>

                <div className="mt-6 space-y-4">
                  {step.id === "identity" ? (
                    <>
                      <Field label="Church Name">
                        <Input
                          value={draft.churchName}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, churchName: event.target.value }))
                          }
                          placeholder="Grace Community Church"
                        />
                      </Field>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Denomination">
                          <Input
                            value={draft.denomination}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                denomination: event.target.value,
                              }))
                            }
                            placeholder="Non-denominational"
                          />
                        </Field>
                        <Field label="City">
                          <Input
                            value={draft.city}
                            onChange={(event) =>
                              setDraft((current) => ({ ...current, city: event.target.value }))
                            }
                            placeholder="Atlanta, GA"
                          />
                        </Field>
                      </div>
                      <Field label="Website">
                        <Input
                          value={draft.website}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, website: event.target.value }))
                          }
                          placeholder="https://example.church"
                        />
                      </Field>
                    </>
                  ) : null}

                  {step.id === "operator" ? (
                    <>
                      <Field label="Primary Contact">
                        <Input
                          value={draft.primaryContactName}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              primaryContactName: event.target.value,
                            }))
                          }
                          placeholder="Pastor Jordan Miles"
                        />
                      </Field>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Email">
                          <Input
                            value={draft.primaryContactEmail}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                primaryContactEmail: event.target.value,
                              }))
                            }
                            placeholder="jordan@example.church"
                          />
                        </Field>
                        <Field label="Phone">
                          <Input
                            value={draft.primaryContactPhone}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                primaryContactPhone: event.target.value,
                              }))
                            }
                            placeholder="(555) 123-4567"
                          />
                        </Field>
                      </div>
                    </>
                  ) : null}

                  {step.id === "launch-plan" ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Team Size">
                          <Input
                            value={draft.teamSize}
                            onChange={(event) =>
                              setDraft((current) => ({ ...current, teamSize: event.target.value }))
                            }
                            placeholder="6"
                          />
                        </Field>
                        <Field label="Average Weekly Attendance">
                          <Input
                            value={draft.averageWeeklyAttendance}
                            onChange={(event) =>
                              setDraft((current) => ({
                                ...current,
                                averageWeeklyAttendance: event.target.value,
                              }))
                            }
                            placeholder="180"
                          />
                        </Field>
                      </div>
                      <Field label="Primary Goal">
                        <Textarea
                          value={draft.primaryGoal}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              primaryGoal: event.target.value,
                            }))
                          }
                          placeholder="Get first-time guest follow-up live before Sunday."
                          className="min-h-[88px]"
                        />
                      </Field>
                      <Field label="Notes For Grace">
                        <Textarea
                          value={draft.notes}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, notes: event.target.value }))
                          }
                          placeholder="Anything the concierge should keep in mind about your staff cadence, tone, or rollout."
                          className="min-h-[120px]"
                        />
                      </Field>
                    </>
                  ) : null}
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setActiveStep((current) => Math.max(current - 1, 0))}
                    disabled={activeStep === 0 || savingStep}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>

                  <Button
                    type="button"
                    onClick={() => void handlePrimaryAction()}
                    disabled={savingStep}
                    className="bg-slate-950 text-white hover:bg-slate-800"
                  >
                    {savingStep ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save Step
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ShortcutCard
                eyebrow="Setup Action"
                title="Install starter templates"
                description="Drop in launch-ready message templates, pipeline stages, and service templates."
                actionLabel="Install"
                busy={installingStarters}
                onAction={() => void handleInstallStarterTemplates()}
              />
              <ShortcutCard
                eyebrow="Testing Action"
                title="Bootstrap sample data"
                description="Seed a realistic workspace so the team can rehearse before going live."
                actionLabel="Seed Data"
                busy={bootstrappingData}
                onAction={() => void handleBootstrapSampleData()}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function ShortcutCard({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
  busy,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <Button
        type="button"
        onClick={onAction}
        disabled={busy}
        className="mt-5 w-full bg-[#84cc16] text-slate-950 hover:bg-[#a3e635]"
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
        {actionLabel}
      </Button>
    </div>
  );
}

function StatTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}
