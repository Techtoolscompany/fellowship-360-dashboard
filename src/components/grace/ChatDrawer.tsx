"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { X, Send, Loader2, Sparkles, RotateCcw, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GraceActionOutcome } from "@/lib/grace/types";

function getOutcomeStatusClass(status: GraceActionOutcome["status"]) {
  if (status === "executed") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (status === "queued") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  }
  if (status === "retried") {
    return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300";
  }
  return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300";
}

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  sentAt: Date;
  outcomes?: GraceActionOutcome[];
}

interface ChatDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ChatDrawer({ open, onClose }: ChatDrawerProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!open) return;
    scrollToBottom();
  }, [messages, open, scrollToBottom]);

  useEffect(() => {
    if (open && !loading) {
      inputRef.current?.focus();
    }
  }, [open, loading]);

  const hasQueuedOutcomes = messages.some(
    (msg) => msg.role === "assistant" && msg.outcomes?.some((outcome) => outcome.status === "queued")
  );

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);

    const tempUserMsg: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      content: userMessage,
      role: "user",
      sentAt: new Date(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const response = await fetch("/api/grace/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId,
          message: userMessage,
        }),
      });

      const payload = (await response.json()) as {
        response?: string;
        threadId?: string;
        actionOutcomes?: GraceActionOutcome[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to get a response from Grace.");
      }

      if (payload.threadId) {
        setThreadId(payload.threadId);
      }

      const assistantContent = payload.response?.trim() ||
        "I couldn't generate a response. Please try again.";

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        content: assistantContent,
        role: "assistant",
        sentAt: new Date(),
        outcomes: payload.actionOutcomes ?? [],
      };

      const now = Date.now();
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        {
          id: `user-${now}`,
          content: userMessage,
          role: "user",
          sentAt: new Date(),
        },
        assistantMsg,
      ]);
    } catch (err) {
      console.error("Failed to send message to Grace:", err);
      setError(err instanceof Error ? err.message : "Failed to get a response.");
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setLoading(false);
    }
  };

  const handleResetConversation = () => {
    setMessages([]);
    setThreadId(null);
    setError(null);
    setInput("");
  };

  const handleOpenVoiceCommand = () => {
    onClose();
    router.push("/app/grace?tab=home&voice=1");
  };

  const handleReviewApprovals = () => {
    onClose();
    router.push("/app/grace?tab=workflow");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-[#1a1d21] to-[#252830]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#bbff00] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#1a1d21]" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Grace AI</h3>
              <p className="text-xs text-white/60">App-wide assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleResetConversation}
              className="text-white/60 hover:text-white hover:bg-white/10"
              title="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#bbff00]/20 to-[#bbff00]/5 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-[#bbff00]" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Grace is ready</h4>
                <p className="text-sm text-muted-foreground">
                  Ask me to review tasks, follow up on conversations, schedule appointments, or log prayer requests.
                </p>
              </div>
              <div className="grid gap-2 w-full mt-2">
                {[
                  "Show me high-priority open tasks and suggest next actions.",
                  "Summarize pending approvals and what I should approve first.",
                  "Draft follow-up plan for today's unresolved conversations.",
                  "Create a prayer request for healing and assign it to prayer team.",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="text-left text-xs px-3 py-2 rounded-lg border border-border hover:border-[#bbff00]/50 hover:bg-[#bbff00]/5 text-muted-foreground hover:text-foreground transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] space-y-1.5 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}
                >
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#bbff00] text-[#1a1d21] rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2">
                        {msg.content.split("\n").map((line, i) => {
                          if (line.startsWith("- ")) {
                            return (
                              <div key={i} className="ml-2 flex gap-1">
                                <span>•</span>
                                <span>{line.slice(2)}</span>
                              </div>
                            );
                          }
                          if (line.startsWith("**") && line.endsWith("**")) {
                            return (
                              <p key={i} className="font-bold">
                                {line.slice(2, -2)}
                              </p>
                            );
                          }
                          if (line.trim() === "") return <br key={i} />;
                          return <p key={i}>{line}</p>;
                        })}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === "assistant" && msg.outcomes && msg.outcomes.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.outcomes.slice(0, 6).map((outcome, index) => (
                        <span
                          key={`${msg.id}-outcome-${index}`}
                          className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getOutcomeStatusClass(outcome.status)}`}
                        >
                          {outcome.tool} · {outcome.status}
                        </span>
                      ))}
                    </div>
                  ) : (
                    null
                  )}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="hover:text-red-800">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-border bg-card">
          {hasQueuedOutcomes ? (
            <button
              type="button"
              onClick={handleReviewApprovals}
              className="mb-3 inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
            >
              Review pending approvals
            </button>
          ) : null}
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Grace to run CRM work..."
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#bbff00]/40"
              disabled={loading}
            />
            <Button
              type="button"
              onClick={handleOpenVoiceCommand}
              variant="outline"
              size="icon"
              className="border-[#bbff00]/30 text-[#1a1d21] hover:bg-[#bbff00]/15"
              title="Open Grace voice command"
            >
              <Mic className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => void handleSend()}
              disabled={!input.trim() || loading}
              size="icon"
              className="bg-[#bbff00] hover:bg-[#a3e600] text-[#1a1d21]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
