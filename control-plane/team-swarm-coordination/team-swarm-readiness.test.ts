import { describe, expect, it } from 'vitest';

import { evaluateTeamSwarmReadiness } from './team-swarm-readiness.ts';

describe('team swarm readiness', () => {
  it('T-TS-R1 blocked takes precedence', () => {
    const result = evaluateTeamSwarmReadiness({
      teamId: 'defi-risk-team',
      swarmId: 'protocol-risk-response',
      activated: true,
      linkedInvestigationCount: 3,
      unresolvedConflictCount: 1,
      hasInvestigationFailure: true,
      swarmReadinessState: 'blocked',
      completionSatisfied: false
    });

    expect(result.readiness).toBe('blocked');
    expect(result.reasons).toEqual([
      'investigation_failure_detected',
      'swarm_readiness_blocked',
      'synthesis_conflicts:1'
    ]);
  });

  it('T-TS-R2 coherent emitted when completion satisfied', () => {
    const result = evaluateTeamSwarmReadiness({
      teamId: 'defi-risk-team',
      swarmId: 'protocol-risk-response',
      activated: true,
      linkedInvestigationCount: 1,
      unresolvedConflictCount: 0,
      hasInvestigationFailure: false,
      swarmReadinessState: 'coherent',
      completionSatisfied: true
    });

    expect(result).toEqual({
      teamId: 'defi-risk-team',
      swarmId: 'protocol-risk-response',
      readiness: 'coherent',
      reasons: ['coherence_conditions_satisfied']
    });
  });
});
