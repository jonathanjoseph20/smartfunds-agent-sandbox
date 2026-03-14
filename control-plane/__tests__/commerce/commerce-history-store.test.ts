import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCommerceHistoryStore } from '../../commerce/commerce-history-store.ts';

const tmpRoot = path.join('control-plane', 'tests', 'commerce', 'tmp-commerce-history');
const historyFilePath = path.join(tmpRoot, 'history.json');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('commerce history store', () => {
  it('T-PF8-H1 append-only dedupe deterministic replay-safe', () => {
    const store = createCommerceHistoryStore({ historyFilePath });

    const first = store.appendCommerceEvent({
      chargeIntentId: 'ci-1',
      eventType: 'charge_intent_created',
      payloadHash: 'h1',
      payload: { a: 1 },
    });

    const duplicate = store.appendCommerceEvent({
      chargeIntentId: 'ci-1',
      eventType: 'charge_intent_created',
      payloadHash: 'h1',
      payload: { a: 1 },
    });

    const second = store.appendCommerceEvent({
      chargeIntentId: 'ci-1',
      eventType: 'settlement_logged',
      payloadHash: 'h2',
      payload: { b: 2 },
    });

    expect(first.appended).toBe(true);
    expect(duplicate.appended).toBe(false);
    expect(second.appended).toBe(true);

    const list = store.listCommerceEvents('ci-1');
    expect(list).toHaveLength(2);

    const reloaded = createCommerceHistoryStore({ historyFilePath });
    expect(reloaded.listCommerceEvents('ci-1')).toEqual(list);
  });
});
