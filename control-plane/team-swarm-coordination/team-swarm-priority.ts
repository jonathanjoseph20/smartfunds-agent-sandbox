import type { TeamSwarmPriority, TeamSwarmPriorityEvaluation } from './team-swarm-types.ts';

const PRIORITY_RANK: Record<TeamSwarmPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3
};

function maxPriority(values: TeamSwarmPriority[]): TeamSwarmPriority {
  return [...values].sort((left, right) => PRIORITY_RANK[right] - PRIORITY_RANK[left])[0] ?? 'normal';
}

function isCriticalEscalationState(value: string): boolean {
  return value === 'critical';
}

function isEscalationState(value: string): boolean {
  return value === 'elevated' || value === 'escalated' || value === 'critical';
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function evaluateTeamSwarmPriority(input: {
  teamId: string;
  swarmId: string;
  unresolvedConflictCount: number;
  hasInvestigationFailure: boolean;
  readiness: 'pending' | 'analyzing' | 'coherent' | 'blocked';
  cohortEscalationStates: string[];
}): TeamSwarmPriorityEvaluation {
  if (input.unresolvedConflictCount > 0) {
    return {
      teamId: input.teamId,
      swarmId: input.swarmId,
      priority: 'critical',
      reasons: [`synthesis_conflicts:${String(input.unresolvedConflictCount)}`],
      appliedRule: 'conflicted'
    };
  }

  if (input.cohortEscalationStates.some((state) => isCriticalEscalationState(state))) {
    return {
      teamId: input.teamId,
      swarmId: input.swarmId,
      priority: 'critical',
      reasons: ['critical_cohort_escalation_detected'],
      appliedRule: 'critical_escalation'
    };
  }

  if (input.cohortEscalationStates.some((state) => isEscalationState(state))) {
    return {
      teamId: input.teamId,
      swarmId: input.swarmId,
      priority: 'high',
      reasons: ['cohort_escalation_detected'],
      appliedRule: 'escalated'
    };
  }

  if (input.hasInvestigationFailure) {
    return {
      teamId: input.teamId,
      swarmId: input.swarmId,
      priority: 'high',
      reasons: ['investigation_failure_detected'],
      appliedRule: 'failure'
    };
  }

  if (input.readiness === 'blocked') {
    return {
      teamId: input.teamId,
      swarmId: input.swarmId,
      priority: 'high',
      reasons: ['swarm_readiness_blocked'],
      appliedRule: 'blocked'
    };
  }

  const priority = maxPriority([input.readiness === 'coherent' ? 'normal' : 'low', 'normal']);
  return {
    teamId: input.teamId,
    swarmId: input.swarmId,
    priority,
    reasons: uniqueSorted(['no_priority_escalators_detected']),
    appliedRule: 'default'
  };
}
