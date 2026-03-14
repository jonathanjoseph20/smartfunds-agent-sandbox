import { describe, expect, it } from 'vitest';

import {
  assertBuildExecutionCanStart,
  deriveBuildExecutionStatus,
} from '../../build-runtime/build-execution-status.ts';

describe('build execution status', () => {
  it('T-PF6-S1 derives draft/ready/running/completed/failed semantics', () => {
    const valid = { validationState: 'valid' as const, missingFields: [], violations: [], warnings: [] };
    const invalid = { validationState: 'invalid' as const, missingFields: ['x'], violations: ['y'], warnings: [] };

    expect(deriveBuildExecutionStatus({ validation: invalid, history: [] })).toBe('draft');
    expect(deriveBuildExecutionStatus({ validation: valid, history: [] })).toBe('ready');
    expect(deriveBuildExecutionStatus({ validation: valid, history: [{ runId: 'r', eventType: 'build_execution_started', payloadHash: 'a', payload: {} }] })).toBe('running');
    expect(deriveBuildExecutionStatus({ validation: valid, history: [{ runId: 'r', eventType: 'build_execution_completed', payloadHash: 'a', payload: {} }] })).toBe('completed');
    expect(deriveBuildExecutionStatus({ validation: valid, history: [{ runId: 'r', eventType: 'build_execution_failed', payloadHash: 'a', payload: {} }] })).toBe('failed');
  });

  it('T-PF6-S2 blocks invalid transition attempts when status is not ready', () => {
    expect(() => assertBuildExecutionCanStart('draft')).toThrow('BUILD_EXECUTION_RUN_NOT_READY: draft');
    expect(() => assertBuildExecutionCanStart('failed')).toThrow('BUILD_EXECUTION_RUN_NOT_READY: failed');
    expect(() => assertBuildExecutionCanStart('ready')).not.toThrow();
  });
});
