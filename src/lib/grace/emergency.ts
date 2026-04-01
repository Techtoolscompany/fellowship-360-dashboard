const EMERGENCY_PATTERNS: RegExp[] = [
  /\b(suicide|suicidal)\b/i,
  /\b(kill myself|end my life|take my life)\b/i,
  /\b(self[-\s]?harm|hurt myself)\b/i,
  /\b(overdose|od)\b/i,
  /\b(domestic violence|abuse)\b/i,
  /\b(child safety|child abuse)\b/i,
  /\b(911|emergency)\b/i,
];

export type EmergencySignal = {
  isEmergency: boolean;
  matchedPatterns: string[];
};

export function detectEmergencySignal(message: string): EmergencySignal {
  const matchedPatterns = EMERGENCY_PATTERNS.filter((pattern) => pattern.test(message)).map(
    (pattern) => pattern.source
  );

  return {
    isEmergency: matchedPatterns.length > 0,
    matchedPatterns,
  };
}

export function buildEmergencyResponseText() {
  return [
    "I escalated this immediately to your church care team.",
    "If anyone is in immediate danger, call 911 right now.",
    "If you can share a safe callback number, someone can follow up as soon as possible.",
  ].join(" ");
}

export function buildEmergencyEscalationDetails(params: {
  message: string;
  matchedPatterns: string[];
}) {
  const compactMessage = params.message.trim().replace(/\s+/g, " ").slice(0, 600);
  return [
    "Deterministic emergency auto-escalation triggered.",
    `Matched patterns: ${params.matchedPatterns.join(", ") || "none"}.`,
    `Message excerpt: ${compactMessage}`,
  ].join(" ");
}
