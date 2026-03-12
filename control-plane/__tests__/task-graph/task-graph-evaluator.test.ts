import { describe, expect, it } from 'vitest';

import { createTaskGraphEvaluator } from '../../task-graph/task-graph-evaluator.ts';

function createEvaluator(overrides: {
  allowedActions?: string[];
  engineState?: string;
  engineEligibilityState?: string;
  engineBlockingReasons?: string[];
} = {}) {
  const executionEngineProjection = {
    projectOne: () => ({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      engineState: overrides.engineState ?? 'eligible_to_start',
      engineEligibilityState: overrides.engineEligibilityState ?? 'eligible',
      runMode: 'simulation_only',
      runInputs: {
        executionTarget: 'team_runtime',
        allowedActions: overrides.allowedActions ?? ['draft_spec', 'validate_spec'],
      },
      blockingReasons: overrides.engineBlockingReasons ?? [],
      limitations: [],
    }),
    projectAll: () => [],
  };

  const runtimeEnvelopeProjection = {
    projectOne: () => ({
      envelopeState: 'ready_for_runtime',
      envelopeEligibility: 'eligible',
      blockers: [],
      limitations: [],
      runtimeCapabilities: {
        supportsTaskGraph: true,
        supportsRetries: false,
        supportsResourceBinding: false,
        supportsExternalAPIs: false,
        supportsParallelExecution: false,
        supportsAgentInvocation: false,
      },
    }),
  };

  const historyStore = {
    append: () => ({ appended: true }),
  };

  return createTaskGraphEvaluator({
    executionEngineProjection: executionEngineProjection as never,
    runtimeEnvelopeProjection: runtimeEnvelopeProjection as never,
    historyStore: historyStore as never,
  });
}

describe('task graph evaluator', () => {
  it('T-MTG-E1 computes deterministic graph identity for equivalent run data', () => {
    const evaluator = createEvaluator({
      allowedActions: ['b_action', 'a_action'],
    });

    const first = evaluator.evaluateTaskGraph({ executionEngineRunId: 'er-1' });
    const second = evaluator.evaluateTaskGraph({ executionEngineRunId: 'er-1' });

    expect(first.taskGraph.taskGraphId).toBe(second.taskGraph.taskGraphId);
  });

  it('T-MTG-E2 derives initial ready-state from finish_to_start dependencies', () => {
    const evaluator = createEvaluator({
      allowedActions: ['action_one', 'action_two'],
    });

    const result = evaluator.evaluateTaskGraph({ executionEngineRunId: 'er-1' }).taskGraph;
    const readyNodes = result.taskNodes.filter((node) => node.taskState === 'ready');
    const pendingNodes = result.taskNodes.filter((node) => node.taskState === 'pending');

    expect(readyNodes).toHaveLength(1);
    expect(pendingNodes).toHaveLength(1);
    expect(pendingNodes[0]?.blockingReasons.some((reason) => reason.startsWith('dependency_unsatisfied:'))).toBe(true);
  });

  it('T-MTG-E3 marks nodes blocked when upstream execution engine is blocked', () => {
    const evaluator = createEvaluator({
      engineState: 'blocked',
      engineEligibilityState: 'blocked',
      engineBlockingReasons: ['execution_contract_blocked'],
    });

    const result = evaluator.evaluateTaskGraph({ executionEngineRunId: 'er-1' }).taskGraph;

    expect(result.graphState).toBe('blocked');
    expect(result.taskNodes.every((node) => node.taskState === 'blocked')).toBe(true);
    expect(result.blockingReasons).toContain('execution_contract_blocked');
  });
});
