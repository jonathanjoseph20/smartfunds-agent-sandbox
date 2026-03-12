import type { RunnableNodeSet } from './task-runnable-node-set.ts';

import type { TaskConcurrencyPolicy } from './task-concurrency-policy-types.ts';
import type { TaskSchedulingWave } from './task-scheduling-wave-types.ts';
import type { MissionTaskExecutionProjection } from './task-execution-step-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function buildSchedulingWave(input: {
  runnableSet: RunnableNodeSet;
  policy: TaskConcurrencyPolicy;
  projection: MissionTaskExecutionProjection;
}): TaskSchedulingWave {
  const availableConcurrencySlots = Math.max(0, input.policy.maxConcurrentNodes);
  const runnableNodeIds = uniqueSorted(input.runnableSet.runnableNodeIds);
  const scheduledNodeIds = runnableNodeIds.slice(0, availableConcurrencySlots);
  const deferredNodeIds = runnableNodeIds.slice(availableConcurrencySlots);

  return {
    executionEngineRunId: input.projection.executionEngineRunId,
    taskGraphId: input.projection.taskGraphId,
    waveIndex: input.projection.currentWaveIndex + 1,
    concurrencyPolicyId: input.policy.policyId,
    runnableNodeIds,
    scheduledNodeIds,
    deferredNodeIds,
    availableConcurrencySlots,
    consumedConcurrencySlots: scheduledNodeIds.length,
  };
}
