import type {
  TeamPriorityEvaluation,
  TeamPriorityRules,
  TeamResponsePriority
} from './team-coordination-types.ts';

const PRIORITY_RANK: Record<TeamResponsePriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3
};

function maxPriority(values: TeamResponsePriority[]): TeamResponsePriority {
  return [...values].sort((left, right) => PRIORITY_RANK[right] - PRIORITY_RANK[left])[0] ?? 'normal';
}

export function evaluateTeamPriority(input: {
  teamId: string;
  priorityRules: TeamPriorityRules;
  hasEscalation: boolean;
  hasInvestigationFailure: boolean;
  hasSynthesisConflict: boolean;
  signalSeverity?: TeamResponsePriority;
}): TeamPriorityEvaluation {
  if (input.hasSynthesisConflict) {
    return {
      teamId: input.teamId,
      priority: input.priorityRules.conflicted,
      reasons: ['synthesis_conflict_detected'],
      appliedRule: 'conflicted'
    };
  }

  if (input.hasEscalation) {
    return {
      teamId: input.teamId,
      priority: input.priorityRules.escalated,
      reasons: ['cohort_escalation_detected'],
      appliedRule: 'escalated'
    };
  }

  if (input.hasInvestigationFailure) {
    return {
      teamId: input.teamId,
      priority: input.priorityRules.failure,
      reasons: ['investigation_failure_detected'],
      appliedRule: 'failure'
    };
  }

  if (input.signalSeverity) {
    return {
      teamId: input.teamId,
      priority: maxPriority(['normal', input.signalSeverity]),
      reasons: [`signal_severity:${input.signalSeverity}`],
      appliedRule: 'signal_severity'
    };
  }

  return {
    teamId: input.teamId,
    priority: 'normal',
    reasons: ['no_priority_escalators_detected'],
    appliedRule: 'default'
  };
}
