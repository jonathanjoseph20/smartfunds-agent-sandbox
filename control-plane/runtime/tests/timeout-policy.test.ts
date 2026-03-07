import { describe, expect, it } from 'vitest';

import {
  evaluateAdapterTimeout,
  evaluateNodeTimeout,
  evaluateWorkflowTimeout,
  validateTimeoutPolicy
} from '../timeout-policy.ts';

describe('runtime timeout policy', () => {
  it('T-TP1 classifies node timeout deterministically', () => {
    const within = evaluateNodeTimeout(30, {
      nodeTimeoutSeconds: 60,
      adapterTimeoutSeconds: 50,
      workflowTimeoutSeconds: 100
    });
    const exceeded = evaluateNodeTimeout(61, {
      nodeTimeoutSeconds: 60,
      adapterTimeoutSeconds: 50,
      workflowTimeoutSeconds: 100
    });

    expect(within).toMatchObject({ timedOut: false, reason: 'WITHIN_LIMIT', code: null });
    expect(exceeded).toMatchObject({ timedOut: true, reason: 'LIMIT_EXCEEDED', code: 'NODE_TIMEOUT' });
  });

  it('T-TP2 classifies adapter/workflow timeout deterministically', () => {
    expect(evaluateAdapterTimeout(11, {
      nodeTimeoutSeconds: 60,
      adapterTimeoutSeconds: 10,
      workflowTimeoutSeconds: 100
    }).code).toBe('ADAPTER_TIMEOUT');

    expect(evaluateWorkflowTimeout(101, {
      nodeTimeoutSeconds: 60,
      adapterTimeoutSeconds: 10,
      workflowTimeoutSeconds: 100
    }).code).toBe('WORKFLOW_TIMEOUT');
  });

  it('T-TP3 validates timeout config', () => {
    expect(validateTimeoutPolicy({
      nodeTimeoutSeconds: 0,
      adapterTimeoutSeconds: -1,
      workflowTimeoutSeconds: 0
    })).toEqual([
      'Invalid timeout config: adapterTimeoutSeconds must be a positive integer.',
      'Invalid timeout config: nodeTimeoutSeconds must be a positive integer.',
      'Invalid timeout config: workflowTimeoutSeconds must be a positive integer.'
    ]);
  });
});
