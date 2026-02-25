export type SwarmMode = 'structured' | 'autonomous';

export type SwarmRole = {
  roleId: string;
  description: string;
};

export type SwarmStep = {
  stepIndex: number;
  roleId: string;
  action: string;
};

export type SwarmDefinition = {
  swarmId: string;
  mode: SwarmMode;
  roles: SwarmRole[];
  steps: SwarmStep[];
};

export type SwarmRunInput = {
  swarmId: string;
  payload: unknown;
};

export type SwarmStepResult = {
  stepIndex: number;
  roleId: string;
  output: unknown;
  outputHash: string;
};

export type SwarmRunResult = {
  runId: string;
  swarmId: string;
  mode: SwarmMode;
  stepResults: SwarmStepResult[];
  chargeIntentReceipt?: unknown;
};
