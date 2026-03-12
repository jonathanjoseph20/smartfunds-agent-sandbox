import type { TaskExecutionStepType } from './task-execution-step-types.ts';
import type { TaskSchedulingWave } from './task-scheduling-wave-types.ts';

export type TaskConcurrencyHistoryEvent = {
  eventType: TaskExecutionStepType;
  eventPayload: Record<string, unknown>;
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function createConcurrencyWaveEvents(input: {
  wave: TaskSchedulingWave;
  attemptIndexByNode: Record<string, number>;
}): TaskConcurrencyHistoryEvent[] {
  const runnableNodeIds = uniqueSorted(input.wave.runnableNodeIds);
  const scheduledNodeIds = uniqueSorted(input.wave.scheduledNodeIds);
  const deferredNodeIds = uniqueSorted(input.wave.deferredNodeIds);

  return [
    {
      eventType: 'concurrency_wave_evaluated',
      eventPayload: {
        executionEngineRunId: input.wave.executionEngineRunId,
        taskGraphId: input.wave.taskGraphId,
        waveIndex: input.wave.waveIndex,
        concurrencyPolicyId: input.wave.concurrencyPolicyId,
        runnableNodeIds,
        scheduledNodeIds,
        deferredNodeIds,
        availableSlots: input.wave.availableConcurrencySlots,
        consumedSlots: input.wave.consumedConcurrencySlots,
      },
    },
    {
      eventType: 'concurrency_slots_allocated',
      eventPayload: {
        executionEngineRunId: input.wave.executionEngineRunId,
        taskGraphId: input.wave.taskGraphId,
        waveIndex: input.wave.waveIndex,
        concurrencyPolicyId: input.wave.concurrencyPolicyId,
        availableSlots: input.wave.availableConcurrencySlots,
        consumedSlots: input.wave.consumedConcurrencySlots,
        scheduledNodeIds,
        deferredNodeIds,
      },
    },
    ...scheduledNodeIds.map((taskNodeId) => ({
      eventType: 'node_scheduled_for_execution' as const,
      eventPayload: {
        executionEngineRunId: input.wave.executionEngineRunId,
        taskGraphId: input.wave.taskGraphId,
        waveIndex: input.wave.waveIndex,
        concurrencyPolicyId: input.wave.concurrencyPolicyId,
        taskNodeId,
        attemptIndex: input.attemptIndexByNode[taskNodeId] ?? 0,
      },
    })),
    ...deferredNodeIds.map((taskNodeId) => ({
      eventType: 'node_deferred_by_concurrency_limit' as const,
      eventPayload: {
        executionEngineRunId: input.wave.executionEngineRunId,
        taskGraphId: input.wave.taskGraphId,
        waveIndex: input.wave.waveIndex,
        concurrencyPolicyId: input.wave.concurrencyPolicyId,
        taskNodeId,
      },
    })),
    {
      eventType: 'concurrency_wave_completed',
      eventPayload: {
        executionEngineRunId: input.wave.executionEngineRunId,
        taskGraphId: input.wave.taskGraphId,
        waveIndex: input.wave.waveIndex,
        concurrencyPolicyId: input.wave.concurrencyPolicyId,
        runnableNodeIds,
        scheduledNodeIds,
        deferredNodeIds,
        availableSlots: input.wave.availableConcurrencySlots,
        consumedSlots: input.wave.consumedConcurrencySlots,
      },
    },
  ];
}
