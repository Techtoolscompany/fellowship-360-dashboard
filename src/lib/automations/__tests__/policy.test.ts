import { describe, expect, it } from "vitest";
import { evaluateEnrollmentPolicy, isWithinQuietHours } from "@/lib/automations/policy";

describe("isWithinQuietHours", () => {
  it("handles overnight quiet windows", () => {
    expect(
      isWithinQuietHours({
        now: new Date(2026, 2, 12, 22, 15),
        quietHoursEnabled: true,
        quietHoursStart: "21:00",
        quietHoursEnd: "08:00",
      })
    ).toBe(true);

    expect(
      isWithinQuietHours({
        now: new Date(2026, 2, 12, 14, 0),
        quietHoursEnabled: true,
        quietHoursStart: "21:00",
        quietHoursEnd: "08:00",
      })
    ).toBe(false);
  });

  it("handles same-day quiet windows", () => {
    expect(
      isWithinQuietHours({
        now: new Date(2026, 2, 12, 10, 30),
        quietHoursEnabled: true,
        quietHoursStart: "09:00",
        quietHoursEnd: "17:00",
      })
    ).toBe(true);
  });
});

describe("evaluateEnrollmentPolicy", () => {
  it("blocks enrolled contacts in once_per_contact mode", () => {
    const result = evaluateEnrollmentPolicy({
      enrollmentMode: "once_per_contact",
      reentryCooldownMinutes: 60,
      hasPriorRun: true,
      latestRunAt: new Date("2026-03-12T10:00:00.000Z"),
      hasOptOut: false,
      respectOptOut: true,
      dailySendCap: 250,
      runsToday: 1,
      now: new Date("2026-03-12T11:00:00.000Z"),
    });

    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.reason).toBe("already_enrolled");
  });

  it("allows re-entry after cooldown expires", () => {
    const result = evaluateEnrollmentPolicy({
      enrollmentMode: "cooldown",
      reentryCooldownMinutes: 60,
      hasPriorRun: true,
      latestRunAt: new Date("2026-03-12T08:00:00.000Z"),
      hasOptOut: false,
      respectOptOut: true,
      dailySendCap: 250,
      runsToday: 2,
      now: new Date("2026-03-12T09:30:00.000Z"),
    });

    expect(result.allowed).toBe(true);
  });

  it("blocks when daily cap is reached", () => {
    const result = evaluateEnrollmentPolicy({
      enrollmentMode: "every_trigger",
      reentryCooldownMinutes: 60,
      hasPriorRun: false,
      latestRunAt: null,
      hasOptOut: false,
      respectOptOut: true,
      dailySendCap: 2,
      runsToday: 2,
      now: new Date("2026-03-12T09:30:00.000Z"),
    });

    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.reason).toBe("daily_send_cap_reached");
  });
});
