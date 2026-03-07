import { canonicalStringify } from '../finance/determinism.ts';
import type { ExecutionContext } from './context-types.ts';
import type { AgentExecutionEnvelope } from '../agents/runtime/agent-envelope.ts';

type CreateExecutionContextInput = {
  runId: string;
  missionId?: string;
  teamId?: string;
  phase: string;
  taskId: string;
  memory?: Record<string, unknown>;
  artifacts?: string[];
  metadata?: Record<string, unknown>;
  activeAgent?: string;
  agentEnvelope?: AgentExecutionEnvelope;
  agentRoster?: AgentExecutionEnvelope[];
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

function canonicalizeAgentRoster(roster?: AgentExecutionEnvelope[]): AgentExecutionEnvelope[] | undefined {
  if (!roster) {
    return undefined;
  }

  return [...stableCloneValue(roster)].sort((left, right) => left.agentId.localeCompare(right.agentId));
}

export function createExecutionContext(input: CreateExecutionContextInput): ExecutionContext {
  return {
    runId: input.runId,
    ...(input.missionId ? { missionId: input.missionId } : {}),
    ...(input.teamId ? { teamId: input.teamId } : {}),
    phase: input.phase,
    taskId: input.taskId,
    memory: sortRecord(stableCloneValue(input.memory ?? {})),
    artifacts: canonicalizeArtifacts(input.artifacts ?? []),
    metadata: sortRecord(stableCloneValue(input.metadata ?? {})),
    ...(input.activeAgent ? { activeAgent: input.activeAgent } : {}),
    ...(input.agentEnvelope ? { agentEnvelope: stableCloneValue(input.agentEnvelope) } : {}),
    ...(input.agentRoster ? { agentRoster: canonicalizeAgentRoster(input.agentRoster) } : {})
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
    ...(context.teamId ? { teamId: context.teamId } : {}),
    phase: context.phase,
    taskId: context.taskId,
    memory: context.memory,
    artifacts: context.artifacts,
    metadata: context.metadata,
    ...(context.activeAgent ? { activeAgent: context.activeAgent } : {}),
    ...(context.agentEnvelope ? { agentEnvelope: context.agentEnvelope } : {}),
    ...(context.agentRoster ? { agentRoster: context.agentRoster } : {})
  });
}

export function withExecutionIdentity(
  context: ExecutionContext,
  identity: { phase: string; taskId: string }
): ExecutionContext {
  return createExecutionContext({
    runId: context.runId,
    ...(context.missionId ? { missionId: context.missionId } : {}),
    ...(context.teamId ? { teamId: context.teamId } : {}),
    phase: identity.phase,
    taskId: identity.taskId,
    memory: context.memory,
    artifacts: context.artifacts,
    metadata: context.metadata,
    ...(context.activeAgent ? { activeAgent: context.activeAgent } : {}),
    ...(context.agentEnvelope ? { agentEnvelope: context.agentEnvelope } : {}),
    ...(context.agentRoster ? { agentRoster: context.agentRoster } : {})
  });
}

export function toReadonlyExecutionContext(context: ExecutionContext): Readonly<ExecutionContext> {
  const cloned = cloneExecutionContext(context);
  return deepFreeze(cloned);
}
