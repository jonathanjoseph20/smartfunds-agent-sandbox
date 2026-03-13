import { createActivationDispatchAttempt } from './activation-dispatch-attempt.ts';
import { deriveActivationDispatchQueueEntry } from './activation-dispatch-queue.ts';
import type {
  ActivationDispatchAttempt,
  ActivationDispatchQueueEntry,
  ActivationRuntimeIntegrationHistoryEvent,
  ActivationRuntimeLink,
  RuntimeFeedbackIngestionRecord,
} from './activation-runtime-integration-types.ts';
import type { MissionExecutionActivationProjection } from './mission-execution-activation-types.ts';

export function deriveDispatchAttemptFromActivationProjection(input: {
  activationProjection: MissionExecutionActivationProjection;
}): ActivationDispatchAttempt {
  return createActivationDispatchAttempt({ activationRecord: input.activationProjection.activationRecord });
}

export function deriveDispatchQueueFromRuntimeIntegration(input: {
  dispatchAttempt: ActivationDispatchAttempt;
  runtimeLinks: ActivationRuntimeLink[];
  feedbackRecords: RuntimeFeedbackIngestionRecord[];
  historyEntries: ActivationRuntimeIntegrationHistoryEvent[];
}): ActivationDispatchQueueEntry {
  return deriveActivationDispatchQueueEntry(input);
}
