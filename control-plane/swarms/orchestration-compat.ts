import type { ExecutionMode } from './types.ts';
import type { SwarmDependencyEdge } from './orchestration-graph.ts';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function sortEdges(edges: SwarmDependencyEdge[]): SwarmDependencyEdge[] {
  return [...edges].sort((left, right) => {
    const from = left.from.localeCompare(right.from);
    if (from !== 0) {
      return from;
    }
    return left.to.localeCompare(right.to);
  });
}

export function evaluateCrossModeDependencyPolicy(params: {
  edges: SwarmDependencyEdge[];
  executionModeBySwarm: Record<string, ExecutionMode>;
  allowsCrossModeDepsBySwarm: Record<string, boolean>;
}): string[] {
  const violations: string[] = [];
  const edges = sortEdges(params.edges);

  for (const edge of edges) {
    const fromMode = params.executionModeBySwarm[edge.from];
    const toMode = params.executionModeBySwarm[edge.to];
    if (!fromMode || !toMode) {
      continue;
    }

    const isCrossMode = fromMode !== toMode;
    const allowOverride = params.allowsCrossModeDepsBySwarm[edge.to] === true;
    if (isCrossMode && !allowOverride) {
      violations.push(
        `orchestration.cross_mode_dependency_denied: from=${edge.from}(${fromMode}) to=${edge.to}(${toMode})`
      );
    }
  }

  return sortedUnique(violations);
}
