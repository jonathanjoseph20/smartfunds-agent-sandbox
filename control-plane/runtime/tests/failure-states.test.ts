import { describe, expect, it } from 'vitest';

import {
  FAILURE_STATE_ERROR_CODES,
  assertWorkflowNodeState,
  assertWorkflowNodeTransition,
  assertWorkflowRunState,
  assertWorkflowRunTransition,
  canTransitionWorkflowNodeState,
  canTransitionWorkflowRunState,
  isWorkflowNodeState,
  isWorkflowRunState
} from '../failure-states.ts';

describe('runtime failure states', () => {
  it('T-FS1 validates canonical node/workflow states', () => {
    expect(isWorkflowNodeState('retrying')).toBe(true);
    expect(isWorkflowNodeState('unknown')).toBe(false);
    expect(isWorkflowRunState('recovering')).toBe(true);
    expect(isWorkflowRunState('paused')).toBe(false);
  });

  it('T-FS2 enforces deterministic transition guards', () => {
    expect(canTransitionWorkflowNodeState('running', 'timeout')).toBe(true);
    expect(canTransitionWorkflowNodeState('completed', 'running')).toBe(false);
    expect(canTransitionWorkflowRunState('running', 'cancelled')).toBe(true);
    expect(canTransitionWorkflowRunState('completed', 'running')).toBe(false);
  });

  it('T-FS3 throws stable errors for invalid values/transitions', () => {
    expect(() => assertWorkflowNodeState('invalid')).toThrow('Invalid workflow node state: invalid');
    expect(() => assertWorkflowRunState('invalid')).toThrow('Invalid workflow state: invalid');

    try {
      assertWorkflowNodeTransition('completed', 'running');
    } catch (error) {
      expect((error as { code: string }).code).toBe(FAILURE_STATE_ERROR_CODES.INVALID_NODE_TRANSITION);
    }

    try {
      assertWorkflowRunTransition('completed', 'running');
    } catch (error) {
      expect((error as { code: string }).code).toBe(FAILURE_STATE_ERROR_CODES.INVALID_RUN_TRANSITION);
    }
  });
});
