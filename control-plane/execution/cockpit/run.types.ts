export type RunStatus = 'created' | 'running' | 'completed' | 'failed';

export type Run = {
  runId: string;
  projectId: string;
  teamId: string;
  goalId: string;
  executionMode: 'structured';
  status: RunStatus;
  attemptIndex: number;
};

export type CreateRunInput = {
  projectId: string;
  teamId: string;
  goalId: string;
};

export type CockpitGoal = {
  goalId: string;
  projectId: string;
  teamId: string;
};
