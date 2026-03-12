export type TaskSchedulingWave = {
  executionEngineRunId: string;
  taskGraphId: string;
  waveIndex: number;
  concurrencyPolicyId: string;
  runnableNodeIds: string[];
  scheduledNodeIds: string[];
  deferredNodeIds: string[];
  availableConcurrencySlots: number;
  consumedConcurrencySlots: number;
};
