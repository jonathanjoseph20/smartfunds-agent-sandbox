import type { WorkflowDefinition, WorkflowNode, WorkflowValidationResult } from './workflow-types.ts';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function sortNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  return [...nodes].sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeDependsOn(dependsOn: string[] | undefined): string[] {
  if (!dependsOn) {
    return [];
  }

  return sortedUnique(dependsOn);
}

function findCycle(nodeIds: string[], adjacency: Map<string, string[]>): string[] | null {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const indexByNode = new Map<string, number>();

  const visit = (nodeId: string): string[] | null => {
    if (visited.has(nodeId)) {
      return null;
    }

    visiting.add(nodeId);
    indexByNode.set(nodeId, stack.length);
    stack.push(nodeId);

    const neighbors = adjacency.get(nodeId) ?? [];
    for (const neighbor of neighbors) {
      if (visiting.has(neighbor)) {
        const cycleStart = indexByNode.get(neighbor) ?? 0;
        return stack.slice(cycleStart);
      }

      const nested = visit(neighbor);
      if (nested) {
        return nested;
      }
    }

    stack.pop();
    indexByNode.delete(nodeId);
    visiting.delete(nodeId);
    visited.add(nodeId);

    return null;
  };

  for (const nodeId of nodeIds) {
    if (visited.has(nodeId)) {
      continue;
    }

    const cycle = visit(nodeId);
    if (cycle) {
      if (cycle.length === 0) {
        return cycle;
      }

      let minIndex = 0;
      for (let index = 1; index < cycle.length; index += 1) {
        if (cycle[index].localeCompare(cycle[minIndex]) < 0) {
          minIndex = index;
        }
      }

      return [...cycle.slice(minIndex), ...cycle.slice(0, minIndex)];
    }
  }

  return null;
}

export function validateWorkflowDefinition(input: WorkflowDefinition): WorkflowValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      valid: false,
      errors: ['workflow.schema_invalid: root must be an object']
    };
  }

  if (!isNonEmptyString(input.workflowId)) {
    errors.push('workflow.schema_invalid: workflowId must be a non-empty string');
  }

  if (!Array.isArray(input.nodes)) {
    errors.push('workflow.schema_invalid: nodes must be a non-empty array');
    return {
      valid: false,
      errors: sortedUnique(errors)
    };
  }

  if (input.nodes.length === 0) {
    errors.push('workflow.schema_invalid: nodes must be a non-empty array');
  }

  const validatedNodes: WorkflowNode[] = [];
  const nodeIds: string[] = [];

  for (let index = 0; index < input.nodes.length; index += 1) {
    const node = input.nodes[index] as WorkflowNode;

    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      errors.push(`workflow.schema_invalid: nodes[${index}] must be an object`);
      continue;
    }

    if (!isNonEmptyString(node.id)) {
      errors.push(`workflow.schema_invalid: nodes[${index}].id must be a non-empty string`);
    }

    if (!isNonEmptyString(node.task)) {
      errors.push(`workflow.schema_invalid: nodes[${index}].task must be a non-empty string`);
    }

    if (node.agent !== undefined && !isNonEmptyString(node.agent)) {
      errors.push(`workflow.schema_invalid: nodes[${index}].agent must be a non-empty string when provided`);
    }

    if (node.phase !== undefined && !isNonEmptyString(node.phase)) {
      errors.push(`workflow.schema_invalid: nodes[${index}].phase must be a non-empty string when provided`);
    }

    if (
      node.dependsOn !== undefined &&
      (!Array.isArray(node.dependsOn) || !node.dependsOn.every((dep) => isNonEmptyString(dep)))
    ) {
      errors.push(`workflow.schema_invalid: nodes[${index}].dependsOn must be an array of non-empty strings`);
    }

    if (
      isNonEmptyString(node.id) &&
      isNonEmptyString(node.task) &&
      (node.agent === undefined || isNonEmptyString(node.agent)) &&
      (node.phase === undefined || isNonEmptyString(node.phase)) &&
      (node.dependsOn === undefined || (Array.isArray(node.dependsOn) && node.dependsOn.every((dep) => isNonEmptyString(dep))))
    ) {
      validatedNodes.push({
        id: node.id,
        task: node.task,
        ...(node.agent ? { agent: node.agent } : {}),
        ...(node.phase ? { phase: node.phase } : {}),
        dependsOn: normalizeDependsOn(node.dependsOn)
      });
      nodeIds.push(node.id);
    }
  }

  const duplicates = nodeIds.filter((nodeId, index) => nodeIds.indexOf(nodeId) !== index);
  for (const duplicate of sortedUnique(duplicates)) {
    errors.push(`workflow.duplicate_node_id: ${duplicate}`);
  }

  const sortedNodes = sortNodes(validatedNodes);
  const nodeSet = new Set(sortedNodes.map((node) => node.id));

  for (const node of sortedNodes) {
    const dependencies = normalizeDependsOn(node.dependsOn);
    for (const dependency of dependencies) {
      if (dependency === node.id) {
        errors.push(`workflow.self_dependency: node=${node.id}`);
      }

      if (!nodeSet.has(dependency)) {
        errors.push(`workflow.missing_dependency: node=${node.id} dependsOn=${dependency}`);
      }
    }
  }

  const adjacency = new Map<string, string[]>();
  for (const node of sortedNodes) {
    adjacency.set(node.id, []);
  }

  for (const node of sortedNodes) {
    const dependencies = normalizeDependsOn(node.dependsOn);
    for (const dependency of dependencies) {
      if (!nodeSet.has(dependency)) {
        continue;
      }

      const neighbors = adjacency.get(dependency) ?? [];
      neighbors.push(node.id);
      adjacency.set(dependency, sortedUnique(neighbors));
    }
  }

  const cycle = findCycle(
    sortedNodes.map((node) => node.id),
    adjacency
  );

  if (cycle && cycle.length > 0) {
    errors.push(`workflow.cycle_detected: ${cycle.join('->')}`);
  }

  return {
    valid: errors.length === 0,
    errors: sortedUnique(errors)
  };
}
