import { canonicalStringify, sha256 } from '../../finance/determinism.ts';

import { describe, expect, it } from 'vitest';

import { normalizeGithubEvent } from './normalize.ts';

describe('normalizeGithubEvent', () => {
  it('builds deterministic envelope regardless of payload key ordering', () => {
    const payloadA = {
      repository: { full_name: 'SmartFunds/Sandbox' },
      check_run: {
        name: 'Unit Tests',
        head_sha: 'abc123',
        conclusion: 'failure',
        pull_requests: [{ number: 42 }]
      }
    };

    const payloadB = {
      check_run: {
        pull_requests: [{ number: 42 }],
        conclusion: 'failure',
        head_sha: 'abc123',
        name: 'Unit Tests'
      },
      repository: { full_name: 'SmartFunds/Sandbox' }
    };

    const first = normalizeGithubEvent({
      eventType: 'check_run',
      deliveryId: 'delivery-1',
      payload: payloadA
    });
    const second = normalizeGithubEvent({
      eventType: 'check_run',
      deliveryId: 'delivery-1',
      payload: payloadB
    });

    expect(first.envelope).toEqual(second.envelope);
  });

  it('uses stable defaults for missing optional fields', () => {
    const normalized = normalizeGithubEvent({
      eventType: 'workflow_run',
      deliveryId: 'delivery-2',
      payload: {
        repository: { full_name: 'SmartFunds/Sandbox' },
        workflow_run: {
          name: 'Lint',
          head_sha: 'def456',
          conclusion: 'success'
        }
      }
    });

    expect(normalized.envelope.prNumber).toBeNull();
    expect(normalized.envelope.tier).toBeNull();
    expect(normalized.envelope.executionMode).toBeNull();
    expect(normalized.envelope.entityIds).toEqual([]);
    expect(normalized.envelope.railBindingStatus).toBe('unknown');
  });

  it('computes normalizedHash from envelope excluding normalizedHash itself', () => {
    const normalized = normalizeGithubEvent({
      eventType: 'check_run',
      deliveryId: 'delivery-3',
      payload: {
        repository: { full_name: 'smartfunds/sandbox' },
        check_run: {
          name: 'Unit Tests',
          head_sha: 'abc123',
          conclusion: 'failure',
          pull_requests: [{ number: 42 }]
        }
      }
    });

    const { normalizedHash, ...withoutHash } = normalized.envelope;
    expect(normalizedHash).toBe(sha256(canonicalStringify(withoutHash)));
  });
});
