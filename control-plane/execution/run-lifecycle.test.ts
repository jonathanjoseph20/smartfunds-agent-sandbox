import { describe, expect, it } from 'vitest';

import {
  assertValidLifecycleTransition,
  isTerminalLifecycleState,
  type RunLifecycleState
} from './run-lifecycle.ts';

const LEGAL_TRANSITIONS: Array<{ from: RunLifecycleState; to: RunLifecycleState }> = [
  { from: 'CREATED', to: 'RUNNING' },
  { from: 'RUNNING', to: 'SUCCEEDED' },
  { from: 'RUNNING', to: 'FAILED' },
  { from: 'FAILED', to: 'RETRY_SCHEDULED' },
  { from: 'RETRY_SCHEDULED', to: 'RETRY_RUNNING' },
  { from: 'RETRY_RUNNING', to: 'RETRY_SUCCEEDED' },
  { from: 'RETRY_RUNNING', to: 'RETRY_FAILED' }
];

describe('run lifecycle', () => {
  it('allows all legal transitions', () => {
    for (const transition of LEGAL_TRANSITIONS) {
      expect(() => assertValidLifecycleTransition(transition.from, transition.to)).not.toThrow();
    }
  });

  it('rejects illegal transitions with deterministic error code/message', () => {
    expect(() => assertValidLifecycleTransition('CREATED', 'FAILED')).toThrowError(
      'Invalid run lifecycle transition: CREATED -> FAILED'
    );

    try {
      assertValidLifecycleTransition('CREATED', 'FAILED');
    } catch (error) {
      expect((error as { code?: string }).code).toBe('ERR_INVALID_RUN_LIFECYCLE_TRANSITION');
    }
  });

  it('derives terminal states without storing TERMINAL', () => {
    expect(isTerminalLifecycleState('SUCCEEDED')).toBe(true);
    expect(isTerminalLifecycleState('RETRY_SUCCEEDED')).toBe(true);
    expect(isTerminalLifecycleState('RETRY_FAILED')).toBe(true);
    expect(isTerminalLifecycleState('RUNNING')).toBe(false);
  });
});
