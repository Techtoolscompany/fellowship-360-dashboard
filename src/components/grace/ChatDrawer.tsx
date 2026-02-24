"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Send, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import useOrganization from "@/lib/organizations/useOrganization";
import {
  getOrCreateAIConversation,
  getAIChatHistory,
  sendMessageToGrace,
} from "@/app/actions/ai";

interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "model";
  sentAt: Date;
}

interface ChatDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function ChatDrawer({ open, onClose }: ChatDrawerProps) {
  const { organization } = useOrganization();
  const orgId = organization?.id;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Initialize conversation
  useEffect(() => {
    if (!open || !orgId) return;

    async function init() {
      setInitializing(true);
      try {
        const conversation = await getOrCreateAIConversation(orgId!);
        setConversationId(conversation.id);

        const { messages: history } = await getAIChatHistory(conversation.id);
        setMessages(history);
      } catch (err) {
        console.error("Failed to initialize chat:", err);
        setError("Failed to connect to Grace. Please try again.");
      } finally {
        setInitializing(false);
      }
    }

    init();
  }, [open, orgId]);

  // Auto-scroll and auto-focus
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && !loading && !initializing) {
      inputRef.current?.focus();
    }
  }, [open, loading, initializing]);

  const handleSend = async () => {
    if (!input.trim() || loading || !conversationId || !orgId) return;

    const userMessage = input.trim();
    setInput("");
    setError(null);

    // Optimistic update
    const tempUserMsg: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      content: userMessage,
      role: "user",
      sentAt: new Date(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const { userMsg, aiMsg } = await sendMessageToGrace(
        conversationId,
        userMessage,
        orgId
      );

      // Replace temp message with real one and add AI response
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        { ...userMsg, sentAt: new Date(userMsg.sentAt) },
        { ...aiMsg, sentAt: new Date(aiMsg.sentAt) },
      ]);
    } catch (err: any) {
      console.error("Failed to send message:", err);
      setError(err.message || "Failed to get a response. Please try again.");
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-[#1a1d21] to-[#252830]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#bbff00] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#1a1d21]" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Grace AI</h3>
              <p className="text-xs text-white/60">Church Assistant</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {initializing ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#bbff00]" />
              <p className="text-sm text-muted-foreground">Connecting to Grace...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#bbff00]/20 to-[#bbff00]/5 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-[#bbff00]" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground mb-1">Hi, I&apos;m Grace! 👋</h4>
                <p className="text-sm text-muted-foreground">
                  I&apos;m your church assistant. Ask me about your contacts, tasks, appointments, or prayer requests.
                </p>
              </div>
              <div className="grid gap-2 w-full mt-2">
                {[
                  "How many contacts do I have?",
                  "What tasks are overdue?",
                  "Summarize this week's appointments",
                  "Show me urgent prayer requests",
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
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#bbff00] text-[#1a1d21] rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.role === "model" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2">
                      {msg.content.split("\n").map((line, i) => {
                        if (line.startsWith("- ")) {
                          return <div key={i} className="ml-2 flex gap-1"><span>•</span><span>{line.slice(2)}</span></div>;
                        }
                        if (line.startsWith("**") && line.endsWith("**")) {
                          return <p key={i} className="font-bold">{line.slice(2, -2)}</p>;
                        }
                        if (line.trim() === "") return <br key={i} />;
                        return <p key={i}>{line}</p>;
                      })}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))
          )}

          {/* Typing indicator */}
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

          {/* Error */}
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

        {/* Input */}
        <div className="p-4 border-t border-border bg-card">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Grace anything..."
              disabled={loading || initializing}
              className="flex-1 px-4 py-2.5 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#bbff00]/50 focus:border-[#bbff00] disabled:opacity-50"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || loading || initializing}
              size="icon"
              className="bg-[#bbff00] text-[#1a1d21] hover:bg-[#a3df00] rounded-xl h-10 w-10 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Grace can see your church data to help answer questions
          </p>
        </div>
      </div>
    </>
  );
}
