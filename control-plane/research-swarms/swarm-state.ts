import type { SwarmState } from './swarm-types.ts';

interface StateInvestigation {
  status: string;
}

interface StateSynthesis {
  readinessState: string;
  unresolvedConflictCount: number;
}

export function evaluateSwarmState(input: {
  investigations: StateInvestigation[];
  syntheses: StateSynthesis[];
  completionSatisfied: boolean;
}): SwarmState {
  const investigations = [...input.investigations];
  const syntheses = [...input.syntheses];

  const hasInvestigations = investigations.length > 0;
  const hasActiveInvestigations = investigations.some((entry) => (
    entry.status === 'running'
    || entry.status === 'awaiting_data'
    || entry.status === 'scheduled_resume'
    || entry.status === 'retry_pending'
  ));
  const hasProgressSignals = syntheses.some((entry) => (
    entry.readinessState === 'ready'
    || entry.readinessState === 'completed'
    || entry.readinessState === 'incomplete'
    || entry.readinessState === 'inconclusive'
    || entry.readinessState === 'active'
  ));
  const hasUnresolvedConflicts = syntheses.some((entry) => entry.unresolvedConflictCount > 0);

  // Explicit deterministic precedence.
  if (!hasInvestigations) {
    return 'inactive';
  }
  if (input.completionSatisfied) {
    return 'completed';
  }
  if (hasUnresolvedConflicts) {
    return 'stabilizing';
  }
  if (hasProgressSignals) {
    return 'progressing';
  }
  if (hasActiveInvestigations) {
    return 'active';
  }
  return 'initializing';
}
