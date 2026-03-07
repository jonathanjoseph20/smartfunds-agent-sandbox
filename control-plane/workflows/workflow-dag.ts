import type { RunnableNode, ValidatedWorkflowDefinition, WorkflowNode } from './workflow-types.ts';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function sortNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  return [...nodes].sort((left, right) => left.id.localeCompare(right.id));
}

export class WorkflowDag {
  private readonly workflowId: string;
  private readonly nodeById: Map<string, WorkflowNode>;
  private readonly nodeIds: string[];
  private readonly executionOrder: string[];

  constructor(workflow: ValidatedWorkflowDefinition) {
    this.workflowId = workflow.workflowId;
    const sortedNodes = sortNodes(workflow.nodes).map((node) => ({
      ...node,
      dependsOn: sortedUnique(node.dependsOn ?? [])
    }));

    this.nodeById = new Map(sortedNodes.map((node) => [node.id, node]));
    this.nodeIds = sortedNodes.map((node) => node.id);
    this.executionOrder = this.computeExecutionOrder();
  }

  private computeExecutionOrder(): string[] {
    const inDegree = new Map<string, number>(this.nodeIds.map((nodeId) => [nodeId, 0]));
    const adjacency = new Map<string, string[]>(this.nodeIds.map((nodeId) => [nodeId, []]));

    for (const nodeId of this.nodeIds) {
      const node = this.nodeById.get(nodeId);
      const dependencies = sortedUnique(node?.dependsOn ?? []);
      for (const dependency of dependencies) {
        if (!this.nodeById.has(dependency)) {
          continue;
        }

        const neighbors = adjacency.get(dependency) ?? [];
        neighbors.push(nodeId);
        adjacency.set(dependency, sortedUnique(neighbors));
        inDegree.set(nodeId, (inDegree.get(nodeId) ?? 0) + 1);
      }
    }

    const available = this.nodeIds
      .filter((nodeId) => (inDegree.get(nodeId) ?? 0) === 0)
      .sort((left, right) => left.localeCompare(right));

    const order: string[] = [];
    while (available.length > 0) {
      const next = available.shift();
      if (!next) {
        break;
      }

      order.push(next);

      for (const neighbor of adjacency.get(next) ?? []) {
        const nextDegree = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, nextDegree);
        if (nextDegree === 0) {
          available.push(neighbor);
          available.sort((left, right) => left.localeCompare(right));
        }
      }
    }

    if (order.length !== this.nodeIds.length) {
      throw new Error(`workflow.dag_invalid: unable to compute topological order for workflow ${this.workflowId}`);
    }

    return order;
  }

  getWorkflowId(): string {
    return this.workflowId;
  }

  getNodeIds(): string[] {
    return [...this.nodeIds];
  }

  getExecutionOrder(): string[] {
    return [...this.executionOrder];
  }

  getRunnableNodeIds(completedNodeIds: string[]): string[] {
    const completed = new Set(sortedUnique(completedNodeIds));

    return this.nodeIds
      .filter((nodeId) => {
        if (completed.has(nodeId)) {
          return false;
        }

        const node = this.nodeById.get(nodeId);
        if (!node) {
          return false;
        }

        const dependencies = sortedUnique(node.dependsOn ?? []);
        return dependencies.every((dependency) => completed.has(dependency));
      })
      .sort((left, right) => left.localeCompare(right));
  }

  getRunnableNodes(completedNodeIds: string[]): RunnableNode[] {
    return this.getRunnableNodeIds(completedNodeIds).map((nodeId) => {
      const node = this.nodeById.get(nodeId);
      if (!node) {
        throw new Error(`workflow.node_not_found: ${nodeId}`);
      }

      return {
        id: node.id,
        task: node.task,
        ...(node.agent ? { agent: node.agent } : {}),
        dependsOn: sortedUnique(node.dependsOn ?? []),
        ...(node.phase ? { phase: node.phase } : {})
      };
    });
  }

  isComplete(completedNodeIds: string[]): boolean {
    const completed = new Set(sortedUnique(completedNodeIds));
    return this.nodeIds.every((nodeId) => completed.has(nodeId));
  }
}
