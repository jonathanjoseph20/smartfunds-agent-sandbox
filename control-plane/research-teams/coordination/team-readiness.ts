import type {
  TeamReadinessEvaluation,
  TeamResponsePriority,
  TeamStabilizationState
} from './team-coordination-types.ts';

export function evaluateTeamReadiness(input: {
  teamId: string;
  teamEnabled: boolean;
  hasLinkedCohorts: boolean;
  hasEscalation: boolean;
  activeInvestigationIds: string[];
  priority: TeamResponsePriority;
  stabilizationState: TeamStabilizationState;
}): TeamReadinessEvaluation {
  if (!input.teamEnabled) {
    return {
      teamId: input.teamId,
      readiness: 'blocked',
      reasons: ['team_disabled']
    };
  }

  if (!input.hasLinkedCohorts) {
    return {
      teamId: input.teamId,
      readiness: 'blocked',
      reasons: ['no_linked_cohorts']
    };
  }

  if (input.stabilizationState === 'resolved') {
    return {
      teamId: input.teamId,
      readiness: 'resolved',
      reasons: ['policy_stabilization_conditions_satisfied']
    };
  }

  if (input.stabilizationState === 'stabilizing') {
    return {
      teamId: input.teamId,
      readiness: 'stabilizing',
      reasons: ['stabilization_in_progress']
    };
  }

  if (input.hasEscalation || input.activeInvestigationIds.length > 0 || input.priority === 'high' || input.priority === 'critical') {
    return {
      teamId: input.teamId,
      readiness: 'engaged',
      reasons: ['active_response_required']
    };
  }

  return {
    teamId: input.teamId,
    readiness: 'ready',
    reasons: ['response_ready']
  };
}
