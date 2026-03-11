import type { TeamSwarmLifecycleState } from './team-swarm-types.ts';

export function evaluateTeamSwarmState(input: {
  activated: boolean;
  readiness: 'pending' | 'analyzing' | 'coherent' | 'blocked';
  completionSatisfied: boolean;
  linkedInvestigationCount: number;
  hasInFlightInvestigations: boolean;
  unresolvedConflictCount: number;
}): TeamSwarmLifecycleState {
  // Deterministic precedence: inactive < completed < stabilizing < progressing < activated.
  if (!input.activated) {
    return 'inactive';
  }
  if (input.completionSatisfied) {
    return 'completed';
  }
  if (input.unresolvedConflictCount > 0 || input.readiness === 'blocked' || input.readiness === 'coherent') {
    return 'stabilizing';
  }
  if (input.hasInFlightInvestigations || input.linkedInvestigationCount > 0 || input.readiness === 'analyzing') {
    return 'progressing';
  }
  return 'activated';
}
