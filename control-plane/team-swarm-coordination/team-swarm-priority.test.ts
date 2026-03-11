import { describe, expect, it } from 'vitest';

import { evaluateTeamSwarmPriority } from './team-swarm-priority.ts';

describe('team swarm priority', () => {
  it('T-TS-P1 conflict precedence yields critical', () => {
    const result = evaluateTeamSwarmPriority({
      teamId: 'defi-risk-team',
      swarmId: 'protocol-risk-response',
      unresolvedConflictCount: 2,
      hasInvestigationFailure: true,
      readiness: 'blocked',
      cohortEscalationStates: ['critical']
    });

    expect(result.priority).toBe('critical');
    expect(result.appliedRule).toBe('conflicted');
    expect(result.reasons).toEqual(['synthesis_conflicts:2']);
  });

  it('T-TS-P2 default path is deterministic', () => {
    const result = evaluateTeamSwarmPriority({
      teamId: 'defi-risk-team',
      swarmId: 'protocol-risk-response',
      unresolvedConflictCount: 0,
      hasInvestigationFailure: false,
      readiness: 'analyzing',
      cohortEscalationStates: ['none']
    });

    expect(result).toEqual({
      teamId: 'defi-risk-team',
      swarmId: 'protocol-risk-response',
      priority: 'normal',
      reasons: ['no_priority_escalators_detected'],
      appliedRule: 'default'
    });
  });
});
