import type { TaskExecutionGraphState, TaskExecutionStepType } from './task-execution-step-types.ts';
import type { TaskSchedulingWave } from './task-scheduling-wave-types.ts';

import {
  DEFAULT_TASK_CONCURRENCY_POLICY_ID,
  getTaskConcurrencyPolicy,
} from './task-concurrency-policies.ts';

type HistoryEntry = {
  eventType: TaskExecutionStepType;
  eventPayload: Record<string, unknown>;
};

export type TaskConcurrencyProjection = {
  runnableNodeCount: number;
  scheduledNodeCount: number;
  deferredNodeCount: number;
  concurrencyPolicyId: string;
  maxConcurrentNodes: number;
  activeConcurrencySlots: number;
  availableConcurrencySlots: number;
  currentWaveIndex: number;
  currentWaveNodeIds: string[];
  deferredNodeIds: string[];
  schedulingState: 'single_lane' | 'wave_ready' | 'wave_active' | 'deferred_by_limit' | 'blocked' | 'completed' | 'failed';
  schedulingWaves: TaskSchedulingWave[];
};

function asInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .sort((left, right) => left.localeCompare(right));
}

function sortWaves(waves: TaskSchedulingWave[]): TaskSchedulingWave[] {
  return [...waves].sort((left, right) => {
    const byIndex = left.waveIndex - right.waveIndex;
    if (byIndex !== 0) {
      return byIndex;
    }

    return left.concurrencyPolicyId.localeCompare(right.concurrencyPolicyId);
  });
}

export function deriveTaskConcurrencyProjection(input: {
  historyEntries: HistoryEntry[];
  graphState: TaskExecutionGraphState;
  runningNodeCount: number;
}): TaskConcurrencyProjection {
  const defaultPolicy = getTaskConcurrencyPolicy(DEFAULT_TASK_CONCURRENCY_POLICY_ID);

  let concurrencyPolicyId = defaultPolicy.policyId;
  let maxConcurrentNodes = defaultPolicy.maxConcurrentNodes;
  let runnableNodeCount = 0;
  let scheduledNodeCount = 0;
  let deferredNodeCount = 0;
  let currentWaveIndex = 0;
  let currentWaveNodeIds: string[] = [];
  let deferredNodeIds: string[] = [];
  let availableSlots = defaultPolicy.maxConcurrentNodes;
  let consumedSlots = 0;

  const waveMap = new Map<number, TaskSchedulingWave>();

  for (const entry of input.historyEntries) {
    if (
      entry.eventType !== 'concurrency_wave_evaluated'
      && entry.eventType !== 'concurrency_slots_allocated'
      && entry.eventType !== 'concurrency_wave_completed'
    ) {
      continue;
    }

    const waveIndex = asInteger(entry.eventPayload.waveIndex);
    if (waveIndex === null || waveIndex < 0) {
      continue;
    }

    const policyId = asString(entry.eventPayload.concurrencyPolicyId) ?? concurrencyPolicyId;
    const policy = getTaskConcurrencyPolicy(policyId);

    const runnableNodeIds = stringArray(entry.eventPayload.runnableNodeIds);
    const scheduledNodeIds = stringArray(entry.eventPayload.scheduledNodeIds);
    const deferredWaveNodeIds = stringArray(entry.eventPayload.deferredNodeIds);

    const available = asInteger(entry.eventPayload.availableSlots) ?? policy.maxConcurrentNodes;
    const consumed = asInteger(entry.eventPayload.consumedSlots) ?? scheduledNodeIds.length;

    const wave: TaskSchedulingWave = {
      executionEngineRunId: asString(entry.eventPayload.executionEngineRunId) ?? '',
      taskGraphId: asString(entry.eventPayload.taskGraphId) ?? '',
      waveIndex,
      concurrencyPolicyId: policy.policyId,
      runnableNodeIds,
      scheduledNodeIds,
      deferredNodeIds: deferredWaveNodeIds,
      availableConcurrencySlots: available,
      consumedConcurrencySlots: consumed,
    };

    waveMap.set(waveIndex, wave);

    concurrencyPolicyId = policy.policyId;
    maxConcurrentNodes = policy.maxConcurrentNodes;
    currentWaveIndex = Math.max(currentWaveIndex, waveIndex);
    runnableNodeCount = runnableNodeIds.length;
    scheduledNodeCount = scheduledNodeIds.length;
    deferredNodeCount = deferredWaveNodeIds.length;
    currentWaveNodeIds = [...scheduledNodeIds];
    deferredNodeIds = [...deferredWaveNodeIds];
    availableSlots = available;
    consumedSlots = consumed;
  }

  const activeConcurrencySlots = input.runningNodeCount;
  const availableConcurrencySlots = Math.max(0, maxConcurrentNodes - activeConcurrencySlots);

  let schedulingState: TaskConcurrencyProjection['schedulingState'];
  if (input.graphState === 'completed') {
    schedulingState = 'completed';
  } else if (input.graphState === 'failed') {
    schedulingState = 'failed';
  } else if (input.graphState === 'blocked') {
    schedulingState = 'blocked';
  } else if (deferredNodeCount > 0) {
    schedulingState = 'deferred_by_limit';
  } else if (activeConcurrencySlots > 0 || consumedSlots > 0) {
    schedulingState = 'wave_active';
  } else if (maxConcurrentNodes <= 1) {
    schedulingState = 'single_lane';
  } else {
    schedulingState = 'wave_ready';
  }

  return {
    runnableNodeCount,
    scheduledNodeCount,
    deferredNodeCount,
    concurrencyPolicyId,
    maxConcurrentNodes,
    activeConcurrencySlots,
    availableConcurrencySlots,
    currentWaveIndex,
    currentWaveNodeIds,
    deferredNodeIds,
    schedulingState,
    schedulingWaves: sortWaves([...waveMap.values()]),
  };
}
