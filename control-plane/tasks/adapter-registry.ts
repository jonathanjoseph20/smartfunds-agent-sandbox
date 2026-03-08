import type { AgentTaskAdapter } from './adapter-interface.ts';
import {
  llmTaskAdapter,
  repoTaskAdapter,
  shellTaskAdapter,
  twitterSearchTaskAdapter,
  webFetchTaskAdapter,
  webSearchTaskAdapter
} from './adapters/index.ts';
import type { TaskType } from './task-types.ts';

const ADAPTERS: readonly AgentTaskAdapter[] = [
  llmTaskAdapter,
  shellTaskAdapter,
  repoTaskAdapter,
  webSearchTaskAdapter,
  webFetchTaskAdapter,
  twitterSearchTaskAdapter
] as const;

const adapterRegistry = new Map<TaskType, AgentTaskAdapter>(
  ADAPTERS.map((adapter) => [adapter.type, adapter])
);

export function getAdapter(taskType: TaskType): AgentTaskAdapter {
  const adapter = adapterRegistry.get(taskType);
  if (!adapter) {
    throw new Error(`ERR_TASK_ADAPTER_NOT_FOUND: ${taskType}`);
  }
  return adapter;
}

export function listRegisteredAdapters(): AgentTaskAdapter[] {
  return [...ADAPTERS].sort((left, right) => left.type.localeCompare(right.type));
}
