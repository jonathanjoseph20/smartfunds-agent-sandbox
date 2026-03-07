import { createExecutionContext } from '../../execution/execution-context.ts';
import type { ExecutionContext } from '../../execution/context-types.ts';
import type { AgentExecutionEnvelope } from './agent-envelope.ts';

export type AgentRuntimeContextInput = {
  teamId?: string;
  activeAgent: string;
  agentEnvelope: AgentExecutionEnvelope;
  agentRoster: AgentExecutionEnvelope[];
};

function sortedRoster(roster: AgentExecutionEnvelope[]): AgentExecutionEnvelope[] {
  return [...roster].sort((left, right) => left.agentId.localeCompare(right.agentId));
}

export function withAgentContext(
  baseContext: ExecutionContext,
  runtimeInfo: AgentRuntimeContextInput
): ExecutionContext {
  const metadata = {
    ...baseContext.metadata,
    teamId: runtimeInfo.teamId ?? baseContext.teamId ?? baseContext.metadata.teamId,
    agentId: runtimeInfo.activeAgent,
    ...(runtimeInfo.agentEnvelope.role ? { agentRole: runtimeInfo.agentEnvelope.role } : {})
  };

  return createExecutionContext({
    runId: baseContext.runId,
    ...(baseContext.missionId ? { missionId: baseContext.missionId } : {}),
    ...(runtimeInfo.teamId || baseContext.teamId ? { teamId: runtimeInfo.teamId ?? baseContext.teamId } : {}),
    phase: baseContext.phase,
    taskId: baseContext.taskId,
    memory: baseContext.memory,
    artifacts: baseContext.artifacts,
    metadata,
    activeAgent: runtimeInfo.activeAgent,
    agentEnvelope: runtimeInfo.agentEnvelope,
    agentRoster: sortedRoster(runtimeInfo.agentRoster)
  });
}

export function getActiveAgentFromContext(context: ExecutionContext): string | undefined {
  return context.activeAgent;
}
