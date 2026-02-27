import { describe, expect, it } from 'vitest';

import { evaluateCrossModeDependencyPolicy } from './orchestration-compat.ts';

describe('swarm orchestration compatibility', () => {
  it('denies structured dependent on autonomous by default', () => {
    const violations = evaluateCrossModeDependencyPolicy({
      edges: [{ from: 'swarm-a', to: 'swarm-b' }],
      executionModeBySwarm: {
        'swarm-a': 'autonomous',
        'swarm-b': 'structured'
      },
      allowsCrossModeDepsBySwarm: {}
    });

    expect(violations).toEqual([
      'orchestration.cross_mode_dependency_denied: from=swarm-a(autonomous) to=swarm-b(structured)'
    ]);
  });

  it('denies autonomous dependent on structured by default', () => {
    const violations = evaluateCrossModeDependencyPolicy({
      edges: [{ from: 'swarm-a', to: 'swarm-b' }],
      executionModeBySwarm: {
        'swarm-a': 'structured',
        'swarm-b': 'autonomous'
      },
      allowsCrossModeDepsBySwarm: {}
    });

    expect(violations).toEqual([
      'orchestration.cross_mode_dependency_denied: from=swarm-a(structured) to=swarm-b(autonomous)'
    ]);
  });

  it('allows cross-mode dependency when dependent sets override', () => {
    const violations = evaluateCrossModeDependencyPolicy({
      edges: [{ from: 'swarm-a', to: 'swarm-b' }],
      executionModeBySwarm: {
        'swarm-a': 'structured',
        'swarm-b': 'autonomous'
      },
      allowsCrossModeDepsBySwarm: {
        'swarm-b': true
      }
    });

    expect(violations).toEqual([]);
  });
});
