import { TASK_TYPES, type TaskType } from '../../tasks/task-types.ts';
import type { AgentExecutionEnvelope } from './agent-envelope.ts';

function isTaskType(value: string): value is TaskType {
  return TASK_TYPES.includes(value as TaskType);
}

export function assertAgentCanUseAdapter(agentEnvelope: AgentExecutionEnvelope, adapterId: string): void {
  if (!isTaskType(adapterId)) {
    throw new Error(`ERR_AGENT_RUNTIME_INVALID: Unsupported adapter identifier: ${adapterId}`);
  }

  if (!agentEnvelope.allowedTools.includes(adapterId)) {
    const allowed = agentEnvelope.allowedTools.join(', ');
    throw new Error(
      `ERR_AGENT_TOOL_FORBIDDEN: Agent ${agentEnvelope.agentId} cannot use adapter ${adapterId}. Allowed adapters: ${allowed}`
    );
  }
}
