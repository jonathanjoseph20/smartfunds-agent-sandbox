import type { RunState } from './runState.ts';
import type { ErrorClass } from './error-classification.ts';
import type { RunLifecycleState } from './run-lifecycle.ts';

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

export interface RunJournalEntry {
  eventId: string;
  runId: string;
  attemptIndex: number;
  attemptId: string;
  previousState: RunLifecycleState;
  nextState: RunLifecycleState;
  state: RunLifecycleState;
  errorClass?: ErrorClass;
  failureSignature?: string;
  envelopeHash: string;
  resultHash?: string;
  mutationBranch?: string;
  mutationPrNumber?: number;
}
