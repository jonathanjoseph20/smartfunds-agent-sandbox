import type { ErrorClass } from './error-classification.ts';
import type { RunLifecycleState } from './run-lifecycle.ts';

export type RuntimeEventType =
  | 'STATE_TRANSITION'
  | 'ERROR_CLASSIFIED'
  | 'ARTIFACT_LINKED';

export type RuntimeEventArtifacts = {
  prNumber?: number;
  prUrl?: string;
  branchName?: string;
  checkRunUrl?: string;
};

export interface RuntimeEvent {
  eventType: RuntimeEventType;
  previousState?: RunLifecycleState;
  nextState?: RunLifecycleState;
  envelopeHash: string;
  errorClass?: ErrorClass;
  failureSignature?: string;
  resultHash?: string;
  artifactType?: string;
  artifactValue?: string;
  artifacts?: RuntimeEventArtifacts;
}

export interface RunEventRecord extends RuntimeEvent {
  eventId: string;
  eventIndex: number;
  runId: string;
  attemptIndex: number;
  attemptId: string;
}

export interface RunRecord {
  runId: string;
  envelopeHash: string;
  envelopeCanonical: string;
  latestState: RunLifecycleState;
  attempts: Array<{
    attemptIndex: number;
    attemptId: string;
    latestState: RunLifecycleState;
  }>;
  events: RunEventRecord[];
}
