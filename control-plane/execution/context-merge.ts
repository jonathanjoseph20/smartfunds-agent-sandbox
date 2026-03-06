import type { TaskResult } from '../tasks/task-result.ts';
import type { ContextUpdates, ExecutionContext } from './context-types.ts';
import { createExecutionContext } from './execution-context.ts';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function extractTaskArtifactPaths(taskResult: TaskResult): string[] {
  const paths = taskResult.artifacts
    .map((artifact) => artifact.path)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return sortedUnique(paths);
}

export function mergeContextUpdates(context: ExecutionContext, updates?: ContextUpdates): ExecutionContext {
  if (!updates || Object.keys(updates).length === 0) {
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

  const mergedMemory: Record<string, unknown> = { ...context.memory };

  for (const key of Object.keys(updates).sort((left, right) => left.localeCompare(right))) {
    const value = updates[key];
    if (value !== undefined) {
      mergedMemory[key] = value;
    }
  }

  return createExecutionContext({
    runId: context.runId,
    ...(context.missionId ? { missionId: context.missionId } : {}),
    phase: context.phase,
    taskId: context.taskId,
    memory: mergedMemory,
    artifacts: context.artifacts,
    metadata: context.metadata
  });
}

export function applyTaskResultToContext(context: ExecutionContext, taskResult: TaskResult): ExecutionContext {
  const mergedContext = mergeContextUpdates(context, taskResult.context_updates);
  const artifactPaths = extractTaskArtifactPaths(taskResult);
  if (artifactPaths.length === 0) {
    return mergedContext;
  }

  return createExecutionContext({
    runId: mergedContext.runId,
    ...(mergedContext.missionId ? { missionId: mergedContext.missionId } : {}),
    phase: mergedContext.phase,
    taskId: mergedContext.taskId,
    memory: mergedContext.memory,
    artifacts: sortedUnique([...mergedContext.artifacts, ...artifactPaths]),
    metadata: mergedContext.metadata
  });
}
