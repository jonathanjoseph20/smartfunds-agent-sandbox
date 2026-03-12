import type { ExecutionAttemptEvaluationResult } from './execution-attempt-policy-types.ts';
import type {
  MissionExecutionAttemptHistoryEntry,
  ExecutionAttemptLifecycleState,
  ExecutionAttemptStatus,
} from './execution-attempt-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function hasHistoryEvent(entries: MissionExecutionAttemptHistoryEntry[] | undefined, eventType: string): boolean {
  if (!entries) {
    return false;
  }
  return entries.some((entry) => entry.eventType === eventType);
}

export function deriveExecutionAttemptStatus(input: {
  runtimeEnvelopeEligibility: string;
  runtimeEnvelopeState: string;
  runtimeEnvelopeBlockers: string[];
  runtimeEnvelopeLimitations: string[];
  historyEntries?: MissionExecutionAttemptHistoryEntry[];
}): ExecutionAttemptEvaluationResult {
  const blockers = uniqueSorted(input.runtimeEnvelopeBlockers);
  const limitations = uniqueSorted([
    ...input.runtimeEnvelopeLimitations,
    'execution_attempt_pre_execution_only',
    'execution_attempt_projection_only',
    'execution_attempt_runtime_disabled',
  ]);

  const cancelled = hasHistoryEvent(input.historyEntries, 'execution_attempt_cancelled');
  const created = hasHistoryEvent(input.historyEntries, 'execution_attempt_created');
  const evaluated = hasHistoryEvent(input.historyEntries, 'execution_attempt_status_evaluated');

  let attemptState: ExecutionAttemptStatus = 'inconclusive';

  if (blockers.length > 0 || input.runtimeEnvelopeState === 'blocked' || input.runtimeEnvelopeEligibility === 'blocked') {
    attemptState = 'blocked';
  } else if (input.runtimeEnvelopeEligibility === 'waiting_on_runtime_support') {
    attemptState = 'waiting_on_runtime_support';
  } else if (input.runtimeEnvelopeEligibility === 'incomplete') {
    attemptState = 'incomplete';
  } else if (input.runtimeEnvelopeEligibility === 'eligible') {
    attemptState = 'pending';
  }

  let attemptLifecycleState: ExecutionAttemptLifecycleState = 'created';
  if (created) {
    attemptLifecycleState = 'prepared';
  }
  if (created && evaluated && attemptState === 'pending') {
    attemptLifecycleState = 'ready_for_execution';
  }
  if (cancelled) {
    attemptLifecycleState = 'cancelled';
  }

  return {
    attemptState,
    attemptLifecycleState,
    blockers,
    limitations,
  };
}
