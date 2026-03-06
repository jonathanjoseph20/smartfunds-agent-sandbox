export type ExecutionMemoryValue = unknown;

export type ContextUpdates = Record<string, ExecutionMemoryValue>;

export type ExecutionContext = {
  runId: string;
  missionId?: string;
  phase: string;
  taskId: string;
  memory: Record<string, ExecutionMemoryValue>;
  artifacts: string[];
  metadata: Record<string, unknown>;
};

export type JournalContextSnapshot = ExecutionContext;
