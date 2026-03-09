export type ServiceRunLike = {
  run: {
    id: string;
    status: string;
    serviceAt: string | Date;
  };
};

export function getNextUpcomingServiceRun<T extends ServiceRunLike>(runs: T[]) {
  const now = Date.now();
  const upcomingRuns = runs
    .filter((row) => {
      if (row.run.status === "cancelled" || row.run.status === "completed") {
        return false;
      }
      return new Date(row.run.serviceAt).getTime() >= now;
    })
    .sort(
      (a, b) =>
        new Date(a.run.serviceAt).getTime() - new Date(b.run.serviceAt).getTime()
    );

  return upcomingRuns[0] ?? null;
}

export function getPreferredServiceRunId<T extends ServiceRunLike>(
  runs: T[],
  currentId: string | null
) {
  if (currentId && runs.some((row) => row.run.id === currentId)) {
    return currentId;
  }
  const nextUpcoming = getNextUpcomingServiceRun(runs);
  return nextUpcoming?.run.id ?? runs[0]?.run.id ?? null;
}

export type RoleSlotLike<TRoleAssignment extends string> = {
  id: string;
  roleName: string;
  assignmentType: TRoleAssignment;
  isRequired: boolean;
  requiredCount: number;
};

export type AssignmentRowLike = {
  assignment: {
    roleSlotId: string | null;
    roleName: string;
    status: string;
    volunteerId: string | null;
    staffUserId: string | null;
  };
};

export type ServiceRunMatrixRow<TRoleAssignment extends string> = {
  roleSlotId: string;
  roleName: string;
  assignmentType: TRoleAssignment;
  isRequired: boolean;
  seatsNeeded: number;
  seatsFilled: number;
  seatsConfirmed: number;
  seatsOpen: number;
  seatsAtRisk: number;
  coveragePercent: number;
};

function hasAssignee(row: AssignmentRowLike) {
  return Boolean(row.assignment.volunteerId || row.assignment.staffUserId);
}

function isFilled(row: AssignmentRowLike, atRiskStatuses: readonly string[]) {
  if (!hasAssignee(row)) return false;
  return !atRiskStatuses.includes(row.assignment.status);
}

function isConfirmed(row: AssignmentRowLike) {
  return (
    row.assignment.status === "confirmed" ||
    row.assignment.status === "checked_in" ||
    row.assignment.status === "checked_out"
  );
}

export function buildServiceRunRoleMatrix<TRoleAssignment extends string>(
  roleSlots: Array<RoleSlotLike<TRoleAssignment>>,
  assignments: AssignmentRowLike[],
  atRiskStatuses: readonly string[]
): Array<ServiceRunMatrixRow<TRoleAssignment>> {
  return roleSlots
    .map((roleSlot) => {
      const roleAssignments = assignments.filter((row) => {
        if (row.assignment.roleSlotId) {
          return row.assignment.roleSlotId === roleSlot.id;
        }
        return row.assignment.roleName === roleSlot.roleName;
      });

      const seatsNeeded = Math.max(1, roleSlot.requiredCount);
      const seatsFilled = roleAssignments.filter((row) =>
        isFilled(row, atRiskStatuses)
      ).length;
      const seatsConfirmed = roleAssignments.filter(isConfirmed).length;
      const seatsAtRisk = roleAssignments.filter((row) =>
        atRiskStatuses.includes(row.assignment.status)
      ).length;
      const seatsOpen = Math.max(seatsNeeded - seatsFilled, 0);
      const coveragePercent =
        seatsNeeded > 0 ? Math.min(100, Math.round((seatsFilled / seatsNeeded) * 100)) : 100;

      return {
        roleSlotId: roleSlot.id,
        roleName: roleSlot.roleName,
        assignmentType: roleSlot.assignmentType,
        isRequired: roleSlot.isRequired,
        seatsNeeded,
        seatsFilled,
        seatsConfirmed,
        seatsOpen,
        seatsAtRisk,
        coveragePercent,
      };
    })
    .sort(
      (a, b) =>
        Number(b.isRequired) - Number(a.isRequired) ||
        b.seatsOpen - a.seatsOpen ||
        a.roleName.localeCompare(b.roleName)
    );
}

export function summarizeRoleMatrix<
  TRoleAssignment extends string,
  TRow extends ServiceRunMatrixRow<TRoleAssignment>,
>(rows: TRow[]) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.seatsNeeded += row.seatsNeeded;
      acc.seatsFilled += row.seatsFilled;
      acc.seatsConfirmed += row.seatsConfirmed;
      acc.seatsOpen += row.seatsOpen;
      acc.seatsAtRisk += row.seatsAtRisk;
      return acc;
    },
    {
      seatsNeeded: 0,
      seatsFilled: 0,
      seatsConfirmed: 0,
      seatsOpen: 0,
      seatsAtRisk: 0,
    }
  );

  return {
    ...totals,
    coveragePercent:
      totals.seatsNeeded > 0
        ? Math.min(100, Math.round((totals.seatsFilled / totals.seatsNeeded) * 100))
        : 0,
  };
}
