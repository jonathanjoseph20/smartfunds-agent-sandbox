import type { TeamSwarmActivationEvaluation } from './team-swarm-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function isEscalatedState(value: string): boolean {
  return value === 'elevated' || value === 'escalated' || value === 'critical';
}

export function evaluateTeamSwarmActivation(input: {
  teamId: string;
  swarmId: string;
  teamEnabled: boolean;
  linkedInvestigationCount: number;
  unresolvedConflictCount: number;
  hasInvestigationFailure: boolean;
  teamCoordinationReadiness: string;
  teamPriority: 'low' | 'normal' | 'high' | 'critical';
  cohortEscalationStates: string[];
}): TeamSwarmActivationEvaluation {
  const reasons: string[] = [];

  if (!input.teamEnabled) {
    return {
      teamId: input.teamId,
      swarmId: input.swarmId,
      activated: false,
      reasons: ['team_disabled']
    };
  }

  const hasEscalation = input.cohortEscalationStates.some((state) => isEscalatedState(state));
  if (hasEscalation) {
    reasons.push('cohort_escalation_detected');
  }

  if (input.unresolvedConflictCount > 0) {
    reasons.push(`synthesis_conflicts:${String(input.unresolvedConflictCount)}`);
  }

  if (input.hasInvestigationFailure) {
    reasons.push('investigation_failure_detected');
  }

  if (input.teamPriority === 'high' || input.teamPriority === 'critical') {
    reasons.push(`team_priority:${input.teamPriority}`);
  }

  if (input.teamCoordinationReadiness === 'engaged' || input.teamCoordinationReadiness === 'stabilizing') {
    reasons.push(`team_coordination:${input.teamCoordinationReadiness}`);
  }

  if (input.linkedInvestigationCount > 0) {
    reasons.push(`linked_investigations:${String(input.linkedInvestigationCount)}`);
  }

  const activated = hasEscalation
    || input.unresolvedConflictCount > 0
    || input.hasInvestigationFailure
    || input.teamPriority === 'high'
    || input.teamPriority === 'critical'
    || input.teamCoordinationReadiness === 'engaged'
    || input.teamCoordinationReadiness === 'stabilizing'
    || input.linkedInvestigationCount > 0;

  return {
    teamId: input.teamId,
    swarmId: input.swarmId,
    activated,
    reasons: uniqueSorted(activated ? reasons : ['activation_conditions_not_met'])
  };
}
