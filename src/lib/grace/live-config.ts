export const DEFAULT_GEMINI_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL?.trim() || "gemini-3.1-flash-live-preview";

export const DEFAULT_GEMINI_LIVE_VOICE_NAME =
  process.env.GEMINI_LIVE_VOICE_NAME?.trim() || "Kore";

export const GRACE_LIVE_TOOL_NAME = "runGraceCrmCommand";

export function supportsAffectiveDialog(model: string) {
  return model.includes("2.5");
}

export function buildGraceLiveSystemInstruction(params: {
  churchName: string;
  denomination: string | null;
  city: string | null;
  customPrompt: string | null;
}) {
  const identity = [
    `You are Grace, the live voice assistant for ${params.churchName}.`,
    params.denomination ? `Denomination: ${params.denomination}.` : "",
    params.city ? `Location: ${params.city}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const operatingRules = [
    "You are speaking with a church staff member inside Fellowship 360 CRM.",
    "Sound natural, calm, concise, and helpful, like a modern AI voice assistant.",
    "Do not narrate your internal reasoning.",
    "Avoid long monologues. Keep spoken responses short unless the user asks for detail.",
    "For any church-specific question, CRM lookup, note update, workflow action, or operational request, call the runGraceCrmCommand tool instead of guessing.",
    "You may answer lightweight conversational turns directly if no CRM or church data is needed.",
    "After tool results return, summarize the result clearly in spoken language.",
    "If a tool reports an error or queued approval, explain that plainly and briefly.",
    "Never invent member data, schedules, staff decisions, or CRM outcomes.",
  ].join("\n");

  const customSection = params.customPrompt?.trim()
    ? `\n\nAdditional instructions for this church:\n${params.customPrompt.trim()}`
    : "";

  return `${identity}\n\n${operatingRules}${customSection}`;
}

export const graceLiveToolDeclaration = {
  name: GRACE_LIVE_TOOL_NAME,
  description:
    "Use this for Fellowship 360 CRM work or church-specific questions, including searching contacts, checking church knowledge, updating records, creating follow-up actions, and handling operational staff requests.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description:
          "The user's request rewritten as a concise CRM instruction or church-specific question.",
      },
    },
    required: ["message"],
  },
} as const;
