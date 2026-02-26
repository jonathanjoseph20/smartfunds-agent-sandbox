export type ExecutionMode = 'structured' | 'autonomous';

export type SwarmMember = {
  role: string;
  capabilities?: string[];
};

export type SwarmDefinition = {
  swarmId: string;
  project: string;
  team: string;
  executionMode: ExecutionMode;
  parentSwarm?: string;
  members?: SwarmMember[];
};

export type SwarmExecutionPlan = {
  swarmId: string;
  project: string;
  executionMode: ExecutionMode;
  steps: Array<{
    role: string;
    action: string;
    capability?: string;
  }>;
};

export type SwarmExecutionReceipt = {
  swarmId: string;
  project: string;
  executionMode: ExecutionMode;
  results: Array<{
    role: string;
    action: string;
    status: 'ok' | 'error';
  }>;
  linkedIntents?: string[];
};
