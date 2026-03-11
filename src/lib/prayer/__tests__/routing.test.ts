import { describe, expect, it } from "vitest";
import {
  buildPrayerEscalationTaskMarker,
  buildPrayerEscalationTaskTitle,
  isPrayerRequestActive,
  normalizePrayerStatus,
  normalizePrayerUrgency,
  resolvePrayerRouting,
} from "../routing";

describe("prayer routing helpers", () => {
  it("normalizes unknown urgency to normal", () => {
    expect(normalizePrayerUrgency("invalid")).toBe("normal");
    expect(normalizePrayerUrgency(undefined)).toBe("normal");
  });

  it("normalizes unknown status to new", () => {
    expect(normalizePrayerStatus("active")).toBe("new");
    expect(normalizePrayerStatus(undefined)).toBe("new");
  });

  it("marks only new/praying as active", () => {
    expect(isPrayerRequestActive("new")).toBe(true);
    expect(isPrayerRequestActive("praying")).toBe(true);
    expect(isPrayerRequestActive("answered")).toBe(false);
    expect(isPrayerRequestActive("archived")).toBe(false);
  });

  it("routes critical language to Pastoral Team with urgent escalation", () => {
    const routing = resolvePrayerRouting({
      content: "Please pray for safety right now, this is an emergency at home.",
      urgency: "normal",
    });

    expect(routing.urgency).toBe("critical");
    expect(routing.assignedTeam).toBe("Pastoral Team");
    expect(routing.escalationPriority).toBe("urgent");
  });

  it("respects explicit assigned team override", () => {
    const routing = resolvePrayerRouting({
      content: "Need prayer for surgery this week",
      urgency: "urgent",
      assignedTeam: "Family Care",
    });

    expect(routing.urgency).toBe("urgent");
    expect(routing.assignedTeam).toBe("Family Care");
    expect(routing.escalationPriority).toBe("high");
  });

  it("builds deterministic task marker and readable title", () => {
    expect(buildPrayerEscalationTaskMarker("req-123")).toBe("[PrayerRequest:req-123]");
    expect(
      buildPrayerEscalationTaskTitle({
        requesterName: "Jane Doe",
        urgency: "critical",
      })
    ).toBe("Critical prayer follow-up: Jane Doe");
  });
});
