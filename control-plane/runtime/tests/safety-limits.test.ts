import { describe, expect, it } from 'vitest';

import {
  evaluateRuntimeSafetyLimits,
  validateRuntimeSafetyLimits
} from '../safety-limits.ts';

describe('runtime safety limits', () => {
  it('T-SL1 validates limit configuration', () => {
    expect(validateRuntimeSafetyLimits({
      maxNodesPerWorkflow: 0,
      maxWorkflowRuntimeSeconds: 0,
      maxRetriesPerNode: 0,
      maxTotalRetriesPerWorkflow: 0,
      maxContextSize: 0
    })).toEqual([
      'Invalid safety limits: maxContextSize must be a positive integer.',
      'Invalid safety limits: maxNodesPerWorkflow must be a positive integer.',
      'Invalid safety limits: maxRetriesPerNode must be a positive integer.',
      'Invalid safety limits: maxTotalRetriesPerWorkflow must be a positive integer.',
      'Invalid safety limits: maxWorkflowRuntimeSeconds must be a positive integer.'
    ]);
  });

  it('T-SL2 reports deterministic violation ordering', () => {
    const violations = evaluateRuntimeSafetyLimits({
      nodeCount: 55,
      runtimeSeconds: 4000,
      retriesByNode: { 'node-b': 4, 'node-a': 4 },
      totalRetries: 30,
      contextSize: 200000,
      limits: {
        maxNodesPerWorkflow: 50,
        maxWorkflowRuntimeSeconds: 3600,
        maxRetriesPerNode: 3,
        maxTotalRetriesPerWorkflow: 25,
        maxContextSize: 100000
      }
    });

    expect(violations.map((entry) => entry.code)).toEqual([
      'CONTEXT_SIZE_EXCEEDED',
      'NODE_LIMIT_EXCEEDED',
      'RETRIES_PER_NODE_EXCEEDED',
      'RETRIES_PER_NODE_EXCEEDED',
      'TOTAL_RETRIES_EXCEEDED',
      'WORKFLOW_RUNTIME_EXCEEDED'
    ]);
  });
});
