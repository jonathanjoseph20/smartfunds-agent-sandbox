import { describe, expect, it } from 'vitest';

import { evaluateTeamSwarmState } from './team-swarm-state.ts';

describe('team swarm state', () => {
  it('T-TS-S1 completed takes precedence over stabilizing/progressing', () => {
    const result = evaluateTeamSwarmState({
      activated: true,
      readiness: 'blocked',
      completionSatisfied: true,
      linkedInvestigationCount: 3,
      hasInFlightInvestigations: true,
      unresolvedConflictCount: 2
    });

    expect(result).toBe('completed');
  });

  it('T-TS-S2 inactive when not activated', () => {
    const result = evaluateTeamSwarmState({
      activated: false,
      readiness: 'pending',
      completionSatisfied: false,
      linkedInvestigationCount: 0,
      hasInFlightInvestigations: false,
      unresolvedConflictCount: 0
    });

    expect(result).toBe('inactive');
  });
});
