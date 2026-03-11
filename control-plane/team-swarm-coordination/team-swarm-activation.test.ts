import { describe, expect, it } from 'vitest';

import { evaluateTeamSwarmActivation } from './team-swarm-activation.ts';

describe('team swarm activation', () => {
  it('T-TS-A1 activates on escalated conditions with deterministic reasons', () => {
    const result = evaluateTeamSwarmActivation({
      teamId: 'defi-risk-team',
      swarmId: 'protocol-risk-response',
      teamEnabled: true,
      linkedInvestigationCount: 2,
      unresolvedConflictCount: 1,
      hasInvestigationFailure: false,
      teamCoordinationReadiness: 'engaged',
      teamPriority: 'high',
      cohortEscalationStates: ['none', 'escalated']
    });

    expect(result.activated).toBe(true);
    expect(result.reasons).toEqual([
      'cohort_escalation_detected',
      'linked_investigations:2',
      'synthesis_conflicts:1',
      'team_coordination:engaged',
      'team_priority:high'
    ]);
  });

  it('T-TS-A2 remains inactive when no activation conditions are met', () => {
    const result = evaluateTeamSwarmActivation({
      teamId: 'defi-risk-team',
      swarmId: 'protocol-risk-response',
      teamEnabled: true,
      linkedInvestigationCount: 0,
      unresolvedConflictCount: 0,
      hasInvestigationFailure: false,
      teamCoordinationReadiness: 'ready',
      teamPriority: 'normal',
      cohortEscalationStates: ['none']
    });

    expect(result).toEqual({
      teamId: 'defi-risk-team',
      swarmId: 'protocol-risk-response',
      activated: false,
      reasons: ['activation_conditions_not_met']
    });
  });
});
