import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetGithubWebhookDedupeForTests } from './dedupe.ts';
import { processGithubWebhookEvent, shouldTriggerRetry } from './process.ts';

describe('shouldTriggerRetry', () => {
  it('blocks non-failure conclusion', () => {
    expect(shouldTriggerRetry({
      conclusion: 'success',
      failureClass: 'unit_test_failure',
      retryCount: 0
    })).toEqual({ trigger: false, reason: 'non_failure_conclusion' });
  });

  it('blocks governance/schema/rail classes', () => {
    expect(shouldTriggerRetry({
      conclusion: 'failure',
      failureClass: 'governance_failure',
      retryCount: 0
    }).trigger).toBe(false);
    expect(shouldTriggerRetry({
      conclusion: 'failure',
      failureClass: 'schema_failure',
      retryCount: 0
    }).trigger).toBe(false);
    expect(shouldTriggerRetry({
      conclusion: 'failure',
      failureClass: 'rail_enforcement_failure',
      retryCount: 0
    }).trigger).toBe(false);
  });

  it('blocks when retry count reached max', () => {
    expect(shouldTriggerRetry({
      conclusion: 'failure',
      failureClass: 'unit_test_failure',
      retryCount: 1
    })).toEqual({ trigger: false, reason: 'retry_limit_reached' });
  });

  it('allows retry for eligible failure', () => {
    expect(shouldTriggerRetry({
      conclusion: 'failure',
      failureClass: 'unit_test_failure',
      retryCount: 0
    })).toEqual({ trigger: true, reason: 'eligible' });
  });
});

describe('processGithubWebhookEvent', () => {
  beforeEach(() => {
    resetGithubWebhookDedupeForTests();
  });

  it('triggers retry once for allowed failure and dedupes replay', () => {
    const triggerRetry = vi.fn(() => ({ accepted: true, reason: 'retry_triggered' }));
    const contextResolver = vi.fn(() => ({
      prNumber: 42,
      tier: 2,
      executionMode: 'structured' as const,
      entityIds: ['entity-1'],
      railBindingStatus: 'ok',
      retryCount: 0,
      runId: 'run-1'
    }));

    const payload = {
      repository: { full_name: 'smartfunds/sandbox' },
      check_run: {
        name: 'Unit Tests',
        head_sha: 'abc123',
        conclusion: 'failure',
        pull_requests: [{ number: 42 }]
      }
    };

    const first = processGithubWebhookEvent({
      eventType: 'check_run',
      deliveryId: 'delivery-1',
      payload,
      contextResolver,
      triggerRetry
    });

    const second = processGithubWebhookEvent({
      eventType: 'check_run',
      deliveryId: 'delivery-1',
      payload,
      contextResolver,
      triggerRetry
    });

    expect(first.retry).toEqual({ accepted: true, reason: 'retry_triggered' });
    expect(second.retry).toEqual({ accepted: false, reason: 'duplicate_ignored' });
    expect(triggerRetry).toHaveBeenCalledTimes(1);
  });

  it('blocks governance failure from retry', () => {
    const triggerRetry = vi.fn(() => ({ accepted: true, reason: 'retry_triggered' }));

    const result = processGithubWebhookEvent({
      eventType: 'check_run',
      deliveryId: 'delivery-2',
      payload: {
        repository: { full_name: 'smartfunds/sandbox' },
        check_run: {
          name: 'Governance Policy',
          head_sha: 'abc123',
          conclusion: 'failure',
          pull_requests: [{ number: 42 }]
        }
      },
      contextResolver: () => ({
        prNumber: 42,
        tier: 2,
        executionMode: 'structured',
        entityIds: [],
        railBindingStatus: 'ok',
        retryCount: 0,
        runId: 'run-1'
      }),
      triggerRetry
    });

    expect(result.retry).toEqual({ accepted: false, reason: 'governance_blocked' });
    expect(triggerRetry).toHaveBeenCalledTimes(0);
  });

  it('blocks retry when retryCount >= 1', () => {
    const triggerRetry = vi.fn(() => ({ accepted: true, reason: 'retry_triggered' }));

    const result = processGithubWebhookEvent({
      eventType: 'workflow_run',
      deliveryId: 'delivery-3',
      payload: {
        repository: { full_name: 'smartfunds/sandbox' },
        workflow_run: {
          name: 'Integration Tests',
          head_sha: 'abc123',
          conclusion: 'failure',
          pull_requests: [{ number: 42 }]
        }
      },
      contextResolver: () => ({
        prNumber: 42,
        tier: 2,
        executionMode: 'autonomous',
        entityIds: [],
        railBindingStatus: 'ok',
        retryCount: 1,
        runId: 'run-1'
      }),
      triggerRetry
    });

    expect(result.retry).toEqual({ accepted: false, reason: 'retry_limit_reached' });
    expect(triggerRetry).toHaveBeenCalledTimes(0);
  });
});
