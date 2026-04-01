import { AUTOMATION_NODE_TYPES, type AutomationDefinition, type AutomationNode } from "./types";

function hasPathToStop(startNodeId: string, graph: Map<string, AutomationNode>) {
  const stack = [startNodeId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const nodeId = stack.pop();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = graph.get(nodeId);
    if (!node) continue;
    if (node.type === "stop") return true;

    for (const nextId of node.nextIds ?? []) {
      if (!visited.has(nextId)) {
        stack.push(nextId);
      }
    }
  }

  return false;
}

export function validateAutomationDefinition(definition: AutomationDefinition) {
  const errors: string[] = [];

  if (!definition || !Array.isArray(definition.nodes)) {
    return ["Definition must include a nodes array."];
  }

  if (definition.nodes.length === 0) {
    return ["Definition must include at least one node."];
  }

  const graph = new Map<string, AutomationNode>();
  const duplicatedNodeIds = new Set<string>();

  for (const node of definition.nodes) {
    if (!node.id?.trim()) {
      errors.push("Every node must include a non-empty id.");
      continue;
    }

    if (graph.has(node.id)) {
      duplicatedNodeIds.add(node.id);
    }

    graph.set(node.id, node);

    if (!AUTOMATION_NODE_TYPES.includes(node.type)) {
      errors.push(`Node ${node.id} has unsupported type \"${String(node.type)}\".`);
    }

    if (!node.label?.trim()) {
      errors.push(`Node ${node.id} must include a label.`);
    }
  }

  if (duplicatedNodeIds.size > 0) {
    errors.push(`Duplicate node id(s): ${Array.from(duplicatedNodeIds).join(", ")}.`);
  }

  const triggerNodes = definition.nodes.filter((node) => node.type === "trigger");
  const stopNodes = definition.nodes.filter((node) => node.type === "stop");

  if (triggerNodes.length !== 1) {
    errors.push("Workflow must include exactly one trigger node.");
  }

  if (stopNodes.length === 0) {
    errors.push("Workflow must include at least one stop node.");
  }

  const startNodeId = definition.startNodeId ?? triggerNodes[0]?.id;

  if (!startNodeId) {
    errors.push("Workflow start node could not be resolved.");
  } else if (!graph.has(startNodeId)) {
    errors.push(`Start node \"${startNodeId}\" does not exist.`);
  }

  for (const node of definition.nodes) {
    const nextIds = node.nextIds ?? [];

    for (const nextId of nextIds) {
      if (!graph.has(nextId)) {
        errors.push(`Node ${node.id} references missing next node \"${nextId}\".`);
      }
    }

    if (node.type === "trigger" && nextIds.length === 0) {
      errors.push(`Trigger node ${node.id} must have at least one outgoing edge.`);
    }

    if (node.type === "condition" && nextIds.length < 2) {
      errors.push(`Condition node ${node.id} must branch to at least two nodes.`);
    }

    if (node.type === "stop" && nextIds.length > 0) {
      errors.push(`Stop node ${node.id} cannot have outgoing edges.`);
    }
  }

  if (startNodeId && graph.has(startNodeId)) {
    const reachable = new Set<string>();
    const queue: string[] = [startNodeId];

    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (!nodeId || reachable.has(nodeId)) continue;
      reachable.add(nodeId);

      const node = graph.get(nodeId);
      if (!node) continue;

      for (const nextId of node.nextIds ?? []) {
        if (!reachable.has(nextId)) {
          queue.push(nextId);
        }
      }
    }

    const unreachable = definition.nodes
      .filter((node) => !reachable.has(node.id))
      .map((node) => node.id);

    if (unreachable.length > 0) {
      errors.push(`Unreachable node(s): ${unreachable.join(", ")}.`);
    }

    if (!hasPathToStop(startNodeId, graph)) {
      errors.push("No executable path reaches a stop node.");
    }
  }

  return Array.from(new Set(errors));
}
