import { canonicalStringify } from '../finance/determinism.ts';
import type { ExecutionContext } from './context-types.ts';

type CreateExecutionContextInput = {
  runId: string;
  missionId?: string;
  phase: string;
  taskId: string;
  memory?: Record<string, unknown>;
  artifacts?: string[];
  metadata?: Record<string, unknown>;
};

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  const sortedEntries = Object.entries(record)
    .filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.fromEntries(sortedEntries);
}

function stableCloneValue<T>(value: T): T {
  return JSON.parse(canonicalStringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
    return Object.freeze(value);
  }

  if (value !== null && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    for (const key of Object.keys(objectValue)) {
      deepFreeze(objectValue[key]);
    }
    return Object.freeze(value);
  }

  return value;
}

function canonicalizeArtifacts(artifacts: string[]): string[] {
  return [...artifacts].sort((left, right) => left.localeCompare(right));
}

export function createExecutionContext(input: CreateExecutionContextInput): ExecutionContext {
  return {
    runId: input.runId,
    ...(input.missionId ? { missionId: input.missionId } : {}),
    phase: input.phase,
    taskId: input.taskId,
    memory: sortRecord(stableCloneValue(input.memory ?? {})),
    artifacts: canonicalizeArtifacts(input.artifacts ?? []),
    metadata: sortRecord(stableCloneValue(input.metadata ?? {}))
  };
}

export function createEmptyExecutionContext(runId: string): ExecutionContext {
  return createExecutionContext({
    runId,
    phase: 'plan',
    taskId: '__run_start__',
    memory: {},
    artifacts: [],
    metadata: {}
  });
}

export function cloneExecutionContext(context: ExecutionContext): ExecutionContext {
  return createExecutionContext({
    runId: context.runId,
    ...(context.missionId ? { missionId: context.missionId } : {}),
    phase: context.phase,
    taskId: context.taskId,
    memory: context.memory,
    artifacts: context.artifacts,
    metadata: context.metadata
  });
}

export function withExecutionIdentity(
  context: ExecutionContext,
  identity: { phase: string; taskId: string }
): ExecutionContext {
  return createExecutionContext({
    runId: context.runId,
    ...(context.missionId ? { missionId: context.missionId } : {}),
    phase: identity.phase,
    taskId: identity.taskId,
    memory: context.memory,
    artifacts: context.artifacts,
    metadata: context.metadata
  });
}

export function toReadonlyExecutionContext(context: ExecutionContext): Readonly<ExecutionContext> {
  const cloned = cloneExecutionContext(context);
  return deepFreeze(cloned);
}
