import type {
  TeamSwarmCompletionEvaluation,
  TeamSwarmLifecycleState,
  TeamSwarmStatusRecord,
  TeamSwarmTopicProgress
} from './team-swarm-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function evaluateTeamSwarmCompletion(input: {
  teamId: string;
  swarmId: string;
  lifecycle: TeamSwarmLifecycleState;
  completedInvestigationCount: number;
  totalInvestigationCount: number;
  unresolvedConflictCount: number;
  completionSatisfied: boolean;
}): TeamSwarmCompletionEvaluation {
  const unmetRequirements: string[] = [];

  if (input.totalInvestigationCount === 0) {
    unmetRequirements.push('no_linked_investigations');
  }
  if (!input.completionSatisfied) {
    unmetRequirements.push('swarm_completion_rules_unsatisfied');
  }
  if (input.unresolvedConflictCount > 0) {
    unmetRequirements.push('unresolved_conflicts_present');
  }
  if (input.lifecycle !== 'completed') {
    unmetRequirements.push(`lifecycle_not_completed:${input.lifecycle}`);
  }

  return {
    teamId: input.teamId,
    swarmId: input.swarmId,
    isComplete: unmetRequirements.length === 0,
    unmetRequirements: uniqueSorted(unmetRequirements),
    completedInvestigationCount: input.completedInvestigationCount,
    totalInvestigationCount: input.totalInvestigationCount,
    unresolvedConflictCount: input.unresolvedConflictCount
  };
}

export function evaluateTeamTopicProgress(input: {
  teamId: string;
  swarms: TeamSwarmStatusRecord[];
}): TeamSwarmTopicProgress {
  const totalSwarms = input.swarms.length;
  const activatedSwarms = input.swarms.filter((entry) => entry.activation.activated).length;
  const completedSwarms = input.swarms.filter((entry) => entry.completion.isComplete).length;
  const stabilizingSwarms = input.swarms.filter((entry) => entry.lifecycle === 'stabilizing').length;

  if (totalSwarms === 0) {
    return {
      teamId: input.teamId,
      progress: 'pending',
      reasons: ['no_linked_swarms'],
      totalSwarms,
      activatedSwarms,
      completedSwarms,
      stabilizingSwarms
    };
  }

  if (completedSwarms === totalSwarms) {
    return {
      teamId: input.teamId,
      progress: 'stabilized',
      reasons: ['all_linked_swarm_responses_completed'],
      totalSwarms,
      activatedSwarms,
      completedSwarms,
      stabilizingSwarms
    };
  }

  if (stabilizingSwarms > 0) {
    return {
      teamId: input.teamId,
      progress: 'stabilizing',
      reasons: [`stabilizing_swarms:${String(stabilizingSwarms)}`],
      totalSwarms,
      activatedSwarms,
      completedSwarms,
      stabilizingSwarms
    };
  }

  if (activatedSwarms > 0) {
    return {
      teamId: input.teamId,
      progress: 'active',
      reasons: [`active_swarms:${String(activatedSwarms)}`],
      totalSwarms,
      activatedSwarms,
      completedSwarms,
      stabilizingSwarms
    };
  }

  return {
    teamId: input.teamId,
    progress: 'pending',
    reasons: ['awaiting_swarm_activation'],
    totalSwarms,
    activatedSwarms,
    completedSwarms,
    stabilizingSwarms
  };
}
