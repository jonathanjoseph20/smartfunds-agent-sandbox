import type { ExecutionJournal } from './journal.ts';
import type { EnvelopeIdentityV1 } from './envelope.ts';
import { classifyFailure as classifyFailureInternal, type NormalizedFailure } from './error-classification.ts';
import { computeAttemptId, isRetryEligible } from './retry.ts';
import type { RuntimeEvent } from './types.ts';

type RetryResponse = { accepted: boolean; reason?: string; attemptIndex?: number };

type EnvelopeFromStore = EnvelopeIdentityV1;

function parseEnvelope(envelopeCanonical: string): EnvelopeFromStore {
  return JSON.parse(envelopeCanonical) as EnvelopeFromStore;
}

export function createRuntimeService(journal: ExecutionJournal) {
  function createOrGetRun(envelopeIdentity: EnvelopeIdentityV1): { runId: string; envelopeHash: string } {
    return journal.createOrGetRun(envelopeIdentity);
  }

  function appendEvent(runId: string, attemptId: string, event: RuntimeEvent): number {
    return journal.appendEvent(runId, attemptId, event);
  }

  function getRun(runId: string) {
    return journal.getRun(runId);
  }

  function listRuns() {
    return journal.listRuns();
  }

  function classifyFailure(normalizedFailure: NormalizedFailure) {
    return classifyFailureInternal(normalizedFailure);
  }

  function requestRetry(runId: string): RetryResponse {
    const run = journal.getRun(runId);
    if (!run) {
      return { accepted: false, reason: 'RUN_NOT_FOUND' };
    }

    if (run.attempts.some((attempt) => attempt.attemptIndex === 1)) {
      return { accepted: true, attemptIndex: 1 };
    }

    const envelope = parseEnvelope(run.envelopeCanonical);
    const failedEvent = [...run.events]
      .reverse()
      .find((event) => event.eventType === 'STATE_TRANSITION' && event.attemptIndex === 0 && event.nextState === 'FAILED');

    if (!failedEvent || !failedEvent.errorClass) {
      return { accepted: false, reason: 'NO_RETRYABLE_FAILURE' };
    }

    const retryEligible = isRetryEligible({
      attemptIndex: 0,
      errorClass: failedEvent.errorClass,
      ownershipStatus: envelope.diff.ownershipStatus,
      declaredTier: envelope.policy.declaredTier,
      impliedTier: envelope.policy.impliedTier
    });
    if (!retryEligible) {
      return { accepted: false, reason: 'NOT_ELIGIBLE' };
    }

    const attempt0Id = computeAttemptId(runId, 0);
    const attempt1Id = computeAttemptId(runId, 1);

    if (run.latestState === 'FAILED') {
      appendEvent(runId, attempt0Id, {
        eventType: 'STATE_TRANSITION',
        previousState: 'FAILED',
        nextState: 'RETRY_SCHEDULED',
        envelopeHash: run.envelopeHash,
        errorClass: failedEvent.errorClass,
        failureSignature: failedEvent.failureSignature
      });
    }

    const current = journal.getRun(runId);
    if (current?.latestState === 'RETRY_SCHEDULED') {
      appendEvent(runId, attempt1Id, {
        eventType: 'STATE_TRANSITION',
        previousState: 'RETRY_SCHEDULED',
        nextState: 'RETRY_RUNNING',
        envelopeHash: run.envelopeHash,
        errorClass: failedEvent.errorClass,
        failureSignature: failedEvent.failureSignature
      });
    }

    return { accepted: true, attemptIndex: 1 };
  }

  return {
    createOrGetRun,
    appendEvent,
    getRun,
    listRuns,
    classifyFailure,
    requestRetry
  };
}

export type RuntimeService = ReturnType<typeof createRuntimeService>;
