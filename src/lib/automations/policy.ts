import type { AutomationEnrollmentMode } from "./types";

function parseTimeOfDay(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isWithinQuietHours(input: {
  now: Date;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}) {
  if (!input.quietHoursEnabled) return false;

  const startMinutes = parseTimeOfDay(input.quietHoursStart);
  const endMinutes = parseTimeOfDay(input.quietHoursEnd);

  if (startMinutes === null || endMinutes === null) {
    return false;
  }

  const nowMinutes = input.now.getHours() * 60 + input.now.getMinutes();

  if (startMinutes === endMinutes) {
    return true;
  }

  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }

  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export function evaluateEnrollmentPolicy(input: {
  enrollmentMode: AutomationEnrollmentMode;
  reentryCooldownMinutes: number;
  hasPriorRun: boolean;
  latestRunAt?: Date | null;
  hasOptOut: boolean;
  respectOptOut: boolean;
  dailySendCap: number;
  runsToday: number;
  now: Date;
}) {
  if (input.respectOptOut && input.hasOptOut) {
    return {
      allowed: false,
      reason: "contact_opted_out" as const,
    };
  }

  if (input.dailySendCap > 0 && input.runsToday >= input.dailySendCap) {
    return {
      allowed: false,
      reason: "daily_send_cap_reached" as const,
    };
  }

  if (input.enrollmentMode === "every_trigger") {
    return { allowed: true as const };
  }

  if (!input.hasPriorRun) {
    return { allowed: true as const };
  }

  if (input.enrollmentMode === "once_per_contact") {
    return {
      allowed: false,
      reason: "already_enrolled" as const,
    };
  }

  if (!input.latestRunAt) {
    return {
      allowed: false,
      reason: "cooldown_active" as const,
    };
  }

  const cooldownMs = Math.max(0, input.reentryCooldownMinutes) * 60 * 1000;
  const elapsedMs = input.now.getTime() - input.latestRunAt.getTime();

  if (elapsedMs >= cooldownMs) {
    return { allowed: true as const };
  }

  return {
    allowed: false,
    reason: "cooldown_active" as const,
    retryAt: new Date(input.latestRunAt.getTime() + cooldownMs),
  };
}
