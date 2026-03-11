import type { CrossSwarmDefinition } from './cross-swarm-types.ts';
import type { CrossSwarmLinkedSwarm, CrossSwarmCompletionEvaluation } from './cross-swarm-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function evaluateCrossSwarmCompletion(input: {
  definition: CrossSwarmDefinition;
  linkedSwarms: CrossSwarmLinkedSwarm[];
  readinessState: 'pending' | 'analyzing' | 'coherent' | 'blocked';
}): CrossSwarmCompletionEvaluation {
  const totalSwarmCount = input.linkedSwarms.length;
  const completedSwarmCount = input.linkedSwarms.filter((entry) => entry.completionSatisfied).length;
  const blockedSwarmCount = input.linkedSwarms.filter((entry) => entry.readinessState === 'blocked').length;
  const unresolvedConflictCount = input.linkedSwarms.reduce((total, entry) => total + entry.unresolvedConflictCount, 0);

  const unmetRequirements: string[] = [];

  if (totalSwarmCount === 0) {
    unmetRequirements.push('no_linked_swarms');
  }
  if (input.definition.completionRules.requireAllLinkedSwarmsComplete && completedSwarmCount !== totalSwarmCount) {
    unmetRequirements.push(`incomplete_swarms:${String(totalSwarmCount - completedSwarmCount)}`);
  }
  if (input.definition.completionRules.requireNoBlockedSwarms && blockedSwarmCount > 0) {
    unmetRequirements.push(`blocked_swarms:${String(blockedSwarmCount)}`);
  }
  if (input.definition.completionRules.requireNoUnresolvedConflicts && unresolvedConflictCount > 0) {
    unmetRequirements.push(`unresolved_conflicts:${String(unresolvedConflictCount)}`);
  }
  if (input.definition.completionRules.requireCoherentReadiness && input.readinessState !== 'coherent') {
    unmetRequirements.push(`readiness_not_coherent:${input.readinessState}`);
  }

  return {
    crossSwarmId: input.definition.crossSwarmId,
    isComplete: unmetRequirements.length === 0,
    unmetRequirements: uniqueSorted(unmetRequirements),
    completedSwarmCount,
    totalSwarmCount,
    blockedSwarmCount,
    unresolvedConflictCount
  };
}
