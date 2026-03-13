import { describe, expect, it } from 'vitest';

import { deriveSystemicStabilizationStrategyClass } from '../../mission-control/systemic-stabilization-strategy.ts';

describe('mission control orchestration strategy derivation', () => {
  it('T-MCO-S1 blocked posture derives dependency relief strategy', () => {
    const strategyClass = deriveSystemicStabilizationStrategyClass({
      projection: {
        intelligenceOutcome: 'systemically_blocked',
        systemicRiskPosture: 'blocked',
        escalationPatterns: [],
        systemicBlockingClusters: [],
      } as never,
      priority: 'critical',
    });

    expect(strategyClass).toBe('dependency_relief_strategy');
  });

  it('T-MCO-S2 governance escalation derives governance resolution strategy', () => {
    const strategyClass = deriveSystemicStabilizationStrategyClass({
      projection: {
        intelligenceOutcome: 'attention_required',
        systemicRiskPosture: 'unstable',
        escalationPatterns: [{ patternClass: 'repeated_governance_block' }],
        systemicBlockingClusters: [],
      } as never,
      priority: 'high',
    });

    expect(strategyClass).toBe('governance_resolution_strategy');
  });
});
