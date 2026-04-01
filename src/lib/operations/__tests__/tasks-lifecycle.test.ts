import { describe, expect, it } from "vitest";
import {
  assertTaskStatusTransition,
  canTransitionTaskStatus,
  computeTaskSlaStatus,
  normalizeOptionalTaskDueDate,
} from "@/lib/operations/tasks-lifecycle";

describe("tasks lifecycle helpers", () => {
  it("allows expected status transitions", () => {
    expect(canTransitionTaskStatus("todo", "in_progress")).toBe(true);
    expect(canTransitionTaskStatus("in_progress", "done")).toBe(true);
    expect(canTransitionTaskStatus("done", "todo")).toBe(true);
  });

  it("blocks invalid status transitions", () => {
    expect(canTransitionTaskStatus("done", "cancelled")).toBe(false);
    expect(canTransitionTaskStatus("cancelled", "done")).toBe(false);
    expect(() => assertTaskStatusTransition("done", "cancelled")).toThrow(
      'Cannot transition task from "done" to "cancelled"'
    );
  });

  it("computes SLA buckets deterministically", () => {
    const now = new Date("2026-03-12T12:00:00.000Z");

    expect(
      computeTaskSlaStatus(
        { status: "todo", dueDate: new Date("2026-03-12T11:59:59.000Z") },
        now
      )
    ).toBe("overdue");

    expect(
      computeTaskSlaStatus(
        { status: "in_progress", dueDate: new Date("2026-03-13T11:59:00.000Z") },
        now
      )
    ).toBe("due_soon");

    expect(
      computeTaskSlaStatus(
        { status: "todo", dueDate: new Date("2026-03-15T11:00:00.000Z") },
        now
      )
    ).toBe("due_next_72h");

    expect(
      computeTaskSlaStatus(
        { status: "todo", dueDate: new Date("2026-03-20T12:00:00.000Z") },
        now
      )
    ).toBe("on_track");

    expect(computeTaskSlaStatus({ status: "todo", dueDate: null }, now)).toBe(
      "no_due_date"
    );
    expect(
      computeTaskSlaStatus(
        { status: "done", dueDate: new Date("2026-03-20T12:00:00.000Z") },
        now
      )
    ).toBe("closed");
  });

  it("normalizes due dates and rejects invalid values", () => {
    expect(normalizeOptionalTaskDueDate(undefined)).toBeNull();
    expect(normalizeOptionalTaskDueDate(null)).toBeNull();
    expect(normalizeOptionalTaskDueDate("")).toBeNull();
    expect(normalizeOptionalTaskDueDate("2026-03-12T10:00:00.000Z")).toEqual(
      new Date("2026-03-12T10:00:00.000Z")
    );
    expect(() => normalizeOptionalTaskDueDate("not-a-date")).toThrow(
      "Invalid dueDate"
    );
  });
});
