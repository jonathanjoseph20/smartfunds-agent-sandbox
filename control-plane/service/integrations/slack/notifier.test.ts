import { describe, expect, it } from 'vitest';

import type { RunRecord } from '../../../execution/types.ts';
import {
  buildLifecycleNotificationId,
  buildLifecycleSlackMessage,
  isRetryButtonEligible
} from './notifier.ts';

function buildRun(overrides: Partial<RunRecord> = {}): RunRecord {
  const base: RunRecord = {
    runId: 'run-1',
    envelopeHash: 'abcdef1234567890',
    envelopeCanonical: JSON.stringify({
      repo: { owner: 'smartfunds', name: 'sandbox' },
      ref: { base: 'main', head: 'feature/x' },
      policy: { declaredTier: 3, impliedTier: 3 },
      diff: { ownershipStatus: 'ok' }
    }),
    latestState: 'FAILED',
    attempts: [
      {
        attemptIndex: 0,
        attemptId: 'attempt-0',
        latestState: 'FAILED'
      }
    ],
    events: [
      {
        eventId: 'e1',
        eventIndex: 0,
        runId: 'run-1',
        attemptIndex: 0,
        attemptId: 'attempt-0',
        eventType: 'STATE_TRANSITION',
        previousState: 'CREATED',
        nextState: 'RUNNING',
        envelopeHash: 'abcdef1234567890'
      },
      {
        eventId: 'e2',
        eventIndex: 1,
        runId: 'run-1',
        attemptIndex: 0,
        attemptId: 'attempt-0',
        eventType: 'STATE_TRANSITION',
        previousState: 'RUNNING',
        nextState: 'FAILED',
        envelopeHash: 'abcdef1234567890',
        errorClass: 'LINT_FAILURE',
        failureSignature: '1234567890abcdef1234567890abcdef'
      }
    ]
  };

  return { ...base, ...overrides };
}

describe('slack notifier helpers', () => {
  it('shows retry button only when retry is eligible', () => {
    const eligibleRun = buildRun();
    const ineligibleRun = buildRun({
      latestState: 'RETRY_FAILED',
      attempts: [
        ...buildRun().attempts,
        {
          attemptIndex: 1,
          attemptId: 'attempt-1',
          latestState: 'RETRY_FAILED'
        }
      ]
    });

    const eligibleMessage = buildLifecycleSlackMessage(eligibleRun, 'FAILED', {
      retryEligible: isRetryButtonEligible(eligibleRun)
    });
    const ineligibleMessage = buildLifecycleSlackMessage(ineligibleRun, 'RETRY_FAILED', {
      retryEligible: isRetryButtonEligible(ineligibleRun)
    });

    expect(eligibleMessage.blocks.some((block) => block.type === 'actions')).toBe(true);
    expect(ineligibleMessage.blocks.some((block) => block.type === 'actions')).toBe(false);
  });

  it('keeps stable field ordering in message details', () => {
    const run = buildRun();
    const message = buildLifecycleSlackMessage(run, 'FAILED', {
      retryEligible: true,
      serviceBaseUrl: 'http://localhost:3000/'
    });

    const details = (message.blocks[1] as { text?: { text?: string } }).text?.text ?? '';
    const lines = details.split('\n');
    expect(lines).toEqual([
      '- repo/ref: smartfunds/sandbox @ feature/x',
      '- attemptIndex: 0',
      '- errorClass: LINT_FAILURE',
      '- failureSignatureShort: 1234567890ab',
      '- envelopeHashShort: abcdef123456',
      '- links: http://localhost:3000/run/run-1'
    ]);
  });

  it('computes deterministic lifecycle notification ids', () => {
    const first = buildLifecycleNotificationId({ runId: 'run-1', state: 'FAILED', attemptIndex: 0 });
    const second = buildLifecycleNotificationId({ runId: 'run-1', state: 'FAILED', attemptIndex: 0 });
    const different = buildLifecycleNotificationId({ runId: 'run-1', state: 'FAILED', attemptIndex: 1 });

    expect(first).toBe(second);
    expect(first).not.toBe(different);
  });
});
