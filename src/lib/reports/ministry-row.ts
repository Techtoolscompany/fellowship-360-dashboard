export type MinistryAggregateRow = {
  name: string;
  members: number | string | null;
  growth: number | string | null;
  leaderFirstName: string | null;
  leaderLastName: string | null;
};

export type ReportMinistryRow = {
  name: string;
  members: number;
  leaderName: string | null;
  newMembersInWindow: number;
  growthRatePercent: number;
  participation: number;
};

export function shapeReportMinistryRows(
  ministryRows: MinistryAggregateRow[]
): ReportMinistryRow[] {
  const maxMinistryMembers = ministryRows.reduce(
    (max, row) => Math.max(max, Number(row.members ?? 0)),
    0
  );

  return ministryRows.map((row) => {
    const members = Number(row.members ?? 0);
    const newMembersInWindow = Number(row.growth ?? 0);
    const baseline = Math.max(members - newMembersInWindow, 0);

    return {
      name: row.name,
      members,
      leaderName:
        `${row.leaderFirstName ?? ""} ${row.leaderLastName ?? ""}`.trim() || null,
      newMembersInWindow,
      growthRatePercent:
        baseline === 0
          ? newMembersInWindow > 0
            ? 100
            : 0
          : Math.round((newMembersInWindow / baseline) * 100),
      participation: maxMinistryMembers
        ? Math.min(Math.round((members / maxMinistryMembers) * 100), 100)
        : 0,
    };
  });
}
