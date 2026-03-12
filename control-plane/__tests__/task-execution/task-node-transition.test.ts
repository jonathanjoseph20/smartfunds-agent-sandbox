import { describe, expect, it } from 'vitest';

import {
  applyTaskNodeTransition,
  assertTaskNodeTransition,
} from '../../task-execution/task-node-transition.ts';

describe('task node transition', () => {
  it('T-MTE-TR1 valid transitions succeed', () => {
    expect(applyTaskNodeTransition({ currentState: 'pending', nextState: 'ready' })).toBe('ready');
    expect(applyTaskNodeTransition({ currentState: 'ready', nextState: 'running' })).toBe('running');
    expect(applyTaskNodeTransition({ currentState: 'running', nextState: 'completed' })).toBe('completed');
  });

  it('T-MTE-TR2 invalid transitions reject with stable error', () => {
    expect(() => assertTaskNodeTransition({ from: 'pending', to: 'running' })).toThrowError('INVALID_TASK_NODE_TRANSITION');
    expect(() => applyTaskNodeTransition({ currentState: 'completed', nextState: 'running' })).toThrowError('INVALID_TASK_NODE_TRANSITION');
  });

  it('T-MTE-TR3 no illegal shortcut transitions are allowed', () => {
    expect(() => applyTaskNodeTransition({ currentState: 'pending', nextState: 'completed' })).toThrowError('INVALID_TASK_NODE_TRANSITION');
  });
});
