import type { SlotState, GraceIntent } from "../types";

const PHONE_PATTERN = /(?:\+?1\s*)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/;
const EMAIL_PATTERN = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,})/i;

export function extractSlots(message: string, currentState: SlotState): SlotState {
  const next = { ...currentState };
  const phoneMatch = message.match(PHONE_PATTERN);
  const emailMatch = message.match(EMAIL_PATTERN);

  if (phoneMatch) {
    next.phone = `${phoneMatch[1]}${phoneMatch[2]}${phoneMatch[3]}`;
  }
  if (emailMatch) {
    next.email = emailMatch[1].toLowerCase();
  }

  if (!next.requestText && message.length > 8) {
    next.requestText = message;
  }

  if (/critical|urgent|asap/i.test(message)) {
    next.urgency = /critical/i.test(message) ? "critical" : "urgent";
  }

  return next;
}

export function missingRequiredSlots(intent: GraceIntent, state: SlotState): string[] {
  if (intent === "prayer_request") {
    return state.requestText ? [] : ["requestText"];
  }
  if (intent === "appointment_request") {
    const missing: string[] = [];
    if (!state.name) missing.push("name");
    if (!state.phone && !state.email) missing.push("contact");
    if (!state.preferredTime) missing.push("preferredTime");
    return missing;
  }
  return [];
}
