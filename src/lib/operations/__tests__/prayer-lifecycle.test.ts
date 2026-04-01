import { describe, expect, it } from "vitest";
import { derivePrayerLifecycleEffects } from "@/lib/operations/prayer-lifecycle";

describe("prayer lifecycle helpers", () => {
  it("keeps active requests in follow-up loop and escalation when needed", () => {
    expect(
      derivePrayerLifecycleEffects({
        status: "new",
        escalationPriority: "urgent",
      })
    ).toEqual({
      ensureEscalationTask: true,
      closeEscalationTasks: false,
      enqueueFollowupSequence: true,
    });

    expect(
      derivePrayerLifecycleEffects({
        status: "praying",
        escalationPriority: "none",
      })
    ).toEqual({
      ensureEscalationTask: false,
      closeEscalationTasks: false,
      enqueueFollowupSequence: true,
    });
  });

  it("closes escalation and stops follow-up for inactive requests", () => {
    expect(
      derivePrayerLifecycleEffects({
        status: "answered",
        escalationPriority: "high",
      })
    ).toEqual({
      ensureEscalationTask: false,
      closeEscalationTasks: true,
      enqueueFollowupSequence: false,
    });

    expect(
      derivePrayerLifecycleEffects({
        status: "archived",
        escalationPriority: "none",
      })
    ).toEqual({
      ensureEscalationTask: false,
      closeEscalationTasks: true,
      enqueueFollowupSequence: false,
    });
  });
});
