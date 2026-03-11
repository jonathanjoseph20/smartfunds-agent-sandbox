import type { TeamSwarmReadinessEvaluation } from './team-swarm-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function evaluateTeamSwarmReadiness(input: {
  teamId: string;
  swarmId: string;
  activated: boolean;
  linkedInvestigationCount: number;
  unresolvedConflictCount: number;
  hasInvestigationFailure: boolean;
  swarmReadinessState: 'pending' | 'analyzing' | 'coherent' | 'blocked';
  completionSatisfied: boolean;
}): TeamSwarmReadinessEvaluation {
  if (input.unresolvedConflictCount > 0 || input.hasInvestigationFailure || input.swarmReadinessState === 'blocked') {
    return {
      teamId: input.teamId,
      swarmId: input.swarmId,
      readiness: 'blocked',
      reasons: uniqueSorted([
        ...(input.unresolvedConflictCount > 0 ? [`synthesis_conflicts:${String(input.unresolvedConflictCount)}`] : []),
        ...(input.hasInvestigationFailure ? ['investigation_failure_detected'] : []),
        ...(input.swarmReadinessState === 'blocked' ? ['swarm_readiness_blocked'] : [])
      ])
    };
  }

  if (input.completionSatisfied || input.swarmReadinessState === 'coherent') {
    return {
      teamId: input.teamId,
      swarmId: input.swarmId,
      readiness: 'coherent',
      reasons: ['coherence_conditions_satisfied']
    };
  }

  if (input.activated || input.linkedInvestigationCount > 0 || input.swarmReadinessState === 'analyzing') {
    return {
      teamId: input.teamId,
      swarmId: input.swarmId,
      readiness: 'analyzing',
      reasons: ['analysis_in_progress']
    };
  }

  return {
    teamId: input.teamId,
    swarmId: input.swarmId,
    readiness: 'pending',
    reasons: ['awaiting_activation']
  };
}
