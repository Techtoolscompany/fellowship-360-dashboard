"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Loader2, Volume2 } from "lucide-react";
import useOrganization from "@/lib/organizations/useOrganization";

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read audio recording."));
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

export function GraceVoiceAssistant({
  autoStart = false,
  hideTitle = false,
}: {
  autoStart?: boolean;
  hideTitle?: boolean;
} = {}) {
  const { organization } = useOrganization();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [graceReply, setGraceReply] = useState("");
  const [sessionId, setSessionId] = useState<string>();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const hasAutoStartedRef = useRef(false);

  // Clean up media streams
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing) return;
    try {
      setTranscript("");
      setGraceReply("");
      audioChunksRef.current = [];
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processAudioWithGrace(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Could not access your microphone. Please check permissions.");
    }
  }, [isProcessing, isRecording]);

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stop media tracks to turn off the red dot in the browser tab
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    if (!autoStart || hasAutoStartedRef.current || isRecording || isProcessing) return;
    hasAutoStartedRef.current = true;
    startRecording();
  }, [autoStart, isProcessing, isRecording, startRecording]);

  const processAudioWithGrace = async (audioBlob: Blob) => {
    try {
      if (!organization?.id) {
        setGraceReply("Organization not found. Please select an organization.");
        setIsProcessing(false);
        return;
      }

      const base64AudioData = await blobToDataUrl(audioBlob);

      const response = await fetch("/api/grace/voice-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioData: base64AudioData,
          sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to contact Grace.");
      }

      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      if (data.transcript) {
        setTranscript(data.transcript);
      }

      if (data.replyText) {
        setGraceReply(data.replyText);
      }

      if (data.audioUrl && audioPlayerRef.current) {
        audioPlayerRef.current.src = data.audioUrl;
        try {
          await audioPlayerRef.current.play();
        } catch (error) {
          console.error("Audio playback failed", error);
        }
      }
    } catch (error) {
      console.error("Failed to process conversation:", error);
      setGraceReply("I encountered an error trying to process that request.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-card shadow-sm space-y-6 max-w-md mx-auto">
      {!hideTitle ? (
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold flex items-center justify-center gap-2">
            <Volume2 className="h-5 w-5 text-indigo-500" />
            Grace Voice Session
          </h2>
          <p className="text-sm text-muted-foreground">
            {autoStart
              ? "Recording started automatically. Tap the mic to stop or restart."
              : "Tap the microphone, say a command or ask a question, and tap again to stop."}
          </p>
        </div>
      ) : null}

      <button
        onClick={toggleRecording}
        disabled={isProcessing}
        className={`relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 ${
          isRecording 
            ? "bg-red-100 text-red-600 hover:bg-red-200 shadow-[0_0_20px_rgba(239,68,68,0.5)]" 
            : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200 shadow-lg"
        } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {isProcessing ? (
          <Loader2 className="h-10 w-10 animate-spin" />
        ) : isRecording ? (
          <Square className="h-8 w-8 fill-current" />
        ) : (
          <Mic className="h-10 w-10" />
        )}
        
        {isRecording && (
          <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-20" />
        )}
      </button>

      {/* Hidden audio player for Grace's response */}
      <audio ref={audioPlayerRef} className="hidden" controls />

      <div className="w-full space-y-4 pt-4 border-t">
        {transcript && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">You said:</span>
            <p className="text-sm p-3 bg-muted rounded-lg italic">&quot;{transcript}&quot;</p>
          </div>
        )}
        
        {graceReply && (
          <div className="space-y-1">
             <span className="text-xs font-semibold text-indigo-500 uppercase tracking-wider">Grace replied:</span>
             <p className="text-sm p-3 bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 rounded-lg">
               {graceReply}
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
