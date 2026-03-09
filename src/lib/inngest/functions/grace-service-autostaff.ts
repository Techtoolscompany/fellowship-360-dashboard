import { NonRetriableError } from "inngest";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  churchContacts,
  graceGoals,
  graceGoalSteps,
  organizationMemberships,
  serviceAssignments,
  serviceRuns,
  serviceTemplateRoleSlots,
  tasks,
  users,
  volunteers,
} from "@/db/schema";
import { resolveSmsProvider } from "@/lib/grace/providers/resolver";
import { sendTextBeeSMS } from "@/lib/grace/channels/sms/textbee";
import { inngest } from "../client";
import { INNGEST_EVENTS } from "../events";
import { INNGEST_RETRY_PROFILES } from "../policy";

const AUTOSTAFF_STEPS: Array<{
  stepKey: string;
  title: string;
  runOrder: number;
}> = [
  {
    stepKey: "ensure_assignments",
    title: "Ensure run has assignment seats",
    runOrder: 10,
  },
  {
    stepKey: "seed_assignments",
    title: "Auto-fill seats from recommendations",
    runOrder: 20,
  },
  {
    stepKey: "send_offers",
    title: "Send SMS offers to proposed assignees",
    runOrder: 30,
  },
  {
    stepKey: "wait_responses",
    title: "Wait for volunteer/staff responses",
    runOrder: 40,
  },
  {
    stepKey: "escalate_gaps",
    title: "Escalate unresolved required seats",
    runOrder: 50,
  },
];

function normalizeRoleText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizePhoneNumber(value: string | null | undefined) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

function roleMatchScore(requiredRole: string, candidateRole: string | null | undefined) {
  const required = normalizeRoleText(requiredRole);
  const candidate = normalizeRoleText(candidateRole);
  if (!candidate) return 0;
  if (candidate === required) return 35;
  if (candidate.includes(required) || required.includes(candidate)) return 20;
  return 5;
}

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
  await db
    .update(graceGoals)
    .set({
      status,
      startedAt: extra?.startedAt,
      completedAt: extra?.completedAt,
      nextRunAt: extra?.nextRunAt,
      resultJson: extra?.resultJson,
      errorText: extra?.errorText,
      updatedAt: new Date(),
    })
    .where(eq(graceGoals.id, goalId));
}

async function startGoalStep(
  goalId: string,
  stepKey: string,
  inputJson?: Record<string, unknown>
) {
  await db
    .update(graceGoalSteps)
    .set({
      status: "in_progress",
      startedAt: new Date(),
      completedAt: null,
      inputJson: inputJson ?? null,
      outputJson: null,
      errorText: null,
      attemptCount: sql`${graceGoalSteps.attemptCount} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(graceGoalSteps.goalId, goalId), eq(graceGoalSteps.stepKey, stepKey)));
}

async function finishGoalStep(params: {
  goalId: string;
  stepKey: string;
  status: "waiting" | "completed" | "failed" | "skipped";
  outputJson?: Record<string, unknown>;
  errorText?: string | null;
}) {
  await db
    .update(graceGoalSteps)
    .set({
      status: params.status,
      outputJson: params.outputJson ?? null,
      errorText: params.errorText ?? null,
      completedAt: params.status === "waiting" ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(graceGoalSteps.goalId, params.goalId), eq(graceGoalSteps.stepKey, params.stepKey))
    );
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

      const [volunteerPool, staffPool] = await Promise.all([
        db
          .select({
            volunteerId: volunteers.id,
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
      ]);

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
      }> = [];

      for (const assignment of unassigned) {
        const candidates: Array<{
          type: "volunteer" | "staff";
          id: string;
          score: number;
        }> = [];

        if (assignment.assignmentType !== "paid_staff") {
          for (const volunteer of volunteerPool) {
            const score =
              40 +
              roleMatchScore(assignment.roleName, volunteer.role) +
              Math.min(12, Math.floor(Number(volunteer.totalHours ?? 0) / 20));
            candidates.push({
              type: "volunteer",
              id: volunteer.volunteerId,
              score,
            });
          }
        }

        if (assignment.assignmentType !== "volunteer") {
          for (const staff of staffPool) {
            const leadershipBoost =
              normalizeRoleText(assignment.roleName).includes("leader") &&
              (staff.membershipRole === "admin" || staff.membershipRole === "owner")
                ? 12
                : 0;
            const score =
              45 + roleMatchScore(assignment.roleName, staff.membershipRole) + leadershipBoost;
            candidates.push({
              type: "staff",
              id: staff.userId,
              score,
            });
          }
        }

        candidates.sort((a, b) => b.score - a.score);

        const candidate =
          candidates.find(
            (row) =>
              (row.type === "volunteer" && !usedVolunteerIds.has(row.id)) ||
              (row.type === "staff" && !usedStaffIds.has(row.id))
          ) ?? candidates[0];

        if (!candidate) {
          continue;
        }

        if (candidate.type === "volunteer") {
          usedVolunteerIds.add(candidate.id);
          updates.push({
            assignmentId: assignment.id,
            volunteerId: candidate.id,
            staffUserId: null,
          });
        } else {
          usedStaffIds.add(candidate.id);
          updates.push({
            assignmentId: assignment.id,
            volunteerId: null,
            staffUserId: candidate.id,
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
            notes: "Auto-assigned by Grace candidate matching",
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

      const smsProvider = await resolveSmsProvider(context.goal.organizationId);
      if (!smsProvider) {
        const output = {
          attempted: candidates.length,
          sent: 0,
          skipped: candidates.length,
          failed: 0,
          reason: "SMS provider not configured",
        };
        await finishGoalStep({
          goalId: context.goal.id,
          stepKey: "send_offers",
          status: "skipped",
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

        const result = await sendTextBeeSMS({
          to,
          message,
          idempotencyKey: `${context.goal.id}:${row.assignment.id}:offer`,
          config: smsProvider,
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

      const rows = await db
        .select({
          assignment: serviceAssignments,
          roleSlot: serviceTemplateRoleSlots,
        })
        .from(serviceAssignments)
        .leftJoin(serviceTemplateRoleSlots, eq(serviceAssignments.roleSlotId, serviceTemplateRoleSlots.id))
        .where(eq(serviceAssignments.serviceRunId, context.serviceRun.id))
        .orderBy(serviceAssignments.roleName, desc(serviceAssignments.createdAt));

      const satisfiedStatuses = new Set(["confirmed", "checked_in", "checked_out"]);
      const statusCounts = rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.assignment.status] = (acc[row.assignment.status] ?? 0) + 1;
        return acc;
      }, {});

      const requiredOpenRows = rows.filter((row) => {
        const isRequired = row.roleSlot?.isRequired ?? true;
        if (!isRequired) return false;
        return !satisfiedStatuses.has(row.assignment.status);
      });

      const uniqueOpenRoles = Array.from(new Set(requiredOpenRows.map((row) => row.assignment.roleName)));
      const unresolvedRequiredSeats = requiredOpenRows.length;
      const serviceRunAt = toDate(context.serviceRun.serviceAt) ?? new Date();

      if (unresolvedRequiredSeats > 0) {
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
          )}. Open roles: ${uniqueOpenRoles.join(", ") || "See assignments board"}.`,
          priority: "high",
          status: "todo",
          dueDate,
        });

        const resultJson = {
          statusCounts,
          unresolvedRequiredSeats,
          openRoles: uniqueOpenRoles,
          escalatedAt: new Date().toISOString(),
        };

        await finishGoalStep({
          goalId: context.goal.id,
          stepKey: "escalate_gaps",
          status: "completed",
          outputJson: resultJson,
        });
        await updateGoalStatus(context.goal.id, "escalated", {
          completedAt: new Date(),
          resultJson,
          errorText: `${unresolvedRequiredSeats} required seats remain unconfirmed.`,
        });
        return {
          status: "escalated",
          ...resultJson,
        };
      }

      const resultJson = {
        statusCounts,
        unresolvedRequiredSeats: 0,
        openRoles: [],
        completedAt: new Date().toISOString(),
      };

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

      return {
        status: "completed",
        ...resultJson,
      };
    });

      logger.info("Grace service autostaff finished", {
        goalId: context.goal.id,
        serviceRunId: context.serviceRun.id,
        finalStatus: finalSummary.status,
      });

      return {
        goalId: context.goal.id,
        serviceRunId: context.serviceRun.id,
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
