export type TaskStatus = 'success' | 'failed';

export type TaskResult = {
  status: TaskStatus;
  outputs: Record<string, unknown>;
  artifacts: Array<Record<string, unknown>>;
  logs: string[];
  errorCode?: string;
  errorMessage?: string;
};
