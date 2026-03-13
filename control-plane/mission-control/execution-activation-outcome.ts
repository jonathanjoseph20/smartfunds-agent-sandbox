import { uniqueSortedStrings } from './mission-execution-activation-identity.ts';
import type {
  ExecutionActivationFeedbackLink,
  ExecutionActivationOutcome,
  ExecutionActivationStatusRecord,
} from './mission-execution-activation-types.ts';

export function deriveExecutionActivationOutcome(input: {
  executionActivationRecordId: string;
  status: ExecutionActivationStatusRecord;
  feedbackLinks: ExecutionActivationFeedbackLink[];
}): ExecutionActivationOutcome {
  const feedbackClasses = input.feedbackLinks.map((entry) => entry.feedbackClass);

  let outcome: ExecutionActivationOutcome['outcome'] = 'pending';

  if (input.status.status === 'inconclusive' || feedbackClasses.includes('execution_inconclusive')) {
    outcome = 'inconclusive';
  } else if (input.status.status === 'activation_failed' || feedbackClasses.includes('execution_failed') || feedbackClasses.includes('execution_blocked')) {
    outcome = 'failed';
  } else if (input.status.status === 'activation_deferred') {
    outcome = 'deferred';
  } else if (input.status.status === 'activation_completed' || feedbackClasses.includes('execution_completed')) {
    outcome = feedbackClasses.includes('execution_started') ? 'partially_completed' : 'completed';
  } else if (input.status.status === 'activation_active' || feedbackClasses.includes('execution_started')) {
    outcome = 'active';
  } else if (input.status.status === 'handoff_submitted' || feedbackClasses.includes('handoff_submitted')) {
    outcome = 'submitted';
  }

  return {
    executionActivationRecordId: input.executionActivationRecordId,
    outcome,
    reasonTokens: uniqueSortedStrings([
      `status:${input.status.status}`,
      `outcome:${outcome}`,
      `feedback_count:${String(input.feedbackLinks.length)}`,
    ]),
  };
}
