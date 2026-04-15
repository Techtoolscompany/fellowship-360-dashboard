import { NonRetriableError } from "inngest";
import { and, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  churchContacts,
  graceGoals,
  graceGoalSteps,
  organizationMemberships,
  serviceAssignments,
  serviceRuns,
  serviceSchedulingProfiles,
  serviceTemplateRoleSlots,
  tasks,
  users,
  volunteers,
  volunteerShifts,
} from "@/db/schema";
import {
  isAvailabilityMatch,
  normalizeAvailabilitySlots,
  scoreStaffCandidate,
  scoreVolunteerCandidate,
} from "@/lib/grace/assignment-scoring";
import {
  buildVolunteerStaffingGoalContext,
  buildVolunteerStaffingGoalResult,
  buildVolunteerStaffingStepTemplates,
  summarizeVolunteerStaffingAssignmentProgress,
  updateVolunteerStaffingGoalStatus,
  updateVolunteerStaffingGoalStep,
  VOLUNTEER_STAFFING_WORKFLOW_KEY,
} from "@/lib/grace/workflows/volunteer";
import { sendOrganizationSms } from "@/lib/sms-gateway/send";
import { inngest } from "../client";
import { INNGEST_EVENTS } from "../events";
import { INNGEST_RETRY_PROFILES } from "../policy";

const AUTOSTAFF_STEPS = buildVolunteerStaffingStepTemplates();

function normalizePhoneNumber(value: string | null | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

function getServiceRunWindow(serviceAt: Date, durationMinutes: number | null | undefined) {
  const safeDurationMinutes = Math.max(0, Number(durationMinutes ?? 90));
  const bufferMs = 30 * 60 * 1000;
  return {
    start: new Date(serviceAt.getTime() - bufferMs),
    end: new Date(serviceAt.getTime() + safeDurationMinutes * 60 * 1000 + bufferMs),
  };
}

function windowsOverlap(
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

function formatShortDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function ensureGoalStepRows(goalId: string, organizationId: string) {
  const existing = await db
    .select({ stepKey: graceGoalSteps.stepKey })
    .from(graceGoalSteps)
    .where(eq(graceGoalSteps.goalId, goalId));

  const existingKeys = new Set(existing.map((row) => row.stepKey));
  const missingRows = AUTOSTAFF_STEPS.filter((step) => !existingKeys.has(step.stepKey)).map(
    (step) => ({
      goalId,
      organizationId,
      stepKey: step.stepKey,
      title: step.title,
      runOrder: step.runOrder,
      status: "pending" as const,
    })
  );

  if (missingRows.length > 0) {
    await db.insert(graceGoalSteps).values(missingRows);
  }
}

async function updateGoalStatus(
  goalId: string,
  status: "queued" | "in_progress" | "waiting" | "completed" | "failed" | "cancelled" | "escalated",
  extra?: Partial<{
    startedAt: Date | null;
    completedAt: Date | null;
    nextRunAt: Date | null;
    resultJson: Record<string, unknown> | null;
    errorText: string | null;
  }>
) {
  await updateVolunteerStaffingGoalStatus({
    goalId,
    status,
    source: "automation_runtime",
    startedAt: extra?.startedAt ?? undefined,
    nextRunAt: extra?.nextRunAt ?? undefined,
    completedAt: extra?.completedAt ?? undefined,
    errorText: extra?.errorText ?? undefined,
    resultJsonPatch: extra?.resultJson ?? undefined,
  });
}

async function startGoalStep(
  goalId: string,
  stepKey: string,
  inputJson?: Record<string, unknown>
) {
  await updateVolunteerStaffingGoalStep({
    goalId,
    stepKey,
    status: "in_progress",
    source: "automation_runtime",
    inputJson: inputJson ?? null,
    startedAt: new Date(),
    completedAt: null,
    attemptCountDelta: 1,
  });
}

async function finishGoalStep(params: {
  goalId: string;
  stepKey: string;
  status: "waiting" | "completed" | "failed" | "skipped";
  outputJson?: Record<string, unknown>;
  errorText?: string | null;
}) {
  await updateVolunteerStaffingGoalStep({
    goalId: params.goalId,
    stepKey: params.stepKey,
    status: params.status,
    source: "automation_runtime",
    outputJson: params.outputJson ?? null,
    errorText: params.errorText ?? null,
    completedAt: params.status === "waiting" ? null : new Date(),
  });
}

export const graceServiceAutostaff = inngest.createFunction(
  {
    id: "grace-service-autostaff",
    retries: INNGEST_RETRY_PROFILES.CORE_AUTOMATION,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.GRACE_SERVICE_AUTOSTAFF_REQUESTED },
  async ({ event, step, logger }) => {
    const waitHours =
      typeof event.data.waitHours === "number" && event.data.waitHours > 0
        ? Math.floor(event.data.waitHours)
        : 6;

    const context = await step.run("load-goal-run-context", async () => {
      const [goal] = await db
        .select()
        .from(graceGoals)
        .where(
          and(
            eq(graceGoals.id, event.data.goalId),
            eq(graceGoals.organizationId, event.data.organizationId)
          )
        )
        .limit(1);

      if (!goal) {
        throw new NonRetriableError(`Grace goal not found: ${event.data.goalId}`);
      }

      const [serviceRun] = await db
        .select()
        .from(serviceRuns)
        .where(
          and(
            eq(serviceRuns.id, event.data.serviceRunId),
            eq(serviceRuns.organizationId, event.data.organizationId)
          )
        )
        .limit(1);

      if (!serviceRun) {
        throw new NonRetriableError(`Service run not found: ${event.data.serviceRunId}`);
      }

      await ensureGoalStepRows(goal.id, goal.organizationId);

      const contextJson = goal.contextJson as Record<string, unknown> | null;
      if (!contextJson || contextJson.workflowKey !== VOLUNTEER_STAFFING_WORKFLOW_KEY) {
        await db
          .update(graceGoals)
          .set({
            contextJson: buildVolunteerStaffingGoalContext({
              serviceRunId: serviceRun.id,
              templateId: serviceRun.templateId,
              serviceAt: serviceRun.serviceAt,
              triggerSource: "automation_runtime",
              triggerChannel: "inngest",
              requestedByUserId: goal.requestedByUserId,
              objectiveText: goal.objectiveText,
              waitHours,
            }),
            updatedAt: new Date(),
          })
          .where(eq(graceGoals.id, goal.id));
      }

      return {
        goal,
        serviceRun,
      };
    });

    try {
      await step.run("set-goal-in-progress", async () => {
        await updateGoalStatus(context.goal.id, "in_progress", {
          startedAt: toDate(context.goal.startedAt) ?? new Date(),
          nextRunAt: null,
          completedAt: null,
          errorText: null,
        });
      });

    const assignmentState = await step.run("ensure-assignment-seats", async () => {
      await startGoalStep(context.goal.id, "ensure_assignments", {
        serviceRunId: context.serviceRun.id,
      });

      const existingAssignments = await db
        .select()
        .from(serviceAssignments)
        .where(eq(serviceAssignments.serviceRunId, context.serviceRun.id));

      let generatedCount = 0;

      if (existingAssignments.length === 0) {
        if (!context.serviceRun.templateId) {
          const errorText =
            "Service run has no template and no assignment seats. Create seats before auto-staffing.";
          await finishGoalStep({
            goalId: context.goal.id,
            stepKey: "ensure_assignments",
            status: "failed",
            errorText,
          });
          throw new NonRetriableError(errorText);
        }

        const roleSlots = await db
          .select()
          .from(serviceTemplateRoleSlots)
          .where(eq(serviceTemplateRoleSlots.templateId, context.serviceRun.templateId))
          .orderBy(serviceTemplateRoleSlots.sortOrder, serviceTemplateRoleSlots.createdAt);

        const assignmentRows = roleSlots.flatMap((roleSlot) => {
          const seats = Math.max(1, roleSlot.requiredCount);
          return Array.from({ length: seats }, (_, index) => ({
            organizationId: context.goal.organizationId,
            serviceRunId: context.serviceRun.id,
            templateId: context.serviceRun.templateId,
            roleSlotId: roleSlot.id,
            roleName: roleSlot.roleName,
            assignmentType: roleSlot.assignmentType,
            status: "proposed" as const,
            notes:
              seats > 1
                ? `Seat ${index + 1} of ${seats}${roleSlot.notes ? ` · ${roleSlot.notes}` : ""}`
                : roleSlot.notes ?? null,
          }));
        });

        if (assignmentRows.length === 0) {
          const errorText =
            "Template has no role slots. Add service positions before auto-staffing.";
          await finishGoalStep({
            goalId: context.goal.id,
            stepKey: "ensure_assignments",
            status: "failed",
            errorText,
          });
          throw new NonRetriableError(errorText);
        }

        generatedCount = assignmentRows.length;
        await db.insert(serviceAssignments).values(assignmentRows);
      }

      const [totalRow] = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(serviceAssignments)
        .where(eq(serviceAssignments.serviceRunId, context.serviceRun.id));

      const output = {
        generatedCount,
        totalAssignments: totalRow?.count ?? 0,
      };

      await finishGoalStep({
        goalId: context.goal.id,
        stepKey: "ensure_assignments",
        status: "completed",
        outputJson: output,
      });

      return output;
    });

    const seeded = await step.run("seed-assignment-candidates", async () => {
      await startGoalStep(context.goal.id, "seed_assignments", {
        serviceRunId: context.serviceRun.id,
        assignmentCount: assignmentState.totalAssignments,
      });

      const assignmentRows = await db
        .select()
        .from(serviceAssignments)
        .where(eq(serviceAssignments.serviceRunId, context.serviceRun.id))
        .orderBy(serviceAssignments.createdAt);

      const assignableStatuses = new Set(["proposed", "declined", "needs_replacement"]);
      const unassigned = assignmentRows.filter(
        (row) =>
          assignableStatuses.has(row.status) && !row.volunteerId && !row.staffUserId
      );

      if (unassigned.length === 0) {
        const output = {
          assignedCount: 0,
          remainingUnassigned: 0,
          reason: "No unassigned seats required auto-fill",
        };
        await finishGoalStep({
          goalId: context.goal.id,
          stepKey: "seed_assignments",
          status: "completed",
          outputJson: output,
        });
        return output;
      }

      const parsedServiceAt = toDate(context.serviceRun.serviceAt);
      if (!parsedServiceAt) {
        const errorText = "Service run time is invalid for auto-staffing.";
        await finishGoalStep({
          goalId: context.goal.id,
          stepKey: "seed_assignments",
          status: "failed",
          errorText,
        });
        throw new NonRetriableError(errorText);
      }

      const serviceWindow = getServiceRunWindow(
        parsedServiceAt,
        context.serviceRun.durationMinutes
      );
      const loadWindowStart = new Date(
        parsedServiceAt.getTime() - 30 * 24 * 60 * 60 * 1000
      );

      const [
        volunteerPool,
        staffPool,
        conflictingStaffAppointments,
        conflictingVolunteerShifts,
        conflictingCrossRunAssignments,
        recentStaffAppointments,
        recentVolunteerShifts,
        schedulingProfiles,
      ] = await Promise.all([
        db
          .select({
            volunteerId: volunteers.id,
            contactId: volunteers.contactId,
            role: volunteers.role,
            totalHours: volunteers.totalHours,
            firstName: churchContacts.firstName,
            lastName: churchContacts.lastName,
          })
          .from(volunteers)
          .leftJoin(churchContacts, eq(volunteers.contactId, churchContacts.id))
          .where(
            and(
              eq(volunteers.organizationId, context.goal.organizationId),
              eq(volunteers.status, "active")
            )
          ),
        db
          .select({
            userId: organizationMemberships.userId,
            membershipRole: organizationMemberships.role,
            displayName: users.name,
          })
          .from(organizationMemberships)
          .leftJoin(users, eq(organizationMemberships.userId, users.id))
          .where(eq(organizationMemberships.organizationId, context.goal.organizationId)),
        db
          .select({
            staffUserId: appointments.staffId,
          })
          .from(appointments)
          .where(
            and(
              eq(appointments.organizationId, context.goal.organizationId),
              gte(appointments.dateTime, serviceWindow.start),
              lte(appointments.dateTime, serviceWindow.end),
              ne(appointments.status, "cancelled"),
              ne(appointments.status, "completed"),
              ne(appointments.status, "no_show")
            )
          ),
        db
          .select({
            volunteerId: volunteerShifts.volunteerId,
          })
          .from(volunteerShifts)
          .innerJoin(volunteers, eq(volunteerShifts.volunteerId, volunteers.id))
          .where(
            and(
              eq(volunteers.organizationId, context.goal.organizationId),
              gte(volunteerShifts.date, serviceWindow.start),
              lte(volunteerShifts.date, serviceWindow.end)
            )
          ),
        db
          .select({
            assignmentId: serviceAssignments.id,
            staffUserId: serviceAssignments.staffUserId,
            volunteerId: serviceAssignments.volunteerId,
            runServiceAt: serviceRuns.serviceAt,
            runDurationMinutes: serviceRuns.durationMinutes,
          })
          .from(serviceAssignments)
          .innerJoin(serviceRuns, eq(serviceAssignments.serviceRunId, serviceRuns.id))
          .where(
            and(
              eq(serviceAssignments.organizationId, context.goal.organizationId),
              ne(serviceAssignments.serviceRunId, context.serviceRun.id),
              inArray(serviceAssignments.status, [...ACTIVE_ASSIGNMENT_CONFLICT_STATUSES]),
              ne(serviceRuns.status, "cancelled"),
              ne(serviceRuns.status, "completed")
            )
          ),
        db
          .select({
            staffUserId: appointments.staffId,
          })
          .from(appointments)
          .where(
            and(
              eq(appointments.organizationId, context.goal.organizationId),
              gte(appointments.dateTime, loadWindowStart),
              lte(appointments.dateTime, parsedServiceAt),
              ne(appointments.status, "cancelled"),
              ne(appointments.status, "no_show")
            )
          ),
        db
          .select({
            volunteerId: volunteerShifts.volunteerId,
          })
          .from(volunteerShifts)
          .innerJoin(volunteers, eq(volunteerShifts.volunteerId, volunteers.id))
          .where(
            and(
              eq(volunteers.organizationId, context.goal.organizationId),
              gte(volunteerShifts.date, loadWindowStart),
              lte(volunteerShifts.date, parsedServiceAt)
            )
          ),
        db
          .select({
            personType: serviceSchedulingProfiles.personType,
            contactId: serviceSchedulingProfiles.contactId,
            staffUserId: serviceSchedulingProfiles.staffUserId,
            isSchedulable: serviceSchedulingProfiles.isSchedulable,
            preferredRoles: serviceSchedulingProfiles.preferredRoles,
            availabilitySlots: serviceSchedulingProfiles.availabilitySlots,
          })
          .from(serviceSchedulingProfiles)
          .where(eq(serviceSchedulingProfiles.organizationId, context.goal.organizationId)),
      ]);

      const blockedStaffIds = new Set<string>();
      for (const row of conflictingStaffAppointments) {
        if (row.staffUserId) {
          blockedStaffIds.add(row.staffUserId);
        }
      }

      const blockedVolunteerIds = new Set<string>();
      for (const row of conflictingVolunteerShifts) {
        blockedVolunteerIds.add(row.volunteerId);
      }

      for (const row of conflictingCrossRunAssignments) {
        const conflictWindow = getServiceRunWindow(
          row.runServiceAt,
          row.runDurationMinutes
        );
        if (!windowsOverlap(serviceWindow, conflictWindow)) {
          continue;
        }
        if (row.staffUserId) {
          blockedStaffIds.add(row.staffUserId);
        }
        if (row.volunteerId) {
          blockedVolunteerIds.add(row.volunteerId);
        }
      }

      const staffLoadCountById = new Map<string, number>();
      for (const row of recentStaffAppointments) {
        if (!row.staffUserId) continue;
        staffLoadCountById.set(
          row.staffUserId,
          (staffLoadCountById.get(row.staffUserId) ?? 0) + 1
        );
      }

      const volunteerLoadCountById = new Map<string, number>();
      for (const row of recentVolunteerShifts) {
        volunteerLoadCountById.set(
          row.volunteerId,
          (volunteerLoadCountById.get(row.volunteerId) ?? 0) + 1
        );
      }

      const staffProfileByUserId = new Map<
        string,
        {
          isSchedulable: boolean;
          preferredRoles: string[];
          availabilitySlots: ReturnType<typeof normalizeAvailabilitySlots>;
        }
      >();

      const volunteerProfileByContactId = new Map<
        string,
        {
          isSchedulable: boolean;
          preferredRoles: string[];
          availabilitySlots: ReturnType<typeof normalizeAvailabilitySlots>;
        }
      >();

      for (const profile of schedulingProfiles) {
        const normalizedProfile = {
          isSchedulable: profile.isSchedulable,
          preferredRoles: Array.isArray(profile.preferredRoles)
            ? profile.preferredRoles.map((item) => String(item).trim()).filter(Boolean)
            : [],
          availabilitySlots: normalizeAvailabilitySlots(profile.availabilitySlots),
        };

        if (profile.personType === "staff" && profile.staffUserId) {
          staffProfileByUserId.set(profile.staffUserId, normalizedProfile);
        }
        if (profile.personType === "contact" && profile.contactId) {
          volunteerProfileByContactId.set(profile.contactId, normalizedProfile);
        }
      }

      const usedVolunteerIds = new Set(
        assignmentRows.filter((row) => row.volunteerId).map((row) => row.volunteerId as string)
      );
      const usedStaffIds = new Set(
        assignmentRows.filter((row) => row.staffUserId).map((row) => row.staffUserId as string)
      );

      let assignedCount = 0;
      const updates: Array<{
        assignmentId: string;
        volunteerId: string | null;
        staffUserId: string | null;
        notes: string;
      }> = [];

      for (const assignment of unassigned) {
        const candidates: Array<{
          type: "volunteer" | "staff";
          id: string;
          score: number;
          available: boolean;
          reasons: string[];
          recentLoad: number;
        }> = [];

        if (assignment.assignmentType !== "paid_staff") {
          for (const volunteer of volunteerPool) {
            const profile = volunteerProfileByContactId.get(volunteer.contactId);
            const conflictReason = blockedVolunteerIds.has(volunteer.volunteerId)
              ? "Conflicts with an existing commitment"
              : undefined;
            const recentLoad = volunteerLoadCountById.get(volunteer.volunteerId) ?? 0;
            const scored = scoreVolunteerCandidate({
              roleName: assignment.roleName,
              volunteerRole: volunteer.role,
              totalHours: volunteer.totalHours,
              preferredRoles: profile?.preferredRoles,
              recentLoad,
              isSchedulable: profile?.isSchedulable ?? true,
              isAvailabilityMatch: profile
                ? isAvailabilityMatch(parsedServiceAt, profile.availabilitySlots)
                : true,
              conflictReason,
            });

            candidates.push({
              type: "volunteer",
              id: volunteer.volunteerId,
              score: scored.score,
              available: scored.available,
              reasons: scored.reasons,
              recentLoad,
            });
          }
        }

        if (assignment.assignmentType !== "volunteer") {
          for (const staff of staffPool) {
            const profile = staffProfileByUserId.get(staff.userId);
            const conflictReason = blockedStaffIds.has(staff.userId)
              ? "Conflicts with an existing commitment"
              : undefined;
            const recentLoad = staffLoadCountById.get(staff.userId) ?? 0;
            const scored = scoreStaffCandidate({
              roleName: assignment.roleName,
              membershipRole: staff.membershipRole,
              preferredRoles: profile?.preferredRoles,
              recentLoad,
              isSchedulable: profile?.isSchedulable ?? true,
              isAvailabilityMatch: profile
                ? isAvailabilityMatch(parsedServiceAt, profile.availabilitySlots)
                : true,
              conflictReason,
            });

            candidates.push({
              type: "staff",
              id: staff.userId,
              score: scored.score,
              available: scored.available,
              reasons: scored.reasons,
              recentLoad,
            });
          }
        }

        candidates.sort((a, b) => {
          if (a.available !== b.available) return a.available ? -1 : 1;
          if (a.score !== b.score) return b.score - a.score;
          if (a.recentLoad !== b.recentLoad) return a.recentLoad - b.recentLoad;
          return 0;
        });

        const availableCandidates = candidates.filter((candidate) => candidate.available);

        const candidate =
          availableCandidates.find(
            (row) =>
              (row.type === "volunteer" && !usedVolunteerIds.has(row.id)) ||
              (row.type === "staff" && !usedStaffIds.has(row.id))
          ) ?? availableCandidates[0];

        if (!candidate) {
          continue;
        }

        if (candidate.type === "volunteer") {
          usedVolunteerIds.add(candidate.id);
          updates.push({
            assignmentId: assignment.id,
            volunteerId: candidate.id,
            staffUserId: null,
            notes: `Auto-assigned by Grace (${candidate.reasons.slice(0, 2).join(" · ")})`,
          });
        } else {
          usedStaffIds.add(candidate.id);
          updates.push({
            assignmentId: assignment.id,
            volunteerId: null,
            staffUserId: candidate.id,
            notes: `Auto-assigned by Grace (${candidate.reasons.slice(0, 2).join(" · ")})`,
          });
        }
      }

      for (const update of updates) {
        await db
          .update(serviceAssignments)
          .set({
            volunteerId: update.volunteerId,
            staffUserId: update.staffUserId,
            status: "proposed",
            notes: update.notes,
            updatedAt: new Date(),
          })
          .where(eq(serviceAssignments.id, update.assignmentId));
        assignedCount += 1;
      }

      const [remainingRow] = await db
        .select({
          count: sql<number>`count(*)::int`,
        })
        .from(serviceAssignments)
        .where(
          and(
            eq(serviceAssignments.serviceRunId, context.serviceRun.id),
            inArray(serviceAssignments.status, ["proposed", "declined", "needs_replacement"]),
            sql`(${serviceAssignments.volunteerId} is null and ${serviceAssignments.staffUserId} is null)`
          )
        );

      const output = {
        assignedCount,
        remainingUnassigned: remainingRow?.count ?? 0,
      };

      await finishGoalStep({
        goalId: context.goal.id,
        stepKey: "seed_assignments",
        status: "completed",
        outputJson: output,
      });

      return output;
    });

    const offerSummary = await step.run("send-assignment-offers", async () => {
      await startGoalStep(context.goal.id, "send_offers", {
        waitHours,
        seededAssignedCount: seeded.assignedCount,
      });

      const rows = await db
        .select({
          assignment: serviceAssignments,
          volunteer: volunteers,
          contact: churchContacts,
        })
        .from(serviceAssignments)
        .leftJoin(volunteers, eq(serviceAssignments.volunteerId, volunteers.id))
        .leftJoin(churchContacts, eq(volunteers.contactId, churchContacts.id))
        .where(eq(serviceAssignments.serviceRunId, context.serviceRun.id))
        .orderBy(serviceAssignments.createdAt);

      const offerableStatuses = new Set(["proposed", "declined", "needs_replacement"]);
      const candidates = rows.filter((row) => offerableStatuses.has(row.assignment.status));

      if (candidates.length === 0) {
        const output = {
          attempted: 0,
          sent: 0,
          skipped: 0,
          failed: 0,
          reason: "No offerable assignments",
        };
        await finishGoalStep({
          goalId: context.goal.id,
          stepKey: "send_offers",
          status: "completed",
          outputJson: output,
        });
        return output;
      }

      let sent = 0;
      let skipped = 0;
      let failed = 0;
      for (const row of candidates) {
        const to = normalizePhoneNumber(row.contact?.phone ?? null);
        if (!to) {
          skipped += 1;
          continue;
        }

        const message = `Grace scheduling: can you serve as ${row.assignment.roleName} on ${formatShortDateTime(
          context.serviceRun.serviceAt
        )}? Reply YES to confirm, NO to decline, or SWAP for a different time.`;

        const result = await sendOrganizationSms({
          organizationId: context.goal.organizationId,
          to,
          message,
          idempotencyKey: `${context.goal.id}:${row.assignment.id}:offer`,
        });

        if (!result.success) {
          failed += 1;
          continue;
        }

        sent += 1;
        await db
          .update(serviceAssignments)
          .set({
            status: "offered",
            offeredAt: new Date(),
            respondedAt: null,
            responseChannel: null,
            responseText: null,
            updatedAt: new Date(),
          })
          .where(eq(serviceAssignments.id, row.assignment.id));
      }

      const output = {
        attempted: candidates.length,
        sent,
        skipped,
        failed,
      };

      await finishGoalStep({
        goalId: context.goal.id,
        stepKey: "send_offers",
        status: "completed",
        outputJson: output,
      });

      return output;
    });

    await step.run("mark-waiting-window", async () => {
      const waitUntil = new Date(Date.now() + waitHours * 60 * 60 * 1000);
      await finishGoalStep({
        goalId: context.goal.id,
        stepKey: "wait_responses",
        status: "waiting",
        outputJson: {
          waitHours,
          waitUntil: waitUntil.toISOString(),
        },
      });
      await updateGoalStatus(context.goal.id, "waiting", {
        nextRunAt: waitUntil,
        resultJson: {
          offerSummary,
        },
      });
    });

    await step.sleep("wait-for-assignment-responses", `${waitHours}h`);

    await step.run("close-waiting-window", async () => {
      await finishGoalStep({
        goalId: context.goal.id,
        stepKey: "wait_responses",
        status: "completed",
        outputJson: {
          waitedHours: waitHours,
          resumedAt: new Date().toISOString(),
        },
      });
      await updateGoalStatus(context.goal.id, "in_progress", {
        nextRunAt: null,
      });
    });

    const finalSummary = await step.run("evaluate-and-escalate-gaps", async () => {
      await startGoalStep(context.goal.id, "escalate_gaps", {
        serviceRunId: context.serviceRun.id,
      });

      const progress = await summarizeVolunteerStaffingAssignmentProgress({
        organizationId: context.goal.organizationId,
        serviceRunId: context.serviceRun.id,
      });
      const serviceRunAt = toDate(context.serviceRun.serviceAt) ?? new Date();

      if (progress.unresolvedRequiredSeats > 0) {
        const dueDate =
          serviceRunAt.getTime() > Date.now()
            ? new Date(
                Math.max(
                  Date.now() + 60 * 60 * 1000,
                  serviceRunAt.getTime() - 24 * 60 * 60 * 1000
                )
              )
            : new Date(Date.now() + 60 * 60 * 1000);

        await db.insert(tasks).values({
          organizationId: context.goal.organizationId,
          title: `Service coverage gap: ${context.serviceRun.name}`,
          description: `Grace auto-staffing could not confirm all required seats for ${formatShortDateTime(
            serviceRunAt
          )}. Open roles: ${progress.openRequiredRoles.join(", ") || "See assignments board"}.`,
          priority: "high",
          status: "todo",
          dueDate,
        });

        const resultJson = buildVolunteerStaffingGoalResult({
          serviceRunId: context.serviceRun.id,
          status: "escalated",
          summary: {
            statusCounts: progress.statusCounts,
            unresolvedRequiredSeats: progress.unresolvedRequiredSeats,
            openRoles: progress.openRequiredRoles,
            escalatedAt: new Date().toISOString(),
          },
          openRequiredSeats: progress.unresolvedRequiredSeats,
          openRoles: progress.openRequiredRoles,
        });

        await updateGoalStatus(context.goal.id, "escalated", {
          completedAt: new Date(),
          resultJson,
          errorText: `${progress.unresolvedRequiredSeats} required seats remain unconfirmed.`,
        });
        return resultJson;
      }

      const resultJson = buildVolunteerStaffingGoalResult({
        serviceRunId: context.serviceRun.id,
        status: "completed",
        summary: {
          statusCounts: progress.statusCounts,
          unresolvedRequiredSeats: 0,
          openRoles: [],
          completedAt: new Date().toISOString(),
        },
        openRequiredSeats: 0,
        openRoles: [],
      });

      await finishGoalStep({
        goalId: context.goal.id,
        stepKey: "escalate_gaps",
        status: "completed",
        outputJson: resultJson,
      });
      await updateGoalStatus(context.goal.id, "completed", {
        completedAt: new Date(),
        resultJson,
        errorText: null,
      });

      return resultJson;
    });

      logger.info("Grace service autostaff finished", {
        goalId: context.goal.id,
        serviceRunId: context.serviceRun.id,
        finalStatus: finalSummary.status,
      });

      return {
        goalId: context.goal.id,
        waitHours,
        ...finalSummary,
      };
    } catch (error) {
      const errorText =
        error instanceof Error ? error.message : "Grace auto-staff workflow failed";

      await step.run("mark-goal-failed", async () => {
        await updateGoalStatus(context.goal.id, "failed", {
          completedAt: new Date(),
          nextRunAt: null,
          errorText,
        });
      });

      logger.error("Grace service autostaff failed", {
        goalId: context.goal.id,
        serviceRunId: context.serviceRun.id,
        error: errorText,
      });

      throw error;
    }
  }
);
