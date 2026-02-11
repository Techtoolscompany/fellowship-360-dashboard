import type { GraceRouterInput, GraceRouterOutput } from "../types";
import { classifyIntent } from "./classifier";
import { extractSlots, missingRequiredSlots } from "./slots";
import { planActions } from "./planner";
import { executePlannedActions } from "./executor";

function replyForIntent(intent: GraceRouterOutput["intent"], missing: string[]): string {
  if (intent === "emergency") {
    return "I am escalating this to a staff member immediately. If this is urgent or dangerous, please call emergency services now.";
  }

  if (missing.length > 0) {
    return `I can help with that. I still need: ${missing.join(", ")}.`;
  }

  if (intent === "info_request") {
    return "I found relevant church information for you.";
  }

  if (intent === "prayer_request") {
    return "I have captured your prayer request and shared it with the church team.";
  }

  if (intent === "appointment_request") {
    return "I can help schedule that appointment and will propose the next step now.";
  }

  return "I understand. I can help with church information, prayer requests, and appointments.";
}

export async function runClawRouter(input: GraceRouterInput): Promise<GraceRouterOutput> {
  const intent = classifyIntent(input.message);
  const state = extractSlots(input.message, input.state);
  const missing = missingRequiredSlots(intent, state);

  const actions = missing.length === 0 ? planActions(intent, state) : [];
  await executePlannedActions({ actions, context: input.context });

  return {
    response: replyForIntent(intent, missing),
    intent,
    state,
    proposedActions: actions,
  };
}
