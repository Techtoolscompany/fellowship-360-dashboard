"use server";

import { getGeminiClient, ChatMessage } from "@/lib/ai/gemini-client";
import { buildChurchContext } from "@/lib/ai/context-manager";
import {
  createConversation,
  getConversations,
  getConversationMessages,
  addMessage,
} from "@/app/actions/communications";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { aiConfig, aiUsageLogs } from "@/db/schema";

/**
 * Get or create an AI conversation for the current org.
 * We look for an existing open "web" conversation, or create a new one.
 */
export async function getOrCreateAIConversation(orgId: string) {
  // Look for an existing open AI conversation
  const existing = await getConversations(orgId, { status: "open" });
  const aiConvo = existing.find(
    (c: any) => c.conversation.channel === "web" && c.conversation.subject === "Grace AI Chat"
  );

  if (aiConvo) {
    return aiConvo.conversation;
  }

  // Create a new one
  const conversation = await createConversation({
    channel: "web",
    subject: "Grace AI Chat",
    organizationId: orgId,
  });

  return conversation;
}

/**
 * Get the chat history for an AI conversation, formatted for Gemini.
 */
export async function getAIChatHistory(conversationId: string): Promise<{
  messages: Array<{ id: string; content: string; role: "user" | "model"; sentAt: Date }>;
  geminiHistory: ChatMessage[];
}> {
  const dbMessages = await getConversationMessages(conversationId);

  const messages = dbMessages.map((msg: any) => ({
    id: msg.id,
    content: msg.content,
    role: msg.senderType === "ai" ? "model" as const : "user" as const,
    sentAt: msg.sentAt,
  }));

  const geminiHistory: ChatMessage[] = dbMessages.map((msg: any) => ({
    role: msg.senderType === "ai" ? "model" as const : "user" as const,
    content: msg.content,
  }));

  return { messages, geminiHistory };
}

/**
 * Send a message to Grace and get a response.
 * This persists both the user message and Grace's response.
 */
export async function sendMessageToGrace(
  conversationId: string,
  userMessage: string,
  orgId: string
): Promise<{
  userMsg: { id: string; content: string; role: "user"; sentAt: Date };
  aiMsg: { id: string; content: string; role: "model"; sentAt: Date };
}> {
  // 1. Save user message
  const savedUserMsg = await addMessage({
    conversationId,
    content: userMessage,
    direction: "inbound",
    senderType: "human",
  });

  // 2. Get conversation history for context
  const { geminiHistory } = await getAIChatHistory(conversationId);
  // Remove the last message (the one we just added) from history
  const historyWithoutCurrent = geminiHistory.slice(0, -1);

  // 3. Build church context
  const contextData = await buildChurchContext(orgId);

  // 4. Get org's AI config
  const aiSettings = await db.query.aiConfig.findFirst({
    where: eq(aiConfig.organizationId, orgId),
  });

  if (aiSettings && !aiSettings.graceEnabled) {
    throw new Error("Grace AI has been disabled for this organization.");
  }

  const systemPrompt = aiSettings?.customSystemPrompt || undefined;

  // 5. Get AI response
  const client = getGeminiClient();
  const aiResponse = await client.chat(userMessage, historyWithoutCurrent, contextData, systemPrompt);

  // 5. Save AI response
  const savedAiMsg = await addMessage({
    conversationId,
    content: aiResponse,
    direction: "outbound",
    senderType: "ai",
  });

  // 6. Record usage
  // First, check if there's already a log for today (we'll simplify this by just recording one entry per message sent for now)
  await db.insert(aiUsageLogs).values({
    organizationId: orgId,
    messagesCount: 1,
  });

  return {
    userMsg: {
      id: savedUserMsg.id,
      content: savedUserMsg.content,
      role: "user",
      sentAt: savedUserMsg.sentAt,
    },
    aiMsg: {
      id: savedAiMsg.id,
      content: aiResponse,
      role: "model",
      sentAt: savedAiMsg.sentAt,
    },
  };
}
