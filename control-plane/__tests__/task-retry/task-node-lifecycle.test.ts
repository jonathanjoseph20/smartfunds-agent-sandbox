import { describe, expect, it } from 'vitest';

import {
  applyTaskNodeLifecycleTransition,
  assertTaskNodeLifecycleTransition,
} from '../../task-execution/task-node-lifecycle.ts';

describe('task node lifecycle', () => {
  it('T-MTE-NL1 accepts sprint 6.3 transitions', () => {
    expect(applyTaskNodeLifecycleTransition({ currentState: 'running', nextState: 'failed' })).toBe('failed');
    expect(applyTaskNodeLifecycleTransition({ currentState: 'failed', nextState: 'retrying' })).toBe('retrying');
    expect(applyTaskNodeLifecycleTransition({ currentState: 'retrying', nextState: 'ready' })).toBe('ready');
    expect(applyTaskNodeLifecycleTransition({ currentState: 'pending', nextState: 'blocked' })).toBe('blocked');
  });

  it('T-MTE-NL2 rejects invalid transitions with stable error code', () => {
    expect(() => assertTaskNodeLifecycleTransition({ from: 'ready', to: 'completed' })).toThrowError('INVALID_TASK_NODE_TRANSITION');
    expect(() => applyTaskNodeLifecycleTransition({ currentState: 'failed', nextState: 'completed' })).toThrowError('INVALID_TASK_NODE_TRANSITION');
  });
});
