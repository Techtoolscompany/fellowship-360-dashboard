import { z } from "zod";

export type SchedulingAvailabilitySlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export const schedulingAvailabilitySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

type ScoredCandidate = {
  score: number;
  reasons: string[];
  available: boolean;
};

export function normalizeRoleText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function parseTimeToMinutes(value: string) {
  const [hoursRaw, minutesRaw] = value.split(":");
  const hours = Number(hoursRaw ?? "0");
  const minutes = Number(minutesRaw ?? "0");
  return hours * 60 + minutes;
}

function isScheduleSlotValid(slot: SchedulingAvailabilitySlot) {
  return parseTimeToMinutes(slot.endTime) > parseTimeToMinutes(slot.startTime);
}

export function normalizeAvailabilitySlots(rawValue: unknown): SchedulingAvailabilitySlot[] {
  if (!Array.isArray(rawValue)) return [];

  return rawValue
    .map((item) => schedulingAvailabilitySlotSchema.safeParse(item))
    .filter((result) => result.success)
    .map((result) => result.data)
    .filter(isScheduleSlotValid)
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
}

export function isAvailabilityMatch(serviceAt: Date, availabilitySlots: SchedulingAvailabilitySlot[]) {
  if (!availabilitySlots.length) return true;

  const dayOfWeek = serviceAt.getDay();
  const minuteOfDay = serviceAt.getHours() * 60 + serviceAt.getMinutes();

  return availabilitySlots.some((slot) => {
    if (slot.dayOfWeek !== dayOfWeek) return false;
    const start = parseTimeToMinutes(slot.startTime);
    const end = parseTimeToMinutes(slot.endTime);
    return minuteOfDay >= start && minuteOfDay < end;
  });
}

export function hasPreferredRoleMatch(roleName: string, preferredRoles: string[]) {
  if (!preferredRoles.length) return false;

  const roleNorm = normalizeRoleText(roleName);
  return preferredRoles.some((preferredRole) => {
    const preferredNorm = normalizeRoleText(preferredRole);
    if (!preferredNorm) return false;
    return (
      preferredNorm === roleNorm ||
      preferredNorm.includes(roleNorm) ||
      roleNorm.includes(preferredNorm)
    );
  });
}

function getRoleMatchScore(requiredRole: string, candidateRole: string | null | undefined) {
  const required = normalizeRoleText(requiredRole);
  const candidate = normalizeRoleText(candidateRole);

  if (!candidate) {
    return { score: 0, reason: "No explicit role tag" };
  }
  if (candidate === required) {
    return { score: 35, reason: "Exact role match" };
  }
  if (candidate.includes(required) || required.includes(candidate)) {
    return { score: 20, reason: "Partial role match" };
  }

  return { score: 0, reason: "General role fit" };
}

export function scoreStaffCandidate(params: {
  roleName: string;
  membershipRole: string;
  preferredRoles?: string[];
  recentLoad: number;
  isSchedulable?: boolean;
  isAvailabilityMatch?: boolean;
  conflictReason?: string;
}): ScoredCandidate {
  let score = 55;
  const reasons = ["Staff pool candidate"];

  const roleMatch = getRoleMatchScore(params.roleName, params.membershipRole);
  if (roleMatch.score > 0) {
    score += Math.ceil(roleMatch.score * 0.4);
    reasons.push(roleMatch.reason);
  }

  const roleName = normalizeRoleText(params.roleName);
  const membershipRole = normalizeRoleText(params.membershipRole);

  if (
    (roleName.includes("pastor") || roleName.includes("leader")) &&
    (membershipRole === "admin" || membershipRole === "owner")
  ) {
    score += 18;
    reasons.push("Leadership role alignment");
  } else if (
    roleName.includes("admin") &&
    (membershipRole === "admin" || membershipRole === "owner")
  ) {
    score += 14;
    reasons.push("Admin role alignment");
  } else {
    score += 6;
    reasons.push("General staff fit");
  }

  if (params.preferredRoles?.length) {
    if (hasPreferredRoleMatch(params.roleName, params.preferredRoles)) {
      score += 12;
      reasons.push("Preferred position match");
    } else {
      score -= 6;
      reasons.push("Outside preferred positions");
    }
  }

  if (params.recentLoad > 0) {
    score -= Math.min(18, params.recentLoad * 3);
    reasons.push(`Recent load: ${params.recentLoad} appointments`);
  }

  if (params.isAvailabilityMatch === false) {
    score -= 30;
    reasons.push("Outside saved availability");
  }

  if (params.isSchedulable === false) {
    score -= 60;
    reasons.push("Scheduling disabled");
  }

  if (params.conflictReason) {
    score -= 40;
    reasons.push("Conflict at service time");
  }

  return {
    score: Math.max(1, score),
    reasons,
    available:
      !params.conflictReason &&
      params.isSchedulable !== false &&
      params.isAvailabilityMatch !== false,
  };
}

export function scoreVolunteerCandidate(params: {
  roleName: string;
  volunteerRole: string | null;
  totalHours: number | null;
  preferredRoles?: string[];
  recentLoad: number;
  isSchedulable?: boolean;
  isAvailabilityMatch?: boolean;
  conflictReason?: string;
}): ScoredCandidate {
  let score = 48;
  const reasons: string[] = [];

  const roleMatch = getRoleMatchScore(params.roleName, params.volunteerRole);
  score += roleMatch.score;
  reasons.push(roleMatch.reason);

  const totalHours = Number(params.totalHours ?? 0);
  if (totalHours >= 100) {
    score += 12;
    reasons.push("High volunteer experience");
  } else if (totalHours >= 25) {
    score += 7;
    reasons.push("Established volunteer");
  } else if (totalHours > 0) {
    score += 3;
    reasons.push("Growing volunteer history");
  }

  if (params.preferredRoles?.length) {
    if (hasPreferredRoleMatch(params.roleName, params.preferredRoles)) {
      score += 16;
      reasons.push("Preferred position match");
    } else {
      score -= 8;
      reasons.push("Outside preferred positions");
    }
  }

  if (params.recentLoad > 0) {
    score -= Math.min(20, params.recentLoad * 4);
    reasons.push(`Recent load: ${params.recentLoad} shifts`);
  }

  if (params.isAvailabilityMatch === false) {
    score -= 30;
    reasons.push("Outside saved availability");
  }

  if (params.isSchedulable === false) {
    score -= 60;
    reasons.push("Scheduling disabled");
  }

  if (params.conflictReason) {
    score -= 40;
    reasons.push("Conflict at service time");
  }

  return {
    score: Math.max(1, score),
    reasons,
    available:
      !params.conflictReason &&
      params.isSchedulable !== false &&
      params.isAvailabilityMatch !== false,
  };
}
