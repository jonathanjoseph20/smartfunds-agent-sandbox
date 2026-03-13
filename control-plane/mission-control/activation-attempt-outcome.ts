import { uniqueSortedStrings } from './activation-runtime-integration-identity.ts';
import type {
  ActivationAttemptOutcome,
  ActivationAttemptStatusRecord,
  RuntimeFeedbackIngestionRecord,
} from './activation-runtime-integration-types.ts';

export function deriveActivationAttemptOutcome(input: {
  activationDispatchAttemptId: string;
  status: ActivationAttemptStatusRecord;
  feedbackRecords: RuntimeFeedbackIngestionRecord[];
}): ActivationAttemptOutcome {
  const feedbackClasses = input.feedbackRecords.map((entry) => entry.feedbackClass);

  let outcome: ActivationAttemptOutcome['outcome'] = 'pending';

  if (input.status.status === 'inconclusive' || feedbackClasses.includes('runtime_execution_inconclusive')) {
    outcome = 'inconclusive';
  } else if (input.status.status === 'runtime_failed' || feedbackClasses.includes('runtime_execution_failed') || feedbackClasses.includes('runtime_execution_blocked')) {
    outcome = 'failed';
  } else if (input.status.status === 'runtime_deferred') {
    outcome = 'deferred';
  } else if (input.status.status === 'runtime_completed' || feedbackClasses.includes('runtime_execution_completed')) {
    outcome = feedbackClasses.includes('runtime_execution_started') ? 'partially_completed' : 'completed';
  } else if (input.status.status === 'runtime_active' || feedbackClasses.includes('runtime_execution_started')) {
    outcome = 'active';
  } else if (input.status.status === 'dispatch_submitted' || feedbackClasses.includes('runtime_dispatch_accepted')) {
    outcome = 'submitted';
  }

  return {
    activationDispatchAttemptId: input.activationDispatchAttemptId,
    outcome,
    reasonTokens: uniqueSortedStrings([
      `status:${input.status.status}`,
      `outcome:${outcome}`,
      `feedback_count:${String(input.feedbackRecords.length)}`,
    ]),
  };
}
