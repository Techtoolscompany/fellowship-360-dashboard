import type { GraceIntent } from "../types";

const EMERGENCY_PATTERN = /(suicide|kill myself|overdose|abuse|911|emergency|self harm)/i;
const PRAYER_PATTERN = /(pray|prayer|healing|intercede|intercession)/i;
const APPOINTMENT_PATTERN = /(appointment|book|schedule|meeting|pastor)/i;
const FOLLOW_UP_PATTERN = /(follow up|check in|reminder|task)/i;
const INFO_PATTERN = /(service|time|location|address|ministry|event|where|when)/i;

export function classifyIntent(message: string): GraceIntent {
  if (EMERGENCY_PATTERN.test(message)) return "emergency";
  if (PRAYER_PATTERN.test(message)) return "prayer_request";
  if (APPOINTMENT_PATTERN.test(message)) return "appointment_request";
  if (FOLLOW_UP_PATTERN.test(message)) return "follow_up_request";
  if (INFO_PATTERN.test(message)) return "info_request";
  return "unknown";
}
