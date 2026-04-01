import { describe, expect, it } from "vitest";
import { validateAutomationDefinition } from "@/lib/automations/validation";
import { createBuilderStarterDefinition } from "@/lib/automations/templates";

describe("validateAutomationDefinition", () => {
  it("accepts a valid starter definition", () => {
    const definition = createBuilderStarterDefinition();
    expect(validateAutomationDefinition(definition)).toEqual([]);
  });

  it("rejects workflows with multiple trigger nodes", () => {
    const definition = createBuilderStarterDefinition();
    definition.nodes.push({
      id: "trigger_secondary",
      type: "trigger",
      label: "Second trigger",
      nextIds: ["action_first_step"],
    });

    expect(validateAutomationDefinition(definition)).toContain(
      "Workflow must include exactly one trigger node."
    );
  });

  it("rejects missing node references", () => {
    const definition = createBuilderStarterDefinition();
    definition.nodes[1].nextIds = ["missing_node"];

    expect(validateAutomationDefinition(definition)).toContain(
      'Node action_first_step references missing next node "missing_node".'
    );
  });

  it("requires condition nodes to branch", () => {
    const definition = createBuilderStarterDefinition();
    definition.nodes = [
      {
        id: "trigger_manual",
        type: "trigger",
        label: "Manual",
        nextIds: ["condition_only_one"],
      },
      {
        id: "condition_only_one",
        type: "condition",
        label: "Condition",
        nextIds: ["stop_done"],
      },
      {
        id: "stop_done",
        type: "stop",
        label: "Stop",
        nextIds: [],
      },
    ];

    expect(validateAutomationDefinition(definition)).toContain(
      "Condition node condition_only_one must branch to at least two nodes."
    );
  });
});
