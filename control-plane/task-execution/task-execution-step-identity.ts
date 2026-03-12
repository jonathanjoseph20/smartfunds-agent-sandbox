import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { TaskExecutionStepType } from './task-execution-step-types.ts';

function normalizeRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(value)) as Record<string, unknown>;
}

export function deriveTaskExecutionStepId(input: {
  executionEngineRunId: string;
  taskGraphId: string;
  taskNodeId: string | null;
  stepType: TaskExecutionStepType;
  stepInputs: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    executionEngineRunId: input.executionEngineRunId,
    taskGraphId: input.taskGraphId,
    taskNodeId: input.taskNodeId,
    stepType: input.stepType,
    normalizedStepInputs: normalizeRecord(input.stepInputs),
  }));
}

export function deriveTaskExecutionEventDedupeKey(input: {
  executionEngineRunId: string;
  executionAttemptId: string;
  taskGraphId: string;
  eventType: TaskExecutionStepType;
  eventPayload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    executionEngineRunId: input.executionEngineRunId,
    executionAttemptId: input.executionAttemptId,
    taskGraphId: input.taskGraphId,
    eventType: input.eventType,
    eventPayload: normalizeRecord(input.eventPayload),
  }));
}
