import type { MissionExecutionAttempt } from '../execution-attempt/execution-attempt-types.ts';

import type {
  ExecutionJournalEvent,
  ExecutionJournalStatus,
} from './execution-journal-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function hasEvent(events: ExecutionJournalEvent[], eventType: string): boolean {
  return events.some((event) => event.eventType === eventType);
}

export function deriveExecutionJournalStatus(input: {
  executionAttempt?: MissionExecutionAttempt | null;
  events: ExecutionJournalEvent[];
}): ExecutionJournalStatus {
  if (!input.executionAttempt) {
    return {
      journalState: 'blocked',
      blockers: ['execution_attempt_not_found'],
      limitations: ['execution_journal_cannot_resolve_attempt_truth'],
      readinessSignals: [],
    };
  }

  const attempt = input.executionAttempt;
  const attemptBlockers = uniqueSorted(attempt.blockers);
  const blockers = uniqueSorted([
    ...attemptBlockers,
    ...input.events.flatMap((event) => event.blockingReasons),
  ]);

  const baseLimitations = [
    'execution_journal_pre_execution_only',
    'execution_journal_projection_only',
    'execution_journal_runtime_events_not_emitted',
  ];

  const attemptStateLimitations = attempt.attemptState === 'incomplete'
    ? ['execution_journal_attempt_state_incomplete']
    : attempt.attemptState === 'inconclusive'
      ? ['execution_journal_attempt_state_inconclusive']
      : [];

  const limitations = uniqueSorted([
    ...baseLimitations,
    ...attempt.limitations,
    ...input.events.flatMap((event) => event.limitations),
    ...attemptStateLimitations,
  ]);

  const hasCreated = hasEvent(input.events, 'attempt_created');
  const hasPrepared = hasEvent(input.events, 'attempt_prepared');
  const hasReady = hasEvent(input.events, 'attempt_ready_for_execution');
  const hasCancelled = hasEvent(input.events, 'attempt_cancelled');

  let journalState: ExecutionJournalStatus['journalState'] = 'initialized';
  if (blockers.length > 0) {
    journalState = 'blocked';
  } else if (hasCancelled || attempt.attemptLifecycleState === 'cancelled') {
    journalState = 'archived';
  } else if (hasReady && hasCreated) {
    journalState = 'ready_for_runtime_events';
  } else if (hasCreated && (hasPrepared || input.events.length > 1)) {
    journalState = 'collecting';
  }

  const readinessSignals = uniqueSorted([
    hasCreated ? 'attempt_created_recorded' : '',
    hasPrepared ? 'attempt_prepared_recorded' : '',
    hasReady ? 'attempt_ready_for_execution_recorded' : '',
    journalState === 'ready_for_runtime_events' ? 'journal_structurally_ready' : '',
  ].filter((entry) => entry.length > 0));

  return {
    journalState,
    blockers,
    limitations,
    readinessSignals,
  };
}
