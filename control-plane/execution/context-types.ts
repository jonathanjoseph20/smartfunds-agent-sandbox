import type { AgentExecutionEnvelope } from '../agents/runtime/agent-envelope.ts';

export type ExecutionMemoryValue = unknown;

export type ContextUpdates = Record<string, ExecutionMemoryValue>;

export type ExecutionContext = {
  runId: string;
  missionId?: string;
  teamId?: string;
  phase: string;
  taskId: string;
  memory: Record<string, ExecutionMemoryValue>;
  artifacts: string[];
  metadata: Record<string, unknown>;
  activeAgent?: string;
  agentEnvelope?: AgentExecutionEnvelope;
  agentRoster?: AgentExecutionEnvelope[];
};

export type JournalContextSnapshot = ExecutionContext;
