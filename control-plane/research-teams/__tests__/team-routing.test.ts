import { describe, expect, it } from 'vitest';

import { routeTeamInvestigation } from '../coordination/team-routing-engine.ts';

describe('team routing engine', () => {
  it('T-RT-CR1 routes deterministically for escalated linked cohort', () => {
    const routed = routeTeamInvestigation({
      teamId: 'defi-risk-team',
      linkedCohortIds: ['aave-risk'],
      cohortEscalationStates: { 'aave-risk': 'escalated' },
      routingRules: [{ cohort: 'aave-risk', investigationTemplate: 'protocol-risk-investigation' }]
    });

    expect(routed).toEqual({
      teamId: 'defi-risk-team',
      investigationTemplate: 'protocol-risk-investigation',
      matchedCohortId: 'aave-risk',
      reason: 'routing_rule_match:aave-risk:escalation_escalated'
    });
  });

  it('T-RT-CR2 chooses first matching rule in canonical policy order', () => {
    const routed = routeTeamInvestigation({
      teamId: 'defi-risk-team',
      linkedCohortIds: ['aave-risk', 'aave-yield'],
      cohortEscalationStates: {
        'aave-risk': 'critical',
        'aave-yield': 'critical'
      },
      routingRules: [
        { cohort: 'aave-risk', investigationTemplate: 'protocol-risk-investigation' },
        { cohort: 'aave-yield', investigationTemplate: 'yield-anomaly-investigation' }
      ]
    });

    expect(routed?.matchedCohortId).toBe('aave-risk');
    expect(routed?.investigationTemplate).toBe('protocol-risk-investigation');
  });

  it('T-RT-CR3 returns null when no escalated routing match exists', () => {
    const routed = routeTeamInvestigation({
      teamId: 'defi-risk-team',
      linkedCohortIds: ['aave-risk'],
      cohortEscalationStates: { 'aave-risk': 'none' },
      routingRules: [{ cohort: 'aave-risk', investigationTemplate: 'protocol-risk-investigation' }]
    });

    expect(routed).toBeNull();
  });
});
