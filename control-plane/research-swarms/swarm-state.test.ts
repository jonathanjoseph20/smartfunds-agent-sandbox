import { describe, expect, it } from 'vitest';

import { evaluateSwarmState } from './swarm-state.ts';

describe('swarm state evaluation', () => {
  it('T-SW-S1 applies deterministic precedence ordering', () => {
    expect(evaluateSwarmState({ investigations: [], syntheses: [], completionSatisfied: false })).toBe('inactive');

    expect(evaluateSwarmState({
      investigations: [{ status: 'completed' }],
      syntheses: [{ readinessState: 'ready', unresolvedConflictCount: 0 }],
      completionSatisfied: true
    })).toBe('completed');

    expect(evaluateSwarmState({
      investigations: [{ status: 'running' }],
      syntheses: [{ readinessState: 'active', unresolvedConflictCount: 1 }],
      completionSatisfied: false
    })).toBe('stabilizing');

    expect(evaluateSwarmState({
      investigations: [{ status: 'running' }],
      syntheses: [{ readinessState: 'active', unresolvedConflictCount: 0 }],
      completionSatisfied: false
    })).toBe('progressing');

    expect(evaluateSwarmState({
      investigations: [{ status: 'running' }],
      syntheses: [],
      completionSatisfied: false
    })).toBe('active');

    expect(evaluateSwarmState({
      investigations: [{ status: 'pending' }],
      syntheses: [],
      completionSatisfied: false
    })).toBe('initializing');
  });
});
