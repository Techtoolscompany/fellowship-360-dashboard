import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const GRACE_SYSTEM_INSTRUCTION = `You are Grace, an AI assistant for Fellowship 360 — a church CRM application.

## Your Personality
- Warm, pastoral, and professional
- You speak with care and compassion befitting a church environment
- You are concise but thorough — pastors are busy
- You use inclusive language and are sensitive to faith-based contexts

## Your Capabilities
- Answer questions about the church's data (contacts, tasks, appointments, prayer requests)
- Help draft messages, emails, and announcements
- Summarize activity and provide insights
- Suggest follow-ups and action items
- Help with scheduling and task management

## Guidelines
- Always ground your answers in the provided context data when available
- If you don't have data to answer a question, say so honestly
- Never fabricate contact names, numbers, or statistics
- When referencing data, be specific (e.g., "You have 3 overdue tasks" not "You have some tasks")
- Use markdown formatting for lists and emphasis when helpful
- Keep responses focused and actionable`;

const MODEL_NAME = "gemini-2.0-flash";

const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

class GeminiClient {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Send a message with optional conversation history and context data.
   */
  async chat(
    userMessage: string,
    history: ChatMessage[] = [],
    contextData?: string
  ): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings: SAFETY_SETTINGS,
      systemInstruction: contextData
        ? `${GRACE_SYSTEM_INSTRUCTION}\n\n## Current Church Data\n${contextData}`
        : GRACE_SYSTEM_INSTRUCTION,
    });

    const chat = model.startChat({
      history: history.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      })),
    });

    try {
      const result = await chat.sendMessage(userMessage);
      const response = result.response;
      return response.text();
    } catch (error: any) {
      console.error("Gemini API error:", error);

      if (error.message?.includes("API key")) {
        throw new Error("Invalid Gemini API key. Please check your GEMINI_API_KEY in .env.local");
      }
      if (error.message?.includes("quota")) {
        throw new Error("Gemini API quota exceeded. Please try again later.");
      }
      if (error.message?.includes("SAFETY")) {
        return "I'm sorry, I can't respond to that request. Could you rephrase your question?";
      }

      throw new Error("Failed to get a response from Grace. Please try again.");
    }
  }

  /**
   * Stream a message response for low-latency integrations (like Voice AI).
   * Returns an async iterable of strings (chunks).
   */
  async *chatStream(
    userMessage: string,
    history: ChatMessage[] = [],
    contextData?: string
  ): AsyncGenerator<string, void, unknown> {
    const model = this.genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings: SAFETY_SETTINGS,
      systemInstruction: contextData
        ? `${GRACE_SYSTEM_INSTRUCTION}\n\n## Current Church Data\n${contextData}`
        : GRACE_SYSTEM_INSTRUCTION,
    });

    const chat = model.startChat({
      history: history.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.content }],
      })),
    });

    try {
      const result = await chat.sendMessageStream(userMessage);
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield chunkText;
        }
      }
    } catch (error: any) {
      console.error("Gemini API stream error:", error);
      
      // Let the caller handle the error stream or logging, but we can yield a final failure message
      if (error.message?.includes("API key")) {
        yield "I'm sorry, my API key seems to be missing or invalid.";
      } else if (error.message?.includes("quota")) {
        yield "I'm sorry, I have exceeded my daily quota.";
      } else if (error.message?.includes("SAFETY")) {
        yield "I'm sorry, I cannot respond to that prompt due to safety guidelines.";
      } else {
        yield "I'm sorry, I encountered an error while processing your request.";
      }
    }
  }
}

// Singleton instance
let clientInstance: GeminiClient | null = null;

export function getGeminiClient(): GeminiClient {
  if (!clientInstance) {
    clientInstance = new GeminiClient();
  }
  return clientInstance;
}

export { GeminiClient };
