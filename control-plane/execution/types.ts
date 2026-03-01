import type { RunState } from './runState.ts';

export interface ExecutionRun {
  runId: string;
  runType: 'swarm';
  projectId: string;
  swarmId: string;
  mode: 'structured' | 'autonomous';
  runIndex: number;
  intent: string;
  argsCanonical: string;
  state: RunState;
  branchName: string;
  prNumber?: number;
  prUrl?: string;
  resultCanonical?: string;
  resultHash?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface ExecutionRunEvent {
  eventId: string;
  runId: string;
  state: RunState;
  payloadCanonical: string;
  payloadHash: string;
  attemptIndex: number;
}
