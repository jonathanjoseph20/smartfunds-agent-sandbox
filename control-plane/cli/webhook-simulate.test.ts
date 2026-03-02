import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { normalizeGithubEvent } from '../webhooks/github/normalize.ts';
import { simulateGithubWebhook } from './webhook-simulate.ts';

const FIXTURE = 'control-plane/webhooks/github/fixtures/check_run_failure.json';

describe('webhook:simulate', () => {
  it('matches normalizer output exactly', () => {
    const payload = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as unknown;

    const simulated = simulateGithubWebhook({
      eventType: 'check_run',
      deliveryId: 'delivery-cli-1',
      payload
    });

    const normalized = normalizeGithubEvent({
      eventType: 'check_run',
      deliveryId: 'delivery-cli-1',
      payload
    });

    expect(simulated).toBe(canonicalStringify(normalized.envelope));
  });
});
