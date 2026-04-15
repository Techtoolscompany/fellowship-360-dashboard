import {
  AUTOMATION_NODE_TYPES,
  type AutomationDefinition,
  type AutomationNode,
  type AutomationNodeType,
} from "./types";

export const AUTOMATION_ACTION_TYPES = [
  "send_sms",
  "send_email",
  "create_task",
  "broadcast_send",
  "generic",
] as const;

export type AutomationActionType = (typeof AUTOMATION_ACTION_TYPES)[number];

export const AUTOMATION_DELAY_UNITS = ["minutes", "hours", "days", "weeks"] as const;
export type AutomationDelayUnit = (typeof AUTOMATION_DELAY_UNITS)[number];

export const AUTOMATION_CONDITION_TYPES = [
  "contact_replied",
  "email_opened",
  "task_completed",
  "field_matches",
  "engaged",
  "manual_review",
] as const;

export type AutomationConditionType =
  (typeof AUTOMATION_CONDITION_TYPES)[number];

export type AutomationOutlineStepKind = Exclude<AutomationNodeType, "trigger">;

export type AutomationOutlineStep = {
  id: string;
  kind: AutomationOutlineStepKind;
  label: string;
  description?: string | null;
  config?: Record<string, unknown>;
  thenSteps?: AutomationOutlineStep[];
  elseSteps?: AutomationOutlineStep[];
};

export type AutomationOutline = {
  triggerNodeId: string;
  triggerLabel: string;
  steps: AutomationOutlineStep[];
};

function cloneDefinition(definition: AutomationDefinition): AutomationDefinition {
  return JSON.parse(JSON.stringify(definition)) as AutomationDefinition;
}

function cloneOutlineStep(step: AutomationOutlineStep): AutomationOutlineStep {
  return JSON.parse(JSON.stringify(step)) as AutomationOutlineStep;
}

function nextNodeId(type: AutomationNodeType | AutomationOutlineStepKind) {
  return `${type}_${Math.random().toString(36).slice(2, 9)}`;
}

function firstValue<T>(value: T | undefined, fallback: T) {
  return value === undefined ? fallback : value;
}

function normalizeActionType(value: unknown): AutomationActionType {
  const candidate = typeof value === "string" ? value : "";
  return (
    AUTOMATION_ACTION_TYPES.find((item) => item === candidate) ?? "send_sms"
  );
}

function normalizeDelayUnit(value: unknown): AutomationDelayUnit {
  const candidate = typeof value === "string" ? value : "";
  return AUTOMATION_DELAY_UNITS.find((item) => item === candidate) ?? "days";
}

function normalizeConditionType(value: unknown): AutomationConditionType {
  const candidate = typeof value === "string" ? value : "";
  return (
    AUTOMATION_CONDITION_TYPES.find((item) => item === candidate) ?? "contact_replied"
  );
}

export function normalizeAutomationDefinition(
  value: unknown
): AutomationDefinition {
  if (!value || typeof value !== "object") {
    return createBuilderStarterDefinition();
  }

  const raw = value as Partial<AutomationDefinition>;
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) {
    return createBuilderStarterDefinition();
  }

  const nodes: AutomationNode[] = raw.nodes
    .filter((node): node is AutomationNode => {
      return Boolean(node && typeof node === "object" && node.id && node.type && node.label);
    })
    .map((node) => ({
      id: node.id,
      type: AUTOMATION_NODE_TYPES.includes(node.type) ? node.type : "action",
      label: node.label,
      description: node.description ?? null,
      config: node.config ?? {},
      nextIds: Array.isArray(node.nextIds)
        ? Array.from(
            new Set(node.nextIds.filter((nextId) => typeof nextId === "string"))
          )
        : [],
    }));

  if (nodes.length === 0) {
    return createBuilderStarterDefinition();
  }

  const triggerNode = nodes.find((node) => node.type === "trigger");
  return {
    version: Number(raw.version ?? 1),
    startNodeId: raw.startNodeId ?? triggerNode?.id ?? nodes[0]?.id,
    nodes,
  };
}

export function createOutlineStep(
  kind: AutomationOutlineStepKind,
  seed: Partial<AutomationOutlineStep> = {}
): AutomationOutlineStep {
  const id = seed.id ?? nextNodeId(kind);
  const description = firstValue(seed.description, null);
  const config = { ...(seed.config ?? {}) };

  if (kind === "action") {
    const actionType = normalizeActionType(config.actionType);
    return {
      id,
      kind,
      label:
        seed.label ??
        (actionType === "send_email"
          ? "Send email"
          : actionType === "create_task"
            ? "Create task"
            : actionType === "broadcast_send"
              ? "Send broadcast"
              : actionType === "generic"
                ? "Action"
                : "Send SMS"),
      description,
      config: {
        actionType,
        ...config,
      },
    };
  }

  if (kind === "delay") {
    return {
      id,
      kind,
      label: seed.label ?? "Wait",
      description,
      config: {
        amount: Number(config.amount ?? 1) || 1,
        unit: normalizeDelayUnit(config.unit),
        ...config,
      },
    };
  }

  if (kind === "condition") {
    return {
      id,
      kind,
      label: seed.label ?? "Check condition",
      description,
      config: {
        conditionType: normalizeConditionType(config.conditionType),
        ...config,
      },
      thenSteps:
        seed.thenSteps?.map((step) => cloneOutlineStep(step)) ??
        [createOutlineStep("stop", { label: "Stop: engaged" })],
      elseSteps:
        seed.elseSteps?.map((step) => cloneOutlineStep(step)) ??
        [createOutlineStep("stop", { label: "Stop: no match" })],
    };
  }

  return {
    id,
    kind,
    label: seed.label ?? "Stop",
    description,
    config,
  };
}

export function createBuilderStarterDefinition(): AutomationDefinition {
  return outlineToDefinition({
    triggerNodeId: "trigger_manual",
    triggerLabel: "Manual trigger",
    steps: [
      createOutlineStep("action", {
        id: "action_first_step",
        label: "Send first message",
        config: {
          actionType: "send_sms",
        },
      }),
      createOutlineStep("stop", {
        id: "stop_done",
        label: "Stop",
      }),
    ],
  });
}

type SequenceWalkerState = {
  graph: Map<string, AutomationNode>;
  clones: Map<string, number>;
  lineage: Set<string>;
};

function nextClonedId(clones: Map<string, number>, nodeId: string) {
  const count = (clones.get(nodeId) ?? 0) + 1;
  clones.set(nodeId, count);
  return count === 1 ? nodeId : `${nodeId}_clone_${count}`;
}

function definitionNodeToStep(
  node: AutomationNode,
  stepId: string
): AutomationOutlineStep {
  if (node.type === "condition") {
    throw new Error("Condition nodes must be handled separately");
  }

  return createOutlineStep(node.type as Exclude<AutomationNodeType, "trigger" | "condition">, {
    id: stepId,
    label: node.label,
    description: node.description ?? null,
    config: node.config ?? {},
  });
}

function walkSequence(
  startNodeId: string | undefined,
  state: SequenceWalkerState
): AutomationOutlineStep[] {
  if (!startNodeId) return [];

  const steps: AutomationOutlineStep[] = [];
  let currentNodeId: string | undefined = startNodeId;

  while (currentNodeId) {
    if (state.lineage.has(currentNodeId)) {
      steps.push(
        createOutlineStep("stop", {
          label: "Stop loop",
          description: `Loop detected at ${currentNodeId}.`,
        })
      );
      break;
    }

    const node = state.graph.get(currentNodeId);
    if (!node) break;

    const stepId = nextClonedId(state.clones, node.id);
    const lineage = new Set(state.lineage);
    lineage.add(currentNodeId);

    if (node.type === "trigger") {
      currentNodeId = node.nextIds?.[0];
      continue;
    }

    if (node.type === "condition") {
      steps.push(
        createOutlineStep("condition", {
          id: stepId,
          label: node.label,
          description: node.description ?? null,
          config: node.config ?? {},
          thenSteps: walkSequence(node.nextIds?.[0], {
            graph: state.graph,
            clones: new Map(state.clones),
            lineage,
          }),
          elseSteps: walkSequence(node.nextIds?.[1], {
            graph: state.graph,
            clones: new Map(state.clones),
            lineage,
          }),
        })
      );
      break;
    }

    steps.push(definitionNodeToStep(node, stepId));
    if (node.type === "stop") break;

    const nextId = node.nextIds?.[0];
    if (!nextId) break;
    currentNodeId = nextId;
  }

  return steps;
}

export function definitionToOutline(definition: AutomationDefinition): AutomationOutline {
  const normalized = normalizeAutomationDefinition(definition);
  const graph = new Map(normalized.nodes.map((node) => [node.id, node]));
  const triggerNode =
    normalized.nodes.find((node) => node.id === normalized.startNodeId) ??
    normalized.nodes.find((node) => node.type === "trigger");

  if (!triggerNode || triggerNode.type !== "trigger") {
    return {
      triggerNodeId: "trigger_manual",
      triggerLabel: "Manual trigger",
      steps: walkSequence(normalized.startNodeId ?? undefined, {
        graph,
        clones: new Map(),
        lineage: new Set(),
      }),
    };
  }

  return {
    triggerNodeId: triggerNode.id,
    triggerLabel: triggerNode.label,
    steps: walkSequence(triggerNode.nextIds?.[0], {
      graph,
      clones: new Map(),
      lineage: new Set([triggerNode.id]),
    }),
  };
}

function compileSequence(
  steps: AutomationOutlineStep[],
  nextAfterId?: string
): {
  entryId?: string;
  nodes: AutomationNode[];
} {
  if (steps.length === 0) {
    return { entryId: nextAfterId, nodes: [] };
  }

  const nodes: AutomationNode[] = [];

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const nextSiblingId = index < steps.length - 1 ? steps[index + 1]?.id : nextAfterId;

    if (!step) continue;

    if (step.kind === "condition") {
      const thenCompiled = compileSequence(step.thenSteps ?? [], nextSiblingId);
      const elseCompiled = compileSequence(step.elseSteps ?? [], nextSiblingId);

      nodes.push({
        id: step.id,
        type: "condition",
        label: step.label,
        description: step.description ?? null,
        config: { ...(step.config ?? {}) },
        nextIds: [thenCompiled.entryId, elseCompiled.entryId].filter(
          (value): value is string => Boolean(value)
        ),
      });
      nodes.push(...thenCompiled.nodes, ...elseCompiled.nodes);
      continue;
    }

    nodes.push({
      id: step.id,
      type: step.kind,
      label: step.label,
      description: step.description ?? null,
      config: { ...(step.config ?? {}) },
      nextIds:
        step.kind === "stop" || !nextSiblingId ? [] : [nextSiblingId],
    });
  }

  return {
    entryId: steps[0]?.id,
    nodes,
  };
}

export function outlineToDefinition(outline: AutomationOutline): AutomationDefinition {
  const compiled = compileSequence(outline.steps);
  const triggerId = outline.triggerNodeId || nextNodeId("trigger");
  const triggerNode: AutomationNode = {
    id: triggerId,
    type: "trigger",
    label: outline.triggerLabel || "Trigger",
    config: {},
    nextIds: compiled.entryId ? [compiled.entryId] : [],
  };

  return normalizeAutomationDefinition({
    version: 1,
    startNodeId: triggerId,
    nodes: [triggerNode, ...compiled.nodes],
  });
}

export function duplicateOutlineStep(step: AutomationOutlineStep): AutomationOutlineStep {
  const cloned = cloneOutlineStep(step);

  function refreshIds(current: AutomationOutlineStep): AutomationOutlineStep {
    const next: AutomationOutlineStep = {
      ...current,
      id: nextNodeId(current.kind),
    };

    if (current.kind === "condition") {
      next.thenSteps = (current.thenSteps ?? []).map((step) => refreshIds(step));
      next.elseSteps = (current.elseSteps ?? []).map((step) => refreshIds(step));
    }

    return next;
  }

  return refreshIds(cloned);
}

export function replaceOutlineStepKind(
  step: AutomationOutlineStep,
  kind: AutomationOutlineStepKind
): AutomationOutlineStep {
  if (step.kind === kind) {
    return cloneOutlineStep(step);
  }

  return createOutlineStep(kind, {
    label: step.label,
    description: step.description ?? null,
  });
}

export function getActionType(step: AutomationOutlineStep): AutomationActionType {
  return normalizeActionType(step.config?.actionType);
}

export function getDelayAmount(step: AutomationOutlineStep) {
  const amount = Number(step.config?.amount ?? 1);
  return Number.isFinite(amount) && amount > 0 ? amount : 1;
}

export function getDelayUnit(step: AutomationOutlineStep): AutomationDelayUnit {
  return normalizeDelayUnit(step.config?.unit);
}

export function getConditionType(step: AutomationOutlineStep): AutomationConditionType {
  return normalizeConditionType(step.config?.conditionType);
}

export function describeAutomationStep(step: AutomationOutlineStep) {
  if (step.kind === "delay") {
    const amount = getDelayAmount(step);
    const unit = getDelayUnit(step);
    return `Wait ${amount} ${unit}`;
  }

  if (step.kind === "condition") {
    const conditionType = getConditionType(step);
    return conditionType.replaceAll("_", " ");
  }

  if (step.kind === "action") {
    const actionType = getActionType(step);
    return actionType.replaceAll("_", " ");
  }

  return step.label;
}
