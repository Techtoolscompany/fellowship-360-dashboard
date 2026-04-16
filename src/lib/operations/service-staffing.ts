import { db } from "@/db";
import {
  appointments,
  serviceAssignments,
  serviceRuns,
  volunteerShifts,
} from "@/db/schema";
import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";

type CandidateScore = {
  score: number;
  reasons: string[];
};

export function formatShortDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function getServiceRunWindow(
  serviceAt: Date,
  durationMinutes: number | null | undefined
) {
  const safeDurationMinutes = Math.max(0, Number(durationMinutes ?? 90));
  const bufferMs = 30 * 60 * 1000;
  const durationMs = safeDurationMinutes * 60 * 1000;
  return {
    start: new Date(serviceAt.getTime() - bufferMs),
    end: new Date(serviceAt.getTime() + durationMs + bufferMs),
  };
}

export function windowsOverlap(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date }
) {
  return a.start <= b.end && a.end >= b.start;
}

const ACTIVE_ASSIGNMENT_CONFLICT_STATUSES = [
  "proposed",
  "offered",
  "confirmed",
  "needs_replacement",
  "checked_in",
] as const;

export async function findServiceAssignmentConflict(params: {
  organizationId: string;
  assignmentId: string;
  serviceAt: Date;
  durationMinutes: number | null | undefined;
  staffUserId?: string;
  volunteerId?: string;
}) {
  const clauses = [
    eq(serviceAssignments.organizationId, params.organizationId),
    ne(serviceAssignments.id, params.assignmentId),
    inArray(serviceAssignments.status, [...ACTIVE_ASSIGNMENT_CONFLICT_STATUSES]),
    ne(serviceRuns.status, "cancelled"),
    ne(serviceRuns.status, "completed"),
  ];

  if (params.staffUserId) {
    clauses.push(eq(serviceAssignments.staffUserId, params.staffUserId));
  } else if (params.volunteerId) {
    clauses.push(eq(serviceAssignments.volunteerId, params.volunteerId));
  } else {
    return null;
  }

  const rows = await db
    .select({
      assignmentId: serviceAssignments.id,
      roleName: serviceAssignments.roleName,
      runId: serviceRuns.id,
      runName: serviceRuns.name,
      runServiceAt: serviceRuns.serviceAt,
      runDurationMinutes: serviceRuns.durationMinutes,
      status: serviceAssignments.status,
    })
    .from(serviceAssignments)
    .innerJoin(serviceRuns, eq(serviceAssignments.serviceRunId, serviceRuns.id))
    .where(and(...clauses))
    .orderBy(serviceRuns.serviceAt);

  if (!rows.length) {
    return null;
  }

  const currentWindow = getServiceRunWindow(params.serviceAt, params.durationMinutes);
  return (
    rows.find((row) => {
      const conflictWindow = getServiceRunWindow(
        row.runServiceAt,
        row.runDurationMinutes
      );
      return windowsOverlap(currentWindow, conflictWindow);
    }) ?? null
  );
}

export async function findStaffSchedulingConflict(params: {
  organizationId: string;
  assignmentId: string;
  staffUserId: string;
  serviceAt: Date;
  durationMinutes: number | null | undefined;
}) {
  const conflictWindow = getServiceRunWindow(params.serviceAt, params.durationMinutes);

  const [appointmentConflict] = await db
    .select({
      id: appointments.id,
      title: appointments.title,
      dateTime: appointments.dateTime,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.organizationId, params.organizationId),
        eq(appointments.staffId, params.staffUserId),
        gte(appointments.dateTime, conflictWindow.start),
        lte(appointments.dateTime, conflictWindow.end),
        ne(appointments.status, "cancelled"),
        ne(appointments.status, "completed"),
        ne(appointments.status, "no_show")
      )
    )
    .orderBy(appointments.dateTime)
    .limit(1);

  if (appointmentConflict) {
    return `Staff member has a conflicting appointment (${appointmentConflict.title}) at ${formatShortDateTime(
      appointmentConflict.dateTime
    )}`;
  }

  const assignmentConflict = await findServiceAssignmentConflict({
    organizationId: params.organizationId,
    assignmentId: params.assignmentId,
    serviceAt: params.serviceAt,
    durationMinutes: params.durationMinutes,
    staffUserId: params.staffUserId,
  });

  if (assignmentConflict) {
    return `Staff member is already assigned to ${assignmentConflict.runName} (${assignmentConflict.roleName}) at ${formatShortDateTime(
      assignmentConflict.runServiceAt
    )}`;
  }

  return null;
}

export async function findVolunteerSchedulingConflict(params: {
  organizationId: string;
  assignmentId: string;
  volunteerId: string;
  serviceAt: Date;
  durationMinutes: number | null | undefined;
}) {
  const conflictWindow = getServiceRunWindow(params.serviceAt, params.durationMinutes);

  const [shiftConflict] = await db
    .select({
      id: volunteerShifts.id,
      date: volunteerShifts.date,
    })
    .from(volunteerShifts)
    .where(
      and(
        eq(volunteerShifts.volunteerId, params.volunteerId),
        gte(volunteerShifts.date, conflictWindow.start),
        lte(volunteerShifts.date, conflictWindow.end)
      )
    )
    .orderBy(volunteerShifts.date)
    .limit(1);

  if (shiftConflict) {
    return `Volunteer has a conflicting shift at ${formatShortDateTime(
      shiftConflict.date
    )}`;
  }

  const assignmentConflict = await findServiceAssignmentConflict({
    organizationId: params.organizationId,
    assignmentId: params.assignmentId,
    serviceAt: params.serviceAt,
    durationMinutes: params.durationMinutes,
    volunteerId: params.volunteerId,
  });

  if (assignmentConflict) {
    return `Volunteer is already assigned to ${assignmentConflict.runName} (${assignmentConflict.roleName}) at ${formatShortDateTime(
      assignmentConflict.runServiceAt
    )}`;
  }

  return null;
}

export function parseAssignmentResponse(message: string) {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return null;
  if (/^(yes|y|confirm|accepted|available)\b/.test(normalized)) {
    return { nextStatus: "confirmed" as const, label: "confirmed" };
  }
  if (/^(no|n|decline|declined|cant|can't|not available)\b/.test(normalized)) {
    return { nextStatus: "declined" as const, label: "declined" };
  }
  if (/^(swap|change|reschedule|later|time|another|different time)\b/.test(normalized)) {
    return { nextStatus: "needs_replacement" as const, label: "needs replacement" };
  }
  return null;
}

function normalizeRoleText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function getRoleMatchScore(roleName: string, candidateRole: string | null | undefined) {
  const roleNorm = normalizeRoleText(roleName);
  const candidateNorm = normalizeRoleText(candidateRole);

  if (!candidateNorm) {
    return { score: 0, reason: "No explicit role tag" };
  }
  if (candidateNorm === roleNorm) {
    return { score: 35, reason: "Exact role match" };
  }
  if (candidateNorm.includes(roleNorm) || roleNorm.includes(candidateNorm)) {
    return { score: 20, reason: "Partial role match" };
  }
  return { score: 0, reason: "General role fit" };
}

export function scoreStaffCandidate(params: {
  roleName: string;
  membershipRole: string;
  recentLoad: number;
  conflictReason?: string;
}): CandidateScore {
  let score = 55;
  const reasons = ["Staff pool candidate"];
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

  if (params.recentLoad > 0) {
    score -= Math.min(18, params.recentLoad * 3);
    reasons.push(`Recent load: ${params.recentLoad} appointments`);
  }

  if (params.conflictReason) {
    score -= 40;
    reasons.push("Conflict at service time");
  }

  return {
    score: Math.max(1, score),
    reasons,
  };
}

export function scoreVolunteerCandidate(params: {
  roleName: string;
  volunteerRole: string | null;
  totalHours: number | null;
  recentLoad: number;
  conflictReason?: string;
}): CandidateScore {
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

  if (params.recentLoad > 0) {
    score -= Math.min(20, params.recentLoad * 4);
    reasons.push(`Recent load: ${params.recentLoad} shifts`);
  }

  if (params.conflictReason) {
    score -= 40;
    reasons.push("Conflict at service time");
  }

  return {
    score: Math.max(1, score),
    reasons,
  };
}
