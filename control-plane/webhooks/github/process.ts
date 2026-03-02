import { MAX_RETRY_ATTEMPTS } from '../../execution/retry.ts';

import { recordNormalizedHash } from './dedupe.ts';
import { normalizeGithubEvent } from './normalize.ts';
import type {
  CiContextResolver,
  CiFailureEnvelope,
  FailureClass,
  RetryTriggerResult,
  SupportedGithubEventType
} from './types.ts';

export type RetryDecision = {
  trigger: boolean;
  reason:
    | 'non_failure_conclusion'
    | 'governance_blocked'
    | 'schema_blocked'
    | 'rail_blocked'
    | 'retry_limit_reached'
    | 'eligible';
};

export function shouldTriggerRetry(input: {
  conclusion: CiFailureEnvelope['conclusion'];
  failureClass: FailureClass;
  retryCount: number;
}): RetryDecision {
  if (input.conclusion !== 'failure') {
    return { trigger: false, reason: 'non_failure_conclusion' };
  }

  if (input.failureClass === 'governance_failure') {
    return { trigger: false, reason: 'governance_blocked' };
  }

  if (input.failureClass === 'schema_failure') {
    return { trigger: false, reason: 'schema_blocked' };
  }

  if (input.failureClass === 'rail_enforcement_failure') {
    return { trigger: false, reason: 'rail_blocked' };
  }

  if (input.retryCount >= MAX_RETRY_ATTEMPTS) {
    return { trigger: false, reason: 'retry_limit_reached' };
  }

  return { trigger: true, reason: 'eligible' };
}

export function processGithubWebhookEvent(input: {
  eventType: SupportedGithubEventType;
  deliveryId: string;
  payload: unknown;
  contextResolver?: CiContextResolver;
  triggerRetry: (args: { runId: string; envelope: CiFailureEnvelope }) => RetryTriggerResult;
}): {
  envelope: CiFailureEnvelope;
  dedupeHit: boolean;
  retry: RetryTriggerResult;
} {
  const normalized = normalizeGithubEvent({
    eventType: input.eventType,
    deliveryId: input.deliveryId,
    payload: input.payload,
    contextResolver: input.contextResolver
  });

  const added = recordNormalizedHash(normalized.envelope.normalizedHash);
  if (!added) {
    return {
      envelope: normalized.envelope,
      dedupeHit: true,
      retry: {
        accepted: false,
        reason: 'duplicate_ignored'
      }
    };
  }

  const retryDecision = shouldTriggerRetry({
    conclusion: normalized.envelope.conclusion,
    failureClass: normalized.envelope.failureClass,
    retryCount: normalized.context.retryCount
  });

  if (!retryDecision.trigger) {
    return {
      envelope: normalized.envelope,
      dedupeHit: false,
      retry: {
        accepted: false,
        reason: retryDecision.reason
      }
    };
  }

  if (!normalized.context.runId) {
    return {
      envelope: normalized.envelope,
      dedupeHit: false,
      retry: {
        accepted: false,
        reason: 'run_not_resolved'
      }
    };
  }

  return {
    envelope: normalized.envelope,
    dedupeHit: false,
    retry: input.triggerRetry({
      runId: normalized.context.runId,
      envelope: normalized.envelope
    })
  };
}
