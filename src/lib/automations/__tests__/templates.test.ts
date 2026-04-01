import { describe, expect, it } from "vitest";
import {
  getAutomationTemplateByKey,
  getAutomationTemplateCatalog,
} from "@/lib/automations/templates";
import { validateAutomationDefinition } from "@/lib/automations/validation";

describe("automation template catalog", () => {
  it("includes the post-launch template set", () => {
    const templates = getAutomationTemplateCatalog();
    const keys = new Set(templates.map((template) => template.key));

    expect(keys.has("visitor_follow_up")).toBe(true);
    expect(keys.has("missed_call_recovery")).toBe(true);
    expect(keys.has("first_time_guest_appointment")).toBe(true);
    expect(keys.has("prayer_request_followup")).toBe(true);
    expect(keys.has("appointment_reminders_no_show_recovery")).toBe(true);
    expect(keys.has("new_member_30_day")).toBe(true);
    expect(keys.has("volunteer_onboarding")).toBe(true);
    expect(keys.has("inactive_member_reengagement")).toBe(true);
    expect(keys.has("event_rsvp_reminders")).toBe(true);
  });

  it("ships valid definitions for all templates", () => {
    const templates = getAutomationTemplateCatalog();

    for (const template of templates) {
      expect(validateAutomationDefinition(template.definition)).toEqual([]);
    }
  });

  it("returns cloned definitions from lookups", () => {
    const first = getAutomationTemplateByKey("new_member_30_day");
    expect(first).not.toBeNull();
    if (!first) return;

    first.definition.nodes[0]!.label = "Mutated Label";
    const second = getAutomationTemplateByKey("new_member_30_day");

    expect(second?.definition.nodes[0]?.label).toBe("New member created");
  });
});
