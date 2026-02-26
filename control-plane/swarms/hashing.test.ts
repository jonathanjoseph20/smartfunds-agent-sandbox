import { describe, expect, it } from 'vitest';

import { hashSwarmExecutionPlan, hashSwarmExecutionReceipt } from './hashing.ts';
import type { SwarmExecutionPlan, SwarmExecutionReceipt } from './types.ts';

describe('swarms hashing', () => {
  it('hashes equivalent plans deterministically', () => {
    const planA: SwarmExecutionPlan = {
      swarmId: 'dev-team',
      project: 'docs',
      executionMode: 'structured',
      steps: [
        { role: 'planner', action: 'draft plan' },
        { role: 'implementer', action: 'apply changes', capability: 'code' }
      ]
    };

    const planB: SwarmExecutionPlan = {
      project: 'docs',
      executionMode: 'structured',
      swarmId: 'dev-team',
      steps: [
        { action: 'draft plan', role: 'planner' },
        { capability: 'code', action: 'apply changes', role: 'implementer' }
      ]
    };

    expect(hashSwarmExecutionPlan(planA)).toBe(hashSwarmExecutionPlan(planB));
  });

  it('changes hashes when step ordering changes', () => {
    const planA: SwarmExecutionPlan = {
      swarmId: 'dev-team',
      project: 'docs',
      executionMode: 'structured',
      steps: [
        { role: 'planner', action: 'draft plan' },
        { role: 'implementer', action: 'apply changes' }
      ]
    };

    const planB: SwarmExecutionPlan = {
      swarmId: 'dev-team',
      project: 'docs',
      executionMode: 'structured',
      steps: [
        { role: 'implementer', action: 'apply changes' },
        { role: 'planner', action: 'draft plan' }
      ]
    };

    expect(hashSwarmExecutionPlan(planA)).not.toBe(hashSwarmExecutionPlan(planB));
  });

  it('hashes receipts deterministically with linked intents', () => {
    const receiptA: SwarmExecutionReceipt = {
      swarmId: 'dev-team',
      project: 'docs',
      executionMode: 'structured',
      results: [
        { role: 'planner', action: 'draft plan', status: 'ok' },
        { role: 'implementer', action: 'apply changes', status: 'ok' }
      ],
      linkedIntents: ['intent-1', 'intent-2']
    };

    const receiptB: SwarmExecutionReceipt = {
      project: 'docs',
      executionMode: 'structured',
      swarmId: 'dev-team',
      results: [
        { action: 'draft plan', status: 'ok', role: 'planner' },
        { status: 'ok', action: 'apply changes', role: 'implementer' }
      ],
      linkedIntents: ['intent-1', 'intent-2']
    };

    expect(hashSwarmExecutionReceipt(receiptA)).toBe(hashSwarmExecutionReceipt(receiptB));
  });

  it('rejects non-string linked intents', () => {
    const receipt: SwarmExecutionReceipt = {
      swarmId: 'dev-team',
      project: 'docs',
      executionMode: 'structured',
      results: [{ role: 'planner', action: 'draft plan', status: 'ok' }],
      linkedIntents: ['intent-1', '']
    };

    expect(() => hashSwarmExecutionReceipt(receipt)).toThrow(
      /linkedIntents must be an array of non-empty strings/
    );
  });
});
