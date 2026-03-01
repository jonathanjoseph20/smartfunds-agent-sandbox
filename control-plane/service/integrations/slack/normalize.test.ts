import { describe, expect, it } from 'vitest';

import {
  computeSlackWebhookEventId,
  normalizeSlackActionPayload,
  normalizeSlackEventEnvelope
} from './normalize.ts';

describe('slack normalize', () => {
  it('computes stable webhookEventId for semantically identical action payloads', () => {
    const payloadA = {
      type: 'block_actions',
      team: { id: 'T1' },
      user: { id: 'U1' },
      actions: [{ action_id: 'retry_run', value: 'runId:r1' }],
      channel: { id: 'C1' },
      message: { ts: '123.456' }
    };
    const payloadB = {
      message: { ts: '123.456' },
      channel: { id: 'C1' },
      actions: [{ value: 'runId:r1', action_id: 'retry_run' }],
      user: { id: 'U1' },
      team: { id: 'T1' },
      type: 'block_actions'
    };

    const normalizedA = normalizeSlackActionPayload(payloadA);
    const normalizedB = normalizeSlackActionPayload(payloadB);

    const first = computeSlackWebhookEventId({ webhookType: 'slack_actions', normalizedPayload: normalizedA });
    const second = computeSlackWebhookEventId({ webhookType: 'slack_actions', normalizedPayload: normalizedB });

    expect(first).toBe(second);
  });

  it('ignores trigger_id for idempotency hashing', () => {
    const first = computeSlackWebhookEventId({
      webhookType: 'slack_actions',
      normalizedPayload: normalizeSlackActionPayload({
        type: 'block_actions',
        team: { id: 'T1' },
        user: { id: 'U1' },
        actions: [{ action_id: 'retry_run', value: 'runId:r1' }],
        trigger_id: 'trigger-1'
      })
    });

    const second = computeSlackWebhookEventId({
      webhookType: 'slack_actions',
      normalizedPayload: normalizeSlackActionPayload({
        type: 'block_actions',
        team: { id: 'T1' },
        user: { id: 'U1' },
        actions: [{ action_id: 'retry_run', value: 'runId:r1' }],
        trigger_id: 'trigger-2'
      })
    });

    expect(first).toBe(second);
  });

  it('normalizes slack events payload deterministically', () => {
    const normalized = normalizeSlackEventEnvelope({
      type: 'event_callback',
      event_id: 'Ev1',
      event: { type: 'app_mention', user: 'U1', channel: 'C1', ts: '1.2' },
      team_id: 'T1'
    });

    expect(normalized).toEqual({
      type: 'event_callback',
      event_id: 'Ev1',
      team_id: 'T1',
      event: {
        type: 'app_mention',
        user: 'U1',
        channel: 'C1',
        ts: '1.2'
      }
    });
  });
});
